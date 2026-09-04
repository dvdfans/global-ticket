/* ═══════════════════════════════════════════════════════════════════════════
 * 自由行套餐模块（机+酒，腾讯文档 + 供应商机+酒 解析入库）
 * ---------------------------------------------------------------------------
 * 本文件为「自由行」独立模块，与宿主 app_main.js 解耦：
 *   - 宿主只需在 index.html 中 <script src="js/free_tour.js"> 即可启用自由行；
 *   - 其它版本（官方版/客服版）不引入本脚本，则完全没有自由行逻辑与渲染；
 *   - 未来可自由组合：接哪个版本就引，不接就不引。
 *
 * 依赖（均为宿主全局，由 core.js / app_main.js 提供）：
 *   esc()  render()  toggleGroup()  closeFilter()  consultCS()
 *   document / window.currentTab / #modalContent / #detailModal
 * ═══════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  // 2026-08-31（与客服版同步）：不再硬覆盖 canSeeSupplier，
  // 改用宿主 core.js 的角色版权限（游客false / 管理员true / 客服按 SUPPLIER_CS_VISIBLE）。
  // 安全性：core.js 先于本文件加载且内部 try/catch + CURRENT_USER 判空，游客态返回 false，不会抛 ReferenceError。
  // 供应商自由行卡片另由 core.js 的 canSeeSupplierFreeTour() 门控，与「供应商代码」权限分离。

  // 任意登录用户判定（权限清单 1.1：机型/餐食/行李 → 全体登录人员可见）
  // _isStaffUser 定义于 app_main.js（本文件之后加载）→ 运行时解析，故用 typeof 守卫；
  // 若宿主缺失该函数的极端情况，降级为 CURRENT_USER 判空（与 app_main.js:_isStaffUser 同口径）。
  function _isStaff() {
    try {
      if (typeof _isStaffUser === 'function') return !!_isStaffUser();
      return !!(typeof CURRENT_USER !== 'undefined' && CURRENT_USER && CURRENT_USER.user);
    } catch (e) { return false; }
  }

  var FreeTour = {
    // 状态（原 app_main.js 的 var JJ）
    JJ: { loaded: false, packages: [] },

    // 2026-08-31（与客服版同步）：①自营自由行 ②供应商自由行（供应商模块上线）
    // 供应商源加载后仍受 canSeeSupplierFreeTour() 门控，游客/其余账号渲染 0 卡。
    sources: [
      'data/jj_packages.json',
      'data/jj_packages_supplier.json'
    ],

    // 分类 Tab 映射（route.country → tab key）
    CAT_TAB: { '韩国': 'korea', '日本': 'japan', '东南亚': 'seasia', '港澳': 'ganga', '国内': 'domestic' },

    // 自由行套餐固定说明（2026-08-26：展示于每个套餐报价详情页「套餐说明」区块）
    FT_NOTES: [
      '本产品酒店房型不可指定，以核销客服实时查询为准。',
      '本产品提供固定航班，用户不可指定，以核销客服回复为准。',
      '本产品提供固定出发日期和往返天数，用户不可指定，以核销客服回复为准。',
      '本产品须2人同行。',
      '本产品按双人入住一间标准间核算价格。若1位成人单独出行，要求单独入住1间房，不提供拼房服务。因此产生的单房差价需额外支付，具体金额请现时咨询。重要提示：如您不接受补足此单房差价，则无法成功预约并出行。',
      '2大1小（2～12周岁）出行，儿童价现询；1大1小出行，大小同价。'
    ],

    // 2026-08-31（与客服版同步）：放开为库内全部供应商代码。
    // 库内实际分布：132×368 / 007×248 / 106×81 / 124×54 / 111×48 / 128×6 / 130×4（共 809 条，全 internal=true）。
    // 注：此白名单只决定「哪些代码进入渲染候选」，是否显示由 canSeeSupplierFreeTour() 决定；自营(_src='self')不受此限制。
    VISIBLE_SUPPLIER_CODES: ['130', '132', '007', '106', '124', '111', '128'],

    /* ── 注入自选酒店组合器样式（自包含，不污染宿主 style.css）────────────── */
    _injectStyle: function () {
      if (document.getElementById('jjSelfBuildStyle')) return;
      var css = ''
        + '.jj-self-build{padding:10px 12px;background:var(--card-bg)}'
        + '.jj-sb-tip{font-size:12px;color:var(--text-secondary);line-height:1.6;margin-bottom:10px;padding:8px 10px;background:var(--tag-bg);border-radius:8px}'
        + '.jj-sb-step{margin-bottom:12px}'
        + '.jj-sb-step-hd{font-size:14px;font-weight:700;margin-bottom:8px;color:var(--text)}'
        + '.jj-sb-flights,.jj-sb-hotels{display:flex;flex-direction:column;gap:8px}'
        + '.jj-sb-flight,.jj-sb-hotel{border:1px solid var(--border);border-radius:10px;padding:10px 12px;cursor:pointer;transition:all .15s;background:var(--bg)}'
        + '.jj-sb-flight.active,.jj-sb-hotel.active{border-color:var(--brand,var(--red));background:var(--brand-soft,#FFF0EE);box-shadow:0 0 0 2px rgba(218,58,44,.15)}'
        + '.jj-sb-f-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}'
        + '.jj-sb-f-route{font-weight:700;font-size:14px;color:var(--text)}'
        + '.jj-sb-f-avail{font-size:12px;color:var(--red);font-weight:600}'
        + '.jj-sb-f-time{font-size:12px;color:var(--text-secondary);margin-bottom:4px}'
        + '.jj-sb-f-price{font-size:13px;font-weight:700;color:var(--red)}'
        + '.jj-sb-h-name{font-weight:600;font-size:14px;color:var(--text);margin-bottom:4px}'
        + '.jj-sb-h-price{font-size:13px;font-weight:700;color:var(--red)}'
        + '.jj-sb-result{margin-top:6px;padding:12px;background:var(--tag-bg);border-radius:10px}'
        + '.jj-sb-sum{font-size:14px;color:var(--text);margin-bottom:10px;text-align:center}'
        + '.jj-sb-sum b{color:var(--red);font-size:16px}'
        + '.jj-sb-gen{width:100%;padding:12px;border:none;border-radius:10px;background:var(--brand,var(--red));color:#fff;font-size:15px;font-weight:700;cursor:pointer}'
        + '.jj-sb-gen:disabled{background:#bbb;cursor:not-allowed}'
        + '.jjd-notes{margin-top:10px;padding:10px 12px;background:var(--tag-bg);border-left:3px solid var(--brand,#FF6A3D);border-radius:6px}'
        + '.jjd-tip{background:var(--brand-light,#FFF0EE);border-left-color:var(--brand,#FF6A3D);margin-top:8px}'
        + '.jjd-notes>b{display:block;font-size:13px;color:var(--text);margin-bottom:6px}'
        + '.jjd-note{font-size:12px;color:var(--text-secondary);line-height:1.7}'
        + '.jjd-price-top{margin:10px 12px 0;padding:10px 12px;background:var(--tag-bg,#FFF0EE);border:1px solid var(--brand,#FF6A3D);border-radius:10px;font-size:14px;color:var(--text-secondary);text-align:center}'
        + '.jjd-price-top b{font-size:24px;color:var(--red);font-weight:800;margin-right:2px}'
        + '.jjd-price-suf{font-size:12px;color:var(--text-secondary);margin-left:4px}'
        + '.jjd-combo-sel{flex:1;min-width:0;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:13px}'
        // 2026-08-24h：组合器 UI 整块隐藏，删除 jjd-combo*/jjd-stepper/jjd-radio/jjd-check 死样式；jjd-combo-sel 保留（航班下拉复用）
        // 2026-08-24g：回溯到自由行标签分组，移除锚定视图/切换条死样式；保留 jj-star（卡片用）
        + '.jj-star{color:#f0a020;font-weight:600;font-size:12px}'
        ;
      var st = document.createElement('style');
      st.id = 'jjSelfBuildStyle';
      st.textContent = css;
      document.head.appendChild(st);
    },

    /* ── 加载（替代原 loadJJ）────────────────────────────────────────────── */
    load: function () {
      var self = this;
      self._injectStyle();
      if (self.JJ.loaded) return;
      // 三源并行：①自营套餐 ②供应商套餐 ③自选酒店组合器（仅自营用）
      // 任一套餐源失败不影响另一源；组合器缺失仅致自选酒店分组不显示（需容错）
      var p1 = fetch(self.sources[0] + '?_=' + Date.now()).then(function (r) { return r.json(); }).catch(function () { return { packages: [] }; });
      var supSrc = self.sources[1];
      var p2 = supSrc ? fetch(supSrc + '?_=' + Date.now()).then(function (r) { return r.json(); }).catch(function () { return { packages: [] }; }) : Promise.resolve({ packages: [] });
      var p3 = fetch('data/jj_selfbuild.json?_=' + Date.now()).then(function (r) { return r.json(); }).catch(function () { return null; });
      var p4 = fetch('data/flight_seats.json?_=' + Date.now()).then(function (r) { return r.json(); }).catch(function () { return {}; });
      Promise.all([p1, p2, p3, p4]).then(function (arr) {
        var selfPk = (arr[0] && arr[0].packages) || [];
        var supPk = (arr[1] && arr[1].packages) || [];
        selfPk.forEach(function (p) { p._src = 'self'; p._keymiss = self._isKeyMissing(p); });
        supPk.forEach(function (p) { p._src = 'supplier'; p._keymiss = self._isKeyMissing(p); });
        // 关键缺失套餐（无价格/去程日期/酒店/航线/航班）：保留在 JJ.packages，由渲染层按登录态决定
        // （游客不可见，内部登录版可见并标注「缺失信息未上线」）；白名单仅作用于「完整」套餐
        supPk = supPk.filter(function (p) {
          if (p._keymiss) return true;
          return self.VISIBLE_SUPPLIER_CODES.indexOf(String(p.supplier)) !== -1;
        });
        self.JJ.packages = selfPk.concat(supPk);
        // 2026-09-04 升级为**日期级**裁剪（原为整包级）：逐个剔除「今天及以前」的班期，
        // 而非「有任一未来日期就保留整包」—— 后者会把已过期班期继续渲染成可选日期。
        // 无日期的待补全行保留（keymiss 照旧）；全部班期过期 → 整卡不渲染。
        var _tm = (function () { var d = new Date(); d.setDate(d.getDate() + 1); var m = d.getMonth() + 1, dd = d.getDate(); return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd; })();
        self.JJ.packages = self.JJ.packages.filter(function (p) {
          var ds = p.dates || [];
          if (!ds.length) return true;
          var keep = [];
          for (var i = 0; i < ds.length; i++) { if (String(ds[i]).slice(0, 10) >= _tm) keep.push(i); }
          if (!keep.length) return false;                    // 全部班期已过期 → 整卡不渲染
          if (keep.length !== ds.length) {
            p.dates = keep.map(function (i) { return ds[i]; });
            if (p.return_dates && p.return_dates.length === ds.length) {
              p.return_dates = keep.map(function (i) { return p.return_dates[i]; });
            }
          }
          return true;
        });
        self.JJ._selfbuild = arr[2] || null;
        self.JJ._seats = arr[3] || {};
        self._buildLinkage();
        self.JJ.loaded = true;
        if (global.render) global.render();   // 加载完成刷新当前视图（自由行 + 自选酒店 分组同屏）
        self.gotoDeepLink();                   // 深链：#ft=子表|日期|天数 → 自动打开对应套餐详情
      }).catch(function () {
        // 极端兜底：两套餐源都挂 → 至少尝试加载自营
        fetch(self.sources[0] + '?_=' + Date.now())
          .then(function (r) { return r.json(); })
          .then(function (d) { (d.packages || []).forEach(function (p) { p._src = 'self'; }); self.JJ.packages = d.packages || []; self._buildLinkage(); self.JJ.loaded = true; if (global.render) global.render(); self.gotoDeepLink(); })
          .catch(function () { self.JJ.loaded = true; });
      });
    },

    /* ── 深链定位：#ft=子表|日期|天数（复制文案末尾链接，打开自动弹详情）── */
    gotoDeepLink: function () {
      try {
        var h = decodeURIComponent(window.location.hash || '');
      } catch (e) { return; }
      var mm = h.match(/#ft=(.+)/);
      if (!mm) return;
      var parts = mm[1].split('|');
      var route = parts[0] || '', date = parts[1] || '', days = parts[2] || '';
      if (!route) return;
      var self = this, idx = -1;
      self.JJ.packages.forEach(function (p, i) {
        if (idx !== -1) return;
        // 2026-08-19: 铁律去供应商名——深链用 route（不含供应商名），sub_sheet 已从 H5 JSON 移除
        if (p.route === route && (!days || (p.days || '') === days)) {
          if (!date || (p.dates || []).indexOf(date) !== -1) idx = i;
        }
      });
      if (idx !== -1) {
        setTimeout(function () {
          var p = self.JJ.packages[idx];
          self.openDetail(idx, date || (p.dates && p.dates[0]) || '');
        }, 350);
      }
    },

    /* ── 按日期取机+酒价（供应商机+酒每个班期价格不同；自由行套餐全期同价则回退 p.price）── */
    price: function (p, date) {
      if (p.price_by_date && date && p.price_by_date[date] != null) return p.price_by_date[date];
      return p.price;
    },
    /* 卡片报价=人均（OTA 起价，默认 2 人拼住：单人机票 + 半间房费）；无组合器数据时回退整包价 */
    perPersonPrice: function (p, date) {
      if (p._src === 'supplier') return this.price(p, date);  // 供应商：套餐价直出，绝不碰 _selfbuild
      var sb = this.JJ._selfbuild;
      if (!sb) return this.price(p, date);
      var f = this._findFlight(p);
      var F = f ? (Number(f.flight_direct) || 0) : 0;
      var hi = this._findHotelIdx(p.hotel, this._selfDest(p));   // 2026-08-31: 按目的地过滤
      var R = hi >= 0 ? (Number(sb.hotels[hi].hotel_total) || 0) : 0;
      if (!F && !R) return this.price(p, date);
      return Math.round(F + R / 2);
    },

    /* ── 广告化自由行卡片（原 jjCard）────────────────────────────────────── */
    card: function (p, date, pi) {
      var self = this;
      var m = 0, day = 0, w = '';
      var isSup = (p._src === 'supplier');
      if (date) {
        m = parseInt(date.slice(5, 7)); day = parseInt(date.slice(8, 10));
        var wk = ['日', '一', '二', '三', '四', '五', '六'];
        var dt = new Date(date);
        w = isNaN(dt.getTime()) ? '' : '（周' + wk[dt.getDay()] + '）';
      }
      // 航班行：紧凑式（对齐普通往返机票 .cf-leg 风格，适配手机浏览）
      // 机场显示=城市+机场 简称（2026-09-01 Howard 定案，抄单机票 app_main.js:425）：
      //   那霸→冲绳那霸、亚庇→沙巴亚庇、济州→济州岛……与单机票卡片逐字一致；
      //   数据字段仍保留「那霸机场」原值（一比一透传），仅展示层归一。航站楼由下方独立字段拼接。
      function _aptShort(a) {
        if (!a) return '';
        var t = String(a)
          .replace(/国际机场/g, '')
          .replace(/机场/g, '')
          .replace(/\s*\([A-Z]{3}\)\s*/g, '')
          .replace(/T\d+/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        var ALIAS = ['浦东=上海浦东', '虹桥=上海虹桥', '萧山=杭州萧山', '禄口=南京禄口',
          '栎社=宁波栎社', '兴东=南通兴东', '硕放=无锡硕放', '凤凰=三亚凤凰',
          '成田=东京成田', '羽田=东京羽田', '仁川=首尔仁川', '金浦=首尔金浦', '金海=釜山金海',
          '关西=大阪关西', '那霸=冲绳那霸', '新千岁=札幌新千岁', '中部=名古屋中部',
          '素万那普=曼谷素万那普', '廊曼=曼谷廊曼', '樟宜=新加坡樟宜', '亚庇=沙巴亚庇',
          '济州=济州岛', '普吉岛=普吉岛'];
        for (var i = 0; i < ALIAS.length; i++) {
          var kv = ALIAS[i].split('=');
          if (t === kv[0] || t.indexOf(kv[0]) !== -1) return kv[1];
        }
        return t;
      }
      var flightHtml = '';
      if (p.flights && p.flights.length) {
        flightHtml = p.flights.map(function (f, idx) {
          var tag = idx === 0 ? '<span class="jj-f-tag">去程</span>' : '<span class="jj-f-tag jj-f-tag-ret">回程</span>';
          var depDate = (idx === 0 ? (p.dep_date || (p.dates && p.dates[0]) || '') : (p.return_date || (p.return_dates && p.return_dates[0]) || ''));
          var dateShort = depDate ? depDate.replace(/^\d{4}-/, '').replace(/-/g, '/') : '';
          // 航站楼：独立字段（全量库一比一透传）优先；字段空时从机场名提取 T{n}（源嵌名归位，值来自源原文，非编造）。
          // _aptShort 已清洗机场名中的 T{n}，此处再拼不会重复——修复嵌名数据下航站楼两头丢失不显示的 BUG。
          var _dtm = String(f.dep_terminal || '') || (String(f.dep_airport || '').match(/T\d+/) || [''])[0];
          var _atm = String(f.arr_terminal || '') || (String(f.arr_airport || '').match(/T\d+/) || [''])[0];
          return '<div class="jj-f-row">'
            + tag
            + '<span class="jj-f-flt">' + esc(f.flight || '') + (dateShort ? ' ' + esc(dateShort) : '') + '</span>'
            + '<span class="jj-f-city">' + esc(_aptShort(f.dep_airport)) + (_dtm ? ' ' + esc(_dtm) : '') + '→' + esc(_aptShort(f.arr_airport)) + (_atm ? ' ' + esc(_atm) : '') + '</span>'
            + '<span class="jj-f-time">' + esc(FreeTour._fmtTime(f.dep_time)) + '-' + esc(FreeTour._fmtTime(f.arr_time)) + (f.arr_next_day ? ' +' + f.arr_next_day : '') + (f.duration ? '（' + esc(f.duration) + '）' : '') + '</span>'
            + '</div>';
        }).join('');
      } else if (p.flight_desc) {
        flightHtml = '<div class="jj-f-desc">' + esc(p.flight_desc) + '</div>';
      }
      // 2026-08-24k（自营）：卡片只渲染「该航班下 13 家自营酒店里 hotel_total 最低的一家」组合；其余 12 家隐藏。
      // 2026-08-26（供应商）：供应商套餐不走 _selfbuild，直接用自身 hotel_details 渲染，不挂「13 家」组合器。
      var sb = isSup ? null : this.JJ._selfbuild;
      var _minHotel = null, _minPer = Infinity;
      var _destCnt = 0;   // 2026-09-01：dest 过滤后的可选酒店数——计数与起价同口径，修「共 N 家可选」不实（全池香港+澳门混计）
      if (sb && sb.hotels && sb.hotels.length) {
        var _f = this._findFlight(p);
        var _F = _f ? (Number(_f.flight_direct) || 0) : 0;
        // 2026-08-31：仅遍历当前套餐目的地(dest)匹配的酒店——香港酒店不得参与澳门套餐起价（Howard 定案）
        var _dest = this._selfDest(p);
        for (var _hi = 0; _hi < sb.hotels.length; _hi++) {
          if (_dest != null && _dest !== '' && sb.hotels[_hi].dest !== _dest) continue;
          _destCnt++;
          var _R = Number(sb.hotels[_hi].hotel_total) || 0;
          var _per = Math.round(_F + _R / 2);
          if (_per < _minPer) { _minPer = _per; _minHotel = sb.hotels[_hi]; }
        }
      }
      // 卡片展示酒店：自营=最低价那家（优先富信息库）；供应商=自身 hotel_details
      var _minHd = _minHotel ? (this._hotelDetailsOf(_minHotel.name) || null) : null;
      var hd = isSup ? (p.hotel_details || null) : (_minHd || p.hotel_details || null);
      var _cardHotelName = (isSup ? (p.hotel_details && p.hotel_details.name) : ((_minHotel && _minHotel.name) || (p.hotel_details && p.hotel_details.name))) || p.hotel || '';
      var hotelHtml = '';
      if (hd) {
        var firstUrl = (hd.urls && hd.urls.length && hd.urls[0].url) || hd.url || '';
        var nm = (hd.display_name || hd.name || '').replace(/(\d+)\/(\d+号店)/g, '$1$2');
        var _en = hd.en_name || '';
        var moreTxt = isSup
          ? '🏨 查看套餐酒店 › <span class="jj-hotel-more-sub">进详情页看全部组合</span>'
          : '🏨 更多酒店组合 › <span class="jj-hotel-more-sub">共 ' + (_destCnt || 1) + ' 家可选 · 进详情页切换</span>';
        hotelHtml = '<div class="jj-hotel">'
          // 2026-08-31：酒店官网链接仅员工端可见（Howard 定案）；游客端酒店名纯文本、不暴露外链
          + ((_isStaff() && firstUrl)
              ? '<div class="jj-hotel-hd"><a class="jj-hotel-name" href="' + esc(firstUrl) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">🏨 ' + esc(nm) + '</a>'
              : '<div class="jj-hotel-hd"><span class="jj-hotel-name">🏨 ' + esc(nm) + '</span>')
          + (_en ? '<span style="font-size:11px;color:var(--color-text-tertiary);margin-left:6px;font-weight:400">' + esc(_en) + '</span>' : '')
          + (hd.star ? '<span class="jj-star">' + esc(hd.star) + '</span>' : '')
          + (p.has_pickup ? '<span class="jj-star" style="color:var(--green);background:#E8F5E9">含接送</span>' : '')
          + '</div>'
          + '<div class="jj-hotel-more" onclick="event.stopPropagation();FreeTour.openDetail(' + (pi === undefined ? '0' : pi) + ',\'' + (date || '') + '\')">'
          + moreTxt + '</div>'
          + '</div>';
      } else if (_cardHotelName) {
        hotelHtml = '<div class="jj-hotel"><div class="jj-hotel-hd"><span class="jj-hotel-name">🏨 ' + esc(_cardHotelName) + '</span></div>'
          + '<div class="jj-hotel-more" onclick="event.stopPropagation();FreeTour.openDetail(' + (pi === undefined ? '0' : pi) + ',\'' + (date || '') + '\')">'
          + '🏨 查看套餐酒店 › <span class="jj-hotel-more-sub">进详情页查看全部组合</span></div>'
          + '</div>';
      }
      var hl = (p.highlights || []).map(function (h) { return '<span class="jj-hl">' + esc(h) + '</span>'; }).join('');
      // 广告横幅
      // 自营 banner：航司+机+酒文案；供应商 banner：航线后紧跟「自由行」标签（放航线后面，按用户定调）
      var banner = '<div class="jj-banner"><div class="jj-banner-bg"></div>'
        + '<div class="jj-banner-t1">' + esc(p.arr || '') + (p.days ? ' · ' + p.days + '天' + (p.nights ? p.nights + '晚' : '') : '') + ' 自由行</div>'
        + (isSup
            ? '<div class="jj-banner-t2">' + esc(p.route || '') + ' <span class="jj-cat-tag">自由行</span>' + (p.flight && p.flights && p.flights[0] ? ' <span class="jj-direct">直飞</span>' : '') + '</div>'
            : '<div class="jj-banner-t2">' + esc(p.route || '') + ' · 东航/上航直飞 · 机+酒一价全包</div>'
              + (p.flight && p.flights && p.flights[0] ? '<span class="jj-direct">直飞</span>' : ''))
        + '</div>';
      var kmBadge = p._keymiss ? '<div class="jj-keymiss">⚠ 缺失信息未上线</div>' : '';
      // 余位徽章：单机票置于卡片底部 meta 区（cf-meta-group，与起价同行），不在航班行内联。
      //   员工登录可见实际余位、游客仅 1-4（fmtSeatsBadge 已按权限处理）；取去程航班余位。
      var _cardSeat = (p.flights && p.flights.length) ? self._seatBadgeForFlight(p.flights[0].flight) : '';
      return '<div class="jj-card" onclick="FreeTour.openDetail(' + (pi === undefined ? '0' : pi) + ',\'' + (date || '') + '\')">'
        + banner
        + kmBadge
        + (flightHtml ? '<div class="jj-flights">' + flightHtml + '</div>' : '')
        + hotelHtml
        + (p.hotel_details && p.hotel_details.tip ? '<div class="jj-tip">💡 ' + esc(p.hotel_details.tip) + '</div>' : '')
        + '<div class="jj-foot2">'
        + (date ? '<span class="jj-date">' + m + '月' + day + '日 ' + w + '</span><span class="jj-retdate">✈ 回程 ' + this.retDateTxt(p, date) + '</span>' : '<span class="jj-date-empty">日期待定</span>')
        + '<span class="jj-foot-right">'
        + (_cardSeat ? '<span class="jj-foot-seat">' + _cardSeat + '</span>' : '')
        + '<span class="jj-price">¥' + ((_minHotel && _minPer !== Infinity) ? _minPer.toLocaleString() : (this.perPersonPrice(p, date) || '—')) + '<span class="jj-price-suffix">/人起</span></span>'
        + '</span>'
        + '</div>'
        + (hl ? '<div class="jj-hls">' + hl + '</div>' : '')
        + '<button class="jj-consult" onclick="event.stopPropagation();FreeTour.openDetail(' + (pi === undefined ? '0' : pi) + ',\'' + (date || '') + '\')">💬 咨询客服</button>'
        + '</div>';
    },

    /* ── 回程日期文本（去程 date → p.return_dates 对应项 → "8月30日（周日）"）── */
    retDateTxt: function (p, date) {
      if (!p || !date) return '';
      var idx = (p.dates || []).indexOf(date);
      var rd = (p.return_dates && p.return_dates[idx]) || '';
      if (!rd) return '';
      var rm = parseInt(rd.slice(5, 7)), rday = parseInt(rd.slice(8, 10));
      var wk = ['日', '一', '二', '三', '四', '五', '六'];
      var dt = new Date(rd);
      var rw = isNaN(dt.getTime()) ? '' : '（周' + wk[dt.getDay()] + '）';
      return rm + '月' + rday + '日 ' + rw;
    },

    /* ── 关键缺失判定 + 余位（全量库 flight_seats.json）── */
    _isKeyMissing: function (p) {
      if (!p) return false;
      if (!p.price) return true;
      if (!(p.dates && p.dates.length)) return true;
      if (!p.hotel) return true;
      if (!p.route) return true;
      if (!(p.flights && p.flights.length)) return true;
      return false;
    },
    /* 余位显示：游客仅 1-4 → 余N；员工(canSeeSupplier)显示实际余位（数字→余N，字面原样） */
    _seatDisp: function (seats) {
      var s = String(seats == null ? '' : seats).trim();
      if (!s) return '';
      var m = s.match(/\d+/);
      if (!m) return '';
      var n = parseInt(m[0], 10);
      if (n >= 1 && n <= 4) return '余' + n;
      return '';
    },
    _seatDispAll: function (seats) {
      var s = String(seats == null ? '' : seats).trim();
      if (!s) return '';
      var l = s.toLowerCase();
      if (l === 'nan' || l === 'na') return '';
      var m = s.match(/\d+/);
      if (m) return '余' + s;
      return s;
    },
    _seatDispRender: function (seats) {
      // 2026-08-31 F2（权限清单§5）：与主站余位口径对齐——任意登录员工可见实际余位（原 canSeeSupplier 仅3人，过严）
      return _isStaff() ? this._seatDispAll(seats) : this._seatDisp(seats);
    },
    fmtSeatsBadge: function (s) {
      var t = this._seatDispRender(s);
      if (!t) return '';
      var n = parseInt(t.replace(/^余/, ''), 10);
      if (!isNaN(n) && n <= 3) return '<span class="seat-badge low">' + t + '</span>';
      return '<span class="seat-badge ok">' + t + '</span>';
    },
    _seatBadgeForFlight: function (flightNo) {
      var seats = this.JJ && this.JJ._seats;
      if (!seats || !flightNo) return '';
      var rec = seats[flightNo];
      if (!rec || !rec.length) return '';
      return this.fmtSeatsBadge(rec[0].seats);
    },
    /* ── 点击卡片打开详情（原 openJjDetail）──────────────────────────────── */
    openDetail: function (pi, date, prefHIdx) {
      var p = this.JJ.packages[pi];
      if (!p) return;
      var curDate = date || (p.dates && p.dates[0]) || '';
      // 2026-08-19: 头部固定布局标记（closeDetail 时移除；机票详情不受影响）
      document.getElementById('modalContent').classList.add('jjd-lock');
      document.getElementById('modalContent').setAttribute('data-pi', pi);
      document.getElementById('modalContent').innerHTML = this.detailHtml(p, curDate, pi);
      document.getElementById('detailModal').classList.add('active');
      // 组合器默认值（1人1间）即时算价；prefHIdx 用于切换航班时保留已选酒店
      var self = this;
      setTimeout(function () {
        if (prefHIdx != null && prefHIdx >= 0) {
          var sel = document.getElementById('comboHotel');
          if (sel && prefHIdx < sel.options.length) sel.selectedIndex = prefHIdx;
        }
        self._recalcCombo();
      }, 0);
    },

    /* ── 详情页（原 jjDetailHtml）────────────────────────────────────────── */
    detailHtml: function (p, curDate, pi) {
      var m = parseInt(curDate.slice(5, 7)), day = parseInt(curDate.slice(8, 10));
      var wk = ['日', '一', '二', '三', '四', '五', '六'];
      var dt = new Date(curDate);
      var w = isNaN(dt.getTime()) ? '' : '（周' + wk[dt.getDay()] + '）';
      var sb = this.JJ._selfbuild;
      var isSup = (p._src === 'supplier');
      // 2026-08-27：S132供应商自由行（supplier==132 且带 hotels 列表）→ 独立渲染分支：
      // 套餐本身即「机+酒一价」组合，hotels[] 为可选酒店/升级项，每项 price 已是直客价(全包)，
      // 与自营组合器(sb.hotels 拆 F+R/2)模型不同，故单独走 cq* 系列函数，不碰 _selfbuild。
      var isChunqiu = isSup && p.hotels && p.hotels.length;
      var cqIdx = isChunqiu ? this._cqDefIdx(p) : -1;
      // 2026-08-26m：详情顶部人均价用「当前选中酒店」的 OTA 起价口径（F+R/2），与卡片/perPersonPrice/_recalcCombo 完全一致；
      // 初值取默认酒店（p.hotel）的 perPersonPrice，避免与切酒店后不一致。
      // S132：直接取选中 hotels 项的直客价（机+酒全包）。
      var _ppTop = isChunqiu ? Number(p.hotels[cqIdx].price) : this.perPersonPrice(p, curDate);
      // 2026-08-24c：酒店富信息优先取 _hotelIndex（已合并 13 家自营组合酒店富信息），回落 p.hotel_details
      var hdFull = this._hotelDetailsOf(p.hotel) || p.hotel_details;
      // 可选去程航班（同一天多起飞时刻可切换）→ 跳到「同酒店·不同航班」套餐，保留已选酒店
      // 下拉菜单形式；按去程航班去重：同一起飞时刻只出 1 项（避免同去程配不同回程产生的重复），标签带去程+回程时刻
      var flightOpts = '', flightChipCount = 0;
      if (!isSup && sb && sb.flights && sb.flights.length) {
        var routeFlights = sb.flights.filter(function (f) { return f.route === p.route; });
        if (!routeFlights.length) routeFlights = sb.flights;
        var seenF1 = {};
        var dedupFlights = routeFlights.filter(function (f) {
          var k = f.flights[0].flight;
          if (seenF1[k]) return false;
          seenF1[k] = true; return true;
        });
        flightChipCount = dedupFlights.length;
        // 2026-08-31：按去程起飞时间升序（Howard 定案）
        dedupFlights.sort(function (a, b) {
          var ta = a.flights[0].dep_time || '99:99', tb = b.flights[0].dep_time || '99:99';
          return ta < tb ? -1 : (ta > tb ? 1 : 0);
        });
        flightOpts = dedupFlights.map(function (f) {
          var f1 = f.flights[0], f2 = f.flights[1];
          var active = (f1.flight === p.flight);
          var label = f1.dep_time + ' ' + f1.flight + ' 起飞·回' + f2.dep_time;
          return '<option value="' + f1.flight + '|' + f2.flight + '"' + (active ? ' selected' : '') + '>' + label + '</option>';
        }).join('');
      }
      // 班期 chips（多日期时显示；当前日期高亮，点击切换详情）
      var dateChips = (p.dates || []).map(function (d) {
        var dm = parseInt(d.slice(5, 7)), dd = parseInt(d.slice(8, 10));
        return '<span class="jjd-chip' + (d === curDate ? ' active' : '') + '" onclick="FreeTour.openDetail(' + this.JJ.packages.indexOf(p) + ',\'' + d + '\')">' + dm + '月' + dd + '日</span>';
      }.bind(this)).join('');
      var hl = (p.highlights || []).map(function (h) { return '<div class="jjd-hl"><span>🎁</span>' + esc(h) + '</div>'; }).join('');
      return '<div class="detail-header jjd-header" style="position:relative">'
        + '<div class="dh-top"><span class="detail-close" onclick="closeDetail()">← 返回</span><span class="detail-x" onclick="closeDetail()">✕</span></div>'
        + '<div class="jjd-title">' + (p.route || '—') + '</div>'
        + '<div class="jjd-sub">' + m + '月' + day + '日 ' + w + ' → 回程 ' + this.retDateTxt(p, curDate) + ' · ' + (p.days ? p.days + '天' : '') + (p.nights ? p.nights + '晚' : '') + ' · 自由行套餐</div>'
        // 2026-08-24i：报价置顶（紧跟标题/副标题，不再放最底部）——人均价口径
        + '<div class="jjd-price-top">人均 <b id="comboPer">¥' + (_ppTop != null ? Number(_ppTop).toLocaleString() : '—') + '</b><span class="jjd-price-suf">/人起 · 机+酒 2人拼住</span></div>'
        + '</div>'
        + '<div class="detail-body">'
        // 可选去程航班（下拉切换起飞时刻）→ 跳到「同酒店·不同航班」套餐，保留已选酒店
        + (flightOpts ? '<div class="jjd-sec"><div class="jjd-sec-t">可选去程航班（' + flightChipCount + '个起飞时刻 · ' + (p.dates && p.dates[0] ? p.dates[0].slice(5).replace('-', '/') + ' 出发' : '') + '）</div><select id="comboFlight" class="jjd-combo-sel" onchange="FreeTour.switchFlight(this.value)">' + flightOpts + '</select></div>' : '')
        // 航班（详情库优先：机场/航站楼/机型/时长/餐食/WiFi）
        + (p.flights && p.flights.length ? '<div class="jjd-sec"><div class="jjd-sec-t">参考航班</div>'
          + p.flights.map(function (f, fidx) {
            // 航站楼：独立字段优先，空则从机场名提取（源嵌名归位）；机场名先清洗 T{n} 防重复显示
            var _dtm = String(f.dep_terminal || '') || (String(f.dep_airport || '').match(/T\d+/) || [''])[0];
            var _atm = String(f.arr_terminal || '') || (String(f.arr_airport || '').match(/T\d+/) || [''])[0];
            var _dname = String(f.dep_airport || '').replace(/T\d+/g, '').replace(/\s+/g, ' ').trim();
            var _aname = String(f.arr_airport || '').replace(/T\d+/g, '').replace(/\s+/g, ' ').trim();
            return '<div class="jjd-flight-card"><div class="jjd-f-hd"><span class="jjd-f-flt">' + esc(f.flight) + '</span>'
              + '<span class="jjd-f-airline">' + esc(f.airline) + '</span><span class="jjd-f-dur">' + esc(f.duration) + '</span></div>'
              + '<div class="jjd-f-row"><span class="jjd-f-air">' + esc(_dname) + (_dtm ? ' ' + esc(_dtm) : '') + '</span>'
              + '<span class="jjd-f-arrow">→</span><span class="jjd-f-air">' + esc(_aname) + (_atm ? ' ' + esc(_atm) : '') + '</span></div>'
              + '<div class="jjd-f-time">' + esc(FreeTour._fmtTime(f.dep_time)) + ' - ' + esc(FreeTour._fmtTime(f.arr_time)) + (f.arr_next_day ? ' +' + f.arr_next_day : '') + '</div>'
              // 2026-08-31：机型/餐食属「外部信息」，按权限清单 1.1 = 全体登录人员可见（原为 canSeeSupplier 仅3人，过严）。
              // _isStaffUser 定义于 app_main.js（本文件之后加载），运行时解析，故用 typeof 守卫。
              + '<div class="jjd-f-tags">' + (_isStaff() && f.aircraft ? '<span>' + esc(f.aircraft) + '</span>' : '')
              + (_isStaff() && f.meal ? '<span>' + esc(f.meal) + '</span>' : '')
              + (f.wifi ? '<span>' + esc(f.wifi) + '</span>' : '')
              + (f.distance ? '<span>航程' + esc(f.distance) + '</span>' : '')
              + (fidx === 0 && FreeTour._seatBadgeForFlight(f.flight) ? '<span class="jjd-f-seat">' + FreeTour._seatBadgeForFlight(f.flight) + '</span>' : '') + '</div></div>';
          }).join('') + '</div>' : '')
        // 选酒店下拉：自营=组合器(13家)联动；S132=hotels 下拉切换套餐与报价（独立分支，不碰 _selfbuild）
        + (isChunqiu ? this._cqComboHtml(p, cqIdx) : (isSup ? '' : this._comboHtml(p)))
        // 酒店（详情库优先：星级/开业/位置/餐饮/设施；随选中酒店实时联动，见 _recalcCombo → _hotelSecHtml）
        // 2026-08-24j：隐藏房间/房型价格信息，只渲染顶部最终人均价（jjd-price-top）
        + (isChunqiu ? this._cqHotelSecHtml(p, cqIdx) : (hdFull ? '<div class="jjd-sec" id="jjdHotelSec"><div class="jjd-sec-t">酒店</div><div class="jjd-hotel-card">'
          + '<div class="jjd-hotel-hd">'
          + (function () {
              // 2026-08-19: 按「住宿安排」分段渲染：每段标题（N晚·城市·区 + 同级标注）+ 每酒店一行；
              // 酒店名=链接（有官网即嵌，新窗口打开），无官网的纯文本。不再单独显示「官网」行。
              // 2026-08-31：官网链接仅员工端可见（Howard 定案）——游客态 urlOf 恒返回空 → 纯文本
              var hd = hdFull;
              var segs = (hd.segs && hd.segs.length) ? hd.segs : null;
              var urls = hd.urls || [];
              function urlOf(h) {
                if (!_isStaff()) return '';   // 游客不返回官网链接
                // 官网名与酒店行名匹配前，都先剥离「X市区」区域前缀（那霸市区Livemax ↔ Livemax波之上1/2号店）
                var stripD = function (s) { return (s || '').replace(/^(那霸市区|济州市区|沙巴市区|亚庇市区|首尔市区|京都市区|大阪市区|吉隆坡市区|冲绳市区|市区)/, ''); };
                for (var i = 0; i < urls.length; i++) {
                  var n = stripD(urls[i].name || '');
                  if (n && (n === h || h.indexOf(n) !== -1 || n.indexOf(h) !== -1)) return urls[i].url;
                }
                return '';
              }
              var html = '';
              // 2026-08-31：酒店英文全称（en_name）随酒店名渲染（Howard 定案，全员可见）
              var _en = hd.en_name || '';
              if (segs) {
                segs.forEach(function (s, si) {
                  var loc = (segs.length > 1 ? '第' + (si + 1) + '段 ' : '') + s.nights + '晚·' + esc(s.location) + (s.same_level ? '（同级替换，视房态）' : '');
                  html += '<div class="jjd-hr" style="margin-top:' + (si ? '8px' : '0') + '"><b>' + loc + '</b></div>';
                  (s.hotels || []).forEach(function (h) {
                    var u = urlOf(h);
                    var _isMain = (h === (hd.name || hd.display_name));
                    html += '<div class="jjd-hotel-name">' + (u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">🏨 ' + esc(h) + '</a>' : '🏨 ' + esc(h)) + '</div>'
                      + (_isMain && _en ? '<div style="font-size:11px;color:var(--color-text-tertiary);line-height:1.4">' + esc(_en) + '</div>' : '');
                  });
                });
              } else {
                var names = (hd.display_name || hd.name || '').replace(/(\d+)\/(\d+号店)/g, '$1$2').split('/').map(function (s) { return s.trim(); }).filter(Boolean);
                if (!names.length) names = [hd.name || ''];
                names.forEach(function (n, i) {
                  var u = urlOf(n);
                  html += '<div class="jjd-hotel-name">' + (names.length > 1 ? (i + 1) + '. ' : '') + (u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">🏨 ' + esc(n) + '</a>' : '🏨 ' + esc(n)) + '</div>'
                    + (i === 0 && _en ? '<div style="font-size:11px;color:var(--color-text-tertiary);line-height:1.4">' + esc(_en) + '</div>' : '');
                });
              }
              return html
                + (hd.star ? '<span class="jjd-star">' + esc(hd.star) + '</span>' : '')
                + (hd.note ? '<span class="jjd-star">' + esc(hd.note) + '</span>' : '')
                + (p.nights ? (segs && segs.length > 1
                    ? '<span class="jjd-nights">共' + esc(p.nights) + '晚·分' + esc(segs.length) + '段</span>'
                    : '<span class="jjd-nights">连住' + esc(p.nights) + '晚</span>') : '');
            })()
          + '</div>'
          + (hdFull.brand ? '<div class="jjd-hotel-brand">' + esc(hdFull.brand) + '</div>' : '')
          + '<div class="jjd-hotel-rows">'
          + (hdFull.opened ? '<div class="jjd-hr"><b>开业</b>' + esc(hdFull.opened) + '</div>' : '')
          + (hdFull.location ? '<div class="jjd-hr"><b>位置</b>' + esc(hdFull.location) + '</div>' : '')
          + (hdFull.dining ? '<div class="jjd-hr"><b>餐饮</b>' + esc(hdFull.dining) + '</div>' : '')
          + (hdFull.facilities ? '<div class="jjd-hr"><b>设施</b>' + esc(hdFull.facilities) + '</div>' : '')
          + (hdFull.address ? '<div class="jjd-hr"><b>地址</b>' + esc(hdFull.address) + '</div>' : '')
          + (hdFull.alt ? '<div class="jjd-hr"><b>备选</b>' + esc(hdFull.alt) + '</div>' : '')
          // 2026-08-24g：OTA 预订须知（来源：携程/Trip.com/Booking/Agoda 多源合并爬取，写进 hotel_details.json 的 notes 字段）
          + (hdFull.notes && hdFull.notes.length ? '<div class="jjd-notes"><b>预订须知</b>' + hdFull.notes.map(function (n) { return '<div class="jjd-note">' + esc(n) + '</div>'; }).join('') + '</div>' : '')
          + (hdFull.tip ? '<div class="jjd-notes jjd-tip"><b>💡 小提示</b><div class="jjd-note">' + esc(hdFull.tip) + '</div></div>' : '')
          + '</div></div></div>' : ''))
        // 行程安排（含出发/到达机场航站楼 + 接送/交通；接送标记已在价格卡）
        + (p.itinerary ? (function () {
            // 2026-08-19: 逐日卡片化——日期徽章（M月D日 周X·第N天）+ 内容分块，参考行程单模板
            var itHtml = (p.itinerary || '').replace(/(\d+月\d+日（周[日一二三四五六]）·第[一二三四五六七八九十]+天[：:])/g, '\n$1')
              .split('\n').filter(function (s) { return s.trim(); })
              .map(function (s) {
                s = s.trim();
                var m = s.match(/^(\d+月\d+日（周[日一二三四五六]）·第[一二三四五六七八九十]+天)[：:]\s*(.*)$/);
                if (m) {
                  return '<div class="jjd-it-day"><div class="jjd-it-date">' + esc(m[1]) + '</div><div class="jjd-it-txt">' + esc(m[2]) + '</div></div>';
                }
                return '<div class="jjd-it-day"><div class="jjd-it-txt">' + esc(s) + '</div></div>';
              }).join('');
            return '<div class="jjd-sec" id="jjdItinSec"><div class="jjd-sec-t">行程安排</div><div class="jjd-itinerary">' + itHtml + '</div></div>';
          })() : '')
        // 班期（多日期时显示）
        + ((p.dates && p.dates.length > 1) ? '<div class="jjd-sec"><div class="jjd-sec-t">可选班期（' + (p.dates || []).length + '个）</div><div class="jjd-chips">' + dateChips + '</div></div>' : '')
        // 行李
        + (p.baggage ? '<div class="jjd-sec"><div class="jjd-sec-t">行李</div><div class="jjd-bag">🧳 ' + esc(p.baggage) + '</div></div>' : '')
        // 卖点
        + (hl ? '<div class="jjd-sec"><div class="jjd-sec-t">套餐包含</div><div class="jjd-hls">' + hl + '</div></div>' : '')
        // 2026-08-31 Howard 定案：富信息区（套餐包含/单房差/儿童政策/退票规则）属参考信息，
        //   仅登录员工可见（游客隐藏）；isChunqiu 门控已放宽至全员 _isStaff()（字段缺失仍整段不渲染）。
        + (_isStaff() ? this._cqRichHtml(p) : '')
        // 来源（2026-08-31 Howard 定案：游客端不显示「来源：自由行套餐」整行；
        //   仅登录员工可见，并追加供应商代码标签（supTagHtml 无权限返回空串，游客零泄露））
        + (_isStaff() ? '<div class="jjd-src">来源：自由行套餐' + (typeof supTagHtml === 'function' ? supTagHtml(p.supplier, 'dh-sup-tag') : '') + '</div>' : '')
        // 套餐说明（2026-08-26：固定产品规则，展示于每个自由行套餐报价详情页）
        + '<div class="jjd-sec" id="jjdNotesSec"><div class="jjd-sec-t">套餐说明</div><div class="jjd-notes">'
        + (this.FT_NOTES || []).map(function (n, i) { return '<div class="jjd-note">' + (i + 1) + '. ' + esc(n) + '</div>'; }).join('')
        + '</div></div>'
        // 底部按钮（2026-08-19: 置于内容末尾、随 body 滚动——头部固定、尾部不固定；与往返机票详情页 detail-actions 相同排版逻辑）
        + '<div class="jjd-footer"><div class="jjd-btn-group">'
        + '<button class="jjd-copy" onclick="FreeTour.copyDetail(' + pi + ',\'' + curDate + '\')">复制套餐信息</button>'
        + '<button class="jjd-consult" onclick="FreeTour.consult(' + pi + ',\'' + curDate + '\')">💬 咨询客服</button>'
        + '</div></div>'
        + '</div>';
    },

    /* ── 客服文案（原 jjQuoteText）────────────────────────────────────────── */
    quoteText: function (p, date) {
      // 多日期组合/未传日期时：降级取第一个班期；仍无日期则用「日期待定」占位（防 NaN月NaN日）
      if (!date && p.dates && p.dates.length) date = p.dates[0];
      var m = parseInt(date ? date.slice(5, 7) : ''), day = parseInt(date ? date.slice(8, 10) : '');
      var rt = this.retDateTxt(p, date).replace(/（周[日一二三四五六]）/, '').trim();
      var L = [];
      // 2026-08-24h：组合器隐藏后，复制/咨询文案仍需带人均价（p.price 已是人均价/人起口径）
      if (p.price != null) L.push('套餐价：人均 ¥' + Number(p.price).toLocaleString() + '/人起 · 机+酒 2人拼住');
      L.push('【自由行 ' + (p.route || '') + '】' + (p.days ? p.days + '天' : '') + (p.nights ? p.nights + '晚' : ''));
      L.push((date && !isNaN(m)) ? (m + '月' + day + '日 出发' + (rt ? ' · ' + rt + ' 返回' : '')) : '出发日期待定（以详情页班期为准）');
      var pp = this.price(p, date);
      if (pp) L.push('价格 ¥' + pp + '/人');
      // 航班（结构化 flights[] → 逐段去程/回程 + 时长）
      var fl = p.flights || [];
      if (fl.length) {
        fl.forEach(function (f, i) {
          var dep = (f.dep_airport || '').replace(/ \(([A-Z]{3})\)/, '');
          var arr = (f.arr_airport || '').replace(/ \(([A-Z]{3})\)/, '');
          var t = (i === 0 ? '✈ 去程 ' : '✈ 回程 ') + (f.flight || '')
            + (dep ? ' ' + dep : '') + (f.dep_time ? ' ' + FreeTour._fmtTime(f.dep_time) : '')
            + (f.arr_time ? ' - ' + FreeTour._fmtTime(f.arr_time) + (f.arr_next_day ? ' +' + f.arr_next_day : '') : '') + (arr ? ' ' + arr : '')
            + (f.duration ? '（' + f.duration + '）' : '');
          L.push(t);
        });
      } else if (p.flight_desc) {
        L.push('✈ ' + p.flight_desc);
      }
      // 酒店（结构化 segs：段×晚数×候选；同级/换酒店标注）
      var segs = p.hotel_details && p.hotel_details.segs;
      if (segs && segs.length) {
        var hs = segs.map(function (s) {
          var t = s.nights + '晚 ' + s.location + '：' + s.hotels.join(' / ');
          if (s.same_level) t += '（同级替换视房态）';
          return t;
        });
        L.push('🏨 ' + hs.join('；'));
        if (segs.length > 1) L.push('   ⤷ 行程中需切换酒店');
      } else if (p.hotel) {
        L.push('🏨 ' + p.hotel);
      }
      // S132供应商自由行：列出全部可选酒店/升级项及各自直客价（机+酒全包），便于客服复制报价
      if (p._src === 'supplier' && p.hotels && p.hotels.length) {
        L.push('🏨 可选酒店/套餐（机+酒直客价）：');
        p.hotels.forEach(function (h) {
          var tag = h.is_upgrade ? '（升级 +' + (h.add || 0) + (h.add_unit || '元/人') + '）' : '';
          L.push('   · ' + h.name + tag + ' ¥' + Number(h.price).toLocaleString() + '/人' + (h.restock ? '（余位：' + h.restock + '）' : ''));
        });
      }
      var hd = p.hotel_details;
      if (hd && hd.address) L.push('📍 ' + hd.address);
      // 2026-08-31：官网链接仅员工端可见（Howard 定案）——复制文本同样只对员工附加官网行
      if (hd && hd.urls && hd.urls.length && _isStaff()) {
        var uu = hd.urls.map(function (u) { return (u.name ? u.name + ' ' : '') + u.url; }).join('；');
        L.push('🔗 官网 ' + uu);
      }
      // 行程（简单版：逐日提取「第N天 + 日期 + 主干」，去周几、超长截断）
      var it = p.itinerary || '';
      if (it) {
        var itLines = it.replace(/(\d+月\d+日（周[日一二三四五六]）·第[一二三四五六七八九十]+天[：:])/g, '\n$1')
          .split('\n').map(function (s) { return s.trim(); }).filter(function (s) { return s; })
          .map(function (s) {
            var m = s.match(/^(\d+月\d+日)（周[日一二三四五六]）·第([一二三四五六七八九十]+)天[：:]\s*(.*)$/);
            var dayTxt, body;
            if (m) { dayTxt = '第' + m[2] + '天 ' + m[1]; body = m[3]; }
            else { dayTxt = ''; body = s; }
            // 截断超长行（保留主干，避免复制信息冗长）
            if (body.length > 70) body = body.slice(0, 70) + '…';
            return (dayTxt ? dayTxt + '：' : '') + body;
          });
        if (itLines.length) {
          L.push('📅 行程安排');
          itLines.forEach(function (x) { L.push('  ' + x); });
        }
      }
      // 接送信息铁律（2026-08-31 Howard 定案）：源表「是否含接送」未标注/标注「不含」= 不含接送，
      //   一律不渲染、不进复制文本，且**严禁编造解释性文案**——旧版 else 分支曾凭空生成一段
      //   「不含接送 + 交通方式指引」，源表并无此信息，属未审核编造且会随复制文本外发给客人，
      //   2026-08-31 已删除、禁止恢复。
      //   仅当源表明确「含接送」时输出该行，且不附加任何源表之外的补充说明。
      if (p.has_pickup) L.push('🚗 含接送机');
      if (p.baggage) L.push('🧳 ' + p.baggage);
      // 深链（借鉴机票详情页 copyAll 的 _PROMO 引导结构：正文 + 分隔线引导 + 🔗 深链）
      try {
        var base = window.location.href.split('#')[0];
        L.push('');
        L.push('———————————————');
        L.push('更多自由行特价套餐（日韩港澳东南亚等）');
        L.push('实时更新，更多惊喜，戳这里查👇');
        // 深链定位：#ft=子表|日期|天数；多日期时跟随当前选中班期；日期缺失时省略中间段
        var ft = (p.route || '') + (date ? '|' + date : '') + (p.days ? '|' + p.days : '');
        L.push('🔗 ' + base + '#ft=' + encodeURIComponent(ft));
      } catch (e) {}
      return L.join('\n');
    },

    /* ── 咨询客服（原 consultJj）─────────────────────────────────────────── */
    consult: function (pi, date) {
      var p = this.JJ.packages[pi];
      if (!p) return;
      var st = this.comboState();
      var txt = (st && st.hotel) ? this._comboText(p, date, st) : this.quoteText(p, date);
      consultCS(txt);  // 弹客服二维码
    },

    /* ── 复制套餐信息（原 copyJjDetail）──────────────────────────────────── */
    copyDetail: function (pi, date) {
      var p = this.JJ.packages[pi];
      if (!p) return;
      var st = this.comboState();
      var txt = (st && st.hotel) ? this._comboText(p, date, st) : this.quoteText(p, date);
      var ta = document.createElement('textarea');
      ta.value = txt;
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      var btn = document.querySelector('.jjd-copy');
      if (btn) { btn.textContent = '✅ 已复制'; btn.classList.add('copied'); }
    },

    /* ── 2026-08-31 组名由航班号航段推导（Howard 定案）──────────────────────
     * 去程到达城市 = 回程出发城市（同城往返）→「去程出发城市-到达城市」       如 上海-首尔
     * 去程到达城市 ≠ 回程出发城市（开口程）  →「去程出发-到达 / 回程出发-到达」 如 上海-香港 / 澳门-上海
     * 城市从航段机场名归一（剥航站楼/IATA码/机场后缀 + 地名别名表）；
     * 航段/机场数据缺失 → fail-closed 用路由文案转同款「-」格式（route 本身是结构化 出发→目的，非猜测）。
     * 显示名同时并入分组键 → 同源路由混排（上海→港澳 4天3晚 = 7澳门往返+2香港进澳门出）自动拆块。 */
    // 2026-09-01（Howard 定案）：时刻表统一——源中部分航段时间为紧凑 24h 制（如 1425 / 900，无冒号），
    //   展示层规整为 HH:MM；数据字段保持原值（一比一透传），仅展示层归一，与机场别名同原则。
    //   非数字（如「待定」）原样保留，不编造。
    _fmtTime: function (t) {
      t = String(t == null ? '' : t).trim();
      if (!t || t.indexOf(':') !== -1) return t;
      if (/^\d{3,4}$/.test(t)) {
        if (t.length === 3) t = '0' + t;
        var h = parseInt(t.slice(0, 2), 10), m = parseInt(t.slice(2), 10);
        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return ('0' + h).slice(-2) + ':' + ('0' + m).slice(-2);
      }
      return t;
    },
    _aptCity: function (s) {
      var t = String(s || '').replace(/\s*T\d+$/i, '').replace(/\s*\([A-Z]{3}\)\s*$/, '').trim();
      t = t.replace(/国际机场$/, '').replace(/机场$/, '').trim();
      var ALIAS = ['浦东=上海', '虹桥=上海', '仁川=首尔', '金浦=首尔', '樟宜=新加坡', '关西=大阪',
        '成田=东京', '羽田=东京', '萧山=杭州', '禄口=南京', '硕放=无锡', '栎社=宁波', '兴东=南通', '凤凰=三亚',
        // 2026-09-01（Howard 定案）：目的地一律城市名，机场名不得当城市（与主站 IATA_CITY 同源）
        '那霸=冲绳', '亚庇=沙巴', '济州=济州岛', '清州=清州'];
      for (var i = 0; i < ALIAS.length; i++) {
        var kv = ALIAS[i].split('=');
        if (t.indexOf(kv[0]) !== -1) return kv[1];
      }
      return t;
    },
    _legName: function (p) {
      var rt = String(p.route || '');
      var fl = p.flights || [];
      // 2026-09-01（Howard 定案）：自由行分组名与单机票分组唯一区别=多一个「自由行」标签；
      //   航线名统一用「→」分隔（原用「-」，与单机票不一致）。
      var dash = rt.replace(/-/g, '→');
      if (!rt || fl.length < 2) return { pat: 'na', name: dash };
      var c = this._aptCity;
      var o1 = c(fl[0].dep_airport), o2 = c(fl[0].arr_airport);
      var r1 = c(fl[1].dep_airport), r2 = c(fl[1].arr_airport);
      if (!o1 || !o2 || !r1 || !r2) return { pat: 'na', name: dash };
      var arr = (rt.split('→')[1] || '');
      if (o2 === r1) {
        // 同城往返：到达城市与路由目的地互为包含（普吉/普吉岛、济州/济州岛、冲绳(那霸)、大阪/大阪京都）
        //   → 沿用路由目的地文案（更完整）；仅语义不同（港澳块内澳门往返：澳门 vs 港澳）→ 用航段实际城市
        var _same = arr && (arr.indexOf(o2) !== -1 || o2.indexOf(arr) !== -1);
        return { pat: 'same:' + (_same ? arr : o2), name: o1 + '→' + (_same ? arr : o2) };
      }
      // 开口程（去程到达 ≠ 回程出发）
      return { pat: 'open:' + o2 + '>' + r1, name: o1 + '→' + o2 + ' / ' + r1 + '→' + r2 };
    },

    /* ── 分组渲染（原 render() 内自由行置顶分组块，返回 HTML 片段）─────────
     * 2026-08-07: 自由行套餐置顶（top）——归入对应分类（country→tab）
     * 组内排序 = 上海出发优先 → 同出发地按航线 → 同航线按天数升序
     */
    renderGroupHtml: function (currentTab) {
      var html = '';
      var self = this;
      // 2026-08-24g：回溯到"自由行标签分组"原始规则——按 (route+days+nights) 聚合，
      // 每个分组头带「自由行」标签，点开 toggleGroup 显示该组下所有自由行报价卡片（jj-card）。
      // 单层结构（分组头 → 直接卡片），无航班组嵌套；_selfbuild 组合器富信息在详情页维度保留。
      var CAT_TAB = this.CAT_TAB;
      // 2026-08-31 修复（Howard 13:11 报 渲染窜栏目+权限错误，双根因同源）：
      // ①权限闸门必须最先——供应商套餐（含关键缺失 _keymiss）仅授权账号可见。
      //   原 _keymiss 无条件直通 return true → 游客也能看到 110 条供应商套餐（权限漏洞）。
      var pkgs = (this.JJ.packages || []).filter(function (p) {
        if (p._src === 'supplier' && p.internal && !canSeeSupplierFreeTour()) return false;
        // 未知航线（无 route）：仅登录版本可见，游客版本不可渲染（避免向外泄露未归类航线）
        if (!p.route) return !!canSeeSupplierFreeTour();
        // ②分类修复：删除 _keymiss 无条件直通——关键缺失套餐同样按 country→tab 归类，
        //   原「return true」使其在五个栏目全部重复出现（丽江/新加坡/巴厘岛+新加坡/沙巴 窜进日本栏目）。
        //   数据层已由 build_freetour_json.py norm_country() 保证 country ∈ 五区域；无法归类的不渲染。
        return CAT_TAB[p.country] === currentTab;
      });
      if (!pkgs.length) return html;
      // 外部分组保持 (route+days+nights) 不变；组内按航班实体 (flight+flight_return) 聚合，
      // 每航班只渲染 1 张卡 = 该航班 13 家组合里「组合人均价」最低的那套；其余组合仅在详情页切换。
      var groups = {};
      pkgs.forEach(function (p) {
        // 2026-08-26：分组键含 _src → 同航线自营/供应商各自独立分组块（并列区分，满足「区别分组标签」）
        // 2026-08-31：分组键改用「去回城市对显示名」(_legName) → ①开口程组头展开全名 ②同源路由混排
        //   （上海→港澳 4天3晚 = 7澳门往返+2香港进澳门出）自动拆块；键用显示名保证「名称相同必同块」，
        //   有/无机场数据（na 与 same 同名）不会拆出重复组头。
        var lg = self._legName(p);
        p._legDisp = lg.name;
        var key = (p.route || '未知航线') + '|' + (p.days || 0) + '|' + (p.nights || 0) + '|' + (p._src || 'self') + '|' + lg.name;
        if (!groups[key]) groups[key] = [];
        groups[key].push(p);
      });
      var keys = Object.keys(groups);
      // 组内排序：上海出发优先 → 同出发地按航线 → 同航线按天数升序；分组间按 days 升序
      keys.sort(function (a, b) {
        var pa = a.split('|'), pb = b.split('|');
        var ra = pa[0].indexOf('上海') === 0 ? 0 : 1, rb = pb[0].indexOf('上海') === 0 ? 0 : 1;
        if (ra !== rb) return ra - rb;
        if (pa[0] !== pb[0]) return pa[0] < pb[0] ? -1 : 1;
        return (Number(pa[1]) || 0) - (Number(pb[1]) || 0);
      });
      keys.forEach(function (key) {
        var parts = key.split('|');
        var route = parts[0], days = Number(parts[1]) || 0, nights = Number(parts[2]) || 0;
        var items = groups[key];
        // 2026-08-31 组头全名：开口程展开「上海 → 香港 / 澳门 → 上海」；同城精确简写（上海-澳门）；缺数据回退原 route
        var routeName = (items[0] && items[0]._legDisp) || route;
        // 2026-08-26：供应商 vs 自营 分组方式不同
        //  · 供应商：每条套餐 = 一个去程日期 = 1 张卡，按去程日期升序排列（绝不按航班塌缩，否则丢日期维度）
        //  · 自营：按航班组合聚合，每航班取组合人均价最低的套餐 → 1 张卡（9航班×13酒店笛卡尔积）
        var isSup = items.length && items[0]._src === 'supplier';
        var gid = 'jjg_' + key.replace(/[^a-z0-9一-龥]/g, '_');
        var cards = [];
        if (isSup) {
          var ordered = items.slice().sort(function (a, b) {
            var da = (a.dates && a.dates[0]) || '', db = (b.dates && b.dates[0]) || '';
            return da < db ? -1 : da > db ? 1 : 0;
          });
          ordered.forEach(function (p) {
            var d = (p.dates && p.dates[0]) || '';
            var pi = self.JJ.packages.indexOf(p);
            var per = Number(self.perPersonPrice(p, d)) || 0;
            cards.push({ p: p, date: d, pi: pi, per: per });
          });
        } else {
          var byFlight = {};
          items.forEach(function (p) {
            var fk = (p.flight || '?') + '|' + (p.flight_return || '?');
            if (!byFlight[fk]) byFlight[fk] = [];
            byFlight[fk].push(p);
          });
          Object.keys(byFlight).sort().forEach(function (fk) {
            var arr = byFlight[fk];
            var best = null, bestPer = Infinity;
            arr.forEach(function (p) {
              var d = (p.dates && p.dates[0]) || '';
              var per = Number(self.perPersonPrice(p, d)) || 0;
              if (per && per < bestPer) { bestPer = per; best = p; }
            });
            if (!best) best = arr[0];
            var bestDate = (best.dates && best.dates[0]) || '';
            var bestPi = self.JJ.packages.indexOf(best);
            var bestPer2 = Number(self.perPersonPrice(best, bestDate)) || 0;
            cards.push({ p: best, date: bestDate, pi: bestPi, per: bestPer2 });
          });
        }
        var pers = cards.map(function (c) { return c.per; }).filter(Boolean);
        var mn = pers.length ? Math.min.apply(null, pers) : 0;
        // 2026-09-01（Howard 定案）：分组计数三位补零 → 001条/023条，使「自由行」标签与「起价」在各分组头上下对齐
        var _cnt3 = ('000' + cards.length).slice(-3);
        var countLabel = isSup ? (_cnt3 + '条') : (_cnt3 + ' 航班');
        // 分组标题：航线 → 自由行标签（供应商/自营区分）→ 几天几晚 → 数量 → 最低价起
        html += '<div class="hm-group">'
          + '<div class="hm-group-hd" onclick="if(event.target.closest(\'.jj-card\'))return;toggleGroup(\'' + gid + '\')">'
          + '<span class="hm-route">' + esc(routeName) + '</span>'
          + '<span class="jj-cat-tag">自由行</span>'
          + '<span class="hm-nights">' + (days ? days + '天' : '') + (nights ? nights + '晚' : '') + '</span>'
          + '<span class="hm-count">' + countLabel + '</span>'
          + (mn ? '<span class="hm-minprice">¥' + Math.round(mn) + ' 起</span>' : '')
          + '<span class="hm-arrow">▾</span></div>'
          + '<div class="hm-group-bd" id="grp_' + gid + '" style="display:none">';
        cards.forEach(function (c) {
          html += self.card(c.p, c.date, c.pi);
        });
        html += '</div></div>';
      });
      return html;
    },


    /* ── 组合器辅助（2026-08-24b：详情页内酒店下拉+人数+房型，实时算价，OTA 单房差规则）── */
    /* 自营套餐目的地（2026-08-31 Howard 定案：香港酒店不得扩散进澳门套餐/组合器）：
       route 含「香港」→ 香港；含「澳门」→ 澳门；其余返回 ''（不参与过滤）。
       供应商套餐(_src==='supplier')不走 _selfbuild 池 → 返回 null。 */
    _selfDest: function (p) {
      if (!p || p._src === 'supplier') return null;
      var rt = String(p.route || '');
      if (rt.indexOf('香港') !== -1) return '香港';
      if (rt.indexOf('澳门') !== -1) return '澳门';
      return '';
    },
    _findFlight: function (p) {
      var sb = this.JJ._selfbuild; if (!sb) return null;
      for (var i = 0; i < sb.flights.length; i++) {
        var f = sb.flights[i];
        if (f.flights && f.flights[0] && f.flights[1]
          && f.flights[0].flight === p.flight && f.flights[1].flight === p.flight_return) return f;
      }
      return null;
    },
    _findHotelIdx: function (name, dest) {
      var sb = this.JJ._selfbuild; if (!sb) return -1;
      for (var i = 0; i < sb.hotels.length; i++) {
        if (sb.hotels[i].name === name
          && (dest == null || dest === '' || sb.hotels[i].dest === dest)) return i;
      }
      return -1;
    },
    /* 套餐索引：给定 (去程航班, 回程航班, 酒店) → packages 下标（117=9航班×13酒店笛卡尔积，唯一） */
    _pkgIdx: function (f1, f2, hotel) {
      var pk = this.JJ.packages || [];
      for (var i = 0; i < pk.length; i++) {
        if (pk[i].flight === f1 && pk[i].flight_return === f2 && pk[i].hotel === hotel) return i;
      }
      return -1;
    },
    /* 自由行联动索引：酒店名→hotel_details；航班+回程+酒店→itinerary（行程含酒店名，必须随选中酒店实时重渲染） */
    _buildLinkage: function () {
      var pk = this.JJ.packages || [];
      this.JJ._hotelIndex = {};
      this.JJ._itinIndex = {};
      for (var i = 0; i < pk.length; i++) {
        var p = pk[i];
        if (p.hotel && p.hotel_details && !this.JJ._hotelIndex[p.hotel]) this.JJ._hotelIndex[p.hotel] = p.hotel_details;
        if (p.flight && p.flight_return && p.hotel && p.itinerary != null) this.JJ._itinIndex[p.flight + '|' + p.flight_return + '|' + p.hotel] = p.itinerary;
      }
      // 2026-08-24c：13 家自营组合酒店富信息并入索引（星级/品牌/开业/客房/位置/餐饮/设施/官网），
      // 按酒店名合并，不覆盖固定套餐已有的 segs/plan/display_name 等结构字段；随组合器下拉实时联动渲染。
      var sb = this.JJ._selfbuild;
      if (sb && sb.hotels) {
        var richKeys = ['star', 'brand', 'opened', 'rooms', 'location', 'dining', 'facilities', 'address', 'alt', 'urls', 'note'];
        for (var j = 0; j < sb.hotels.length; j++) {
          var h = sb.hotels[j];
          if (!h.name || !h.details) continue;
          var ex = this.JJ._hotelIndex[h.name] || {};
          for (var k = 0; k < richKeys.length; k++) {
            var rk = richKeys[k];
            if (h.details[rk] != null) ex[rk] = h.details[rk];
          }
          if (!ex.name) ex.name = h.name;
          this.JJ._hotelIndex[h.name] = ex;
        }
      }
    },
    _hotelDetailsOf: function (name) {
      return (this.JJ._hotelIndex && this.JJ._hotelIndex[name]) ? this.JJ._hotelIndex[name] : null;
    },
    _itineraryOf: function (p, hotelName) {
      if (!this.JJ._itinIndex || !p) return '';
      return this.JJ._itinIndex[(p.flight || '') + '|' + (p.flight_return || '') + '|' + (hotelName || '')] || '';
    },
    /* 酒店信息区块（随选中酒店联动重渲染；DOM id=jjdHotelSec data-hl=酒店名） */
    _hotelSecHtml: function (hd, p) {
      if (!hd) return '';
      return '<div class="jjd-sec" id="jjdHotelSec" data-hl="' + esc(hd.name || '') + '"><div class="jjd-sec-t">酒店</div><div class="jjd-hotel-card">'
        + (function () {
            var segs = (hd.segs && hd.segs.length) ? hd.segs : null;
            var urls = hd.urls || [];
            function urlOf(h) {
              if (!_isStaff()) return '';   // 2026-08-31：官网链接仅员工端可见（游客纯文本）
              var stripD = function (s) { return (s || '').replace(/^(那霸市区|济州市区|沙巴市区|亚庇市区|首尔市区|京都市区|大阪市区|吉隆坡市区|冲绳市区|市区)/, ''); };
              for (var i = 0; i < urls.length; i++) {
                var n = stripD(urls[i].name || '');
                if (n && (n === h || h.indexOf(n) !== -1 || n.indexOf(h) !== -1)) return urls[i].url;
              }
              return '';
            }
            var html = '';
            if (segs) {
              segs.forEach(function (s, si) {
                var loc = (segs.length > 1 ? '第' + (si + 1) + '段 ' : '') + s.nights + '晚·' + esc(s.location) + (s.same_level ? '（同级替换，视房态）' : '');
                html += '<div class="jjd-hr" style="margin-top:' + (si ? '8px' : '0') + '"><b>' + loc + '</b></div>';
                (s.hotels || []).forEach(function (h) {
                  var u = urlOf(h);
                  html += '<div class="jjd-hotel-name">' + (u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">🏨 ' + esc(h) + '</a>' : '🏨 ' + esc(h)) + '</div>';
                });
              });
            } else {
              var names = (hd.display_name || hd.name || '').replace(/(\d+)\/(\d+号店)/g, '$1$2').split('/').map(function (s) { return s.trim(); }).filter(Boolean);
              if (!names.length) names = [hd.name || ''];
              names.forEach(function (n, i) {
                var u = urlOf(n);
                html += '<div class="jjd-hotel-name">' + (names.length > 1 ? (i + 1) + '. ' : '') + (u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">🏨 ' + esc(n) + '</a>' : '🏨 ' + esc(n)) + '</div>';
              });
            }
            return html
              + (hd.star ? '<span class="jjd-star">' + esc(hd.star) + '</span>' : '')
              + (hd.note ? '<span class="jjd-star">' + esc(hd.note) + '</span>' : '')
              + (p && p.nights ? (segs && segs.length > 1
                  ? '<span class="jjd-nights">共' + esc(p.nights) + '晚·分' + esc(segs.length) + '段</span>'
                  : '<span class="jjd-nights">连住' + esc(p.nights) + '晚</span>') : '');
          })()
        + '</div>'
        + (hd.brand ? '<div class="jjd-hotel-brand">' + esc(hd.brand) + '</div>' : '')
        + '<div class="jjd-hotel-rows">'
        + (hd.opened ? '<div class="jjd-hr"><b>开业</b>' + esc(hd.opened) + '</div>' : '')
        + (hd.location ? '<div class="jjd-hr"><b>位置</b>' + esc(hd.location) + '</div>' : '')
        + (hd.dining ? '<div class="jjd-hr"><b>餐饮</b>' + esc(hd.dining) + '</div>' : '')
        + (hd.facilities ? '<div class="jjd-hr"><b>设施</b>' + esc(hd.facilities) + '</div>' : '')
        + (hd.address ? '<div class="jjd-hr"><b>地址</b>' + esc(hd.address) + '</div>' : '')
        + (hd.alt ? '<div class="jjd-hr"><b>备选</b>' + esc(hd.alt) + '</div>' : '')
        + '</div></div>';
    },
    /* 行程区块（含酒店名，随选中酒店联动重渲染；DOM id=jjdItinSec data-it=酒店名） */
    _itinerarySecHtml: function (itin, hotelName) {
      if (!itin) return '';
      var itHtml = (itin || '').replace(/(\d+月\d+日（周[日一二三四五六]）·第[一二三四五六七八九十]+天[：:])/g, '\n$1')
        .split('\n').filter(function (s) { return s.trim(); })
        .map(function (s) {
          s = s.trim();
          var m = s.match(/^(\d+月\d+日（周[日一二三四五六]）·第[一二三四五六七八九十]+天)[：:]\s*(.*)$/);
          if (m) {
            return '<div class="jjd-it-day"><div class="jjd-it-date">' + esc(m[1]) + '</div><div class="jjd-it-txt">' + esc(m[2]) + '</div></div>';
          }
          return '<div class="jjd-it-day"><div class="jjd-it-txt">' + esc(s) + '</div></div>';
        }).join('');
      return '<div class="jjd-sec" id="jjdItinSec" data-it="' + esc(hotelName || '') + '"><div class="jjd-sec-t">行程安排</div><div class="jjd-itinerary">' + itHtml + '</div></div>';
    },
    /* 详情页切换去程航班：保留当前已选酒店，跳到「同酒店·不同航班」套餐（起飞时刻切换核心） */
    switchFlight: function (a, b, date) {
      var f1, f2;
      if (a && a.indexOf('|') >= 0) { var parts = a.split('|'); f1 = parts[0]; f2 = parts[1]; }
      else { f1 = a; f2 = b; }
      var c = document.getElementById('modalContent');
      var pi = c ? parseInt(c.getAttribute('data-pi'), 10) : -1;
      var p = (pi != null && pi >= 0) ? this.JJ.packages[pi] : null;
      var st = this.comboState();
      var sb = this.JJ._selfbuild;
      var hIdx = (st && st.hIdx != null) ? st.hIdx : (p ? this._findHotelIdx(p.hotel) : 0);
      var hotel = (sb && sb.hotels[hIdx]) ? sb.hotels[hIdx].name : (p ? p.hotel : null);
      var idx = this._pkgIdx(f1, f2, hotel);
      if (idx < 0 && p) idx = this._pkgIdx(f1, f2, p.hotel);  // 兜底：用套餐原酒店
      if (idx >= 0) this.openDetail(idx, date, hIdx);
    },
    /* 从详情页 DOM 读取当前组合选择（2026-08-24g：隐藏成人/儿童后仅取酒店，其余用 OTA 起价口径默认） */
    comboState: function () {
      var sel = document.getElementById('comboHotel');
      if (!sel) return null;
      var sb = this.JJ._selfbuild;
      // 2026-08-31：下拉 option 值=过滤后下标；需映射回全池索引（香港酒店不混入澳门套餐）
      var selName = sel.options && sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : '';
      var hIdx = -1;
      if (sb && sb.hotels) {
        for (var i = 0; i < sb.hotels.length; i++) {
          if (sb.hotels[i].name === selName) { hIdx = i; break; }
        }
      }
      var hotel = (sb && hIdx >= 0) ? sb.hotels[hIdx] : null;
      return { hIdx: hIdx, hotel: hotel, adults: 2, children: 0, childBed: false, solo: false, pax: 2 };
    },
    /* 实时重算总价/人均 */
    _recalcCombo: function () {
      var c = document.getElementById('modalContent');
      var pi = c ? parseInt(c.getAttribute('data-pi'), 10) : -1;
      var p = (pi != null && pi >= 0) ? this.JJ.packages[pi] : null;
      var st = this.comboState();
      if (!p || !st || !st.hotel) return;
      var f = this._findFlight(p);
      var F = f ? (Number(f.flight_direct) || 0) : 0;     // 成人机票/人
      var R = Number(st.hotel.hotel_total) || 0;          // 每间房（三晚）平价
      // 2026-08-24g：隐藏成人/儿童逻辑，报价只用「人均价」= 单人机票 + 半间房费（OTA 起价口径）
      var per = Math.round(F + R / 2);
      var pp = document.getElementById('comboPer');
      if (pp) pp.textContent = '¥' + per.toLocaleString();
      // 信息联动：选中酒店变化时才重渲染 酒店信息 + 行程（data-hl/data-it 防重复渲染；行程含酒店名必须同步）
      var selName = st.hotel ? st.hotel.name : '';
      var hdEl = document.getElementById('jjdHotelSec');
      if (hdEl && hdEl.getAttribute('data-hl') !== selName) hdEl.outerHTML = this._hotelSecHtml(this._hotelDetailsOf(selName), p);
      var itEl = document.getElementById('jjdItinSec');
      if (itEl && itEl.getAttribute('data-it') !== selName) itEl.outerHTML = this._itinerarySecHtml(this._itineraryOf(p, selName), selName);
    },
    /* 选酒店下拉（2026-08-24h 之后恢复：仅用于切换 13 家酒店富信息联动，
       不含成人/儿童/房型/算价 UI——「组合方式」整块已隐藏，只留这个选择器） */
    _comboHtml: function (p) {
      var sb = this.JJ._selfbuild;
      if (!sb || !sb.hotels || !sb.hotels.length) return '';
      // 2026-08-31：下拉只列当前套餐目的地(dest)的酒店——香港酒店不得混入澳门套餐（Howard 定案）
      var dest = this._selfDest(p);
      var defIdx = this._findHotelIdx(p.hotel, dest);
      if (defIdx < 0) defIdx = 0;
      var opts = sb.hotels.map(function (h, i) {
        if (dest != null && dest !== '' && h.dest !== dest) return '';
        return '<option value="' + i + '"' + (i === defIdx ? ' selected' : '') + '>' + esc(h.name) + '</option>';
      }).filter(Boolean).join('');
      if (!opts) return '';
      return '<div class="jjd-sec jjd-pick-hotel">'
        + '<div class="jjd-sec-t">选择酒店</div>'
        + '<select id="comboHotel" class="jjd-combo-sel" onchange="FreeTour._recalcCombo()">' + opts + '</select>'
        + '</div>';
    },
    /* 组合套餐复制文案（酒店/人数/房型/总价按当前选择） */
    _comboText: function (p, date, st) {
      var f = this._findFlight(p);
      var F = f ? (Number(f.flight_direct) || 0) : 0;
      var R = Number(st.hotel.hotel_total) || 0;
      // 2026-08-24g：隐藏成人/儿童逻辑，文案只报「人均价」= F + R/2（OTA 起价口径）
      var per = Math.round(F + R / 2);
      if (!date && p.dates && p.dates.length) date = p.dates[0];
      var m = parseInt(date ? date.slice(5, 7) : ''), day = parseInt(date ? date.slice(8, 10) : '');
      var rt = this.retDateTxt(p, date).replace(/（周[日一二三四五六]）/, '').trim();
      var L = [];
      L.push('【自由行 ' + (p.route || '') + '】' + (p.days ? p.days + '天' : '') + (p.nights ? p.nights + '晚' : ''));
      L.push((date && !isNaN(m)) ? (m + '月' + day + '日 出发' + (rt ? ' · ' + rt + ' 返回' : '')) : '出发日期待定（以详情页班期为准）');
      L.push('套餐：' + esc(st.hotel.name) + ' · 人均价 ¥' + per.toLocaleString() + '/人起（机+酒套餐价，最终报价）');
      var fl = p.flights || [];
      if (fl.length) {
        fl.forEach(function (f2, i) {
          var dep = (f2.dep_airport || '').replace(/ \(([A-Z]{3})\)/, '');
          var arr = (f2.arr_airport || '').replace(/ \(([A-Z]{3})\)/, '');
          L.push((i === 0 ? '✈ 去程 ' : '✈ 回程 ') + (f2.flight || '') + (dep ? ' ' + dep : '') + (f2.dep_time ? ' ' + FreeTour._fmtTime(f2.dep_time) : '') + (f2.arr_time ? ' - ' + FreeTour._fmtTime(f2.arr_time) + (f2.arr_next_day ? ' +' + f2.arr_next_day : '') : '') + (arr ? ' ' + arr : '') + (f2.duration ? '（' + f2.duration + '）' : ''));
        });
      } else if (p.flight_desc) { L.push('✈ ' + p.flight_desc); }
      L.push('🏨 ' + st.hotel.name);
      if (p.baggage) L.push('🧳 ' + p.baggage);
      try {
        var base = window.location.href.split('#')[0];
        L.push(''); L.push('———————————————');
        L.push('更多自由行特价套餐（日韩港澳东南亚等）');
        L.push('实时更新，更多惊喜，戳这里查👇');
        var ft = (p.route || '') + (date ? '|' + date : '') + (p.days ? '|' + p.days : '');
        L.push('🔗 ' + base + '#ft=' + encodeURIComponent(ft));
      } catch (e) {}
      return L.join('\n');
    },

    /* ───────────────────────────────────────────────────────────────────────
     * S132供应商自由行（supplier==132，p.hotels 为可选酒店/升级项，price 已是机+酒直客价全包）
     * 独立于自营组合器(_selfbuild)体系，下列 cq* 函数仅供S132分支调用。
     * ─────────────────────────────────────────────────────────────────────── */
    /* 默认选中项 = 价格最低的那家（与卡片起价 p.price 一致）；回退 default_hidx */
    _cqDefIdx: function (p) {
      if (!p.hotels || !p.hotels.length) return 0;
      var mi = 0, mp = Infinity;
      for (var i = 0; i < p.hotels.length; i++) {
        var pr = Number(p.hotels[i].price);
        if (pr < mp) { mp = pr; mi = i; }
      }
      return mi;
    },
    /* 选择酒店/套餐 下拉（切换即改价，见 _onCqHotel） */
    _cqComboHtml: function (p, cqIdx) {
      if (!p.hotels || !p.hotels.length) return '';
      var opts = p.hotels.map(function (h, i) {
        var addTxt = h.add ? (' · 升级+' + h.add + (h.add_unit || '元/人')) : '';
        var label = h.name + (h.is_upgrade ? '（升级）' : '') + ' ¥' + Number(h.price).toLocaleString() + '/人' + addTxt;
        return '<option value="' + i + '"' + (i === cqIdx ? ' selected' : '') + '>' + esc(label) + '</option>';
      }).join('');
      var baseCount = p.hotels.filter(function (h) { return !h.is_upgrade; }).length;
      var upCount = p.hotels.length - baseCount;
      return '<div class="jjd-sec jjd-pick-hotel">'
        + '<div class="jjd-sec-t">选择酒店/套餐（' + baseCount + ' 家基础 + ' + upCount + ' 项升级可选 · 切换看报价）</div>'
        + '<select id="cqHotelSel" class="jjd-combo-sel" onchange="FreeTour._onCqHotel(this.value)">' + opts + '</select>'
        + '</div>';
    },
    /* 酒店区块（S132：随下拉选中项实时渲染，含 desc/余位/升级加价） */
    _cqHotelSecHtml: function (p, idx) {
      var h = p.hotels[idx];
      if (!h) return '';
      var star = h.star || 0;
      var html = '<div class="jjd-sec" id="jjdHotelSec" data-hl="' + esc(h.name || '') + '"><div class="jjd-sec-t">酒店/套餐（' + p.hotels.length + ' 家可选）</div><div class="jjd-hotel-card">'
        + '<div class="jjd-hotel-hd"><span class="jjd-hotel-name">🏨 ' + esc(h.name) + '</span>'
        + (star ? '<span class="jj-star">' + star + '钻</span>' : '')
        + (h.is_upgrade ? '<span class="jj-star" style="color:var(--brand,#FF6A3D)">升级项</span>' : '')
        + '</div>';
      if (h.desc) html += '<div class="jjd-notes"><div class="jjd-note">' + esc(h.desc) + '</div></div>';
      if (h.restock) html += '<div class="jjd-hr"><b>余位</b>' + esc(h.restock) + '</div>';
      if (h.add) html += '<div class="jjd-hr"><b>升级加价</b>+' + esc(h.add) + (h.add_unit || '元/人') + '</div>';
      html += '</div>';
      if (h.is_upgrade) html += '<div class="jjd-hotel-brand">本项为可选升级套餐，选中后人均价在上方基础上 +' + esc(h.add) + (h.add_unit || '元/人') + '</div>';
      html += '</div>';
      return html;
    },
    /* 富信息区：套餐包含/单房差/儿童政策/退票规则（字段缺失则整段不渲染；价格构成/返利属商业机密，不渲染） */
    _cqRichHtml: function (p) {
      var secs = [];
      if (p.inclusions && p.inclusions.length) {
        secs.push('<div class="jjd-sec"><div class="jjd-sec-t">套餐包含</div><div class="jjd-hls">'
          + p.inclusions.map(function (x) { return '<div class="jjd-hl"><span>🎁</span>' + esc(x) + '</div>'; }).join('')
          + '</div></div>');
      }
      if (p.single_supplement) secs.push('<div class="jjd-sec"><div class="jjd-sec-t">单房差</div><div class="jjd-bag">' + esc(p.single_supplement) + '</div></div>');
      if (p.child_policy) secs.push('<div class="jjd-sec"><div class="jjd-sec-t">儿童政策</div><div class="jjd-bag">' + esc(p.child_policy) + '</div></div>');
      if (p.refund_rule) secs.push('<div class="jjd-sec"><div class="jjd-sec-t">退票规则</div><div class="jjd-notes"><div class="jjd-note">' + esc(p.refund_rule) + '</div></div></div>');
      // 注意：price_ladder_note（价格构成/阶梯加成公式）与 rebate_note（同业结算价）属企业内部成本/加价结构，
      // 属商业机密，绝不渲染到任何面向用户的详情页，亦不写入对外服务的 JSON（见 merge_chunqiu_supplier.py 剥离逻辑）。
      return secs.join('');
    },
    /* 下拉切换：更新顶部人均价 + 重渲染酒店区块 */
    _onCqHotel: function (val) {
      var c = document.getElementById('modalContent');
      var pi = c ? parseInt(c.getAttribute('data-pi'), 10) : -1;
      var p = (pi != null && pi >= 0) ? this.JJ.packages[pi] : null;
      if (!p || !p.hotels) return;
      var idx = parseInt(val, 10) || 0;
      var h = p.hotels[idx];
      if (!h) return;
      p._cqHIdx = idx;
      var pp = document.getElementById('comboPer');
      if (pp) pp.textContent = '¥' + Number(h.price).toLocaleString();
      var hdEl = document.getElementById('jjdHotelSec');
      if (hdEl) hdEl.outerHTML = this._cqHotelSecHtml(p, idx);
    },

    /* ── 搜索命中（原搜索块内 jjHits 计算，返回命中的套餐对象数组）────────── */
    searchHits: function (q) {
      var hits = [];
      if (this.JJ && this.JJ.packages && this.JJ.packages.length) {
        // 可见性门控（与 785/1281/1339 一致）：自营/公开组游客可见；内部供应商组仅特权可见；无 route 仅特权可见
        var _vis = function (p) {
          if (!p.route) return !!canSeeSupplierFreeTour();
          if (p._src === 'supplier' && p.internal) return !!canSeeSupplierFreeTour();
          return true;
        };
        // 搜「自由行」/「自由行套餐」→ 列出全部可见自由行套餐（2026-08-19 修复：此前无结果）
        var q2 = (q || '').toLowerCase();
        if (q2.indexOf('自由行') !== -1) return this.JJ.packages.filter(_vis);
        var kwl = q2;
        var kwh = (q || '').trim();
        this.JJ.packages.forEach(function (p) {
          if (!_vis(p)) return;
          var hit = (p.route || '').indexOf(kwh) !== -1
            || (p.arr || '').indexOf(kwh) !== -1
            || (p.hotel || '').toLowerCase().indexOf(kwl) !== -1
            || (p.flight_desc || '').toLowerCase().indexOf(kwl) !== -1
            || (p.country || '').indexOf(kwh) !== -1
            || (p.highlights || []).some(function (h) { return h.indexOf(kwh) !== -1; });
          if (hit) hits.push(p);
        });
      }
      return hits;
    },

    /* ── 搜索结果点击自由行套餐 → 切到所属分类 Tab 并打开详情（原 jjSearchOpen）── */
    searchOpen: function (pi, date) {
      if (global.closeFilter) global.closeFilter();
      var CAT_TAB = this.CAT_TAB;
      var p = this.JJ.packages ? this.JJ.packages[pi] : null;
      var tabKey = (p && CAT_TAB[p.country]) || 'seasia';
      document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
      var tTab = document.querySelector('[data-tab="' + tabKey + '"]');
      if (tTab) tTab.classList.add('active');
      global.currentTab = tabKey;
      var list = document.getElementById('cardList');
      if (list) list.scrollTop = 0;
      if (global.render) global.render();
      var self = this;
      global.setTimeout(function () { self.openDetail(pi, date); }, 250);  // 等渲染完成再打开详情
    },

    /* ── 搜索结果中的自由行命中（返回 HTML 片段，点击 → 切到所属分类 Tab 并打开详情）── */
    searchResultsHtml: function (q) {
      var hits = this.searchHits(q);
      if (!hits || !hits.length) return '';
      var self = this;
      var rows = hits.map(function (p) {
        var pi = self.JJ.packages.indexOf(p);
        var dates = (p.dates && p.dates.length) ? p.dates.slice().sort() : [''];
        return dates.map(function (d) {
          // 搜索结果卡片点击 → searchOpen（切 Tab + 开详情），复用 card 渲染
          return self.card(p, d, pi).split('FreeTour.openDetail(').join('FreeTour.searchOpen(');
        }).join('');
      }).join('');
      return '<div class="jj-search-block"><div class="jj-search-hd">自由行套餐 ' + hits.length + ' 个</div>' + rows + '</div>';
    },

    /* ── 自由行模式：筛选条件联动套餐数据（2026-08-26 新增）── */
    setMode: function (mode) {
      this._mode = mode;
      this._filterActive = false;   // 退出筛选视图，等待新一轮 applyFilter
    },

    // 由 _filter（dep/arr/days/month/dates）过滤套餐；arr 容错 route 包含
    _matchFilter: function (p, f) {
      if (!p) return false;
      // 供应商套餐：仅 internal=true 的供应商组对游客隐藏，internal=false 的供应商组游客可见（可见性铁律例外）
      if (p._src === 'supplier' && p.internal && !canSeeSupplierFreeTour()) return false;
      f = f || {};
      if (f.dep) {
        var _seg = (p.route || '').split('→');
        if ((_seg[0] || '').indexOf(f.dep) === -1 && (p.dep || '').indexOf(f.dep) === -1) return false;
      }
      if (f.arr) {
        var _seg2 = (p.route || '').split('→');
        var _arrCity = _seg2[1] || p.arr || '';
        if (_arrCity.indexOf(f.arr) === -1 && (p.arr || '').indexOf(f.arr) === -1) return false;
      }
      if (f.days) { if (String(p.days || '') !== String(f.days)) return false; }
      if (f.month) {
        var _hitM = false;
        (p.dates || []).forEach(function (d) { if (d.slice(0, 7) === f.month) _hitM = true; });
        if (!_hitM) return false;
      }
      if (f.dates && f.dates.length) {
        var _set = {}; f.dates.forEach(function (d) { _set[d] = true; });
        if (!(p.dates || []).some(function (d) { return _set[d]; })) return false;
      }
      if (f.supplier) {
        if (p._src !== 'supplier' || String(p.supplier || '') !== String(f.supplier)) return false;
      }
      return true;
    },

    filteredCount: function (filter) {
      if (!this.JJ.packages || !this.JJ.packages.length) return 0;
      var self = this, n = 0;
      this.JJ.packages.forEach(function (p) { if (self._matchFilter(p, filter)) n++; });
      return n;
    },

    // 渲染筛选结果到 cardList（自由行模式）；render() 重渲染时调用 renderFiltered 复用
    applyFilter: function (filter) {
      this._lastFilter = filter || { dep: '', arr: '', days: '', month: '', date: '', dates: [] };
      var self = this;
      var hits = (this.JJ.packages || []).filter(function (p) { return self._matchFilter(p, self._lastFilter); });
      var list = document.getElementById('cardList');
      if (!list) return;
      if (!hits.length) { list.innerHTML = '<div class="loading">无符合条件的自由行套餐</div>'; return; }
      self._filterActive = true;
      list.innerHTML = hits.map(function (p) {
        var pi = self.JJ.packages.indexOf(p);
        var dates = (p.dates && p.dates.length) ? p.dates.slice().sort() : [''];
        return dates.map(function (d) { return self.card(p, d, pi); }).join('');
      }).join('');
    },

    // render() 重渲染入口（currentTab==='filter' 且自由行模式时由宿主调用）
    renderFiltered: function () {
      if (this._filterActive) this.applyFilter(this._lastFilter);
      else { var l = document.getElementById('cardList'); if (l) l.innerHTML = '<div class="loading">请设置筛选条件</div>'; }
    },

    // 自由行模式筛选面板：出发城市/到达城市/天数/月份/月历（数据源 jj_packages，复用宿主 select* 处理器与 _filter 状态）
    filterPills: function () {
      if (!this.JJ.loaded) return '<div class="loading">自由行套餐加载中…</div>';
      var self = this;
      // 可见套餐（与 _matchFilter 空过滤一致：游客只看自营 + 公开组，特权账号看全部）
      var pk = (this.JJ.packages || []).filter(function (p) { return self._matchFilter(p, {}); });
      function _seg(p) { var s = (p.route || '').split('→'); return { dep: s[0] || '', arr: s[1] || '' }; }

      function deps() {
        var s = new Set();
        pk.forEach(function (p) { var d = _seg(p).dep; if (d) s.add(d); });
        return Array.from(s);
      }
      function arrs() {
        var s = new Set();
        pk.forEach(function (p) {
          var g = _seg(p);
          if (_filter.dep && g.dep !== _filter.dep) return;
          if (g.arr) s.add(g.arr);
        });
        return Array.from(s);
      }
      function days() {
        var s = new Set();
        pk.forEach(function (p) {
          var g = _seg(p);
          if (_filter.dep && g.dep !== _filter.dep) return;
          if (_filter.arr && g.arr !== _filter.arr) return;
          if (p.days) s.add(String(p.days));
        });
        return Array.from(s).sort(function (a, b) { return parseInt(a) - parseInt(b); });
      }
      function months() {
        var s = new Set();
        pk.forEach(function (p) {
          var g = _seg(p);
          if (_filter.dep && g.dep !== _filter.dep) return;
          if (_filter.arr && g.arr !== _filter.arr) return;
          if (_filter.days && String(p.days) !== String(_filter.days)) return;
          (p.dates || []).forEach(function (d) { if (d.length >= 7) s.add(d.slice(0, 7)); });
        });
        return Array.from(s).sort();
      }
      function pill(onclick, label, active) {
        var a = active ? ' style="background:var(--brand,var(--red));color:#fff;border-color:var(--brand,var(--red))"' : '';
        return '<div class="fit-pill" onclick="' + onclick + '"' + a + '>' + label + '</div>';
      }

      // 出发城市
      var depHtml = '<div style="margin-bottom:10px"><div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">出发城市</div><div style="display:flex;flex-wrap:wrap;gap:6px">';
      deps().forEach(function (c) { depHtml += pill('selectDep(\'' + c + '\')', c, _filter.dep === c); });
      depHtml += '</div></div>';

      // 到达城市
      var arrHtml = '<div style="margin-bottom:10px"><div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">到达城市</div><div style="display:flex;flex-wrap:wrap;gap:6px">';
      arrs().forEach(function (c) { arrHtml += pill('selectArr(\'' + c + '\')', c, _filter.arr === c); });
      arrHtml += '</div></div>';

      // 天数
      var canSel = _filter.dep || _filter.arr;
      var dDisabled = canSel ? '' : ' style="opacity:0.4;pointer-events:none"';
      var dayHtml = '<div' + dDisabled + ' style="margin-bottom:10px"><div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">天数 <span style="font-size:11px;color:var(--text-light)">' + (canSel ? '' : '先选择出发或到达城市') + '</span></div><div style="display:flex;flex-wrap:wrap;gap:6px">';
      (canSel ? days() : []).forEach(function (d) { dayHtml += pill('selectDay(\'' + d + '\')', d + '天', String(_filter.days) === String(d)); });
      dayHtml += '</div></div>';

      // 月份
      var mDisabled = canSel ? '' : ' style="opacity:0.4;pointer-events:none"';
      var monthHtml = '<div' + mDisabled + ' style="margin-bottom:10px"><div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">月份 <span style="font-size:11px;color:var(--text-light)">' + (canSel ? '' : '先选择出发或到达城市') + '</span></div><div style="display:flex;flex-wrap:wrap;gap:6px">';
      (canSel ? months() : []).forEach(function (m) { monthHtml += pill('selectMonth(\'' + m + '\')', parseInt(m.slice(5, 7)) + '月', _filter.month === m); });
      monthHtml += '</div></div>';

      // 月历（按已选条件聚合每日最低人均价）
      var calHtml = (function () {
        var canCal = canSel && _filter.days && _filter.month;
        if (!canCal) {
          return '<div style="margin-bottom:10px;opacity:0.4;pointer-events:none"><div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">日历报价 <span style="font-size:11px;color:var(--text-light)">请先选择月份</span></div>'
            + '<div style="padding:20px;text-align:center;font-size:11px;color:var(--text-light);background:var(--tag-bg);border-radius:8px">请先选择出发城市、到达城市、天数和月份</div></div>';
        }
        var recs = pk.filter(function (p) { return self._matchFilter(p, _filter); });
        var dateMap = {};
        recs.forEach(function (p) {
          (p.dates || []).forEach(function (d) {
            if (d.slice(0, 7) !== _filter.month) return;
            var pr = Number(self.perPersonPrice(p, d)) || 0;
            if (!dateMap[d] || pr < dateMap[d].min) dateMap[d] = { min: pr };
          });
        });
        var year = parseInt(_filter.month.slice(0, 4), 10);
        var mo = parseInt(_filter.month.slice(5, 7), 10) - 1;
        var firstDay = new Date(year, mo, 1).getDay();
        var dim = new Date(year, mo + 1, 0).getDate();
        var h = '<div style="margin-bottom:6px"><div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">' + parseInt(_filter.month.slice(5, 7), 10) + '月日历 · 最低价</div>'
          + '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center">'
          + '<span style="font-size:10px;color:var(--text-light)">日</span><span style="font-size:10px;color:var(--text-light)">一</span><span style="font-size:10px;color:var(--text-light)">二</span>'
          + '<span style="font-size:10px;color:var(--text-light)">三</span><span style="font-size:10px;color:var(--text-light)">四</span>'
          + '<span style="font-size:10px;color:var(--text-light)">五</span><span style="font-size:10px;color:var(--text-light)">六</span>';
        for (var i = 0; i < firstDay; i++) h += '<div></div>';
        for (var day = 1; day <= dim; day++) {
          var pad = day < 10 ? '0' + day : '' + day;
          var dateStr = _filter.month + '-' + pad;
          var info = dateMap[dateStr];
          var sel = (_filter.dates || []).indexOf(dateStr) >= 0 ? ' style="border:1.5px solid var(--red);background:var(--red-light)"' : ' style="cursor:pointer"';
          h += '<div class="cal-cell" onclick="selectDate(\'' + dateStr + '\')"' + sel + '>'
            + '<div style="font-size:11px;font-weight:500;color:var(--text)">' + day + '</div>';
          if (info) h += '<div style="font-size:10px;color:var(--red);font-weight:500">¥' + Math.round(info.min) + '</div>';
          else h += '<div style="font-size:9px;color:var(--text-light)">—</div>';
          h += '</div>';
        }
        h += '</div></div>';
        return h;
      })();

      return depHtml + arrHtml + dayHtml + monthHtml + calHtml;
    },

    // 自由行模式：关键字检索套餐（路由自 searchFilter）
    search: function (q) {
      var hits = this.searchHits(q).filter(function (p) { return !(p._src === 'supplier' && p.internal && !canSeeSupplierFreeTour()); });
      var self = this;
      var body = document.getElementById('filterBody');
      if (!body) return;
      if (!hits.length) { body.innerHTML = '<div class="loading">未找到匹配的自由行套餐</div>'; return; }
      var rows = hits.map(function (p) {
        var pi = self.JJ.packages.indexOf(p);
        var dates = (p.dates && p.dates.length) ? p.dates.slice().sort() : [''];
        return dates.map(function (d) {
          return self.card(p, d, pi).split('FreeTour.openDetail(').join('FreeTour.searchOpen(');
        }).join('');
      }).join('');
      body.innerHTML = '<div class="jj-search-block"><div class="jj-search-hd">自由行套餐 ' + hits.length + ' 个</div>' + rows + '</div>';
    },

  };

  global.FreeTour = FreeTour;

  // 自初始化：本脚本被引入即触发自由行数据加载（无需宿主 app_main.js 显式调用，
  // 避免测试版 app_main.js 被 sandbox 版 cp 覆盖时丢失接入点）。
  // 其它版本（官方/客服）不引入本脚本 → 完全无自由行逻辑与渲染。
  if (typeof FreeTour.load === 'function') FreeTour.load();
})(window);
