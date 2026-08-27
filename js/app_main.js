function render() {
  // 2026-08-13: 非搜索结果视图（render 是常规视图渲染入口）→ 重置搜索态标志
  _isSearchView = false;
  // 首页-热销(千巡); 热门-中秋国庆; 其他-区域筛选
  if (currentTab === 'home') return renderHome();
  if (currentTab === 'filter') {
    if (_searchMode === 'freetour' && window.FreeTour && window.FreeTour.renderFiltered) return window.FreeTour.renderFiltered();
    return renderFiltered();
  }
  renderTab();
}

// 滑动区固定顶栏：标签名 + 排序 + 筛选按钮
function _seatNum(r) {
  var s = (r.seats||'').trim().toLowerCase();
  var m = s.match(/\d+/);
  if (m) return parseInt(m[0]);
  if (s === '充足') return 999;
  return 0;
}
function _compareByMode(a, b, mode) {
  if (mode === 'price_asc') return (a.retail||0) - (b.retail||0);
  if (mode === 'price_desc') return (b.retail||0) - (a.retail||0);
  if (mode === 'seats_asc') return (_seatNum(a)||999) - (_seatNum(b)||999);
  if (mode === 'seats_desc') return (_seatNum(b)||0) - (_seatNum(a)||0);
  if (mode === 'route_asc') return ((a.dep||'')+(a.arr||'')) < ((b.dep||'')+(b.arr||'')) ? -1 : 1;
  if (mode === 'route_desc') return ((a.dep||'')+(a.arr||'')) > ((b.dep||'')+(b.arr||'')) ? -1 : 1;
  // 日期
  var da = a.dep_date||'', db = b.dep_date||'';
  if (mode === 'date_desc') {
    var today = new Date(), y=today.getFullYear(), m=today.getMonth();
    var rangeStart = y+'-'+(m+1<10?'0':'')+(m+1)+'-01';
    var nextMonthEnd = new Date(y, m+2, 0).toISOString().slice(0,10);
    var inA = da >= rangeStart && da <= nextMonthEnd;
    var inB = db >= rangeStart && db <= nextMonthEnd;
    if (inA && inB) return da > db ? -1 : 1;
    if (inA) return -1;
    if (inB) return 1;
    return da < db ? -1 : 1;
  }
  // 默认 date_asc（缺去程日期的沉底，不抢排最前；同日期按价格升序二级）
  if (!da && !db) return (a.retail||0) - (b.retail||0);
  if (!da) return 1;
  if (!db) return -1;
  if (da === db) return (a.retail||0) - (b.retail||0);
  return da < db ? -1 : 1;
}
function _sortRecords(recs) {
  var modes = _sortModes || [];
  if (!modes.length) return recs;  // 未选排序 → 原始顺序
  var sorted = recs.slice(0);
  sorted.sort(function(a, b) {
    for (var i = 0; i < modes.length; i++) {
      var cmp = _compareByMode(a, b, modes[i]);
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
  return sorted;
}

function _stickyBar() {
  var label = {'home':'热销','hot':'热门','japan':'日本','korea':'韩国','seasia':'东南亚','ganga':'港澳','domestic':'国内'};
  var name = label[currentTab] || currentTab;
  return '<div class="sticky-bar" style="display:flex;align-items:center;justify-content:space-between;padding:6px 12px">'
    + '<span class="sticky-label" style="font-weight:500;font-size:13px">'+name+'</span>'
    + '<div style="display:flex;gap:4px;align-items:center">'
    + '<span class="sticky-filter" onclick="openSortModal()" style="font-size:11px;padding:3px 8px;border-radius:10px;border:0.5px solid var(--border);cursor:pointer;color:#888;margin-right:8px"><svg viewBox="0 0 24 24" width="13" height="13" style="vertical-align:-2px" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="17 11 12 6 7 11"></polyline><polyline points="7 13 12 18 17 13"></polyline></svg> 排序</span>'
    + '<span class="sticky-filter" onclick="openFilter()" style="font-size:11px;padding:3px 8px;border-radius:10px;border:0.5px solid var(--border);cursor:pointer;color:var(--text-secondary)"><svg viewBox="0 0 24 24" width="13" height="13" style="vertical-align:-2px" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><line x1="16.5" y1="16.5" x2="21" y2="21"></line></svg> 搜索</span>'
    + '</div></div>';
}

// 搜索态顶部栏（2026-08-13）：搜索结果列表也带 排序/搜索 按钮，与常规列表页一致
// 左侧用搜索关键字组合成分组标题（🔍 搜索"xx" · N 条）；sticky 固定（-webkit-sticky 兼容 iOS）
// _isSearchView/_lastSearchQ 由 searchFilterAndShow 维护；render() 开头重置
var _isSearchView = false;
var _lastSearchQ = '';
function _searchStickyBar(n, kw) {
  var title = '搜索结果';
  if (kw) title = '🔍 搜索"' + kw + '"';
  return '<div class="sticky-bar" style="display:flex;align-items:center;justify-content:space-between;padding:6px 12px">'
    + '<span class="sticky-label" style="font-weight:500;font-size:13px">' + title + (n ? ' · ' + n + ' 条' : '') + '</span>'
    + '<div style="display:flex;gap:4px;align-items:center">'
    + '<span class="sticky-filter" onclick="openSortModal()" style="font-size:11px;padding:3px 8px;border-radius:10px;border:0.5px solid var(--border);cursor:pointer;color:#888;margin-right:8px"><svg viewBox="0 0 24 24" width="13" height="13" style="vertical-align:-2px" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="17 11 12 6 7 11"></polyline><polyline points="7 13 12 18 17 13"></polyline></svg> 排序</span>'
    + '<span class="sticky-filter" onclick="openFilter()" style="font-size:11px;padding:3px 8px;border-radius:10px;border:0.5px solid var(--border);cursor:pointer;color:var(--text-secondary)"><svg viewBox="0 0 24 24" width="13" height="13" style="vertical-align:-2px" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><line x1="16.5" y1="16.5" x2="21" y2="21"></line></svg> 搜索</span>'
    + '</div></div>';
}

// 筛选结果页顶部栏（2026-08-13）：筛选「查看N条结果」/ f_* 深链页 也带 分组标题+排序+搜索 按钮，固定
function _filterStickyBar(n) {
  var f = _filter || {};
  var parts = [];
  if (f.dep) parts.push(f.dep + '→' + (f.arr || '目的地'));
  else if (f.arr) parts.push('出发地→' + f.arr);
  if (f.days) parts.push(f.days + '天');
  if (f.month) {
    var _m = String(f.month).split('-').pop();
    parts.push(parseInt(_m, 10) + '月');
  }
  var title = parts.length ? parts.join(' ') : '筛选结果';
  return '<div class="sticky-bar" style="display:flex;align-items:center;justify-content:space-between;padding:6px 12px">'
    + '<span class="sticky-label" style="font-weight:500;font-size:13px">' + title + (n ? ' · ' + n + ' 条' : '') + '</span>'
    + '<div style="display:flex;gap:4px;align-items:center">'
    + '<span class="sticky-filter" onclick="openSortModal()" style="font-size:11px;padding:3px 8px;border-radius:10px;border:0.5px solid var(--border);cursor:pointer;color:#888;margin-right:8px"><svg viewBox="0 0 24 24" width="13" height="13" style="vertical-align:-2px" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="17 11 12 6 7 11"></polyline><polyline points="7 13 12 18 17 13"></polyline></svg> 排序</span>'
    + '<span class="sticky-filter" onclick="openFilter()" style="font-size:11px;padding:3px 8px;border-radius:10px;border:0.5px solid var(--border);cursor:pointer;color:var(--text-secondary)"><svg viewBox="0 0 24 24" width="13" height="13" style="vertical-align:-2px" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><line x1="16.5" y1="16.5" x2="21" y2="21"></line></svg> 搜索</span>'
    + '</div></div>';
}

// Excel表头点击 — 直接入口
document.addEventListener('click', function(e) {
  var hdr = e.target.closest('[data-key]');
  if (!hdr) return;
  var k = hdr.dataset.key;
  if (!k) return;
  var asc = k+'_asc', desc = k+'_desc';
  var modes = _sortModes || [];
  var existingIdx = modes.indexOf(asc);
  if (existingIdx < 0) existingIdx = modes.indexOf(desc);
  if (e.shiftKey || e.metaKey) {
    // Shift / Cmd + click: 追加/移除条件
    if (existingIdx >= 0) {
      modes.splice(existingIdx, 1);
    } else {
      if (modes.length >= 3) modes.shift();
      modes.push(asc);
    }
  } else {
    // 单击：切换升降 或 替换
    if (existingIdx === 0) {
      // 已经是主要条件 → 切换升降
      modes[0] = modes[0] === asc ? desc : asc;
    } else {
      // 替换为主要条件
      modes = [asc];
    }
  }
  if (!modes.length) modes = ['date_asc'];
  _sortModes = modes;
  render();
});

function toggleTheme() {
  document.body.classList.toggle('dark');
  var dark = document.body.classList.contains('dark');
  localStorage.setItem('theme', dark ? 'dark' : 'light');
  var el = document.getElementById('headerTheme');
  if (el) el.textContent = dark ? '🌙' : '☀️';
  render();
}

// ═══════════════ 颜色主题（环球红焰 / 紫金 / 深海蓝 / 翡翠绿）═══════════════
// 与现有 dark/light 并存：使用独立 localStorage 键 pq_theme，不覆盖原有 'theme'（深色模式）
var PQ_THEMES = {
  red:    { name: '环球红焰' },
  purple: { name: '紫金' },
  blue:   { name: '深海蓝' },
  green:  { name: '翡翠绿' }
};
function pqThemeGet() {
  var t = '';
  try { t = localStorage.getItem('pq_theme') || ''; } catch(e) {}
  return PQ_THEMES[t] ? t : 'red';
}
function applyTheme(t) {
  if (!PQ_THEMES[t]) t = 'red';
  document.body.setAttribute('data-theme', t);
  try { localStorage.setItem('pq_theme', t); } catch(e) {}
  var opts = document.querySelectorAll('.theme-opt');
  for (var i = 0; i < opts.length; i++) {
    opts[i].classList.toggle('active', opts[i].getAttribute('data-theme') === t);
  }
  var pop = document.getElementById('themePop');
  if (pop) pop.style.display = 'none';
}
function openThemeSwitcher() {
  var pop = document.getElementById('themePop');
  if (!pop) return;
  pop.style.display = pop.style.display === 'none' ? 'block' : 'none';
}
function setTheme(t) { applyTheme(t); }

// 2026-08-05 用户：主题切换用「点击 logo」实现——循环切换 4 主题 + toast 提示 + localStorage 记忆
function cycleTheme() {
  var order = ['red', 'purple', 'blue', 'green'];
  var cur = pqThemeGet();
  var idx = order.indexOf(cur);
  var next = order[(idx + 1) % order.length];
  applyTheme(next);
  showToast('🎨 主题：' + PQ_THEMES[next].name);
  try { recordAction('theme_cycle', {theme: next}); } catch(e) {}
}

function renderTab() {
  var today = new Date();
  var todayStr = today.toISOString().slice(0,10);
  var monthEnd = new Date(today.getTime() + 30 * 86400000);
  var monthEndStr = monthEnd.toISOString().slice(0,10);
  var holidayStart = '2026-09-23', holidayEnd = '2026-10-07'; // 中秋提前2天(拼假) + 国庆连休 9/23~10/7
  var list = document.getElementById('cardList');
  
  if (currentTab === 'hot') {
    // 热门：中秋国庆9月25日~10月7日 — 按日期排序的报价卡片
    var all = DB.records.filter(function(r) {
      if (!_hasSeats(r) || !_validRecord(r)) return false;
      var d = r.dep_date || '';
      return d >= holidayStart && d <= holidayEnd && !(!r.flight_return && (r.dep === '济州岛' || r.dep === '济州') && r.arr === '上海');
    });
    all.sort(function(a,b) { return (a.dep_date||'') < (b.dep_date||'') ? -1 : 1; });
    list.innerHTML = _stickyBar() + all.map(function(r){return hmCard(r)}).join('');
    list.scrollTop = 0;
    return;
  }
  
  // 区域：日本/韩国/东南亚/港澳
  var records = DB.records.filter(function(r) { return _hasSeats(r); });
  var cities = TAB_CITIES[currentTab] || [];
  records = records.filter(function(r) { return cities.some(function(c){return r.arr===c}); });
  records = records.filter(function(r) { return !(!r.flight_return && (r.dep==='济州岛'||r.dep==='济州') && r.arr==='上海'); });
  
  // 所有区域统一使用排序+分组模式
  records = _sortRecords(records);
  var html = _stickyBar();
  // 自由行套餐（机+酒）——独立模块 FreeTour（js/free_tour.js）；仅当 index.html 引入时启用
  if (window.FreeTour) {
    html += FreeTour.renderGroupHtml(currentTab);
  }
  if (_groupMode) {
    // 分组模式
    var groups = {};
    records.forEach(function(r) {
      // 2026-08-06: 缺口程单独分组——回程出发城市 ≠ 去程到达城市（如 上海→东京 / 大阪→上海）
      // 不混入"上海-东京"组，独立成"上海→东京 / 大阪→上海 5天"组；城市名归一后比较（济州==济州岛等）
      var retC = _retDepCity(r);
      var isOpenJaw = retC && retC !== _normCity(r.arr);
      var routeKey = r.dep + '→' + r.arr + (isOpenJaw ? ' / ' + retC + '→' + (r.dep || '') : '');
      var k = routeKey + '|' + (getDays(r) || '0');
      if (!groups[k]) groups[k] = {dep: r.dep, arr: r.arr, retCity: retC, isOpenJaw: isOpenJaw, nights: getDays(r) || '', records: []};
      groups[k].records.push(r);
    });
    // 组间排序 — 2026-08-07 16:5x: 城市层级(上海→省会→其他, 不同城市按城市总条数降序) → 同出发地按TAB_CITIES目的地顺序 → 天数升序 → 原排序模式兜底
    // 省会城市集合（当前涉及 杭州/南京；后续可扩展）
    var SHENG_HUI = {'杭州':1,'南京':1,'广州':1,'成都':1,'武汉':1,'西安':1,'郑州':1,'长沙':1,'沈阳':1,'济南':1,'昆明':1,'石家庄':1,'太原':1,'合肥':1,'福州':1,'南昌':1,'南宁':1,'贵阳':1,'兰州':1,'西宁':1,'银川':1,'拉萨':1,'乌鲁木齐':1,'呼和浩特':1,'哈尔滨':1,'长春':1,'海口':1};
    var gKeys = Object.keys(groups);
    // 2026-08-07 16:5x: 预聚合每个出发城市的总条数（城市间按总条数排序，保证同城市所有分组连排）
    var depCount = {};
    gKeys.forEach(function (_k) {
      var _d = groups[_k].dep;
      depCount[_d] = (depCount[_d] || 0) + groups[_k].records.length;
    });
    var firstMode = (_sortModes && _sortModes.length) ? _sortModes[0] : 'date_asc';
    // 当前分类的目的地城市顺序（TAB_CITIES[currentTab]；港澳/国内也有）
    var TAB_ARR_ORDER = TAB_CITIES[currentTab] || [];
    function _arrIdx(g) { var i = TAB_ARR_ORDER.indexOf(g.arr); return i < 0 ? 999 : i; }
    // 2026-08-07 17:1x: 分组排序模式（组间）——'smart'=智能规则；其余=航线/天数/条数/价格 升降序
    var GS = typeof _groupSort !== 'undefined' ? _groupSort : 'smart';
    function _gMinPrice(g) { return Math.min.apply(null, g.records.map(function(r){return r.retail||99999})); }
    gKeys.sort(function(ka, kb) {
      var ga = groups[ka].records, gb = groups[kb].records;
      // ── 非智能分组排序：按所选维度全局排（不套城市层级）──
      if (GS !== 'smart') {
        var gk = GS.split('_')[0], gd = GS.indexOf('_desc') >= 0 ? -1 : 1;
        if (gk === 'route') {
          // 航线：按 TAB_CITIES 目的地顺序（desc=反向）
          var rA = _arrIdx(groups[ka]), rB = _arrIdx(groups[kb]);
          if (rA !== rB) return gd > 0 ? rA - rB : rB - rA;
        } else if (gk === 'nights') {
          var dA = parseInt(groups[ka].nights || '0', 10) || 0;
          var dB = parseInt(groups[kb].nights || '0', 10) || 0;
          if (dA !== dB) return gd > 0 ? dA - dB : dB - dA;
        } else if (gk === 'count') {
          var cA = groups[ka].records.length, cB = groups[kb].records.length;
          if (cA !== cB) return gd > 0 ? cA - cB : cB - cA;
        } else if (gk === 'price') {
          var pA = _gMinPrice(groups[ka]), pB = _gMinPrice(groups[kb]);
          if (pA !== pB) return gd > 0 ? pA - pB : pB - pA;
        } else if (gk === 'date') {
          function _gMinDate(g){ return g.records.reduce(function(m,r){var d=r.dep_date||'';return (d && (m==='9999'||d<m))?d:m;},'9999'); }
          var dA=_gMinDate(groups[ka]), dB=_gMinDate(groups[kb]);
          if (dA !== dB) return gd > 0 ? (dA < dB ? -1 : 1) : (dA < dB ? 1 : -1);
        }
        // 同值兜底：天数升序 → 原排序
        var ddA = parseInt(groups[ka].nights || '0', 10) || 0;
        var ddB = parseInt(groups[kb].nights || '0', 10) || 0;
        if (ddA !== ddB) return ddA - ddB;
        return 0;
      }
      // ── 智能排序：城市层级 + 城市总条数 + 航线顺序 + 纯/缺口 + 天数升序 ──
      // ① 城市层级：上海(0) → 省会(1) → 其他(2)
      function _lv(g) { return (g.dep === '上海') ? 0 : (SHENG_HUI[g.dep] ? 1 : 2); }
      var lvA = _lv(groups[ka]), lvB = _lv(groups[kb]);
      if (lvA !== lvB) return lvA - lvB;
      // ② 不同出发城市（同层级）：按城市总条数由多到少（同城市所有组连排）
      if (groups[ka].dep !== groups[kb].dep) {
        var cA = depCount[groups[ka].dep] || 0, cB = depCount[groups[kb].dep] || 0;
        if (cA !== cB) return cB - cA;
      }
      // ③ 同出发地：按 TAB_CITIES 目的地顺序（东京→大阪→冲绳→福冈）
      var iA = _arrIdx(groups[ka]), iB = _arrIdx(groups[kb]);
      if (iA !== iB) return iA - iB;
      // ③b 2026-08-07 17:1x: 同目的地内：纯航线在前、缺口程在后（相同航线上下排列）
      //    港澳线实测：上海→香港(纯) 与 上海→香港/澳门→上海(缺口程) 原交错排，应各自连排
      var oA = groups[ka].isOpenJaw ? 1 : 0;
      var oB = groups[kb].isOpenJaw ? 1 : 0;
      if (oA !== oB) return oA - oB;
      // ④ 天数升序（同航线）
      var dA = parseInt(groups[ka].nights || '0', 10) || 0;
      var dB = parseInt(groups[kb].nights || '0', 10) || 0;
      if (dA !== dB) return dA - dB;
      // ⑤ 原排序模式兜底（价格/日期/航线）
      if (firstMode.indexOf('price') >= 0) {
        var ma = Math.min.apply(null, ga.map(function(r){return r.retail||99999}));
        var mb = Math.min.apply(null, gb.map(function(r){return r.retail||99999}));
        return firstMode === 'price_asc' ? ma - mb : mb - ma;
      }
      if (firstMode.indexOf('seats') >= 0) {
        var sa = Math.min.apply(null, ga.map(function(r){return _seatNum(r)}));
        var sb = Math.min.apply(null, gb.map(function(r){return _seatNum(r)}));
        return firstMode === 'seats_asc' ? sa - sb : sb - sa;
      }
      if (firstMode.indexOf('route') >= 0) {
        var rka = ka.split('|')[0], rkb = kb.split('|')[0];
        return firstMode === 'route_asc' ? (rka < rkb ? -1 : 1) : (rka > rkb ? -1 : 1);
      }
      // 日期排序
      var da = ga[0].dep_date||'', db = gb[0].dep_date||'';
      if (firstMode.indexOf('date_desc') >= 0) {
        // 降序：取组内最远日期(当月+次月范围内)
        var today = new Date(), y=today.getFullYear(), m=today.getMonth();
        var rangeStart = y+'-'+(m+1<10?'0':'')+(m+1)+'-01';
        var nextMonthEnd = new Date(y, m+2, 0).toISOString().slice(0,10);
        var farA = ga.reduce(function(max,r){var d=r.dep_date||'';return d>=rangeStart&&d<=nextMonthEnd&&d>max?d:max;},'');
        var farB = gb.reduce(function(max,r){var d=r.dep_date||'';return d>=rangeStart&&d<=nextMonthEnd&&d>max?d:max;},'');
        if (!farA) farA = ga[ga.length-1].dep_date||'';
        if (!farB) farB = gb[gb.length-1].dep_date||'';
        return farA > farB ? -1 : 1;
      }
      return da < db ? -1 : 1;
    });
    gKeys.forEach(function(k){
      var g=groups[k];var gid=k.replace(/[^a-z0-9\u4e00-\u9fa5]/g,'_');
      var mp=Math.min.apply(null,g.records.map(function(r){return r.retail||99999}));
      // 组内排序
      g.records = _sortRecords(g.records);
      html+='<div class="hm-group" onclick="if(event.target.closest(\'.card\'))return;toggleGroup(\''+gid+'\')"><div class="hm-group-hd">'
        +'<span class="hm-route">'+(g.isOpenJaw ? (g.dep+' → '+g.arr+' / '+g.retCity+' → '+(g.dep||'')) : (g.dep+' → '+g.arr))+'</span>'
        +'<span class="hm-nights">'+(g.nights?g.nights+'天':'自由')+'</span>'
        +'<span class="hm-count">'+g.records.length+'条</span>'
        +'<span class="hm-minprice">¥'+mp+'起</span>'
        +'<span class="hm-arrow">▾</span></div>'
        +'<div class="hm-group-bd" id="grp_'+gid+'" style="display:none">'
        +g.records.map(function(r){return hmCard(r)}).join('')+'</div></div>';
    });
  } else {
    // 不分组：扁平卡片列表
    html += records.slice(0, 150).map(function(r){return hmCard(r)}).join('');
  }
  list.innerHTML = html; list.scrollTop = 0;
}

// ═══════════════ 首页渲染 ═══════════════

function renderHome() {
  var list = document.getElementById('cardList');
  var today = new Date();
  var todayStr = today.toISOString().slice(0,10);
  var weekEnd = new Date(today.getTime() + 7 * 86400000);
  var weekEndStr = weekEnd.toISOString().slice(0,10);
  
  // 首页：热销 — 渲染全部千巡(供应商码130)报价卡片，按去程日期升序（2026-08-21 撤销原尾单规则）
  var records = DB.records.filter(function(r) {
    if (!_hasSeats(r) || !_validRecord(r)) return false;
    if (String(r.supplier) !== '130') return false;  // 仅指定供应商代码
    return true;
  });
  records.sort(function(a,b) { return (a.dep_date||'') < (b.dep_date||'') ? -1 : 1; });

  var html = _stickyBar();
  var useSimple = location.pathname.indexOf('_simple') !== -1;
  if (records.length) records.forEach(function(r) { html += useSimple ? renderCardSimple(r) : hmCard(r); });
  else html += '<div class="loading" style="padding:20px">暂无热销</div>';
  list.innerHTML = html;
}

function toggleGroup(gid) {
  var el = document.getElementById('grp_' + gid);
  if (!el) return;
  var isOpen = el.style.display !== 'none';
  el.style.display = isOpen ? 'none' : 'block';
  var arrow = el.parentElement.querySelector('.hm-arrow');
  if (arrow) arrow.textContent = isOpen ? '▾' : '▴';
}

// 2026-08-06: 城市名归一（缺口程判断用：济州==济州岛、亚庇==沙巴、仁川==首尔…）
function _normCity(c) {
  if (!c) return '';
  var m = {'济州':'济州岛','亚庇':'沙巴','樟宜':'新加坡','仁川':'首尔','金海':'釜山','成田':'东京','羽田':'东京','关西':'大阪','那霸':'冲绳','新千岁':'札幌','素万那普':'曼谷','清莱':'清迈','浦东':'上海','虹桥':'上海','禄口':'南京','萧山':'杭州','栎社':'宁波','兴东':'南通','硕放':'无锡','凤凰':'三亚'};
  return m[c] || c;
}

// 2026-08-06: 回程出发城市计算（缺口程分组用；逻辑与详情页 retCity 一致）
// 返回记录的回程出发城市名（已归一化）；无法判断返回 ''。
function _retDepCity(r) {
  if (!r || !r.flight_return) return '';
  var IATA_CITY = {'AAT':'阿勒泰', 'BKI':'沙巴', 'BKK':'曼谷', 'CAN':'广州', 'CGK':'雅加达', 'CGO':'郑州', 'CJJ':'清州', 'CJU':'济州岛', 'CKG':'重庆', 'CNX':'清迈', 'CSX':'长沙', 'CTS':'札幌', 'CTU':'成都', 'DAD':'岘港', 'DLC':'大连', 'DMK':'曼谷', 'DPS':'巴厘岛', 'DYG':'张家界', 'FOC':'福州', 'FUK':'福冈', 'GMP':'首尔', 'HAK':'海口', 'HAN':'河内', 'HGH':'杭州', 'HKG':'香港', 'HKT':'普吉岛', 'HND':'东京', 'HRB':'哈尔滨', 'ICN':'首尔', 'JXU':'嘉兴', 'KHH':'高雄', 'KIX':'大阪', 'KMG':'昆明', 'KUL':'吉隆坡', 'KWE':'贵阳', 'KWL':'桂林', 'LHW':'兰州', 'MFM':'澳门', 'MNL':'马尼拉', 'NGB':'宁波', 'NGO':'名古屋', 'NKG':'南京', 'NNG':'南宁', 'NRT':'东京', 'NTG':'南通', 'OKA':'冲绳', 'PEK':'北京', 'PKX':'北京', 'PQC':'富国岛', 'PUS':'釜山', 'PVG':'上海', 'SGN':'胡志明', 'SHA':'上海', 'SHE':'沈阳', 'SIN':'新加坡', 'SYX':'三亚', 'SZX':'深圳', 'TAO':'青岛', 'TFU':'成都', 'TNA':'济南', 'TPE':'台北', 'TSN':'天津', 'URC':'乌鲁木齐', 'WUH':'武汉', 'WUX':'无锡', 'XIY':'西安', 'XMN':'厦门', 'XNN':'西宁'};
  var retCity = r.arr;
  var retDepAirport = (r.return_dep_airport || '').trim();
  if (retDepAirport && retDepAirport !== r.arr) {
    if (IATA_CITY[retDepAirport]) {
      retCity = IATA_CITY[retDepAirport];
    } else {
      var knownCities = ['东京','大阪','首尔','济州','香港','澳门','普吉岛','曼谷','冲绳','三亚','巴厘岛','沙巴','新加坡','福冈','釜山','清迈','名古屋','札幌','仙台'];
      for (var ci = 0; ci < knownCities.length; ci++) {
        if (retDepAirport.indexOf(knownCities[ci]) !== -1) { retCity = knownCities[ci]; break; }
      }
      if (retCity === r.arr) {
        var airportCityMap = {'樟宜':'新加坡','济州':'济州岛','沙巴亚庇':'沙巴','苏南硕放':'无锡','南京禄口':'南京','杭州萧山':'杭州','宁波栎社':'宁波','南通兴东':'南通','三亚凤凰':'三亚','普吉岛':'普吉岛','曼谷素万那普':'曼谷','冲绳那霸':'冲绳','札幌新千岁':'札幌'};
        retCity = airportCityMap[retDepAirport] || (r.return_dep_airport_name||'') || retDepAirport.replace(/浦东|虹桥|仁川|金海|成田|羽田|新千岁|凤凰|栎社|素万那普|那霸|关西|国际|禄口|萧山/gi, '').trim();
      }
    }
  }
  return _normCity(retCity);
}

// ═══════════════ 真实字段渲染助手（机场名 / 航站楼 / 行李额）═══════════════
// 约定俗成机场名（2026-08-05 用户：统一成 城市+机场 简称，如 上海浦东/东京成田/首尔仁川）
var AIRPORT_CN = {
  // IATA → 规范名（name 为空时的兜底）
  'PVG':'上海浦东','SHA':'上海虹桥','HGH':'杭州萧山','NGB':'宁波栎社','NKG':'南京禄口','WUX':'无锡硕放','NTG':'南通兴东','SYX':'三亚凤凰',
  'ICN':'首尔仁川','GMP':'首尔金浦','PUS':'釜山金海','CJU':'济州岛','CJJ':'清州',
  'NRT':'东京成田','HND':'东京羽田','KIX':'大阪关西','FUK':'福冈','OKA':'冲绳那霸','CTS':'札幌新千岁','NGO':'名古屋中部',
  'BKK':'曼谷素万那普','DMK':'曼谷廊曼','HKT':'普吉岛','CNX':'清迈','DPS':'巴厘岛',
  'SIN':'新加坡樟宜','BKI':'沙巴亚庇','KUL':'吉隆坡','MFM':'澳门','HKG':'香港','KHH':'高雄','TPE':'台北桃园', 'PQC':'富国岛', 'URC':'乌鲁木齐地窝堡', 'DYG':'张家界荷花', 'KWL':'桂林两江', 'HAK':'海口美兰', 'XNN':'西宁曹家堡', 'JXU':'嘉兴', 'AAT':'阿勒泰', 'PEK':'北京首都', 'PKX':'北京大兴', 'CAN':'广州白云', 'SZX':'深圳宝安', 'TFU':'成都天府', 'CTU':'成都双流', 'CKG':'重庆', 'XIY':'西安咸阳', 'WUH':'武汉天河', 'CSX':'长沙黄花', 'KMG':'昆明长水', 'XMN':'厦门高崎', 'TAO':'青岛流亭', 'DLC':'大连周水子', 'SHE':'沈阳桃仙', 'TSN':'天津滨海', 'CGO':'郑州新郑', 'TNA':'济南遥墙', 'FOC':'福州长乐', 'KWE':'贵阳龙洞堡', 'NNG':'南宁吴圩', 'LHW':'兰州中川', 'HRB':'哈尔滨太平', 'MNL':'马尼拉', 'CGK':'雅加达', 'HAN':'河内', 'SGN':'胡志明', 'DAD':'岘港'
  };
var AIRPORT_ALIAS = {
  // 源表别名 → 规范名
  '浦东':'上海浦东','虹桥':'上海虹桥','萧山':'杭州萧山','禄口':'南京禄口','栎社':'宁波栎社','兴东':'南通兴东','硕放':'无锡硕放','凤凰':'三亚凤凰',
  '成田':'东京成田','羽田':'东京羽田','仁川':'首尔仁川','金浦':'首尔金浦','金海':'釜山金海',
  '关西':'大阪关西','那霸':'冲绳那霸','新千岁':'札幌新千岁','中部':'名古屋中部',
  '素万那普':'曼谷素万那普','廊曼':'曼谷廊曼','樟宜':'新加坡樟宜','亚庇':'沙巴亚庇',
  '济州':'济州岛','普吉岛':'普吉岛'
};
// 机场名规范化：源表原文（上海浦东/上海浦东机场/成田）→ 约定俗成名（上海浦东/东京成田）
function _airportCN(name, code) {
  var n = String(name || '').trim();
  if (n) {
    n = n.replace(/T\d+$/, '').replace(/机场$/, '').trim();   // 去航站楼残留 + 去"机场"后缀
    // 2026-08-13 紧急修复：机场名与机场码错位（供应商表 name/code 对调，如 return_dep_airport=CJU 但 name=上海浦东）
    // → name 与 code 权威城市不匹配时，以 code 查 AIRPORT_CN 为准，避免回程显示「上海浦东→济州岛」
    if (code && AIRPORT_CN[code]) {
      var std = AIRPORT_CN[code];   // 权威名：上海浦东 / 济州岛 / 东京成田 ...
      var city = std.replace(/浦东|虹桥|成田|羽田|关西|新千岁|那霸|仁川|金浦|樟宜|亚庇|素万那普|禄口|萧山|栎社|凤凰|国际/g, '').trim();
      var ok = (std.indexOf(n) !== -1) || (n.indexOf(std) !== -1) || (city && n.indexOf(city) !== -1);
      if (!ok) return std;
    }
    if (AIRPORT_ALIAS[n]) return AIRPORT_ALIAS[n];
    return n;
  }
  return AIRPORT_CN[code] || _apt(code) || code;
}
// 机场信息块：真实机场名优先（dep_airport_name 规范化），无则降级 IATA 完整名
// showCode=true（详情页）输出 机场名 [PVG] T2；showCode=false（报价卡片）输出 机场名 T2（简洁，不显示代码）
function _aptBlock(r, prefix, showCode) {
  var code = ((r[prefix + '_airport'] || '')).trim();
  var name = _airportCN(r[prefix + '_airport_name'], code);
  var iata = (showCode !== false && !name && /^[A-Z]{3}$/.test(code)) ? ' [' + code + ']' : '';
  var term = ((r[prefix + '_terminal'] || '')).trim();
  var termHtml = term ? '<span class="t-term">' + term + '</span>' : _term(r.airline, code);
  return name + iata + termHtml;
}
// 机场信息块（纯文本版，复制信息用）：机场中文名 + 航站楼，如「上海浦东T1」——2026-08-13 用户要求复制信息含机场/航站楼/时长
function _aptBlockTxt(r, prefix) {
  var code = ((r[prefix + '_airport'] || '')).trim();
  var name = _airportCN(r[prefix + '_airport_name'], code);
  var term = ((r[prefix + '_terminal'] || '')).trim();
  if (!term) term = String(_term(r.airline, code) || '').replace(/<[^>]*>/g, '').trim();
  return name + term;
}
// 飞行时长（纯文本，复制用）：seg='ret' 回程，否则去程；统一 1h45m 格式（2026-08-13 用户指定复制格式）
function _durFmt(s) {
  var str = String(s || '').trim();
  if (!str) return '';
  // 兼容 1h45 / 1h45m / 1时45分 / 2h05m 等
  var m = str.match(/^(\d+)\s*h\s*(\d+)?\s*m?$/i) || str.match(/^(\d+)\s*时\s*(\d+)?\s*分?$/);
  if (m) {
    var h = parseInt(m[1], 10), mi = parseInt(m[2] || 0, 10);
    if (h > 0 && mi > 0) return h + 'h' + mi + 'm';
    if (h > 0) return h + 'h';
    if (mi > 0) return mi + 'm';
    return '';
  }
  return str;
}
function _durTxt(r, seg) {
  var raw = (seg === 'ret') ? (r.return_duration || _fds(r.return_dep_time, r.return_arr_time, r.arr, r.dep))
                            : (r.duration || _fds(r.dep_time, r.arr_time, r.dep, r.arr));
  return _durFmt(raw);
}
// 航站楼块：真实字段优先，无则降级 _term()
function _termBlock(r, prefix) {
  var term = ((r[prefix + '_terminal'] || '')).trim();
  if (term) return '<span class="t-term">' + term + '</span>';
  return _term(r.airline, r[prefix + '_airport']);
}
// 行李单行渲染（2026-08-17 用户定案：单行「行李」标签，内容区分托运/手提；字体小一号 12px）
// ⚠ 补全数据（baggage_std 权威/产品定义，供应商无值时）内容前加「*」；供应商在线表数据不加
// 例：供应商 → 行李 | 🧳 托运行李 1件×20kg；补全 → 行李 | *🧳 托运行李 2件×23kg · 手提行李 1件8kg
function _bagRowsHtml(t, isStd) {
  var s = String(t || '').trim();
  if (!s) return '';
  var star = isStd ? '*' : '';
  return '<div class="detail-row" style="font-size:12px"><span class="label">行李</span><span class="value">' + star + '🧳 ' + s + '</span></div>';
}
// 详情页 行李/机型/餐食 行（2026-08-17 用户铁律：权限分层 + 打包产品行李额以供应商为准）
//   - 游客：只显示 供应商在线表采集到的行李额（baggage，统一格式单行，内容区分托运/手提）；供应商无值 → 不显示
//   - 登录内部人员：
//       · 供应商有行李额 → 显示供应商值；⚠ 网上权威值不予显示（打包产品口径，不误导）
//       · 供应商无行李额 → 显示 baggage_std（权威/产品定义，同样单行「行李」标签）
//     + 机型(aircraft)/餐食(meal)（补全信息，仅内部）
//   - 补全信息（aircraft/baggage_std/meal）绝不渲染给游客、绝不进游客侧复制文本
// 2026-08-17 联运分别标注：去程/回程不同航司（flight vs flight_return）→ 权威行李额分两行（去程行李/回程行李）
function _bagDetailRow(r) {
  var html = '';
  var b = ((r.baggage || '')).trim();
  if (b) html += _bagRowsHtml(b);
  if (_isStaffUser()) {
    var a = ((r.aircraft || '')).trim();
    var bs = ((r.baggage_std || '')).trim();
    var m = ((r.meal || '')).trim();
    if (a) html += '<div class="detail-row" style="font-size:12px"><span class="label">机型</span><span class="value">✈️ ' + a + '</span></div>';
    // 行李参考值：仅当供应商无值时才显示（打包产品以供应商为准，权威不误导）；补全数据内容前加「*」
    var isInterline = !!(r.flight && r.flight_return && (r.flight||'').slice(0,2) !== (r.flight_return||'').slice(0,2));
    if (isInterline) {
      // 联运：去程/回程 分别标注权威行李额（供应商无值时）
      if (!b) {
        if (bs) html += _bagRowsHtml('去程 ' + bs, true);
        var bsr = ((r.baggage_std_ret || '')).trim();
        if (bsr) html += _bagRowsHtml('回程 ' + bsr, true);
      }
    } else if (bs && !b) {
      html += _bagRowsHtml(bs, true);
    }
    if (m) html += '<div class="detail-row" style="font-size:12px"><span class="label">餐食</span><span class="value">🍽️ ' + m + '</span></div>';
  }
  return html;
}

// 统一报价卡片渲染（v4格式 — 直客价）
// 2026-08-13 紧急修复：_tz/_actualFlight 提升为全局（原定义在 renderCard 内部，
// 导致 openDetail/_fds 调用报 "not defined"，报价详情页无法打开）
function _tz(city) {
  var m = {
    '上海':8,'北京':8,'广州':8,'深圳':8,'杭州':8,'南京':8,'无锡':8,
    '成都':8,'重庆':8,'西安':8,'武汉':8,'长沙':8,'厦门':8,
    '三亚':8,'海口':8,'青岛':8,'大连':8,'沈阳':8,'天津':8,
    '郑州':8,'济南':8,'福州':8,'贵阳':8,'南宁':8,'兰州':8,
    '哈尔滨':8,'乌鲁木齐':8,'南通':8,'南通兴东':8,'宁波':8,'宁波栎社':8,
    '昆明':8,'嘉兴':8,'西宁':8,'阿勒泰':8,
    '香港':8,'澳门':8,'台北':8,
    '东京':9,'大阪':9,'名古屋':9,'冲绳':9,'札幌':9,'福冈':9,
    '首尔':9,'济州岛':9,'釜山':9,
    '曼谷':7,'普吉岛':7,'清迈':7,'清迈5天':7,'胡志明':7,'岘港':7,'河内':7,'雅加达':7,'富国岛':7,
    '沙巴':8,'巴厘岛':8,'新加坡':8,'吉隆坡':8,'马尼拉':8,
    '目的地':8
  };
  return m[city] !== undefined ? m[city] : 8;
}

function _actualFlight(depTime, arrTime, depCity, arrCity) {
  if (!depTime || !arrTime) return '';
  var p1 = depTime.split(':'), p2 = arrTime.split(':');
  if (p1.length<2 || p2.length<2) return '';
  var depUTC = parseInt(p1[0])*60 + parseInt(p1[1]) - _tz(depCity)*60;
  var arrUTC = parseInt(p2[0])*60 + parseInt(p2[1]) - _tz(arrCity)*60;
  var diff = arrUTC - depUTC;
  if (diff < 0) diff += 1440;
  var h = Math.floor(diff/60), min = diff % 60;
  if (h > 0 && min > 0) return h + 'h' + min + 'm';
  if (h > 0) return h + 'h';
  if (min > 0) return min + 'm';
  return '';
}

// 2026-08-13 紧急修复：_tz/_actualFlight 提升为全局（原定义在 renderCard 内部，
// 导致 openDetail/_fds 调用报 "not defined"，报价详情页无法打开）
function _tz(city) {
  var m = {
    '上海':8,'北京':8,'广州':8,'深圳':8,'杭州':8,'南京':8,'无锡':8,
    '成都':8,'重庆':8,'西安':8,'武汉':8,'长沙':8,'厦门':8,
    '三亚':8,'海口':8,'青岛':8,'大连':8,'沈阳':8,'天津':8,
    '郑州':8,'济南':8,'福州':8,'贵阳':8,'南宁':8,'兰州':8,
    '哈尔滨':8,'乌鲁木齐':8,'南通':8,'南通兴东':8,'宁波':8,'宁波栎社':8,
    '昆明':8,'嘉兴':8,'西宁':8,'阿勒泰':8,
    '香港':8,'澳门':8,'台北':8,
    '东京':9,'大阪':9,'名古屋':9,'冲绳':9,'札幌':9,'福冈':9,
    '首尔':9,'济州岛':9,'釜山':9,
    '曼谷':7,'普吉岛':7,'清迈':7,'清迈5天':7,'胡志明':7,'岘港':7,'河内':7,'雅加达':7,'富国岛':7,
    '沙巴':8,'巴厘岛':8,'新加坡':8,'吉隆坡':8,'马尼拉':8,
    '目的地':8
  };
  return m[city] !== undefined ? m[city] : 8;
}

function _actualFlight(depTime, arrTime, depCity, arrCity) {
  if (!depTime || !arrTime) return '';
  var p1 = depTime.split(':'), p2 = arrTime.split(':');
  if (p1.length<2 || p2.length<2) return '';
  var depUTC = parseInt(p1[0])*60 + parseInt(p1[1]) - _tz(depCity)*60;
  var arrUTC = parseInt(p2[0])*60 + parseInt(p2[1]) - _tz(arrCity)*60;
  var diff = arrUTC - depUTC;
  if (diff < 0) diff += 1440;
  var h = Math.floor(diff/60), min = diff % 60;
  if (h > 0 && min > 0) return h + 'h' + min + 'm';
  if (h > 0) return h + 'h';
  if (min > 0) return min + 'm';
  return '';
}

function renderCard(r) {
  var hasReturn = !!(r.flight_return && r.flight_return.trim());
  var sc = supplierColor(r.supplier);
  var seatsHtml = fmtSeatsBadge(r.seats);
  
  // 天数晚数显示
  var daysVal = getDays(r);
  var durationHtml = '';
  if (daysVal) {
    var d = parseInt(daysVal);
    if (!isNaN(d) && d > 0) {
      var ni = Math.max(0, d - 1);
      durationHtml = d + '天';
    }
  }
  
  // 航线头：支持多口岸（如上海-首尔/济州-上海）
  // IATA代码→城市名（数据源部分记录直接存 IATA 代码而非中文机场名）
  var IATA_CITY = {'AAT':'阿勒泰', 'BKI':'沙巴', 'BKK':'曼谷', 'CAN':'广州', 'CGK':'雅加达', 'CGO':'郑州', 'CJJ':'清州', 'CJU':'济州岛', 'CKG':'重庆', 'CNX':'清迈', 'CSX':'长沙', 'CTS':'札幌', 'CTU':'成都', 'DAD':'岘港', 'DLC':'大连', 'DMK':'曼谷', 'DPS':'巴厘岛', 'DYG':'张家界', 'FOC':'福州', 'FUK':'福冈', 'GMP':'首尔', 'HAK':'海口', 'HAN':'河内', 'HGH':'杭州', 'HKG':'香港', 'HKT':'普吉岛', 'HND':'东京', 'HRB':'哈尔滨', 'ICN':'首尔', 'JXU':'嘉兴', 'KHH':'高雄', 'KIX':'大阪', 'KMG':'昆明', 'KUL':'吉隆坡', 'KWE':'贵阳', 'KWL':'桂林', 'LHW':'兰州', 'MFM':'澳门', 'MNL':'马尼拉', 'NGB':'宁波', 'NGO':'名古屋', 'NKG':'南京', 'NNG':'南宁', 'NRT':'东京', 'NTG':'南通', 'OKA':'冲绳', 'PEK':'北京', 'PKX':'北京', 'PQC':'富国岛', 'PUS':'釜山', 'PVG':'上海', 'SGN':'胡志明', 'SHA':'上海', 'SHE':'沈阳', 'SIN':'新加坡', 'SYX':'三亚', 'SZX':'深圳', 'TAO':'青岛', 'TFU':'成都', 'TNA':'济南', 'TPE':'台北', 'TSN':'天津', 'URC':'乌鲁木齐', 'WUH':'武汉', 'WUX':'无锡', 'XIY':'西安', 'XMN':'厦门', 'XNN':'西宁'};
  var retCity = r.arr;
  var retDepAirport = (r.return_dep_airport||'').trim();
  if (retDepAirport && retDepAirport !== r.arr) {
    if (IATA_CITY[retDepAirport]) {
      retCity = IATA_CITY[retDepAirport];
    } else {
    // 从机场名提取城市名
    var knownCities = ['东京','大阪','首尔','济州','香港','澳门','普吉岛','曼谷','冲绳','三亚','巴厘岛','沙巴','新加坡','福冈','釜山','清迈','名古屋','札幌','仙台'];
    for (var ci=0; ci<knownCities.length; ci++) {
      if (retDepAirport.indexOf(knownCities[ci]) !== -1) { retCity = knownCities[ci]; break; }
    }
    // 机场名→城市名映射（已知不包含城市名的）
    if (retCity === r.arr) {
      var airportCityMap = {'樟宜':'新加坡','济州':'济州岛','沙巴亚庇':'沙巴','苏南硕放':'无锡','南京禄口':'南京','杭州萧山':'杭州','宁波栎社':'宁波','南通兴东':'南通','三亚凤凰':'三亚','普吉岛':'普吉岛','曼谷素万那普':'曼谷','冲绳那霸':'冲绳','札幌新千岁':'札幌'};
      retCity = airportCityMap[retDepAirport] || retDepAirport.replace(/浦东|虹桥|仁川|金海|成田|羽田|新千岁|凤凰|栎社|素万那普|那霸|关西|国际|禄口|萧山/gi,'').trim();
    }
    }
  }
  var routeHeader;
  if (hasReturn) {
    routeHeader = (r.dep||'') + '-' + (r.arr||'') + ' / ' + retCity + '-' + (r.dep||'');
  } else {
    routeHeader = (r.dep||'') + '-' + (r.arr||'');
  }
  
  // ─── 日期长格式：7月17日 （周五）───
  function _fmtDateLong(d) {
    if (!d) return '';
    var p = d.split('-');
    if (p.length < 3) return d;
    var m = parseInt(p[1]), day = parseInt(p[2]);
    var wk = ['日','一','二','三','四','五','六'];
    var dt = new Date(d);
    var w = isNaN(dt.getTime()) ? '' : '（周' + wk[dt.getDay()] + '）';
    return m + '月' + day + '日 ' + w;
  }
  
  // ─── 城市时区表（所有时间都是当地时间，转UTC消除时差）───
  function _tz(city) {
    var m = {
      '上海':8,'北京':8,'广州':8,'深圳':8,'杭州':8,'南京':8,'无锡':8,
      '成都':8,'重庆':8,'西安':8,'武汉':8,'长沙':8,'厦门':8,
      '三亚':8,'海口':8,'青岛':8,'大连':8,'沈阳':8,'天津':8,
      '郑州':8,'济南':8,'福州':8,'贵阳':8,'南宁':8,'兰州':8,
      '哈尔滨':8,'乌鲁木齐':8,'南通':8,'南通兴东':8,'宁波':8,'宁波栎社':8,
      '昆明':8,'嘉兴':8,'西宁':8,'阿勒泰':8,
      '香港':8,'澳门':8,'台北':8,
      '东京':9,'大阪':9,'名古屋':9,'冲绳':9,'札幌':9,'福冈':9,
      '首尔':9,'济州岛':9,'釜山':9,
      '曼谷':7,'普吉岛':7,'清迈':7,'清迈5天':7,'胡志明':7,'岘港':7,'河内':7,'雅加达':7,'富国岛':7,
      '沙巴':8,'巴厘岛':8,'新加坡':8,'吉隆坡':8,'马尼拉':8,
      '目的地':8
    };
    return m[city] !== undefined ? m[city] : 8;
  }
  
  // ─── 计算实际飞行时间（转UTC，消除时差干扰）───
  function _actualFlight(depTime, arrTime, depCity, arrCity) {
    if (!depTime || !arrTime) return '';
    var p1 = depTime.split(':'), p2 = arrTime.split(':');
    if (p1.length<2 || p2.length<2) return '';
    var depUTC = parseInt(p1[0])*60 + parseInt(p1[1]) - _tz(depCity)*60;
    var arrUTC = parseInt(p2[0])*60 + parseInt(p2[1]) - _tz(arrCity)*60;
    var diff = arrUTC - depUTC;
    if (diff < 0) diff += 1440;
    var h = Math.floor(diff/60), min = diff % 60;
    if (h > 0 && min > 0) return h + 'h' + min + 'm';
    if (h > 0) return h + 'h';
    if (min > 0) return min + 'm';
    return '';
  }
  
  // ─── 计算回程日期：出发日 + (天数-1) ───
  function _calcReturnDate(depDate, days) {
    if (!depDate || !days) return '';
    var d = parseInt(days);
    if (isNaN(d) || d <= 0) return '';
    var dt = new Date(depDate);
    if (isNaN(dt.getTime())) return '';
    dt.setDate(dt.getDate() + d - 1);
    return dt.toISOString().slice(0,10);
  }
  
  // ─── 去程行：文本流格式 ───
  var outDateLong = _fmtDateLong(r.dep_date);
  var outDuration = (r.duration || _actualFlight(r.dep_time, r.arr_time, r.dep, r.arr));
  var outboundAirport = _apt(r.dep_airport||'');
  var arrivalAirport = _apt(r.arr_airport||'');
  
  var outRow = '<div class="cf-leg">'
    + '<div class="cf-leg-cell"><span class="cf-leg-tag">去程</span><span class="cf-leg-dateflight">' + _fmtDateShort(r.dep_date) + ' ' + (r.flight||'') + '</span></div>'
    + '<div class="cf-leg-detail"><span class="cf-routepair">' + _aptBlock(r,'dep',false) + '-' + _aptBlock(r,'arr',false) + '</span>'
    + '<span class="cf-times">' + (r.dep_time||'') + '-' + (r.arr_time||'') + '（' + outDuration + '）' + '</span></div>'
    + '</div>';
  
  // ─── 回程行（与去程同格式）───
  var retHtml = '';
  if (hasReturn) {
    var retDate = r.return_date || _calcReturnDate(r.dep_date, daysVal);
    var retDepAirport = _apt(r.return_dep_airport||'');
    var retArrAirport = _apt(r.return_arr_airport||'');
    var retDuration = (r.return_duration || _actualFlight(r.return_dep_time, r.return_arr_time, r.arr, r.dep));
    
    // 回程出发日 = return_date 本身。红眼航班仅到达日为次日，出发日不变（2026-08-05 修复：移除错误的"减1天"逻辑）
    var retDateLong = _fmtDateLong(retDate);
    
    retHtml = '<div class="cf-leg">'
      + '<div class="cf-leg-cell"><span class="cf-leg-tag" style="background:#E8F5E9;color:#2E7D32">回程</span><span class="cf-leg-dateflight">' + _fmtDateShort(retDate) + ' ' + (r.flight_return||'') + '</span></div>'
      + '<div class="cf-leg-detail"><span class="cf-routepair">' + _aptBlock(r,'return_dep',false) + '-' + _aptBlock(r,'return_arr',false) + '</span>'
      + '<span class="cf-times">' + (r.return_dep_time||'') + '-' + (r.return_arr_time||'') + '（' + retDuration + '）' + '</span></div>'
      + '</div>';
  }
  
  return '<div class="card cf-card" data-rec=\'' + JSON.stringify(r).replace(/'/g,"&#39;") + '\' style="--card-stripe:' + sc.dot + ';--card-glow:' + (sc.glow||'rgba(0,0,0,0.05)') + '">'
    + '<div class="cf-header">'
    + '<span class="cf-route">' + routeHeader + '</span>'
    + (durationHtml ? '<span class="cf-duration-badge">' + durationHtml + '</span>' : '')
    + supTagHtml(r.supplier, 'cf-sup-tag')
    + '<span class="cf-airline-tag">' + (r.airline_cn||'') + '</span>'
    + (!hasReturn ? '<span class="cf-oneway-tag">需搭配回程</span>' : '')
    + '</div>'
    + outRow
    + retHtml
    + '<div class="cf-footer">'
    + '<span class="cf-price">¥' + (r.retail||0) + '<span class="cf-price-tax">（含税）</span></span>'
    + '<span class="cf-meta-group">' + seatsHtml + '</span>'
    + '<button class="cf-btn">咨询客服锁单</button>'
    + '</div></div>';
}

// ═══ 简化版卡片（用于首页热销/千巡）═══
function renderCardSimple(r) {
  var hasReturn = !!(r.flight_return && r.flight_return.trim());
  var daysVal = getDays(r);
  var durationStr = daysVal ? ' ' + daysVal + '天' : '';
  var IATA_CITY = {'AAT':'阿勒泰', 'BKI':'沙巴', 'BKK':'曼谷', 'CAN':'广州', 'CGK':'雅加达', 'CGO':'郑州', 'CJJ':'清州', 'CJU':'济州岛', 'CKG':'重庆', 'CNX':'清迈', 'CSX':'长沙', 'CTS':'札幌', 'CTU':'成都', 'DAD':'岘港', 'DLC':'大连', 'DMK':'曼谷', 'DPS':'巴厘岛', 'DYG':'张家界', 'FOC':'福州', 'FUK':'福冈', 'GMP':'首尔', 'HAK':'海口', 'HAN':'河内', 'HGH':'杭州', 'HKG':'香港', 'HKT':'普吉岛', 'HND':'东京', 'HRB':'哈尔滨', 'ICN':'首尔', 'JXU':'嘉兴', 'KHH':'高雄', 'KIX':'大阪', 'KMG':'昆明', 'KUL':'吉隆坡', 'KWE':'贵阳', 'KWL':'桂林', 'LHW':'兰州', 'MFM':'澳门', 'MNL':'马尼拉', 'NGB':'宁波', 'NGO':'名古屋', 'NKG':'南京', 'NNG':'南宁', 'NRT':'东京', 'NTG':'南通', 'OKA':'冲绳', 'PEK':'北京', 'PKX':'北京', 'PQC':'富国岛', 'PUS':'釜山', 'PVG':'上海', 'SGN':'胡志明', 'SHA':'上海', 'SHE':'沈阳', 'SIN':'新加坡', 'SYX':'三亚', 'SZX':'深圳', 'TAO':'青岛', 'TFU':'成都', 'TNA':'济南', 'TPE':'台北', 'TSN':'天津', 'URC':'乌鲁木齐', 'WUH':'武汉', 'WUX':'无锡', 'XIY':'西安', 'XMN':'厦门', 'XNN':'西宁'};
  var retCity = r.arr;
  var retDepAirport = (r.return_dep_airport||'').trim();
  if (retDepAirport && retDepAirport !== r.arr) {
    if (IATA_CITY[retDepAirport]) { retCity = IATA_CITY[retDepAirport]; }
    else {
    var kc = ['东京','大阪','首尔','济州','香港','澳门','普吉岛','曼谷','冲绳','三亚','巴厘岛','沙巴','新加坡','福冈','釜山','清迈','名古屋','札幌','仙台'];
    for (var ci=0; ci<kc.length; ci++) { if (retDepAirport.indexOf(kc[ci])!==-1) { retCity=kc[ci]; break; } }
    if (retCity===r.arr) {
      var acm={'樟宜':'新加坡','济州':'济州岛','沙巴亚庇':'沙巴','苏南硕放':'无锡','南京禄口':'南京','杭州萧山':'杭州','宁波栎社':'宁波','南通兴东':'南通','三亚凤凰':'三亚','普吉岛':'普吉岛','曼谷素万那普':'曼谷','冲绳那霸':'冲绳','札幌新千岁':'札幌'};
      retCity = acm[retDepAirport] || retDepAirport.replace(/浦东|虹桥|仁川|金海|成田|羽田|新千岁|凤凰|栎社|素万那普|那霸|关西|国际|禄口|萧山/gi,'').trim();
    }
    }
  }
  var routeStr = (r.dep||'') + '-' + (r.arr||'') + (hasReturn ? '/' + retCity + '-' + (r.dep||'') : '');
  // 显示用余位：员工→实际余位；游客→仅1-4
  var seatDispRender = _seatDispRender(r.seats);
  if (seatDispRender) seatDispRender = ' ' + seatDispRender;
  // 复制用余位：一律仅 1-4（铁律：复制文本与游客逐字节一致）
  var seatDispCopy = _seatDisp(r.seats);
  if (seatDispCopy) seatDispCopy = ' ' + seatDispCopy;
  var outDate = _fmtDateShort(r.dep_date);
  var outDur = (r.duration || _fds(r.dep_time, r.arr_time, r.dep, r.arr));
  var outRow = '<div class="cfs-row"><span class="cfs-icon">去</span>' + outDate + ' ' + (r.flight||'') + ' ' + _aptBlock(r,'dep',false) + ' ' + (r.dep_time||'') + ' ' + outDur + ' ' + (r.arr_time||'') + ' ' + _aptBlock(r,'arr',false) + '</div>';
  var retHtml = '';
  if (hasReturn) {
    var retDur = (r.return_duration || _fds(r.return_dep_time, r.return_arr_time, r.arr, r.dep));
    retHtml = '<div class="cfs-row"><span class="cfs-icon cfs-icon-ret">回</span>' + _fmtDateShort(r.return_date) + ' ' + (r.flight_return||'') + ' ' + _aptBlock(r,'return_dep',false) + ' ' + (r.return_dep_time||'') + ' ' + retDur + ' ' + (r.return_arr_time||'') + ' ' + _aptBlock(r,'return_arr',false) + '</div>';
  }
  // 生成咨询时复制的文本
  var retDurConsult = hasReturn ? (r.return_duration || _fds(r.return_dep_time, r.return_arr_time, r.arr, r.dep)) : '';
  // 铁律（REFERENCE §8）：复制信息严禁含供应商标签——任何登录态复制文本必须与游客逐字节一致
  var consultText = routeStr + (durationStr||'') + ' ¥' + (r.retail||0) + (seatDispCopy || '') + ' ' + (r.airline_cn||'')
    + '\n去程 ' + _fmtDateShort(r.dep_date) + ' ' + (r.flight||'') + ' ' + _aptBlockTxt(r,'dep') + ' ' + (r.dep_time||'') + ' ' + _durFmt(outDur) + ' ' + (r.arr_time||'') + ' ' + _aptBlockTxt(r,'arr')
    + (hasReturn ? '\n回程 ' + _fmtDateShort(r.return_date) + ' ' + (r.flight_return||'') + ' ' + _aptBlockTxt(r,'return_dep') + ' ' + (r.return_dep_time||'') + ' ' + _durFmt(retDurConsult) + ' ' + (r.return_arr_time||'') + ' ' + _aptBlockTxt(r,'return_arr') : '');
  var _sc2 = supplierColor(r.supplier);
  return '<div class="card cfs-card" data-rec=\'' + JSON.stringify(r).replace(/'/g,"&#39;") + '\' style="--card-stripe:' + _sc2.dot + ';--card-glow:' + (_sc2.glow||'rgba(0,0,0,0.05)') + '">'
    + '<div class="cfs-top"><span class="cfs-route">' + routeStr + '</span>'
    + durationStr + ' ' + supTagHtml(r.supplier, 'cfs-sup-tag')
    + ' <span class="cfs-price">¥' + (r.retail||0) + '</span>' + seatDispRender
    + ' <span class="cfs-airline">' + (r.airline_cn||'') + '</span>'
    + (!hasReturn ? '<span class="cf-oneway-tag">需搭配回程</span>' : '') + '</div>'
    + '<div class="cfs-body">'
    + '<div class="cfs-flights">' + outRow + retHtml + '</div>'
    + '<span class="cfs-consult" onclick="event.stopPropagation();consultCSwithCopy(\'' + consultText.replace(/'/g,"\\'") + '\',\'' + (r.dep||'') + '-' + (r.arr||'') + ' ' + (r.dep_date||'') + ' ¥' + (r.retail||0) + '\')">咨询</span>'
    + '</div></div>';
}

// 简化版飞行时间：3h20m
function _fds(dt, at, dc, ac) {
  return _actualFlight(dt, at, dc, ac);  // 2026-08-13 治本：统一用完整 _tz() 时区表，消除国际航线往返时长错算
}

// hmCard 别名 → 统一用 renderCard
function hmCard(r) { return renderCard(r); }

// ── 余位显示规则（2026-08-12 用户）：复制信息仅保留余位 1-4（>4/字面不显示）；
//    页面渲染：游客仅 1-4 显示；员工登录后（CURRENT_USER 非空）显示实际余位数（数字→余N、字面→原样） ──
// 复制/游客视图：仅数字 1-4 → '余N'，其余不显示
function _seatDisp(seats) {
  var s = String(seats == null ? '' : seats).trim();
  if (!s) return '';
  var m = s.match(/\d+/);
  if (!m) return '';
  var n = parseInt(m[0], 10);
  if (n >= 1 && n <= 4) return '余' + n;
  return '';
}
// 员工判定：所有登录用户（admin + 客服）均为员工，可见实际余位
function _isStaffUser() {
  try { return !!(CURRENT_USER && CURRENT_USER.user); } catch(e) { return false; }
}
// 员工视图：实际余位原样显示（含数字→余N；字面如充足/询/预留→原样；空→''）
function _seatDispAll(seats) {
  var s = String(seats == null ? '' : seats).trim();
  if (!s) return '';
  var l = s.toLowerCase();
  if (l === 'nan' || l === 'na') return '';
  var m = s.match(/\d+/);
  if (m) return '余' + s;
  return s;
}
// 页面渲染统一入口：员工→实际余位；游客→仅 1-4
function _seatDispRender(seats) {
  return _isStaffUser() ? _seatDispAll(seats) : _seatDisp(seats);
}

function fmtSeatsBadge(s) {
  var t = _seatDispRender(s);
  if (!t) return '';
  var n = parseInt(t.replace(/^余/, ''), 10);
  if (!isNaN(n) && n <= 3) return '<span class="seat-badge low">' + t + '</span>';
  return '<span class="seat-badge ok">' + t + '</span>';
}

function cardHTML(r) { return renderCard(r); }

// ═══════════════ 路线详情（全日期）═══════════════

// 获取同航司同路线的可搭配回程航班
function getReturnOptions(rec) {
  var air = (rec.flight || '').substring(0, 2).toUpperCase();  // HO
  // 同航司 + 反向路线 + 回程日期 ≥ 去程+1天
  // 2026-08-14 修正：取消原 +15 天上限。两段单程各自独立售卖，不存在「最长停留」耦合，
  // 该上限会把 53% 的合理配对（>15晚）误过滤掉；与报价库 combo.js 口径统一为「+1天及之后全部」。
  var minDate = new Date(rec.dep_date);
  minDate.setDate(minDate.getDate() + 1);
  var minDateStr = minDate.toISOString().slice(0,10);
  var rets = DB.records.filter(function(r) {
    return r.dep === rec.arr && r.arr === rec.dep
      && r.dep_date >= minDateStr
      && !((r.flight_return || '').trim())   // 仅「纯单程腿」可作回程；排除团票往返记录（当前 0 条，防未来误用其含双程的价格）
      && (r.flight || '').substring(0, 2).toUpperCase() === air;
  });
  rets.sort(function(a,b) { return (a.dep_date||'') < (b.dep_date||'') ? -1 : 1; });
  return rets;
}

// 组合总天数 = 回程日期 - 去程日期 + 1（HO 单程无 days 字段，2026-08-13 组合行程预览改版）
function _comboDays(outRec, ret) {
  if (!outRec || !ret || !outRec.dep_date || !ret.dep_date) return '';
  var d0 = new Date(outRec.dep_date), d1 = new Date(ret.dep_date);
  if (isNaN(d0.getTime()) || isNaN(d1.getTime())) return '';
  var n = Math.round((d1 - d0) / 86400000) + 1;
  return n > 0 ? n : '';
}
// 组合行程头部块（方案3：并入 detail-header 深色渐变底，白字适配，2026-08-13 v3）
// 去程+回程+合计+天数+同航司；航司并进合计行右侧；红点切换时 selectReturn 更新 comboHd* 元素
function _comboBarHtml(outRec, ret) {
  var days = _comboDays(outRec, ret);
  var total = (outRec.retail||0) + (ret.retail||0);
  var outSeat = _seatDispRender(outRec.seats);
  var retSeat = _seatDispRender(ret.seats);
  var airCn = outRec.airline_cn || outRec.airline || '';
  return '<div id="comboHeaderBar" style="margin-top:4px;font-size:11px;line-height:1.75;color:#fff">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1px">'
    + '<span id="comboHdTitle" style="font-size:11px;font-weight:600;letter-spacing:.3px">组合行程' + (days ? ' · ' + days + '天' : '') + (airCn ? ' · ' + airCn : '') + '</span>'
    + '</div>'
    + '<div><span style="opacity:.7">去程</span> ' + _fmtDateShort(outRec.dep_date) + ' ' + (outRec.flight||'') + ' ' + _aptBlockTxt(outRec,'dep') + '→' + _aptBlockTxt(outRec,'arr') + ' ' + (outRec.dep_time||'') + '-' + (outRec.arr_time||'') + (function(){var t=_durTxt(outRec);return t?' '+t:'';})() + (outSeat ? ' <span style="color:#FFE58A;font-size:10px">' + outSeat + '</span>' : '') + '</div>'
    + '<div id="comboHdRet"><span style="opacity:.7">回程</span> ' + _fmtDateShort(ret.dep_date) + ' ' + (ret.flight||'') + ' ' + _aptBlockTxt(ret,'dep') + '→' + _aptBlockTxt(ret,'arr') + ' ' + (ret.dep_time||'') + '-' + (ret.arr_time||'') + (function(){var t=_durTxt(ret);return t?' '+t:'';})() + (retSeat ? ' <span style="color:#FFE58A;font-size:10px">' + retSeat + '</span>' : '') + '</div>'
    + '<div id="comboHdTotal" style="display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid rgba(255,255,255,.3);margin-top:3px;padding-top:3px">'
    + '<span style="font-weight:700;font-size:14px">合计 ¥' + total + '<span style="font-size:10px;font-weight:400;opacity:.8">（含税）/人</span></span>'
    + '<span style="opacity:.85;font-size:11px">去¥' + (outRec.retail||0) + '+回¥' + (ret.retail||0) + '</span>'
    + '</div>'
    + '</div>';
}
// 组合行程完整复制文本（单条）：去程+回程+日期+价格+余位——selectReturn 与客服批量复制共用，保证格式逐字一致
// 铁律（REFERENCE §2.10）：复制文本严禁含供应商标签，客服登录同样必须与游客逐字节一致
function _comboText(outRec, ret) {
  var days = getDays(outRec) || _comboDays(outRec, ret);
  var outSeat = _seatDisp(outRec.seats);
  var retSeat = _seatDisp(ret.seats);
  var total = (outRec.retail||0) + (ret.retail||0);
  var t = (outRec.dep||'') + '-' + (outRec.arr||'') + '/' + (ret.dep||'') + '-' + (ret.arr||'') + (days ? ' ' + days + '天' : '')
    + '\n' + (outRec.flight||'') + ' ' + _aptBlockTxt(outRec,'dep') + '-' + _aptBlockTxt(outRec,'arr') + ' ' + (outRec.dep_time||'') + '-' + (outRec.arr_time||'') + ' ' + _durTxt(outRec)
    + '\n' + (ret.flight||'') + ' ' + _aptBlockTxt(ret,'dep') + '-' + _aptBlockTxt(ret,'arr') + ' ' + (ret.dep_time||'') + '-' + (ret.arr_time||'') + ' ' + _durTxt(ret)
    + '\n' + _fmtDateShort(outRec.dep_date) + '-' + _fmtDateShort(ret.dep_date)
    + '\n去¥' + (outRec.retail||0) + (outSeat ? '(' + outSeat + ')' : '') + ' + 回¥' + (ret.retail||0) + (retSeat ? '(' + retSeat + ')' : '') + ' = 合计¥' + total;
  return t;
}
// 渲染可搭配回程航班选项（回程列表；组合行程预览已移至详情页顶部固定栏 _comboBarHtml）
// 2026-08-13 客服专属：登录员工可见每行勾选框 + 底部「复制选中组合」按钮；游客不显示
function renderReturnOptions(rec) {
  var rets = getReturnOptions(rec);
  if (!rets.length) return '';
  var staff = _isStaffUser();
  var html = '<div class="detail-section" style="padding:0 8px"><h4 style="padding:0 8px">需搭配回程航班 <span style="font-size:11px;font-weight:400;color:var(--text-light)">' + (staff ? '同航司·可勾选多条复制' : '同航司·可选日期') + '</span></h4>'
    + '<div style="max-height:200px;overflow-y:auto;margin-top:6px">';
  rets.forEach(function(r, idx) {
    html += '<div class="rodate" onclick="selectReturn(' + idx + ')" id="ropt_' + idx + '">'
      + (staff ? '<label class="ro-multi-wrap" onclick="event.stopPropagation()" ontouchend="event.stopPropagation()"><input type="checkbox" class="ro-multi" data-idx="' + idx + '" onchange="updateMultiBtn();toggleMultiChecked(this)"></label>' : '')
      + '<span class="ro-check" style="color:var(--red)">' + (idx === 0 ? '●' : '○') + '</span>';
    html += '<span class="ro-flight">' + (r.flight||'') + '</span>'
      + '<span class="ro-date">' + _wd(r.dep_date) + '</span>'
      + '<span class="ro-time">' + (r.dep_time||'') + '</span>'
      + '<span class="ro-price">¥' + (r.retail||0) + '</span>'
      + '<span class="ro-seats">' + _seatDispRender(r.seats) + '</span>'
      + '</div>';
  });
  html += '</div>';
  // 客服专属：复制选中组合（仅登录员工可见；计数由 onchange 动态刷新）
  if (staff) {
    html += '<div style="margin-top:8px"><button id="multiCopyBtn" onclick="copySelectedCombos()" style="width:100%;padding:10px;border:none;border-radius:8px;background:var(--red);color:#fff;font-size:13px;font-weight:700;cursor:pointer">📋 复制选中组合</button></div>';
  }
  html += '</div>';
  // 保存回程列表供切换
  _curReturnOptions = rets;
  return html;
}
// 客服勾选行视觉标记：勾选 → 行加 multi-checked 背景（浅绿/深绿，与红点红高亮区分）
function toggleMultiChecked(cb) {
  try {
    var row = cb.closest('.rodate, .odate');
    if (row) row.classList.toggle('multi-checked', !!cb.checked);
  } catch(e) {}
}
// 客服批量复制：动态刷新按钮计数（去程数×回程数的有效组合数）
function updateMultiBtn() {  try {
    var btn = document.getElementById('multiCopyBtn');
    if (!btn) return;
    var n = _comboCount();
    btn.textContent = '📋 复制选中组合' + (n ? ' (' + n + ')' : '');
  } catch(e) {}
}
// 客服批量复制：多去程 × 多回程 纯笛卡尔积组合复制（2026-08-13 v3）
// 勾选的去程（其他去程日期区，_sameRoute）× 勾选的回程（回程列表，_curReturnOptions）全量逐对组合，
// 不做日期窗口过滤（客服自行判断合理性）；去程/回程任一方未勾选时：去程默认当前记录，回程默认当前选中项。
function _checkedOutRecs() {
  var list = [];
  document.querySelectorAll('.odate-multi:checked').forEach(function(cb) {
    var idx = parseInt(cb.getAttribute('data-idx'), 10);
    if (_sameRoute && _sameRoute[idx]) list.push(_sameRoute[idx]);
  });
  return list;
}
function _checkedRetRecs() {
  var list = [];
  document.querySelectorAll('.ro-multi:checked').forEach(function(cb) {
    var idx = parseInt(cb.getAttribute('data-idx'), 10);
    if (_curReturnOptions && _curReturnOptions[idx]) list.push(_curReturnOptions[idx]);
  });
  return list;
}
// 2026-08-14 修复多选组合倒挂：每条去程日期重算各自合法回程窗口（getReturnOptions(out)），
// 再与"已勾选回程集合"取交集——仅保留落在该去程窗口内的配对，杜绝回程早于去程的非法组合。
function _pairRetsForOut(out) {
  var checked = _checkedRetRecs();
  var outRets = getReturnOptions(out); // 该去程自己的合法回程窗口（同 DB.records 引用）
  if (checked.length) {
    // 仅保留落在该去程合法窗口内的已勾选回程；一条都不落 → 该去程无可行组合，直接跳过。
    // 2026-08-14 修正：原先退回 outRets[0] 会凭空造出用户没勾选的组合（错报价风险）。
    return checked.filter(function(r) { return outRets.indexOf(r) !== -1; });
  }
  // 未勾选任何回程：默认取该去程窗口首条；对当前详情则尊重红点选中项（保持原行为）
  if (out === currentDetailRec && _curReturnOptions.length) {
    return [_curReturnOptions[_selectedReturnIdx] || _curReturnOptions[0]];
  }
  return outRets.length ? [outRets[0]] : [];
}
// 计算组合数 = Σ(每条去程的可行回程数)（2026-08-14 改为按各自窗口计，按钮计数用）
function _comboCount() {
  var outs = _checkedOutRecs();
  if (!outs.length && currentDetailRec) outs = [currentDetailRec];
  var total = 0;
  outs.forEach(function(out) { total += _pairRetsForOut(out).length; });
  return total;
}
// 组合深链：去程+回程（带回程参数，handleDeepLink 自动选中第一条组合，2026-08-13）
function _comboDeepLink(outRec, ret) {
  return location.origin + location.pathname
    + '?dep=' + encodeURIComponent(outRec.dep||'')
    + '&arr=' + encodeURIComponent(outRec.arr||'')
    + '&flight=' + encodeURIComponent(outRec.flight||'')
    + '&date=' + encodeURIComponent(outRec.dep_date||'')
    + '&ret_flight=' + encodeURIComponent(ret.flight||'')
    + '&ret_date=' + encodeURIComponent(ret.dep_date||'');
}
// 客服批量复制：去程×回程全量笛卡尔积组合，多条之间空行分隔，与单条复制逐字同格式
function copySelectedCombos() {
  if (!currentDetailRec) return;
  var outs = _checkedOutRecs();
  if (!outs.length) outs = [currentDetailRec];
  // 2026-08-14 修复：每条去程重算各自合法回程窗口，再与已勾选回程取交集，避免回程早于去程的倒挂组合；
  // 透明记录「无可配回程」的去程，避免静默丢失（Fix③ 2026-08-14）。
  var lines = [], skipped = [];
  outs.forEach(function(out) {
    var prs = _pairRetsForOut(out);
    if (!prs.length) { skipped.push(out.dep_date || ''); return; }  // 该去程无可配回程 → 记录并跳过，不静默消失
    prs.forEach(function(ret) {
      lines.push(_comboText(out, ret));
    });
  });
  if (!lines.length) { showToast('⚠ 所选去程均无可用的合法回程组合，请调整勾选', true); return; }
  // 2026-08-13 深链：当前红点选中的组合（_deepUrl 由 openDetail/selectReturn 维护），客人打开所见即所得；
  // 统一推广文案（与 copyAll 同款）
  var text = lines.join('\n\n') + '\n\n' + _PROMO + '\n🔗 ' + _deepUrl;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function() {
      showToast('✅ 已复制 ' + lines.length + ' 条组合（' + (outs.length - skipped.length) + ' 个去程）'
        + (skipped.length ? '；' + skipped.length + ' 个去程无可配回程已跳过：' + skipped.join('、') : '')
        + '，可直接粘贴', true);
    }).catch(function(e) {
      showToast('⚠ 复制失败，请手动复制（' + (e && e.message ? e.message : e) + '）', true);
    });
  } else { prompt('复制以下内容：', text); }
  recordAction('copy_multi_return', {count:lines.length, quote:text.slice(0,200), deep:_deepUrl});
}
// 客服专属：动态刷新「复制选中日期」按钮计数（其他去程日期多选）
function updateODateBtn() {
  try {
    var btn = document.getElementById('odateMultiBtn');
    if (!btn) return;
    var n = document.querySelectorAll('.odate-multi:checked').length;
    btn.textContent = '📋 复制选中日期' + (n ? ' (' + n + ')' : '');
  } catch(e) {}
}
// 客服专属：复制勾选的去程日期报价（头部航线+航班行 + 每个勾选日期一行），多条空行分隔
function copySelectedDates() {
  var checked = document.querySelectorAll('.odate-multi:checked');
  if (!checked.length) { showToast('⚠ 请先勾选要复制的去程日期'); return; }
  // 头部 = 单日期复制文本去掉日期行（航线+航班行），复用 openDetail 已生成的 _shareTextSingle
  var head = (_shareTextSingle || '').replace(/\n\d+月\d+日.*$/, '');
  var lines = [];
  checked.forEach(function(cb) {
    var idx = parseInt(cb.getAttribute('data-idx'), 10);
    var r = _sameRoute[idx];
    if (!r) return;
    var shortD = (function(d){if(!d)return'';var p=d.split('-');if(p.length<3)return d;var wk=['日','一','二','三','四','五','六'];var dt=new Date(d);var w=isNaN(dt.getTime())?'':'('+wk[dt.getDay()]+')';return parseInt(p[1])+'月'+parseInt(p[2])+'日'+w;})(r.dep_date);
    var shortRet = r.return_date ? (function(d){if(!d)return'';var p=d.split('-');if(p.length<3)return d;var wk=['日','一','二','三','四','五','六'];var dt=new Date(d);var w=isNaN(dt.getTime())?'':'('+wk[dt.getDay()]+')';return parseInt(p[1])+'月'+parseInt(p[2])+'日'+w;})(r.return_date) : '';
    lines.push(head + '\n' + shortD + (shortRet ? '-' + shortRet : '') + ' ¥' + (r.retail||0) + (function(){var t=_seatDisp(r.seats);return t?' '+t:'';})());
  });
  if (!lines.length) { showToast('⚠ 请先勾选要复制的去程日期'); return; }
  // 2026-08-13 深链：当前红点选中的组合（_deepUrl）+ 统一推广文案（与 copyAll 同款）
  var text = lines.join('\n\n') + '\n\n' + _PROMO + '\n🔗 ' + _deepUrl;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function() { showToast('✅ 已复制 ' + lines.length + ' 个去程日期，可直接粘贴'); });
  } else { prompt('复制以下内容：', text); }
  recordAction('copy_multi_date', {count:lines.length, quote:text.slice(0,200)});
}

// 选择回程航班（更新顶部固定栏组合行程）
var _selectedReturnIdx = 0;
var _curReturnOptions = [];
function selectReturn(idx) {
  _selectedReturnIdx = idx;
  document.querySelectorAll('.rodate').forEach(function(el, i) {
    var check = el.querySelector('.ro-check');
    if (check) check.textContent = i === idx ? '●' : '○';
    if (check) check.style.color = i === idx ? 'var(--red)' : '';
  });
  // 更新组合行程（方案A：头部内嵌，comboHd*）
  var ret = _curReturnOptions[idx];
  if (!ret) return;
  var outRec = currentDetailRec;
  var total = (outRec.retail||0) + (ret.retail||0);
  var days = _comboDays(outRec, ret);
  var retSeat = _seatDispRender(ret.seats);
  // 头部组合行程：回程行 + 合计行 + 标题天数
  var hdRet = document.getElementById('comboHdRet');
  if (hdRet) {
    hdRet.innerHTML = '<span style="opacity:.7">回程</span> ' + _fmtDateShort(ret.dep_date) + ' ' + (ret.flight||'') + ' ' + _aptBlockTxt(ret,'dep') + '→' + _aptBlockTxt(ret,'arr') + ' ' + (ret.dep_time||'') + '-' + (ret.arr_time||'') + (retSeat ? ' <span style="color:#FFE58A;font-size:10px">' + retSeat + '</span>' : '');
  }
  var hdTitle = document.getElementById('comboHdTitle');
  if (hdTitle) {
    var airCn3 = outRec.airline_cn || outRec.airline || '';
    hdTitle.textContent = '组合行程' + (days ? ' · ' + days + '天' : '') + (airCn3 ? ' · ' + airCn3 : '');
  }
  var hdTotal = document.getElementById('comboHdTotal');
  if (hdTotal) {
    hdTotal.innerHTML = '<span style="font-weight:700;font-size:14px">合计 ¥' + total + '<span style="font-size:10px;font-weight:400;opacity:.8">（含税）/人</span></span>'
      + '<span style="opacity:.85;font-size:11px">去¥' + (outRec.retail||0) + '+回¥' + (ret.retail||0) + '</span>';
  }
  // 更新分享文本（复用 _comboText，与客服批量复制逐字一致）
  var outDays = getDays(outRec) || _comboDays(outRec, ret);
  _shareText = _comboText(outRec, ret);
  recordAction('return_select', {route:(outRec.dep||'')+'→'+(outRec.arr||'') + '/' + (ret.dep||'')+'→'+(ret.arr||''),flight:outRec.flight,date:outRec.dep_date,days:outDays,price:total,quote:_shareText});
  // 更新深链 — 包含回程选择
  _deepUrl = location.origin + location.pathname
    + '?dep=' + encodeURIComponent(outRec.dep||'')
    + '&arr=' + encodeURIComponent(outRec.arr||'')
    + '&flight=' + encodeURIComponent(outRec.flight||'')
    + '&date=' + encodeURIComponent(outRec.dep_date||'')
    + '&ret_flight=' + encodeURIComponent(ret.flight||'')
    + '&ret_date=' + encodeURIComponent(ret.dep_date||'');
}

function _fmtDateShort(d) {
  if (!d) return '';
  var p = d.split('-'); if (p.length < 3) return d;
  var wk = ['日','一','二','三','四','五','六'];
  var dt = new Date(d);
  var w = isNaN(dt.getTime()) ? '' : '(' + wk[dt.getDay()] + ')';
  return parseInt(p[1]) + '月' + parseInt(p[2]) + '日' + w;
}
// 周几标注（完整日期+括号周几）：2026-08-18 → 2026-08-18(二)；空/非法原样返回（2026-08-13 列表显示增强）
function _wd(d) {
  if (!d) return '';
  var p = d.split('-'); if (p.length < 3) return d;
  var wk = ['日','一','二','三','四','五','六'];
  var dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return d + '(' + wk[dt.getDay()] + ')';
}

// ═══════════ 关键排序规则（2026-08-17 用户定案，先推线上）═══════════
// 同航班号 + 同日 + 不同供应商代码的报价 → 默认选中一条：
//   1. 最低价  2. 同价 → 余位少  3. 余位相同 → 供应商代码排前（空代码排最后）
function _seatRank(s) {
  var m = String(s == null ? '' : s).match(/\d+/);
  return m ? parseInt(m[0], 10) : 999999;  // 字面值（充足/10+ 等）取数字；无数字视为大量排后
}
function _pickBestRec(list) {
  return list.slice().sort(function(a, b) {
    var pa = Number(a.retail) || 0, pb = Number(b.retail) || 0;
    if (pa !== pb) return pa - pb;                            // 1. 最低价
    var sa = _seatRank(a.seats), sb = _seatRank(b.seats);
    if (sa !== sb) return sa - sb;                            // 2. 余位少
    var ca = String(a.supplier || ''), cb = String(b.supplier || '');
    if (!ca && cb) return 1;
    if (ca && !cb) return -1;
    return ca.localeCompare(cb);                              // 3. 供应商代码排前
  })[0];
}

function openDetail(rec) {
  if (!rec) return;
  // 2026-08-17 关键排序规则：同航班号+同日+不同供应商 → 自动切到最优（最低价/余位少/供应商代码前）
  var _keyRecs = DB.records.filter(function(r) {
    return r.dep === rec.dep && r.arr === rec.arr && r.flight === rec.flight && r.dep_date === rec.dep_date
      && getDays(r) === getDays(rec)
      && ((r.flight_return||'').trim() === (rec.flight_return||'').trim());
  });
  if (_keyRecs.length > 1) {
    var _best = _pickBestRec(_keyRecs);
    if (_best) rec = _best;
  }
  currentDetailRec = rec;
  recordAction('detail_view', {supplier:rec.supplier,flight:rec.flight,route:(rec.dep||'')+'→'+(rec.arr||''),date:rec.dep_date,days:getDays(rec),price:rec.retail});
  
  // 找到同航线的所有日期（同出发、到达、航班、天数、回程航班）
  var sameRoute = DB.records.filter(function(r) {
    if (r.dep !== rec.dep || r.arr !== rec.arr || r.flight !== rec.flight) return false;
    if (getDays(r) !== getDays(rec)) return false;
    // 团票：回程航班也需一致
    var recRet = (rec.flight_return||'').trim();
    var rRet = (r.flight_return||'').trim();
    if (recRet && rRet && recRet !== rRet) return false;
    return true;
  });
  sameRoute.sort(function(a,b) { return (a.dep_date||'') < (b.dep_date||'') ? -1 : 1; });
  // 2026-08-17 关键排序规则：同航班同日多供应商 → 其他去程日期按日期去重，每日期保留最优条（避免重复红框红点）
  var _byDate = {};
  sameRoute.forEach(function(r) { (_byDate[r.dep_date] = _byDate[r.dep_date] || []).push(r); });
  sameRoute = Object.keys(_byDate).map(function(dt) { return _pickBestRec(_byDate[dt]); });
  
  var f1 = rec.flight || '';
  var f2 = rec.flight_return || '';
  var hasReturn = !!(f2 && f2.trim());
  // 单程自由组合：打开新详情时重置回程红点索引，避免沿用上一条详情的残留选中（与头部默认 return[0] 保持一致）
  if (!hasReturn) _selectedReturnIdx = 0;
  var typeStr = hasReturn ? '团票组合' : '自由组合';
  var flightStr = hasReturn ? f1 + '/' + f2 : f1;
  
  // 生成长链接（含所有可去程日期 + 余位 + 价格）
  var deepUrl = location.origin + location.pathname
    + '?dep=' + encodeURIComponent(rec.dep||'')
    + '&arr=' + encodeURIComponent(rec.arr||'')
    + '&flight=' + encodeURIComponent(rec.flight||'')
    + '&date=' + encodeURIComponent(rec.dep_date||'');
  
  // 其他日期列表 — 内联 onclick + ●○ 红点（用索引找record）
  // 2026-08-13 客服专属：登录员工每行加勾选框（多选复制日期报价），游客不显示
  var staff = _isStaffUser();
  var dateListHtml = sameRoute.map(function(r, idx) {
    var active = r.dep_date === rec.dep_date;
    var sel = active ? ' style="background:var(--red-light);border:1px solid var(--red)"' : '';
    var dot = active ? '<span class="odate-dot" style="color:var(--red)">●</span>' : '<span class="odate-dot">○</span>';
    return '<div class="odate" onclick="openDetail(_sameRoute[' + idx + '])"' + sel + '>'
      + (staff ? '<label class="odate-multi-wrap" onclick="event.stopPropagation()" ontouchend="event.stopPropagation()"><input type="checkbox" class="odate-multi" data-idx="' + idx + '" onchange="updateODateBtn();updateMultiBtn();toggleMultiChecked(this)"></label>' : '')
      + dot
      + '<span>' + _wd(r.dep_date) + '</span>'
      + (r.return_date ? '<span style="margin:0 4px;color:var(--text-light);font-size:11px">→' + _wd(r.return_date) + '</span>' : '')
      + '<span class="odate-price">¥' + (r.retail||0) + '</span>'
      + '<span class="odate-seats">' + _seatDispRender(r.seats) + '</span>'
      + (r.dep_time ? '<span class="odate-time">' + r.dep_time + (r.duration?' · '+r.duration:'') + '</span>' : '')
      + '</div>';
  }).join('');
  
  // 保存到全局，供其他日期点击切换
  _sameRoute = sameRoute;
  
  // ─── 格式化日期（复用renderCard中的命名空间，实际是全局同名函数）
  var outDateLong = (function(d){if(!d)return'';var p=d.split('-');if(p.length<3)return d;var m=parseInt(p[1]),day=parseInt(p[2]);var wk=['日','一','二','三','四','五','六'];var dt=new Date(d);var w=isNaN(dt.getTime())?'':'（周'+wk[dt.getDay()]+'）';return m+'月'+day+'日 '+w;})(rec.dep_date);
  var outDuration = (rec.duration || _actualFlight(rec.dep_time,rec.arr_time,rec.dep,rec.arr));
  var retDateLong = '', retDuration = '';
  if (hasReturn) {
    retDateLong = (function(d){if(!d)return'';var p=d.split('-');if(p.length<3)return d;var m=parseInt(p[1]),day=parseInt(p[2]);var wk=['日','一','二','三','四','五','六'];var dt=new Date(d);var w=isNaN(dt.getTime())?'':'（周'+wk[dt.getDay()]+'）';return m+'月'+day+'日 '+w;})(rec.return_date);
    retDuration = (rec.return_duration || _actualFlight(rec.return_dep_time,rec.return_arr_time,rec.arr,rec.dep));
  }

  // 多口岸回程城市
  var retCity = rec.arr;
  var retDepAirport = (rec.return_dep_airport||'').trim();
  // IATA代码→城市名（数据源部分记录直接存 IATA 代码而非中文机场名，如 NRT/HND）
  var IATA_CITY = {'AAT':'阿勒泰', 'BKI':'沙巴', 'BKK':'曼谷', 'CAN':'广州', 'CGK':'雅加达', 'CGO':'郑州', 'CJJ':'清州', 'CJU':'济州岛', 'CKG':'重庆', 'CNX':'清迈', 'CSX':'长沙', 'CTS':'札幌', 'CTU':'成都', 'DAD':'岘港', 'DLC':'大连', 'DMK':'曼谷', 'DPS':'巴厘岛', 'DYG':'张家界', 'FOC':'福州', 'FUK':'福冈', 'GMP':'首尔', 'HAK':'海口', 'HAN':'河内', 'HGH':'杭州', 'HKG':'香港', 'HKT':'普吉岛', 'HND':'东京', 'HRB':'哈尔滨', 'ICN':'首尔', 'JXU':'嘉兴', 'KHH':'高雄', 'KIX':'大阪', 'KMG':'昆明', 'KUL':'吉隆坡', 'KWE':'贵阳', 'KWL':'桂林', 'LHW':'兰州', 'MFM':'澳门', 'MNL':'马尼拉', 'NGB':'宁波', 'NGO':'名古屋', 'NKG':'南京', 'NNG':'南宁', 'NRT':'东京', 'NTG':'南通', 'OKA':'冲绳', 'PEK':'北京', 'PKX':'北京', 'PQC':'富国岛', 'PUS':'釜山', 'PVG':'上海', 'SGN':'胡志明', 'SHA':'上海', 'SHE':'沈阳', 'SIN':'新加坡', 'SYX':'三亚', 'SZX':'深圳', 'TAO':'青岛', 'TFU':'成都', 'TNA':'济南', 'TPE':'台北', 'TSN':'天津', 'URC':'乌鲁木齐', 'WUH':'武汉', 'WUX':'无锡', 'XIY':'西安', 'XMN':'厦门', 'XNN':'西宁'};
  if (retDepAirport && retDepAirport !== rec.arr) {
    if (IATA_CITY[retDepAirport]) {
      retCity = IATA_CITY[retDepAirport];
    } else {
      var kc = ['东京','大阪','首尔','济州','香港','澳门','普吉岛','曼谷','冲绳','三亚','巴厘岛','沙巴','新加坡','福冈','釜山','清迈','名古屋','札幌','仙台'];
      for (var ci=0; ci<kc.length; ci++) { if (retDepAirport.indexOf(kc[ci]) !== -1) { retCity = kc[ci]; break; } }
      if (retCity === rec.arr) {
        var acm = {'樟宜':'新加坡','济州':'济州岛','沙巴亚庇':'沙巴','苏南硕放':'无锡','南京禄口':'南京','杭州萧山':'杭州','宁波栎社':'宁波','南通兴东':'南通','三亚凤凰':'三亚','普吉岛':'普吉岛','曼谷素万那普':'曼谷','冲绳那霸':'冲绳','札幌新千岁':'札幌'};
        retCity = acm[retDepAirport] || retDepAirport.replace(/浦东|虹桥|仁川|金海|成田|羽田|新千岁|凤凰|栎社|素万那普|那霸|关西|国际|禄口|萧山/gi,'').trim();
      }
    }
  }

  var seatsBadge = (function(s){var t=_seatDispRender(s);if(!t)return'';var n=parseInt(t.replace(/^余/,''),10);if(!isNaN(n)&&n<=3)return'<span style="color:#FF7D00;font-weight:600">'+t+'</span>';return'<span style="color:var(--green)">'+t+'</span>';})(rec.seats);

  // ─── 复制文本（单日期 / 全日期）───
  // 铁律（REFERENCE §8）：复制信息严禁含供应商标签——任何登录态复制文本必须与游客逐字节一致
  // 2026-08-13：getDays 为空（HO 单程）时不输出孤立的"天"字
  var _rDays = getDays(rec);
  var routeLabel = (rec.dep||'') + '-' + (rec.arr||'') + (hasReturn ? '/' + retCity + '-' + (rec.dep||'') : '') + (_rDays ? ' ' + _rDays + '天' : '');
  // 2026-08-13：复制信息含机场全名+航站楼+飞行时长（_aptBlockTxt/_durTxt），替代原 _apt() 城市名
  // 格式：航班 机场1-机场2 时间1-时间2(时长)  如 MU5041 上海浦东T1-首尔仁川T1 09:10-11:55(1h45m)
  var flightLine = f1 + ' ' + _aptBlockTxt(rec,'dep') + '-' + _aptBlockTxt(rec,'arr') + ' ' + (rec.dep_time||'') + '-' + (rec.arr_time||'') + ' ' + _durTxt(rec);
  var retFlightLine = hasReturn ? f2 + ' ' + _aptBlockTxt(rec,'return_dep') + '-' + _aptBlockTxt(rec,'return_arr') + ' ' + (rec.return_dep_time||'') + '-' + (rec.return_arr_time||'') + ' ' + _durTxt(rec,'ret') : '';
  var dateRange = (rec.dep_date||'') + (rec.return_date ? '-' + rec.return_date : '');
  
  var shareTextSingle = routeLabel + '\n' + flightLine
    + (retFlightLine ? '\n' + retFlightLine : '')
    + '\n' + (function(d){if(!d)return'';var p=d.split('-');if(p.length<3)return d;var wk=['日','一','二','三','四','五','六'];var dt=new Date(d);var w=isNaN(dt.getTime())?'':'('+wk[dt.getDay()]+')';return parseInt(p[1])+'月'+parseInt(p[2])+'日'+w;})(rec.dep_date)
    + (rec.return_date ? '-' + (function(d){if(!d)return'';var p=d.split('-');if(p.length<3)return d;var wk=['日','一','二','三','四','五','六'];var dt=new Date(d);var w=isNaN(dt.getTime())?'':'('+wk[dt.getDay()]+')';return parseInt(p[1])+'月'+parseInt(p[2])+'日'+w;})(rec.return_date) : '')
    + ' ¥' + (rec.retail||0) + (function(){var t=_seatDisp(rec.seats);return t?' '+t:'';})();
  
  // 全日期文本：格式同单日期，每行一个日期
  var shareTextAll = shareTextSingle.replace(/\n\d+月\d+日.*$/, '') + '\n';
  sameRoute.forEach(function(r, i) {
    var shortD = (function(d){if(!d)return'';var p=d.split('-');if(p.length<3)return d;var wk=['日','一','二','三','四','五','六'];var dt=new Date(d);var w=isNaN(dt.getTime())?'':'('+wk[dt.getDay()]+')';return parseInt(p[1])+'月'+parseInt(p[2])+'日'+w;})(r.dep_date);
    var shortRet = r.return_date ? (function(d){if(!d)return'';var p=d.split('-');if(p.length<3)return d;var wk=['日','一','二','三','四','五','六'];var dt=new Date(d);var w=isNaN(dt.getTime())?'':'('+wk[dt.getDay()]+')';return parseInt(p[1])+'月'+parseInt(p[2])+'日'+w;})(r.return_date) : '';
    shareTextAll += shortD + (shortRet ? '-' + shortRet : '') + ' ¥' + (r.retail||0) + (function(){var t=_seatDisp(r.seats);return t?' '+t:'';})() + '\n';
  });
  shareTextAll = shareTextAll.trim();
  
  _shareTextSingle = shareTextSingle;
  _shareTextAll = shareTextAll;
  _shareText = shareTextSingle;

  var html = '<div class="detail-header" style="position:-webkit-sticky;position:sticky;top:0;z-index:20">'
    + '<div class="dh-top"><span class="detail-close" onclick="closeDetail()">← 返回</span><span class="detail-x" onclick="closeDetail()">✕</span></div>'
    // 2026-08-17 路由标题精简：团票正常往返 → 上海⇄济州岛；多口岸回程(retCity≠arr) → 保留 去-到/回-去；单程 → 上海-济州岛
    + '<div class="dh-route">' + (hasReturn
        ? (retCity === (rec.arr||'') ? (rec.dep||'') + '⇄' + (rec.arr||'') : (rec.dep||'') + '-' + (rec.arr||'') + '/' + retCity + '-' + (rec.dep||''))
        : (rec.dep||'') + '-' + (rec.arr||''))
      + ' ' + supTagHtml(rec.supplier, 'dh-sup-tag') + '</div>'
    // 方案A（2026-08-13 v2）：单程自由组合 → 组合行程并入头部（去程+回程+合计），不再有独立固定栏；
    // 团票 → 原 dh-flight 去程时刻行（2026-08-17 组合栏方案用户否决不采用，恢复原格式）
    + (!hasReturn
      ? (function(){ var _rets0 = getReturnOptions(rec); _curReturnOptions = _rets0; return _rets0.length ? _comboBarHtml(rec, _rets0[0]) : '<div class="dh-flight">' + _aptBlock(rec, 'dep') + '→' + _aptBlock(rec, 'arr') + '</div>'; })()
      : '<div class="dh-flight"><span class="dh-time">' + (rec.dep_time||'') + '</span> <span class="dh-dur">' + outDuration + '</span> <span class="dh-time">' + (rec.arr_time||'') + '</span> ' + _aptBlock(rec, 'dep') + '→' + _aptBlock(rec, 'arr') + '</div>')
    + (hasReturn ? '<div class="dh-dates">' + (rec.dep_date||'') + (rec.return_date ? ' → ' + rec.return_date : '') + '  •  ' + (getDays(rec)||'') + '天</div>' : '')
    + '</div>'
    // 单程自由组合：默认复制文本 = 当前头部显示的默认组合（去程+第一个回程），与可见组合行程/深链一致
    // 修复（2026-08-14）：原默认 _shareText 仅为去程单腿，与头部组合行程+深链(return[0])不一致 → 所见非所得
    + (function(){ if (!hasReturn && _curReturnOptions.length) { _shareText = _comboText(rec, _curReturnOptions[_selectedReturnIdx] || _curReturnOptions[0]); } return ''; })()
    + '<div class="detail-body">'
    // 方案3（2026-08-13 v3）：单程自由组合价格/航司已并入头部组合行程（合计行含 去¥+回¥·航司），body 零冗余；
    // 团票 → 保留原价格行 + 航班信息区块（2026-08-17 组合栏方案用户否决，恢复原格式）
    + (hasReturn ? '<div class="dp-row"><span class="dp-price">¥' + (rec.retail||0) + '</span><span class="dp-tax">（含税）/人</span><span class="dp-seat">' + seatsBadge + '</span></div>' : '')
    + _bagDetailRow(rec)  // 机型/行李/餐食 三行（单程自由组合 + 团票 均显示；游客=仅供应商行李额，内部=+机型+餐食）
    + (hasReturn
      ? '<div class="detail-section"><h4>航班信息 <span style="font-size:11px;font-weight:400;color:var(--text-light)">' + typeStr + (hasReturn ? ' · 大人小孩同价' : '') + '</span></h4>'
        + '<div class="detail-row" style="font-size:12px"><span class="label">航司</span><span class="value">' + (rec.airline_cn||rec.airline||'—') + '</span></div>'
      : '')
    + (hasReturn
      ? '<div class="detail-row" style="border-bottom:none;font-size:12px"><span class="label">去程</span><span class="value">' + outDateLong + ' ' + f1 + ' ' + _aptBlock(rec, 'dep') + ' ' + (rec.dep_time||'') + ' ' + outDuration + ' ' + (rec.arr_time||'') + ' ' + _aptBlock(rec, 'arr') + '</span></div>'
        + '<div class="detail-row" style="border-bottom:none;font-size:12px"><span class="label">回程</span><span class="value">' + retDateLong + ' ' + f2 + ' ' + _aptBlock(rec, 'return_dep') + ' ' + (rec.return_dep_time||'') + ' ' + retDuration + ' ' + (rec.return_arr_time||'') + ' ' + _aptBlock(rec, 'return_arr') + '</span></div>'
        + '</div>'
      : '')
    // 其他去程日期（默认折叠）— 与当前天数、回程航班一致
    + '<div class="dd-toggle" onclick="toggleDates()">📅 其他去程日期 <span id="darrow">▸</span></div>'
    + '<div id="ddates" style="display:none;padding:0 8px 8px">' + dateListHtml
    + (staff ? '<div style="margin-top:8px"><button id="odateMultiBtn" onclick="copySelectedDates()" style="width:100%;padding:10px;border:none;border-radius:8px;background:var(--red);color:#fff;font-size:13px;font-weight:700;cursor:pointer">📋 复制选中日期</button></div>' : '')
    + '</div>'
    + (!hasReturn ? renderReturnOptions(rec) : '')
    + (staff ? '<div style="padding:0 12px 8px"><button onclick="copyStaffInfo()" style="width:100%;padding:10px;border:1px dashed #c0392b;border-radius:8px;background:#fff7f5;color:#c0392b;font-size:13px;font-weight:700;cursor:pointer">📋 复制（含行李、机型、餐食信息）</button></div>' : '')
    + '<div class="detail-actions">'
    + '<button class="detail-share" onclick="copyAll()">📋 复制全部</button>'
    + '<button class="detail-consult" onclick="consultCSwithCopyAll(\'' + (rec.dep||'') + '-' + (rec.arr||'') + ' ' + (rec.dep_date||'') + ' ¥' + (rec.retail||0) + '\')">💬 咨询客服</button>'
    + '</div>';

  document.getElementById('modalContent').innerHTML = html;
  document.getElementById('detailModal').classList.add('active');
  // 客服专属：初始化批量复制按钮计数（默认 1 去程 × 1 回程 = 1 条）
  if (_isStaffUser()) { try { updateMultiBtn(); } catch(e) {} }
  
  // 深链 = 当前红点选中的组合（2026-08-13）：单程且回程列表非空 → 当前去程+默认第一个回程；
  // 团票/无回程 → 详情页基础深链。红点移动时 selectReturn 会同步更新 _deepUrl。
  if (!hasReturn && _curReturnOptions && _curReturnOptions.length) {
    _deepUrl = _comboDeepLink(rec, _curReturnOptions[0]);
  } else {
    _deepUrl = deepUrl;
  }
}

// 折叠/展开其他日期，同时切换复制文本
function toggleDates() {
  var el = document.getElementById('ddates');
  var arrow = document.getElementById('darrow');
  if (!el) return;
  var isOpen = el.style.display !== 'none';
  el.style.display = isOpen ? 'none' : 'block';
  if (arrow) arrow.textContent = isOpen ? '▸' : '▾';
  recordAction('detail_date_toggle', {action:isOpen?'close':'open'});
  // 单程自由组合：折叠=当前选中组合（去程+回程）与头部一致；展开=全部去程日期（不含回程，与"其他去程日期"语义一致）
  // 团票：沿用原 折叠=单日期 / 展开=全日期
  var _tdRec = currentDetailRec;
  if (_tdRec && !(_tdRec.flight_return && _tdRec.flight_return.trim()) && _curReturnOptions.length) {
    _shareText = isOpen ? _shareTextAll : _comboText(_tdRec, _curReturnOptions[_selectedReturnIdx] || _curReturnOptions[0]);
  } else {
    _shareText = isOpen ? _shareTextSingle : _shareTextAll;
  }
}

// ═══════════════ 复制全部信息 ═══════════════

var _shareText = '', _shareTextSingle = '', _shareTextAll = '', _deepUrl = '', _sameRoute = [], _curReturnOptions = [], _lastShareText = '';
var _PROMO = '———————————————\n更多特价机票（日韩港澳东南亚等）\n请详见小程序，实时更新，\n更多惊喜，戳这里查👇';

function copyAll() {
  var text = _shareText + '\n\n' + _PROMO + '\n🔗 ' + _deepUrl;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function() { showToast('✅ 已复制全部信息，可直接粘贴'); });
  } else {
    prompt('复制以下内容：', text);
  }
  recordAction('copy_all', {route:_shareText,quote:_shareText + '\n\n' + _PROMO + '\n🔗 ' + _deepUrl});
}

// 复制给客服（2026-08-17 用户定案，仅内部员工可见）：机票信息 + 内部补全信息（机型/餐食/行李参考；余位=实际值）
// 与游客侧复制（copyAll/copySearchResults/copyFilterResults）互不影响——原位置复制逻辑不变
function copyStaffInfo() {
  var rec = currentDetailRec;
  if (!rec) { showToast('无可复制内容'); return; }
  var hasReturn = !!(rec.flight_return && rec.flight_return.trim());
  var _rDays = getDays(rec);
  var routeLabel = (rec.dep||'') + '-' + (rec.arr||'') + (hasReturn ? '/' + (rec.arr||'') + '-' + (rec.dep||'') : '') + (_rDays ? ' ' + _rDays + '天' : '');
  var flightLine = (rec.flight||'') + ' ' + _aptBlockTxt(rec,'dep') + '-' + _aptBlockTxt(rec,'arr') + ' ' + (rec.dep_time||'') + '-' + (rec.arr_time||'') + ' ' + _durTxt(rec);
  var retFlightLine = hasReturn ? (rec.flight_return||'') + ' ' + _aptBlockTxt(rec,'return_dep') + '-' + _aptBlockTxt(rec,'return_arr') + ' ' + (rec.return_dep_time||'') + '-' + (rec.return_arr_time||'') + ' ' + _durTxt(rec,'ret') : '';
  var lines = [routeLabel, flightLine];
  if (retFlightLine) lines.push(retFlightLine);
  // 行李一行 + 机型/餐食一行（2026-08-17 用户定案：分二行排列；行李=供应商优先，无则参考值）
  var bg = ((rec.baggage || '')).trim();
  var bs = ((rec.baggage_std || '')).trim();
  var bagLine = bg || bs;
  if (bagLine) lines.push(bagLine);
  var acMealLine = [((rec.aircraft||'')).trim(), ((rec.meal||'')).trim()].filter(Boolean).join(' ');
  if (acMealLine) lines.push(acMealLine);
  // 日期行（余位=游客口径：仅数字1-4显示「余N」，>4/字面值不可复制）
  var dateStr = (function(d){if(!d)return'';var p=d.split('-');if(p.length<3)return d;var wk=['日','一','二','三','四','五','六'];var dt=new Date(d);var w=isNaN(dt.getTime())?'':'('+wk[dt.getDay()]+')';return parseInt(p[1])+'月'+parseInt(p[2])+'日'+w;})(rec.dep_date);
  var retStr = rec.return_date ? '-' + (function(d){if(!d)return'';var p=d.split('-');if(p.length<3)return d;var wk=['日','一','二','三','四','五','六'];var dt=new Date(d);var w=isNaN(dt.getTime())?'':'('+wk[dt.getDay()]+')';return parseInt(p[1])+'月'+parseInt(p[2])+'日'+w;})(rec.return_date) : '';
  var seat = (function(){var t=_seatDisp(rec.seats);return t?' '+t:'';})();
  lines.push(dateStr + retStr + ' ¥' + (rec.retail||0) + seat);
  var text = lines.join('\n') + '\n\n' + _PROMO + '\n🔗 ' + _deepUrl;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function() { showToast('✅ 已复制（含内部参考信息）'); });
  } else {
    prompt('复制以下内容：', text);
  }
  recordAction('copy_staff', {route:(rec.dep||'')+'→'+(rec.arr||''),flight:rec.flight,quote:text.slice(0,200)});
}

function showToast(msg, persistent) {
  var t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast';
    t.style.cssText = 'position:fixed;bottom:120px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.85);color:#fff;padding:12px 22px;border-radius:10px;font-size:13px;z-index:500;transition:opacity .3s;white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,.3);cursor:pointer';
    t.title = '点击关闭';
    t.addEventListener('click', function(){ t.style.opacity = '0'; });
    document.body.appendChild(t); }
  t.textContent = msg; t.style.opacity = '1';
  // 2026-08-06: persistent=true 不自动消失（一直显示，点击关闭）；默认 2500ms 消失
  if (persistent) {
    clearTimeout(t._timer);
  } else {
    clearTimeout(t._timer);
    t._timer = setTimeout(function(){ t.style.opacity = '0'; }, 2500);
  }
}

// 简化卡「咨询」= 复制文本 + 弹客服
function consultCSwithCopy(text, label) {
  recordAction('copy_card', {route:text,quote:text});
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function() {
      // 2026-08-06: 一直显示（点击关闭）+ 新文案
      showToast('✅ 已复制航班信息，可直接粘贴咨询', true);
      consultCS(label);
    });
  } else {
    prompt('复制以下内容：', text);
    consultCS(label);
  }
}

// 详情页「咨询客服」= 复制完整信息（含深链）+ 弹客服（2026-08-05 用户需求：咨询同时复制）
function consultCSwithCopyAll(quote) {
  consultCSwithCopy(_shareText + '\n\n' + _PROMO + '\n🔗 ' + _deepUrl, quote);
}

function closeDetail() {
  document.getElementById('detailModal').classList.remove('active');
}
document.getElementById('detailModal').onclick = function(e) {
  if (e.target.id === 'detailModal') closeDetail();
};

// ═══════════════ 客服咨询 ═══════════════

function consultCS(quote) {
  var detail = currentDetailRec || {};
  recordAction('consult', {supplier:detail.supplier,flight:detail.flight,route:(detail.dep||'')+'→'+(detail.arr||''),date:detail.dep_date,price:detail.retail||0,quote:quote});
  var html = '<div style="text-align:center;padding:16px">'
    + '<img src="img/qr_cs.png" alt="客服" style="width:140px;height:140px;border-radius:8px">'
    + '<p style="margin-top:10px;font-size:13px;color:#4E5969">' + quote + '</p>'
    + '<p style="margin-top:6px;color:#E60012;font-weight:700">长按识别二维码联系客服</p></div>';
  document.getElementById('csModalContent').innerHTML = html;
  document.getElementById('csModal').classList.add('active');
  sendStats({action:'consult_request',quote:quote,ts:new Date().toISOString()});
}
document.getElementById('csModal').onclick = function(e) {
  if (e.target.id === 'csModal') document.getElementById('csModal').classList.remove('active');
};
document.getElementById('qrCs').onclick = function() {
  recordAction('qr_click', {route:(CURRENT_USER?CURRENT_USER.user:'')+'→咨询'});
  openCSMulti();
};

// ═══════════════ 分享（含二维码）═══════════════

function _buildShareResultsText() {
  var recs = _getFilteredRecs();
  if (!recs.length) return '';
  var groups = _buildCopyGroups(recs);
  var trailer = _PROMO + '\n🔗 ' + location.origin + location.pathname + _filterUrlQuery();
  var batches = _buildCopyBatchTexts(groups, 100, trailer);
  return batches.length ? batches[0].text : '';
}

// 2026-08-26 修复 B+ 回归：分享/尾部二维码是否携带"搜索·筛选结果"取决于是否存在有效筛选上下文。
// 自由文本搜索(searchFilterAndShow)会置 _isSearchView=true；但筛选弹窗(applyFilter→renderFiltered)只填 _filter 不置 _isSearchView。
// 旧 B+ 仅以 _isSearchView 为开关，导致筛选后分享回退成干净沙箱链接——现改为以下任一成立即视为"活跃筛选上下文"：
//   · _filter 任意字段非空（出发/到达/天数/月份/多选日期）
//   · _isSearchView 为 true（自由文本搜索）
function _hasActiveFilterCtx() {
  return !!(_filter && (_filter.dep || _filter.arr || _filter.days || _filter.month || (_filter.dates && _filter.dates.length))) || _isSearchView;
}
function openShareModal(mode) {
  recordAction('share_open', {});
  var url = _hasActiveFilterCtx() ? (location.origin + location.pathname + _filterUrlQuery()) : (location.origin + location.pathname);
  // 筛选/结果页场景：优先展示全部报价（与「复制文字」、二维码一致）；单卡场景回落 _shareText
  var isFilterCtx = _hasActiveFilterCtx() && _getFilteredRecs().length;
  var _tabLabels = {home:'首页',hot:'热门',japan:'日本',korea:'韩国',seasia:'东南亚',ganga:'港澳',domestic:'国内'};
  var _tabLabel = _tabLabels[currentTab] || '特价';
  var resultsText = isFilterCtx ? _buildShareResultsText() : '';
  var text = resultsText || _shareText || ('🌍 环球度假 · ' + _tabLabel + '特价机票每日更新\n' + url);
  _lastShareText = text;

  var html = '<div style="text-align:center;padding:20px 16px">'
    + '<p style="font-size:15px;font-weight:700;color:var(--text)">分享报价</p>'
    + '<div style="margin:14px 0;background:var(--tag-bg);border-radius:8px;padding:12px;font-size:12px;color:var(--text-secondary);white-space:pre-wrap;word-break:break-all;line-height:1.7;text-align:left;max-height:300px;overflow:auto">' + _escHtml(text) + '</div>'
    + '<div style="display:flex;gap:8px">'
    + '<button class="share-copy" onclick="copyShareText()" style="flex:1;padding:10px;border:none;border-radius:8px;background:var(--brand,var(--red));color:#fff;font-weight:700;font-size:13px">📋 复制文字</button>'
    + '<button class="share-wx" onclick="openCSMulti()" style="flex:1;padding:10px;border:none;border-radius:8px;background:var(--green);color:#fff;font-weight:700;font-size:13px">💬 客服咨询</button>'
    + '</div>'
    + '<div id="qrCanvasWrap" style="width:200px;height:200px;margin:12px auto;border-radius:4px;overflow:hidden;background:#fff;padding:8px;box-sizing:content-box"></div>'
    + '<p style="font-size:12px;color:var(--text);font-weight:600">📲 长按二维码转发给好友</p>'
    + '<p style="font-size:11px;color:var(--text-light);margin-top:4px">好友长按图片即可识别，或点链接直达11条结果</p>'
    + '<div style="margin-top:12px;background:var(--red-light);border-radius:8px;padding:10px;font-size:11px;color:var(--red);text-align:left">💡 已自动复制报价，可直接粘贴到微信发送</div>'
    + '<button onclick="closeShareModal()" style="margin-top:10px;padding:8px 24px;border:none;border-radius:6px;background:var(--tag-bg);color:var(--text-secondary);font-size:13px;cursor:pointer">关闭</button>'
    + '</div>';

  document.getElementById('shareModalContent').innerHTML = html;
  document.getElementById('shareModal').classList.add('active');

  setTimeout(function() {
    var wrap = document.getElementById('qrCanvasWrap');
    if (wrap && typeof QRCode !== 'undefined') {
      wrap.innerHTML = '';
      new QRCode(wrap, { text: url, width: 200, height: 200 });
    }
  }, 50);
}

function copyShareText() {
  var text = _lastShareText || _shareText || ('🌍 环球度假 · 特价机票每日更新\n' + location.href);
  recordAction('share_copy', {quote:text});
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function() { showToast('✅ 已复制，可直接粘贴'); });
  } else { prompt('复制：', text); }
}

function openCSMulti() {
  // 客服咨询：先复制当前报价文本（方便扫码后直接粘贴给客服），再弹出企业微信多人客服二维码（扫码系统自动分配在线客服）
  var _csText = _buildShareResultsText() || _shareText || _lastShareText || ('🌍 环球度假 · 特价机票每日更新\n' + location.href);
  if (navigator.clipboard) { navigator.clipboard.writeText(_csText).then(function(){ showToast('✅ 已复制报价，可直接粘贴'); }); } else { prompt('复制：', _csText); }
  recordAction('share_copy', {quote:_csText});
  var html = '<div style="text-align:center;padding:16px">'
    + '<p style="font-size:15px;font-weight:700;color:var(--text)">企业微信客服</p>'
    + '<img src="img/qr_cs.png" alt="企业微信客服" style="width:180px;height:180px;border-radius:8px;margin:12px 0">'
    + '<p style="font-size:13px;color:#4E5969">扫码后系统自动分配在线客服</p>'
    + '<p style="font-size:11px;color:var(--text-light);margin-top:4px">已自动复制报价，添加客服后可直接粘贴</p></div>';
  document.getElementById('csModalContent').innerHTML = html;
  document.getElementById('csModal').classList.add('active');
  recordAction('cs_multi_open', {});
}

function closeShareModal() {
  document.getElementById('shareModal').classList.remove('active');
}
document.getElementById('shareModal').onclick = function(e) {
  if (e.target.id === 'shareModal') closeShareModal();
};

// ═══════════════ Tab切换 ═══════════════

// 2026-08-25 ③ 深链残留修复：导航切换时同步重置浏览器地址栏深链参数+分享卡片复制信息+尾部二维码
function _resetDeepLinkAndShare() {
  // 1) 清空筛选条件 → 地址栏深链参数(?f_*)随之清空
  _filter = { dep: '', arr: '', days: '', month: '', date: '', dates: [] };
  _updateFilterUrl();            // 重置地址栏为干净 pathname（移除 ?f_* 残留）
  // 2) 清空上一次搜索/详情残留的复制文本与深链
  _shareText = ''; _shareTextSingle = ''; _shareTextAll = '';
  _lastShareText = ''; _deepUrl = ''; _sameRoute = []; _curReturnOptions = [];
  _isSearchView = false;
  // 3) 尾部「分享报价」二维码重置为当前干净页面 URL
  if (typeof generateFooterQR === 'function') generateFooterQR();
}

document.getElementById('tabBar').onclick = function(e) {
  if (e.target.classList.contains('tab')) {
    _resetDeepLinkAndShare();   // ③ 切换即重置深链 + 分享残留
    document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
    e.target.classList.add('active');
    var tab = e.target.dataset.tab;
    if (tab === 'home') {
      // 首页：一周内余位≤3
      currentTab = 'home';
      document.getElementById('cardList').scrollTop = 0;
      render();
      recordAction('tab_home', {route:'home→'});
      return;
    }
    currentTab = tab;
    document.getElementById('cardList').scrollTop = 0;
    render();
    recordAction('tab_switch', {route:tab+'→'});
  }
};

// ═══════════════ 全量用户行为追踪 ═══════════════

// 统一记录：action=事件名, data={supplier,flight,route,date,days,price,quote,tag}
function recordAction(action, data) {
  data = data || {};
  var payload = {
    timestamp: new Date().toISOString(),
    action: action,
    user: CURRENT_USER ? CURRENT_USER.user : (localStorage.getItem('visitor_id') || '游客'),
    role: CURRENT_USER ? CURRENT_USER.role : 'guest',
    supplier: data.supplier || '',
    flight: data.flight || '',
    route: data.route || '',
    date: data.date || '',
    days: data.days || '',
    price: data.price || 0,
    quote: data.quote || '',
    page: location.pathname,
    tab: currentTab || '',
    filter: 'dep=' + (_filter.dep||'') + '&arr=' + (_filter.arr||'') + '&days=' + (_filter.days||'') + '&month=' + (_filter.month||'') + '&date=' + ((_filter.dates||[]).join(',')),
    ua: (navigator.userAgent || '').substring(0, 80),
    // ── STATS-DIM v1 多维度 ──
    src: _statsSrc(),
    device: _statsDev(),
    os: _statsOS(),
    browser: _statsBr(),
    entry: _statsEntry(),
    referrer: (document.referrer || '').substring(0, 120),
    session: _statsSid(),
    screen: (window.screen ? (screen.width + 'x' + screen.height) : ''),
    theme: _statsTheme(),
    lang: (navigator.language || ''),
    group: _statsGroup(data),
    card: _statsCard(data),
    copy_len: (data.quote || '').length
  };
  // 发到 stats_server
  if (STATS_API_URL) {
    try {
      fetch(STATS_API_URL, {
        method: 'POST', body: JSON.stringify(payload),
        headers: {'Content-Type': 'text/plain'}, keepalive: true
      }).catch(function(){});
    } catch(e) {}
  }
  // 写本地 localStorage
  try {
    var key = 'click_stats_' + new Date().toISOString().split('T')[0];
    var arr = JSON.parse(localStorage.getItem(key) || '[]');
    arr.push(payload);
    if (arr.length > 2000) arr.splice(0, arr.length - 2000);
    localStorage.setItem(key, JSON.stringify(arr));
  } catch(e) {}
}

// ═══════════════ 启动 ═══════════════

// ── 分权限：员工/游客 ──
function esc(s){ return (s==null?'':''+s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function isStaff(){ return false; }

// 供应商标签框/权限：统一在 core.js（照搬客服版 canSeeSupplier/supTagHtml/supStripe，逐字一致；
// 内容=供应商代码由子库数据天然决定），此处不再另写，避免覆盖。

// 确保登录状态恢复（兼容不同浏览器）
(function() {
  var saved = localStorage.getItem('current_user');
  if (saved) {
    try {
      var u = JSON.parse(saved);
      if (u && u.user) {
        CURRENT_USER = u;
      }
    } catch(e) {}
  }
})();

// 应用已保存的颜色主题（默认环球红焰）
applyTheme(pqThemeGet());

loadDB();
// 自由行套餐模块：仅当 index.html 引入 free_tour.js 时加载并渲染（正式版=自营 only）
if (window.FreeTour) FreeTour.load();

// 全局卡片点击委托 — 所有 .hmcard 和 .card 通过 data-rec 触发详情
document.getElementById('cardList').addEventListener('click', function(e) {
  var card = e.target.closest('.card[data-rec]');
  if (!card) return;
  // 2026-08-21 BUG一修复：阻止冒泡到外层 .hm-group 的 toggleGroup，避免点开详情时分组被自动折叠
  e.stopPropagation();
  // 如果点击的是按钮内部，让按钮自己处理
  if (e.target.closest('.card-btn-v2') || e.target.closest('.card-btn')) return;
  try {
    var rec = JSON.parse(card.getAttribute('data-rec'));
    openDetail(rec);
  } catch(ex) { /* ignore parse errors */ }
});

// 详情页其他日期样式
var odStyle = document.createElement('style');
odStyle.textContent = '.odate{display:flex;align-items:center;gap:6px;padding:8px;margin-bottom:4px;border-radius:6px;cursor:pointer;font-size:12px;background:var(--tag-bg)}'
  + '.odate:hover{background:var(--border)}'
  + '.odate-dot{font-size:10px;margin-right:2px;color:var(--text-light);width:10px;text-align:center}'
  + '.odate-price{font-weight:700;color:#E60012;margin-left:auto}'
  + '.odate-seats{color:#00B42A;font-size:11px;min-width:30px}'
  + '.odate-time{color:#86909C;font-size:11px}'
  + '.detail-actions{display:flex;gap:8px;padding:0 16px 16px}'
  + '.detail-actions button{flex:1;padding:12px;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}'
  + '.detail-share{background:#165DFF;color:#fff}'
  + '.detail-share:active{background:#0E42D2}';
document.head.appendChild(odStyle);

// ── 尾部二维码（分享报价按钮）──
function generateFooterQR() {
  var wrap = document.getElementById('qrLinkCanvas');
  if (!wrap || typeof QRCode === 'undefined') return;
  var shareUrl = _hasActiveFilterCtx() ? (location.origin + location.pathname + _filterUrlQuery()) : (location.origin + location.pathname);
  // 清空可能存在的占位
  wrap.innerHTML = '';
  new QRCode(wrap, { text: shareUrl, width: 56, height: 56 });
  // 点击打开分享弹层 + 自动复制链接
  document.getElementById('qrShare').onclick = function() {
    openShareModal('filter');
    var t = (typeof _lastShareText !== 'undefined' && _lastShareText) ? _lastShareText : shareUrl;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(t).catch(function(){});
    }
  };
}

// ═══════════════ 筛选（新：出发+到达并列 + 天数+月份+日历）═══════════════

var _filter = { dep: '', arr: '', days: '', month: '', date: '', dates: [] };
var _fstep = 0;

document.getElementById('filterBtn').onclick = function() { openFilter(); };

function openFilter() {
  _filter = { dep: '', arr: '', days: '', month: '', date: '', dates: [] };
  _fstep = 0;
  _showFilter();
  document.getElementById('filterModal').classList.add('active');
}

function closeFilter() {
  document.getElementById('filterModal').classList.remove('active');
}
document.getElementById('filterModal').onclick = function(e) {
  if (e.target.id === 'filterModal') closeFilter();
};
document.getElementById('filterModal').onclick = function(e) {
  if (e.target.id === 'filterModal') closeFilter();
};

function _scopeCities() {
  var s = currentTab;
  if (s === 'home' || s === 'hot' || s === 'filter') return null;
  return TAB_CITIES[s] || null;
}

function _scopeIsDomestic() { return currentTab === 'domestic'; }

function _recordsInScope() {
  var scope = _scopeCities();
  var r = DB.records.filter(function(x){return _hasSeats(x) && _validRecord(x)});
  if (!scope) return r;
  if (_scopeIsDomestic()) return r.filter(function(x){return scope.some(function(c){return x.arr===c}) && scope.some(function(c){return x.dep===c})});
  return r.filter(function(x){return scope.some(function(c){return x.arr===c})});
}

function _getDeps() {
  var s = new Set();
  var recs = _recordsInScope();
  if (_filter.arr) recs = recs.filter(function(r){return r.arr===_filter.arr});
  recs.forEach(function(r){if(!(!r.flight_return&&(r.dep==='济州岛'||r.dep==='济州')&&r.arr==='上海')) s.add(r.dep)});
  // 按优先级排序：上海优先，华东次之
  var priority = ['上海','杭州','南京','宁波','无锡','嘉兴','南通兴东','三亚','济州岛'];
  return Array.from(s).sort(function(a,b){
    var ia = priority.indexOf(a), ib = priority.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a < b ? -1 : 1;
  });
}

function _getArrs() {
  var s = new Set();
  var recs = _recordsInScope();
  if (_filter.dep) recs = recs.filter(function(r){return r.dep===_filter.dep});
  recs.forEach(function(r){if(!(!r.flight_return&&(r.dep==='济州岛'||r.dep==='济州')&&r.arr==='上海')) s.add(r.arr)});
  return Array.from(s);
}

// 天数筛选匹配：'自由' 视为无天数（单程自由组合，如上海-济州岛 HO 单程）
function daysMatch(r, sel) {
  if (sel === '自由') return !getDays(r);
  return getDays(r) === sel;
}

function _getDays() {
  var s = new Set();
  var recs = _recordsInScope();
  if (_filter.dep) recs = recs.filter(function(r){return r.dep===_filter.dep});
  if (_filter.arr) recs = recs.filter(function(r){return r.arr===_filter.arr});
  if (_filter.month) recs = recs.filter(function(r){return (r.dep_date||'').slice(0,7)===_filter.month});
  var hasFree = false;
  recs.forEach(function(r){var d=getDays(r); if(d && d!=='0'){s.add(d);} else {hasFree=true;}});
  var arr = Array.from(s).sort(function(a,b){return parseInt(a)-parseInt(b)});
  if (hasFree) arr.push('自由');
  return arr;
}

function _getMonths() {
  var s = new Set();
  var recs = _recordsInScope();
  if (_filter.dep) recs = recs.filter(function(r){return r.dep===_filter.dep});
  if (_filter.arr) recs = recs.filter(function(r){return r.arr===_filter.arr});
  if (_filter.days) recs = recs.filter(function(r){return daysMatch(r,_filter.days)});
  recs.forEach(function(r){var d=r.dep_date||'';if(d.length>=7)s.add(d.slice(0,7))});
  return Array.from(s).sort();
}

// ── 主渲染函数（所有选项始终可见，未满足条件的灰色提示）──
function _showFilter() {
  var html = _filterSearchBox();
  html += _filterCityPills();
  html += '<div style="display:flex;gap:12px;margin-bottom:10px">'
    + '<div style="flex:1;min-width:0">' + _filterDayPills(true) + '</div>'
    + '<div style="flex:1;min-width:0">' + _filterMonthPills(true) + '</div>'
    + '</div>';
  html += _filterCalendar();
  
  var count = _filteredCount();
  document.getElementById('filterCountDisplay').textContent = count;
  document.getElementById('filterBody').innerHTML = html;
  
  // 复制按钮：四个条件全选中才可点击
  _updateCopyBtnState();
  _refreshSearchModeUI();
}

function _updateCopyBtnState() {
  var btn = document.getElementById('filterCopyBtn');
  if (!btn) return;
  var ready = _filter.dep && _filter.arr && _filter.days && _filter.month;
  if (ready) {
    btn.classList.remove('disabled');
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
  } else {
    btn.classList.add('disabled');
    btn.style.opacity = '0.4';
    btn.style.cursor = 'not-allowed';
  }
}

// ── 智能搜索（2026-08-05 改为：输入不搜索，点「搜索」按钮/回车才搜）──
// 模糊匹配统一入口（2026-08-13 修复：补充机场名/机场码匹配，解决「羽田/成田/HND」搜不到）
// ── 机场名拼音索引（2026-08-13 生成：GB2312 一级同音字扩充，支持 羽田/雨田 等）──
var _AIRPORT_PY = {"三亚": {"full": "sanya", "initial": "sy"}, "三亚凤凰": {"full": "sanyafenghuang", "initial": "syfh"}, "上海浦东": {"full": "shanghaipudong", "initial": "shpd"}, "上海浦东机场": {"full": "shanghaipudongjichang", "initial": "shpdjc"}, "上海虹桥": {"full": "shanghaihongqiao", "initial": "shhq"}, "上海虹桥机场": {"full": "shanghaihongqiaojichang", "initial": "shhqjc"}, "东京成田": {"full": "dongjingchengtian", "initial": "djct"}, "东京成田机场": {"full": "dongjingchengtianjichang", "initial": "djctjc"}, "东京羽田": {"full": "dongjingyutian", "initial": "djyt"}, "东京羽田机场": {"full": "dongjingyutianjichang", "initial": "djytjc"}, "乌鲁木齐": {"full": "wulumuqi", "initial": "wlmq"}, "亚庇国际机场": {"full": "yabiguojijichang", "initial": "ybgjjc"}, "仁川国际机场": {"full": "renchuanguojijichang", "initial": "rcgjjc"}, "冲绳那霸机场": {"full": "chongshengnabajichang", "initial": "csnbjc"}, "南京禄口": {"full": "nanjinglukou", "initial": "njlk"}, "南通兴东": {"full": "nantongxingdong", "initial": "ntxd"}, "吉隆坡": {"full": "jilongpo", "initial": "jlp"}, "吉隆坡国际机场": {"full": "jilongpoguojijichang", "initial": "jlpgjjc"}, "吉隆坡机场": {"full": "jilongpojichang", "initial": "jlpjc"}, "嘉兴": {"full": "jiaxing", "initial": "jx"}, "大阪关西": {"full": "dabanguanxi", "initial": "dbgx"}, "大阪关西机场": {"full": "dabanguanxijichang", "initial": "dbgxjc"}, "宁波栎社": {"full": "ningbolishe", "initial": "nbls"}, "富国岛": {"full": "fuguodao", "initial": "fgd"}, "巴厘岛": {"full": "balidao", "initial": "bld"}, "巴厘岛机场": {"full": "balidaojichang", "initial": "bldjc"}, "成田": {"full": "chengtian", "initial": "ct"}, "新加坡": {"full": "xinjiapo", "initial": "xjp"}, "普吉岛国际机场": {"full": "pujiguojijichang", "initial": "pjgjjc"}, "普吉岛": {"full": "pujidao", "initial": "pjd"}, "普吉岛机场": {"full": "pujijichang", "initial": "pjjc"}, "曼谷素万": {"full": "mangusuwan", "initial": "mgsw"}, "曼谷素万那普机场": {"full": "mangusuwannapujichang", "initial": "mgswnpjc"}, "杭州萧山": {"full": "hangzhouxiaoshan", "initial": "hzxs"}, "杭州萧山机场": {"full": "hangzhouxiaoshanjichang", "initial": "hzxsjc"}, "樟宜机场": {"full": "zhangyijichang", "initial": "zyjc"}, "沙巴亚庇": {"full": "shabayabi", "initial": "sbyb"}, "济州": {"full": "jizhou", "initial": "jz"}, "济州国际机场": {"full": "jizhouguojijichang", "initial": "jzgjjc"}, "济州岛": {"full": "jizhoudao", "initial": "jzd"}, "济州机场": {"full": "jizhoujichang", "initial": "jzjc"}, "浦东国际机场": {"full": "pudongguojijichang", "initial": "pdgjjc"}, "海口美兰": {"full": "haikoumeilan", "initial": "hkml"}, "清州国际机场": {"full": "qingzhouguojijichang", "initial": "qzgjjc"}, "清迈": {"full": "qingmai", "initial": "qm"}, "清迈机场": {"full": "qingmaijichang", "initial": "qmjc"}, "澳门": {"full": "aomen", "initial": "am"}, "澳门机场": {"full": "aomenjichang", "initial": "amjc"}, "福冈机场": {"full": "fugangjichang", "initial": "fgjc"}, "西宁曹家堡": {"full": "xiningcaojiabao", "initial": "xncjb"}, "釜山金海机场": {"full": "fushanjinhaijichang", "initial": "fsjhjc"}, "首尔仁川": {"full": "shouerrenchuan", "initial": "serc"}, "首尔仁川机场": {"full": "shouerrenchuanjichang", "initial": "sercjc"}, "首尔金浦": {"full": "shouerjinpu", "initial": "sejp"}, "首尔金浦机场": {"full": "shouerjinpujichang", "initial": "sejpjc"}, "香港": {"full": "xianggang", "initial": "xg"}, "香港机场": {"full": "xianggangjichang", "initial": "xgjc"}};
var _HAN_PY = {"三": "san", "亚": "ya", "凤": "feng", "凰": "huang", "上": "shang", "海": "hai", "浦": "pu", "东": "dong", "机": "ji", "场": "chang", "虹": "hong", "桥": "qiao", "京": "jing", "成": "cheng", "田": "tian", "羽": "yu", "乌": "wu", "鲁": "lu", "木": "mu", "齐": "qi", "庇": "bi", "国": "guo", "际": "ji", "仁": "ren", "川": "chuan", "冲": "chong", "绳": "sheng", "那": "na", "霸": "ba", "南": "nan", "禄": "lu", "口": "kou", "通": "tong", "兴": "xing", "吉": "ji", "隆": "long", "坡": "po", "嘉": "jia", "大": "da", "阪": "ban", "关": "guan", "西": "xi", "宁": "ning", "波": "bo", "栎": "li", "社": "she", "富": "fu", "岛": "dao", "巴": "ba", "厘": "li", "新": "xin", "加": "jia", "普": "pu", "曼": "man", "谷": "gu", "素": "su", "万": "wan", "杭": "hang", "州": "zhou", "萧": "xiao", "山": "shan", "樟": "zhang", "宜": "yi", "沙": "sha", "济": "ji", "美": "mei", "兰": "lan", "清": "qing", "迈": "mai", "澳": "ao", "门": "men", "福": "fu", "冈": "gang", "曹": "cao", "家": "jia", "堡": "bao", "釜": "fu", "金": "jin", "首": "shou", "尔": "er", "香": "xiang", "港": "gang", "凹": "ao", "敖": "ao", "熬": "ao", "翱": "ao", "袄": "ao", "傲": "ao", "奥": "ao", "懊": "ao", "芭": "ba", "捌": "ba", "扒": "ba", "叭": "ba", "吧": "ba", "笆": "ba", "八": "ba", "疤": "ba", "拔": "ba", "跋": "ba", "靶": "ba", "把": "ba", "耙": "ba", "坝": "ba", "罢": "ba", "爸": "ba", "斑": "ban", "班": "ban", "搬": "ban", "扳": "ban", "般": "ban", "颁": "ban", "板": "ban", "版": "ban", "扮": "ban", "拌": "ban", "伴": "ban", "瓣": "ban", "半": "ban", "办": "ban", "绊": "ban", "苞": "bao", "胞": "bao", "包": "bao", "褒": "bao", "剥": "bo", "薄": "bao", "雹": "bao", "保": "bao", "饱": "bao", "宝": "bao", "抱": "bao", "报": "bao", "暴": "bao", "豹": "bao", "鲍": "bao", "爆": "bao", "逼": "bi", "鼻": "bi", "比": "bi", "鄙": "bi", "笔": "bi", "彼": "bi", "碧": "bi", "蓖": "bi", "蔽": "bi", "毕": "bi", "毙": "bi", "毖": "bi", "币": "bi", "痹": "bi", "闭": "bi", "敝": "bi", "弊": "bi", "必": "bi", "壁": "bi", "臂": "bi", "避": "bi", "陛": "bi", "玻": "bo", "菠": "bo", "播": "bo", "拨": "bo", "钵": "bo", "博": "bo", "勃": "bo", "搏": "bo", "铂": "bo", "箔": "bo", "伯": "bo", "帛": "bo", "舶": "bo", "脖": "bo", "膊": "bo", "渤": "bo", "泊": "po", "驳": "bo", "卜": "bo", "操": "cao", "糙": "cao", "槽": "cao", "草": "cao", "昌": "chang", "猖": "chang", "尝": "chang", "常": "chang", "长": "zhang", "偿": "chang", "肠": "chang", "厂": "chang", "敞": "chang", "畅": "chang", "唱": "chang", "倡": "chang", "撑": "cheng", "称": "cheng", "城": "cheng", "橙": "cheng", "呈": "cheng", "乘": "cheng", "程": "cheng", "惩": "cheng", "澄": "cheng", "诚": "cheng", "承": "cheng", "逞": "cheng", "骋": "cheng", "秤": "cheng", "充": "chong", "虫": "chong", "崇": "chong", "宠": "chong", "穿": "chuan", "椽": "chuan", "传": "chuan", "船": "chuan", "喘": "chuan", "串": "chuan", "搭": "da", "达": "da", "答": "da", "瘩": "da", "打": "da", "刀": "dao", "捣": "dao", "蹈": "dao", "倒": "dao", "祷": "dao", "导": "dao", "到": "dao", "稻": "dao", "悼": "dao", "道": "dao", "盗": "dao", "冬": "dong", "董": "dong", "懂": "dong", "动": "dong", "栋": "dong", "侗": "dong", "恫": "dong", "冻": "dong", "洞": "dong", "而": "er", "儿": "er", "耳": "er", "饵": "er", "洱": "er", "二": "er", "贰": "er", "丰": "feng", "封": "feng", "枫": "feng", "蜂": "feng", "峰": "feng", "锋": "feng", "风": "feng", "疯": "feng", "烽": "feng", "逢": "feng", "冯": "feng", "缝": "feng", "讽": "feng", "奉": "feng", "佛": "fu", "夫": "fu", "敷": "fu", "肤": "fu", "孵": "fu", "扶": "fu", "拂": "fu", "辐": "fu", "幅": "fu", "氟": "fu", "符": "fu", "伏": "fu", "俘": "fu", "服": "fu", "浮": "fu", "涪": "fu", "袱": "fu", "弗": "fu", "甫": "fu", "抚": "fu", "辅": "fu", "俯": "fu", "斧": "fu", "脯": "pu", "腑": "fu", "府": "fu", "腐": "fu", "赴": "fu", "副": "fu", "覆": "fu", "赋": "fu", "复": "fu", "傅": "fu", "付": "fu", "阜": "fu", "父": "fu", "腹": "fu", "负": "fu", "讣": "fu", "附": "fu", "妇": "fu", "缚": "fu", "咐": "fu", "刚": "gang", "钢": "gang", "缸": "gang", "肛": "gang", "纲": "gang", "岗": "gang", "杠": "gang", "辜": "gu", "菇": "gu", "咕": "gu", "箍": "gu", "估": "gu", "沽": "gu", "孤": "gu", "姑": "gu", "鼓": "gu", "古": "gu", "蛊": "gu", "骨": "gu", "股": "gu", "故": "gu", "顾": "gu", "固": "gu", "雇": "gu", "棺": "guan", "官": "guan", "冠": "guan", "观": "guan", "管": "guan", "馆": "guan", "罐": "guan", "惯": "guan", "灌": "guan", "贯": "guan", "锅": "guo", "郭": "guo", "果": "guo", "裹": "guo", "过": "guo", "骸": "hai", "孩": "hai", "氦": "hai", "亥": "hai", "害": "hai", "骇": "hai", "夯": "hang", "航": "hang", "轰": "hong", "哄": "hong", "烘": "hong", "鸿": "hong", "洪": "hong", "宏": "hong", "弘": "hong", "红": "hong", "还": "hai", "荒": "huang", "慌": "huang", "黄": "huang", "磺": "huang", "蝗": "huang", "簧": "huang", "皇": "huang", "惶": "huang", "煌": "huang", "晃": "huang", "幌": "huang", "恍": "huang", "谎": "huang", "击": "ji", "圾": "ji", "基": "ji", "畸": "ji", "稽": "ji", "积": "ji", "箕": "ji", "肌": "ji", "饥": "ji", "迹": "ji", "激": "ji", "讥": "ji", "鸡": "ji", "姬": "ji", "绩": "ji", "缉": "ji", "极": "ji", "棘": "ji", "辑": "ji", "籍": "ji", "集": "ji", "及": "ji", "急": "ji", "疾": "ji", "汲": "ji", "即": "ji", "嫉": "ji", "级": "ji", "挤": "ji", "几": "ji", "脊": "ji", "己": "ji", "蓟": "ji", "技": "ji", "冀": "ji", "季": "ji", "伎": "ji", "祭": "ji", "剂": "ji", "悸": "ji", "寄": "ji", "寂": "ji", "计": "ji", "记": "ji", "既": "ji", "忌": "ji", "妓": "ji", "继": "ji", "纪": "ji", "枷": "jia", "夹": "jia", "佳": "jia", "荚": "jia", "颊": "jia", "贾": "jia", "甲": "jia", "钾": "jia", "假": "jia", "稼": "jia", "价": "jia", "架": "jia", "驾": "jia", "嫁": "jia", "藉": "ji", "巾": "jin", "筋": "jin", "斤": "jin", "今": "jin", "津": "jin", "襟": "jin", "紧": "jin", "锦": "jin", "仅": "jin", "谨": "jin", "进": "jin", "靳": "jin", "晋": "jin", "禁": "jin", "近": "jin", "烬": "jin", "浸": "jin", "尽": "jin", "劲": "jin", "荆": "jing", "兢": "jing", "茎": "jing", "睛": "jing", "晶": "jing", "鲸": "jing", "惊": "jing", "精": "jing", "粳": "jing", "经": "jing", "井": "jing", "警": "jing", "景": "jing", "颈": "jing", "静": "jing", "境": "jing", "敬": "jing", "镜": "jing", "径": "jing", "痉": "jing", "靖": "jing", "竟": "jing", "竞": "jing", "净": "jing", "抠": "kou", "扣": "kou", "寇": "kou", "蓝": "lan", "婪": "lan", "栏": "lan", "拦": "lan", "篮": "lan", "阑": "lan", "澜": "lan", "谰": "lan", "揽": "lan", "览": "lan", "懒": "lan", "缆": "lan", "烂": "lan", "滥": "lan", "梨": "li", "犁": "li", "黎": "li", "篱": "li", "狸": "li", "离": "li", "漓": "li", "理": "li", "李": "li", "里": "li", "鲤": "li", "礼": "li", "莉": "li", "荔": "li", "吏": "li", "栗": "li", "丽": "li", "厉": "li", "励": "li", "砾": "li", "历": "li", "利": "li", "傈": "li", "例": "li", "俐": "li", "痢": "li", "立": "li", "粒": "li", "沥": "li", "隶": "li", "力": "li", "璃": "li", "哩": "li", "龙": "long", "聋": "long", "咙": "long", "笼": "long", "窿": "long", "垄": "long", "拢": "long", "陇": "long", "芦": "lu", "卢": "lu", "颅": "lu", "庐": "lu", "炉": "lu", "掳": "lu", "卤": "lu", "虏": "lu", "麓": "lu", "碌": "lu", "露": "lu", "路": "lu", "赂": "lu", "鹿": "lu", "潞": "lu", "录": "lu", "陆": "lu", "戮": "lu", "埋": "mai", "买": "mai", "麦": "mai", "卖": "mai", "脉": "mai", "瞒": "man", "馒": "man", "蛮": "man", "满": "man", "蔓": "man", "慢": "man", "漫": "man", "谩": "man", "玫": "mei", "枚": "mei", "梅": "mei", "酶": "mei", "霉": "mei", "煤": "mei", "没": "mei", "眉": "mei", "媒": "mei", "镁": "mei", "每": "mei", "昧": "mei", "寐": "mei", "妹": "mei", "媚": "mei", "闷": "men", "们": "men", "拇": "mu", "牡": "mu", "亩": "mu", "姆": "mu", "母": "mu", "墓": "mu", "暮": "mu", "幕": "mu", "募": "mu", "慕": "mu", "目": "mu", "睦": "mu", "牧": "mu", "穆": "mu", "拿": "na", "哪": "na", "呐": "na", "钠": "na", "娜": "na", "纳": "na", "男": "nan", "难": "nan", "柠": "ning", "狞": "ning", "凝": "ning", "拧": "ning", "泞": "ning", "泼": "po", "颇": "po", "婆": "po", "破": "po", "魄": "po", "迫": "po", "粕": "po", "扑": "pu", "铺": "pu", "仆": "pu", "莆": "pu", "葡": "pu", "菩": "pu", "蒲": "pu", "埔": "pu", "朴": "pu", "圃": "pu", "谱": "pu", "曝": "pu", "瀑": "pu", "期": "qi", "欺": "qi", "栖": "qi", "戚": "qi", "妻": "qi", "七": "qi", "凄": "qi", "漆": "qi", "柒": "qi", "沏": "qi", "其": "qi", "棋": "qi", "奇": "qi", "歧": "qi", "畦": "qi", "崎": "qi", "脐": "qi", "旗": "qi", "祈": "qi", "祁": "qi", "骑": "qi", "起": "qi", "岂": "qi", "乞": "qi", "企": "qi", "启": "qi", "契": "qi", "砌": "qi", "器": "qi", "气": "qi", "迄": "qi", "弃": "qi", "汽": "qi", "泣": "qi", "讫": "qi", "橇": "qiao", "锹": "qiao", "敲": "qiao", "悄": "qiao", "瞧": "qiao", "乔": "qiao", "侨": "qiao", "巧": "qiao", "鞘": "qiao", "撬": "qiao", "翘": "qiao", "峭": "qiao", "俏": "qiao", "窍": "qiao", "茄": "jia", "青": "qing", "轻": "qing", "氢": "qing", "倾": "qing", "卿": "qing", "擎": "qing", "晴": "qing", "氰": "qing", "情": "qing", "顷": "qing", "请": "qing", "庆": "qing", "壬": "ren", "人": "ren", "忍": "ren", "韧": "ren", "任": "ren", "认": "ren", "刃": "ren", "妊": "ren", "纫": "ren", "叁": "san", "伞": "san", "散": "san", "莎": "sha", "砂": "sha", "杀": "sha", "刹": "sha", "纱": "sha", "傻": "sha", "啥": "sha", "煞": "sha", "珊": "shan", "苫": "shan", "杉": "shan", "删": "shan", "煽": "shan", "衫": "shan", "闪": "shan", "陕": "shan", "擅": "shan", "赡": "shan", "膳": "shan", "善": "shan", "汕": "shan", "扇": "shan", "缮": "shan", "墒": "shang", "伤": "shang", "商": "shang", "赏": "shang", "晌": "shang", "尚": "shang", "裳": "shang", "奢": "she", "赊": "she", "蛇": "she", "舌": "she", "舍": "she", "赦": "she", "摄": "she", "射": "she", "慑": "she", "涉": "she", "设": "she", "声": "sheng", "生": "sheng", "甥": "sheng", "牲": "sheng", "升": "sheng", "省": "sheng", "盛": "sheng", "剩": "sheng", "胜": "sheng", "圣": "sheng", "收": "shou", "手": "shou", "守": "shou", "寿": "shou", "授": "shou", "售": "shou", "受": "shou", "瘦": "shou", "兽": "shou", "苏": "su", "酥": "su", "俗": "su", "速": "su", "粟": "su", "僳": "su", "塑": "su", "溯": "su", "宿": "su", "诉": "su", "肃": "su", "天": "tian", "添": "tian", "填": "tian", "甜": "tian", "恬": "tian", "舔": "tian", "腆": "tian", "桐": "tong", "酮": "tong", "瞳": "tong", "同": "tong", "铜": "tong", "彤": "tong", "童": "tong", "桶": "tong", "捅": "tong", "筒": "tong", "统": "tong", "痛": "tong", "豌": "wan", "弯": "wan", "湾": "wan", "玩": "wan", "顽": "wan", "丸": "wan", "烷": "wan", "完": "wan", "碗": "wan", "挽": "wan", "晚": "wan", "皖": "wan", "惋": "wan", "宛": "wan", "婉": "wan", "腕": "wan", "巫": "wu", "呜": "wu", "钨": "wu", "污": "wu", "诬": "wu", "屋": "wu", "无": "wu", "芜": "wu", "梧": "wu", "吾": "wu", "吴": "wu", "毋": "wu", "武": "wu", "五": "wu", "捂": "wu", "午": "wu", "舞": "wu", "伍": "wu", "侮": "wu", "坞": "wu", "戊": "wu", "雾": "wu", "晤": "wu", "物": "wu", "勿": "wu", "务": "wu", "悟": "wu", "误": "wu", "昔": "xi", "熙": "xi", "析": "xi", "硒": "xi", "矽": "xi", "晰": "xi", "嘻": "xi", "吸": "xi", "锡": "xi", "牺": "xi", "稀": "xi", "息": "xi", "希": "xi", "悉": "xi", "膝": "xi", "夕": "xi", "惜": "xi", "熄": "xi", "烯": "xi", "溪": "xi", "汐": "xi", "犀": "xi", "檄": "xi", "袭": "xi", "席": "xi", "习": "xi", "媳": "xi", "喜": "xi", "铣": "xi", "洗": "xi", "系": "xi", "隙": "xi", "戏": "xi", "细": "xi", "厦": "sha", "相": "xiang", "厢": "xiang", "镶": "xiang", "箱": "xiang", "襄": "xiang", "湘": "xiang", "乡": "xiang", "翔": "xiang", "祥": "xiang", "详": "xiang", "想": "xiang", "响": "xiang", "享": "xiang", "项": "xiang", "巷": "xiang", "橡": "xiang", "像": "xiang", "向": "xiang", "象": "xiang", "硝": "xiao", "霄": "xiao", "哮": "xiao", "嚣": "xiao", "销": "xiao", "消": "xiao", "宵": "xiao", "淆": "xiao", "晓": "xiao", "小": "xiao", "孝": "xiao", "校": "xiao", "肖": "xiao", "啸": "xiao", "笑": "xiao", "效": "xiao", "薪": "xin", "芯": "xin", "锌": "xin", "欣": "xin", "辛": "xin", "忻": "xin", "心": "xin", "信": "xin", "衅": "xin", "星": "xing", "腥": "xing", "猩": "xing", "惺": "xing", "刑": "xing", "型": "xing", "形": "xing", "邢": "xing", "行": "xing", "醒": "xing", "幸": "xing", "杏": "xing", "性": "xing", "姓": "xing", "压": "ya", "押": "ya", "鸦": "ya", "鸭": "ya", "呀": "ya", "丫": "ya", "芽": "ya", "牙": "ya", "蚜": "ya", "崖": "ya", "衙": "ya", "涯": "ya", "雅": "ya", "哑": "ya", "讶": "ya", "一": "yi", "壹": "yi", "医": "yi", "揖": "yi", "铱": "yi", "依": "yi", "伊": "yi", "衣": "yi", "颐": "yi", "夷": "yi", "遗": "yi", "移": "yi", "仪": "yi", "胰": "yi", "疑": "yi", "沂": "yi", "姨": "yi", "彝": "yi", "椅": "yi", "蚁": "yi", "倚": "yi", "已": "yi", "乙": "yi", "矣": "yi", "以": "yi", "艺": "yi", "抑": "yi", "易": "yi", "邑": "yi", "屹": "yi", "亿": "yi", "役": "yi", "臆": "yi", "逸": "yi", "肄": "yi", "疫": "yi", "亦": "yi", "裔": "yi", "意": "yi", "毅": "yi", "忆": "yi", "义": "yi", "益": "yi", "溢": "yi", "诣": "yi", "议": "yi", "谊": "yi", "译": "yi", "异": "yi", "翼": "yi", "翌": "yi", "绎": "yi", "迂": "yu", "淤": "yu", "于": "yu", "盂": "yu", "榆": "yu", "虞": "yu", "愚": "yu", "舆": "yu", "余": "yu", "俞": "yu", "逾": "yu", "鱼": "yu", "愉": "yu", "渝": "yu", "渔": "yu", "隅": "yu", "予": "yu", "娱": "yu", "雨": "yu", "与": "yu", "屿": "yu", "禹": "yu", "宇": "yu", "语": "yu", "玉": "yu", "域": "yu", "芋": "yu", "郁": "yu", "遇": "yu", "喻": "yu", "峪": "yu", "御": "yu", "愈": "yu", "欲": "yu", "狱": "yu", "育": "yu", "誉": "yu", "浴": "yu", "寓": "yu", "裕": "yu", "预": "yu", "豫": "yu", "驭": "yu", "轧": "ya", "章": "zhang", "彰": "zhang", "漳": "zhang", "张": "zhang", "掌": "zhang", "涨": "zhang", "杖": "zhang", "丈": "zhang", "帐": "zhang", "账": "zhang", "仗": "zhang", "胀": "zhang", "瘴": "zhang", "障": "zhang", "舟": "zhou", "周": "zhou", "洲": "zhou", "诌": "zhou", "粥": "zhou", "轴": "zhou", "肘": "zhou", "帚": "zhou", "咒": "zhou", "皱": "zhou", "宙": "zhou", "昼": "zhou", "骤": "zhou"};

// 拼音同音匹配（2026-08-13：搜索词转拼音后与机场名拼音子串匹配，支持 雨田→羽田 等）
function _kwToPy(kw) {
  var out = '';
  for (var i = 0; i < kw.length; i++) {
    var c = kw[i];
    if (_HAN_PY[c]) out += _HAN_PY[c];
    else if (/[a-z0-9]/i.test(c)) out += c.toLowerCase();
    else out += c;
  }
  return out;
}
function _pyMatchAirports(kw) {
  var py = _kwToPy(kw);
  if (!py || py.length < 2) return [];
  var hits = [];
  for (var name in _AIRPORT_PY) {
    if (_AIRPORT_PY[name].full.indexOf(py) !== -1) hits.push(name);
  }
  return hits;
}
function _recHasAirport(r, names) {
  for (var i = 0; i < names.length; i++) {
    if ((r.dep_airport_name||'').indexOf(names[i]) !== -1) return true;
    if ((r.arr_airport_name||'').indexOf(names[i]) !== -1) return true;
    if ((r.return_dep_airport_name||'').indexOf(names[i]) !== -1) return true;
    if ((r.return_arr_airport_name||'').indexOf(names[i]) !== -1) return true;
  }
  return false;
}

// ══════════════════════════════════════════════════════════════
// 2026-08-18 H5 前端关键字抽取（多航司 OR 组合 + 供应商维度告警）
// 铁律：H5 简化库不含供应商名称（supplier 字段只有代码 103/108），
//       故供应商名一律不作为检索关键字 → 剔除并弹窗告警。
// ⚠ 黑名单仅含供应商代码，绝不可含航司代码(FM/9C)——否则会误杀航司检索。
// 注：本数组仅用于"识别游客输入的供应商名并拦截"，不渲染供应商名到界面；
//     拦截提示文案刻意不回显具体供应商名（见 searchFilter 的告警语），避免界面出现供应商身份。
var _FE_SUPPLIER_WORDS = ['103','108','104','111','101','125','119'];
var _FE_AIRLINE_VOCAB = null;

// 航司词表从库实时构建（airline_cn 中文名 + airline IATA 代码），不硬编码
function _feAirlineVocab() {
  if (_FE_AIRLINE_VOCAB) return _FE_AIRLINE_VOCAB;
  var cn = {}, code = {};
  var recs = (typeof DB !== 'undefined' && DB && DB.records) ? DB.records : [];
  recs.forEach(function(r) {
    if (r.airline_cn) cn[String(r.airline_cn)] = true;
    if (r.airline) code[String(r.airline).toUpperCase()] = true;
  });
  _FE_AIRLINE_VOCAB = { cn: Object.keys(cn), code: Object.keys(code) };
  return _FE_AIRLINE_VOCAB;
}

// 供应商代码集合（从库实时构建：supplier 字段只有代码 101/103/108/005…，无中文名）
var _FE_SUPPLIER_CODES = null;
function _feSupplierCodes() {
  if (_FE_SUPPLIER_CODES) return _FE_SUPPLIER_CODES;
  var set = {};
  var recs = (typeof DB !== 'undefined' && DB && DB.records) ? DB.records : [];
  recs.forEach(function(r) { var k = String(r.supplier || ''); if (k) set[k] = true; });
  _FE_SUPPLIER_CODES = Object.keys(set);
  return _FE_SUPPLIER_CODES;
}

// 从任意输入抽取关键字：航司(中文名/IATA码，大小写无关)、航班号、供应商名(不支持维度)
// 返回 {airlines:[中文名或IATA码], flights:[航班号], unsupported:[供应商名]}
function _extractSearchKw(q) {
  var raw = String(q || '');
  var lower = raw.toLowerCase();
  var vocab = _feAirlineVocab();
  var out = { airlines: [], flights: [], unsupported: [], suppliers: [] };

  // 1) 供应商名 → 不支持维度（H5 库无此字段）
  _FE_SUPPLIER_WORDS.forEach(function(w) {
    if (raw.indexOf(w) !== -1 && out.unsupported.indexOf(w) === -1) out.unsupported.push(w);
  });

  // 2) 航班号（2位字母/数字 + 3~4位数字），优先级高于航司代码：
  //    搜 GK036 是要那一班，不该放大成「所有 GK 航班」
  var fm = lower.match(/[a-z0-9]{2}\d{3,4}/g) || [];
  fm.forEach(function(f) { if (out.flights.indexOf(f) === -1) out.flights.push(f); });

  // 2.5 供应商代码（数据字段，非中文名）：纯数字段精确命中库内已知 supplier 代码才采纳，
  //     避免把航班号/日期里的数字误当供应商。如「103」→ 供应商103；「103GK」→ 供应商103 + 航司GK。
  var _supCodes = _feSupplierCodes();
  var _numRuns = raw.match(/\d{2,3}/g) || [];
  _numRuns.forEach(function(nr) {
    if (_supCodes.indexOf(nr) !== -1 && out.suppliers.indexOf(nr) === -1) out.suppliers.push(nr);
  });

  // 3) 航司中文名：逐个 indexOf，天然支持连写「东航国航南航日航」
  vocab.cn.forEach(function(n) {
    if (raw.indexOf(n) !== -1 && out.airlines.indexOf(n) === -1) out.airlines.push(n);
  });

  // 4) 航司 IATA 代码（大小写无关）。剔除已归为航班号的片段后再扫，
  //    仅在「独立 token」或「整段可被已知代码完整覆盖」时采纳，
  //    避免 hongkong 里渗出 HO 这类假阳性。
  var scan = lower;
  out.flights.forEach(function(f) { scan = scan.split(f).join(' '); });
  var tokens = scan.split(/[^a-z0-9]+/).filter(Boolean);
  tokens.forEach(function(tok) {
    var up = tok.toUpperCase();
    // 4a. 整个 token 就是一个已知航司代码
    if (vocab.code.indexOf(up) !== -1) {
      if (out.airlines.indexOf(up) === -1) out.airlines.push(up);
      return;
    }
    // 4b. token 能被已知代码「完整覆盖」才拆（GKMU → GK+MU；hongkong → 拆不动，丢弃）
    var i = 0, picked = [];
    while (i < up.length) {
      var hit = '';
      for (var L = 3; L >= 2; L--) {
        if (i + L <= up.length && vocab.code.indexOf(up.substr(i, L)) !== -1) { hit = up.substr(i, L); break; }
      }
      if (!hit) { picked = null; break; }
      picked.push(hit); i += hit.length;
    }
    if (picked && picked.length) {
      picked.forEach(function(c) { if (out.airlines.indexOf(c) === -1) out.airlines.push(c); });
      return;
    }
    // 4c. 含数字前缀的粘连（如 103GK / 103GKMU / 103 GK）：数字作分隔，
    //    对纯字母段做代码拆解；供应商代码 103 被当分隔丢弃（H5 不检索供应商，符合铁律）。
    //    hongkong 等「纯字母且 4b 失败」的 token 不会进入此分支，HO 仍不误命中。
    if (/\d/.test(tok)) {
      var _alphaRuns = tok.split(/[0-9]+/).filter(Boolean);
      _alphaRuns.forEach(function(run) {
        var ru = run.toUpperCase();
        var j = 0, pk = [];
        while (j < ru.length) {
          var h = '';
          for (var L = 3; L >= 2; L--) {
            if (j + L <= ru.length && vocab.code.indexOf(ru.substr(j, L)) !== -1) { h = ru.substr(j, L); break; }
          }
          if (!h) { pk = null; break; }
          pk.push(h); j += h.length;
        }
        if (pk) pk.forEach(function(c) { if (out.airlines.indexOf(c) === -1) out.airlines.push(c); });
      });
    }
  });
  return out;
}

// 单条记录是否命中「任一」航司（多航司=并集 OR：一条航班只有一个航司，AND 必然 0 条）
function _matchAnyAirline(r, list) {
  var cn = String(r.airline_cn || '');
  var code = String(r.airline || '').toUpperCase();
  for (var i = 0; i < list.length; i++) {
    var k = list[i];
    if (cn && cn.indexOf(k) !== -1) return true;
    if (code && code === String(k).toUpperCase()) return true;
  }
  return false;
}

// 告警弹窗（不支持的关键字）
function _showSearchAlert(msg) {
  _closeSearchAlert();
  var mask = document.createElement('div');
  mask.id = 'searchAlertMask';
  mask.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.45);z-index:900;display:flex;align-items:center;justify-content:center;padding:24px';
  mask.innerHTML = '<div style="background:var(--bg-card,#fff);border-radius:14px;max-width:320px;width:100%;padding:20px;box-shadow:0 8px 32px rgba(0,0,0,.25);text-align:center">'
    + '<div style="font-size:26px;line-height:1;margin-bottom:10px">⚠️</div>'
    + '<div style="font-size:15px;font-weight:700;color:var(--text,#222);margin-bottom:8px">搜索提示</div>'
    + '<div style="font-size:13px;color:var(--text-secondary,#666);line-height:1.65;margin-bottom:16px">' + msg + '</div>'
    + '<div onclick="_closeSearchAlert()" style="padding:10px;border-radius:10px;background:var(--brand,var(--red,#e64340));color:#fff;font-size:14px;font-weight:600;cursor:pointer">我知道了</div>'
    + '</div>';
  mask.addEventListener('click', function(e) { if (e.target === mask) _closeSearchAlert(); });
  document.body.appendChild(mask);
}
function _closeSearchAlert() {
  var m = document.getElementById('searchAlertMask');
  if (m && m.parentNode) m.parentNode.removeChild(m);
}

function _searchMatch(r, kw) {
  if ((r.flight||'').toLowerCase().indexOf(kw)!==-1) return true;
  if ((r.flight_return||'').toLowerCase().indexOf(kw)!==-1) return true;
  if ((r.dep||'').indexOf(kw)!==-1) return true;
  if ((r.arr||'').indexOf(kw)!==-1) return true;
  if ((r.airline_cn||'').indexOf(kw)!==-1) return true;
  // 航司 IATA 代码（2026-08-18：大小写无关，搜 gk/GK/Gk 均命中）
  if ((r.airline||'').toLowerCase().indexOf(kw)!==-1) return true;
  // 机场中文名（如 东京羽田机场/东京成田机场/上海浦东机场）
  if ((r.dep_airport_name||'').indexOf(kw)!==-1) return true;
  if ((r.arr_airport_name||'').indexOf(kw)!==-1) return true;
  if ((r.return_dep_airport_name||'').indexOf(kw)!==-1) return true;
  if ((r.return_arr_airport_name||'').indexOf(kw)!==-1) return true;
  // 机场三字码（如 HND/NRT/PVG）
  if ((r.dep_airport||'').toLowerCase().indexOf(kw)!==-1) return true;
  if ((r.arr_airport||'').toLowerCase().indexOf(kw)!==-1) return true;
  if ((r.return_dep_airport||'').toLowerCase().indexOf(kw)!==-1) return true;
  if ((r.return_arr_airport||'').toLowerCase().indexOf(kw)!==-1) return true;
  return false;
}
var _searchInputId = 'fitSearch';

function _mkSearchInput(val) {
  var v = val || '';
  return '<div style="display:flex;gap:6px;align-items:center">'
    + '<span style="color:var(--text-secondary);display:inline-flex;flex-shrink:0"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><line x1="16.5" y1="16.5" x2="21" y2="21"></line></svg></span>' + '<input class="fit-search" id="' + _searchInputId + '" placeholder="' + (_searchMode === 'freetour' ? '搜目的地 / 酒店 / 航线 / 日期...' : '搜航线、航班号、目的地...') + '"'
    + ' onkeydown="if(event.key===\'Enter\'){searchFilter(this.value)}"'
    + ' value="' + v.replace(/"/g,'&quot;') + '"'
    + ' style="flex:1;min-width:0;padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;outline:none;box-sizing:border-box">'
    + '<button onclick="searchFilter(document.getElementById(\'' + _searchInputId + '\').value)"'
    + ' style="flex-shrink:0;padding:8px 14px;border:none;border-radius:8px;background:var(--brand,var(--red));color:#fff;font-size:13px;font-weight:600;cursor:pointer">搜索</button>'
    + '</div>';
}

function _filterSearchBox() {
  // 2026-08-13: 搜索结果态打开筛选弹窗时，预填上次搜索词方便改词
  var pre = (_isSearchView && _lastSearchQ) ? _lastSearchQ : '';
  return '<div style="padding:0 0 10px">' + _mkSearchInput(pre) + '</div>';
}

function _filterCityPills() {
  var depHtml = '';
  _getDeps().forEach(function(c){
    var a = _filter.dep===c?' style="background:var(--brand,var(--red));color:#fff;border-color:var(--brand,var(--red))"':'';
    depHtml += '<div class="fit-pill" onclick="selectDep(\''+c+'\')"'+a+'>'+c+'</div>';
  });
  
  var baseHtml = '<div style="margin-bottom:10px"><div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">出发城市</div><div style="display:flex;flex-wrap:wrap;gap:6px">'+depHtml+'</div></div>';
  
  // 如果已经选了到达城市：隐藏其他区域，保留同区域的城市
  if (_filter.arr) {
    var allArrs = _getArrs().filter(function(c){ return c !== '清迈天' && c !== '目的地'; });
    var regionOrder = [
      {name:'韩国', cities: TAB_CITIES.korea},
      {name:'日本', cities: TAB_CITIES.japan},
      {name:'东南亚', cities: TAB_CITIES.seasia},
      {name:'港澳', cities: TAB_CITIES.ganga},
      {name:'国内', cities: TAB_CITIES.domestic},
    ];
    // 找到已选城市属于哪个区域
    var targetRegion = null;
    regionOrder.forEach(function(r) {
      if (r.cities.indexOf(_filter.arr) !== -1) targetRegion = r;
    });
    // 只显示该区域的城市
    var arrHtml = '';
    if (targetRegion) {
      var matched = allArrs.filter(function(c){ return targetRegion.cities.indexOf(c) !== -1; });
      matched.sort(function(a,b){ return targetRegion.cities.indexOf(a) - targetRegion.cities.indexOf(b); });
      if (matched.length) {
        arrHtml += '<div style="font-size:10px;color:var(--text-light);margin:8px 0 2px;letter-spacing:2px">—— ' + targetRegion.name + ' ——</div>'
          + '<div style="display:flex;flex-wrap:wrap;gap:6px">';
        matched.forEach(function(c){
          var a = _filter.arr===c?' style="background:var(--brand,var(--red));color:#fff;border-color:var(--brand,var(--red))"':'';
          arrHtml += '<div class="fit-pill" onclick="selectArr(\''+c+'\')"'+a+'>'+c+'</div>';
        });
        arrHtml += '</div>';
      }
    }
    return baseHtml + '<div style="margin-bottom:10px"><div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">到达城市</div>'+arrHtml+'</div>';
  }
  
  // 到达城市按区域分组（完整显示）
  var regionOrder = [
    {name:'韩国', cities: TAB_CITIES.korea},
    {name:'日本', cities: TAB_CITIES.japan},
    {name:'东南亚', cities: TAB_CITIES.seasia},
    {name:'港澳', cities: TAB_CITIES.ganga},
    {name:'国内', cities: TAB_CITIES.domestic},
  ];
  var allArrs = _getArrs().filter(function(c){ return c !== '清迈天' && c !== '目的地'; });
  var arrHtml = '';
  regionOrder.forEach(function(region) {
    var matched = allArrs.filter(function(c){ return region.cities.indexOf(c) !== -1; });
    // 按 region.cities 的顺序排序
    matched.sort(function(a,b){ return region.cities.indexOf(a) - region.cities.indexOf(b); });
    if (!matched.length) return;
    arrHtml += '<div style="font-size:10px;color:var(--text-light);margin:8px 0 2px;letter-spacing:2px">—— ' + region.name + ' ——</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:6px">';
    matched.forEach(function(c){
      var a = _filter.arr===c?' style="background:var(--brand,var(--red));color:#fff;border-color:var(--brand,var(--red))"':'';
      arrHtml += '<div class="fit-pill" onclick="selectArr(\''+c+'\')"'+a+'>'+c+'</div>';
    });
    arrHtml += '</div>';
  });
  // 未归类的城市
  var allRegionCities = [];
  regionOrder.forEach(function(r){ allRegionCities = allRegionCities.concat(r.cities); });
  var others = allArrs.filter(function(c){ return allRegionCities.indexOf(c) === -1; });
  if (others.length) {
    arrHtml += '<div style="font-size:10px;color:var(--text-light);margin:8px 0 2px;letter-spacing:2px">—— 其他 ——</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:6px">';
    others.forEach(function(c){
      var a = _filter.arr===c?' style="background:var(--brand,var(--red));color:#fff;border-color:var(--brand,var(--red))"':'';
      arrHtml += '<div class="fit-pill" onclick="selectArr(\''+c+'\')"'+a+'>'+c+'</div>';
    });
    arrHtml += '</div>';
  }
  return '<div style="margin-bottom:10px"><div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">出发城市</div><div style="display:flex;flex-wrap:wrap;gap:6px">'+depHtml+'</div></div>'
    + '<div style="margin-bottom:10px"><div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">到达城市</div>'+arrHtml+'</div>';
}

function _filterDayPills(inline) {
  var canSelect = _filter.dep || _filter.arr;
  var days = canSelect ? _getDays() : [];
  var hint = canSelect ? '' : '先选择出发或到达城市';
  var disabledCls = canSelect ? '' : ' style="opacity:0.4;pointer-events:none"';
  var mb = inline ? '0' : '10px';
  var h = '<div style="margin-bottom:' + mb + '"' + disabledCls + '><div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">天数 <span style="font-size:11px;color:var(--text-light)">' + hint + '</span></div><div style="display:flex;flex-wrap:wrap;gap:6px">';
  (days.length ? days : ['']).forEach(function(d){
    if (!d || d === '0') { h += '<span style="font-size:11px;color:var(--text-light);padding:6px 0">请先选择出发或到达城市</span>'; return; }
    var a = _filter.days===d?' style="background:var(--brand,var(--red));color:#fff;border-color:var(--brand,var(--red))"':'';
    var lbl = (d === '自由') ? '自由' : (d + '天');
    h += '<div class="fit-pill" onclick="selectDay(\''+d+'\')"'+a+'>'+lbl+'</div>';
  });
  return h+'</div></div>';
}

function _filterMonthPills(inline) {
  var canSelect = _filter.dep || _filter.arr;
  var months = canSelect ? _getMonths() : [];
  var hint = canSelect ? '' : '先选择出发或到达城市';
  var disabledCls = canSelect ? '' : ' style="opacity:0.4;pointer-events:none"';
  var mb = inline ? '0' : '10px';
  var h = '<div style="margin-bottom:' + mb + '"' + disabledCls + '><div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">月份 <span style="font-size:11px;color:var(--text-light)">' + hint + '</span></div><div style="display:flex;flex-wrap:wrap;gap:6px">';
  (months.length ? months : ['']).forEach(function(m){
    if (!m) { h += '<span style="font-size:11px;color:var(--text-light);padding:6px 0">' + hint + '</span>'; return; }
    var lbl = parseInt(m.slice(5,7))+'月';
    var a = _filter.month===m?' style="background:var(--brand,var(--red));color:#fff;border-color:var(--brand,var(--red))"':'';
    h += '<div class="fit-pill" onclick="selectMonth(\''+m+'\')"'+a+'>'+lbl+'</div>';
  });
  return h+'</div></div>';
}

function _filterCalendar() {
  var canSelect = (_filter.dep||_filter.arr) && _filter.days && _filter.month;
  if (!canSelect) {
    return '<div style="margin-bottom:10px;opacity:0.4;pointer-events:none"><div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">日历报价 <span style="font-size:11px;color:var(--text-light)">请先选择月份</span></div>'
      + '<div style="padding:20px;text-align:center;font-size:11px;color:var(--text-light);background:var(--tag-bg);border-radius:8px">请先选择出发城市、到达城市、天数和月份</div></div>';
  }
  // 聚合该月每日最低价
  var recs = _recordsInScope();
  if (_filter.dep) recs = recs.filter(function(r){return r.dep===_filter.dep});
  if (_filter.arr) recs = recs.filter(function(r){return r.arr===_filter.arr});
  if (_filter.days) recs = recs.filter(function(r){return daysMatch(r,_filter.days)});
  recs = recs.filter(function(r){var d=r.dep_date||'';return d.slice(0,7)===_filter.month});
  
  var dateMap = {};
  recs.forEach(function(r){
    var d = r.dep_date||'';
    var p = parseFloat(r.retail||0);
    if (!dateMap[d] || p < dateMap[d].min) dateMap[d] = {min:p};
  });
  
  var year = parseInt(_filter.month.slice(0,4));
  var month = parseInt(_filter.month.slice(5,7)) - 1;
  var firstDay = new Date(year, month, 1).getDay();
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  
  var h = '<div style="margin-bottom:6px"><div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">' + parseInt(_filter.month.slice(5,7)) + '月日历 · 最低价</div>'
    + '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center">'
    + '<span style="font-size:10px;color:var(--text-light)">日</span><span style="font-size:10px;color:var(--text-light)">一</span><span style="font-size:10px;color:var(--text-light)">二</span>'
    + '<span style="font-size:10px;color:var(--text-light)">三</span><span style="font-size:10px;color:var(--text-light)">四</span>'
    + '<span style="font-size:10px;color:var(--text-light)">五</span><span style="font-size:10px;color:var(--text-light)">六</span>';
  
  for (var i=0; i<firstDay; i++) h += '<div></div>';
  for (var day=1; day<=daysInMonth; day++) {
    var pad = day<10?'0'+day:''+day;
    var dateStr = _filter.month + '-' + pad;
    var info = dateMap[dateStr];
    var sel = _filter.dates.indexOf(dateStr) >= 0 ? ' style="border:1.5px solid var(--red);background:var(--red-light)"' : ' style="cursor:pointer"';
    h += '<div class="cal-cell" onclick="selectDate(\''+dateStr+'\')"'+sel+'>'
      + '<div style="font-size:11px;font-weight:500;color:var(--text)">'+day+'</div>';
    if (info) h += '<div style="font-size:10px;color:var(--red);font-weight:500">¥'+Math.round(info.min)+'</div>';
    else h += '<div style="font-size:9px;color:var(--text-light)">—</div>';
    h += '</div>';
  }
  h += '</div></div>';
  return h;
}

function _filteredCount() {
  if (_searchMode === 'freetour' && window.FreeTour && window.FreeTour.filteredCount) {
    return window.FreeTour.filteredCount(_filter);
  }
  return _getFilteredRecs().length;
}

// 2026-08-04 用户需求：复制/渲染按「日历所选多个去程日期（多选，任意命中）」过滤
function _isDateOnOrAfter(r) {
  var ds = _filter.dates || [];
  if (!ds.length) return true;              // 未选日期 → 不过滤
  return ds.indexOf(r.dep_date) >= 0;       // dep_date 命中任一选中日期
}

function _getFilteredRecs() {
  var recs = _recordsInScope();
  if (_filter.dep) recs = recs.filter(function(r){return r.dep===_filter.dep});
  if (_filter.arr) recs = recs.filter(function(r){return r.arr===_filter.arr});
  if (_filter.days) recs = recs.filter(function(r){return daysMatch(r,_filter.days)});
  if (_filter.month) recs = recs.filter(function(r){return (r.dep_date||'').slice(0,7)===_filter.month});
  if ((_filter.dates || []).length) recs = recs.filter(_isDateOnOrAfter);
  return recs;
}

// ── 复制分组 / 分批（2026-08-18 升级：超 100 条自动分批，溢出在告警框二次渲染供续复制）──
function _escHtml(s){ return (''+s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// 把记录按 (dep|arr|days|flight|flight_return) 分组，返回 [{header:[行], dates:[行], size}]
function _buildCopyGroups(recs) {
  var groups = {};
  recs.forEach(function(r) {
    var key = (r.dep||'') + '|' + (r.arr||'') + '|' + (getDays(r)||'') + '|' + (r.flight||'') + '|' + ((r.flight_return||'').trim());
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });
  Object.keys(groups).forEach(function(k) {
    groups[k].sort(function(a,b){return (a.dep_date||'') < (b.dep_date||'') ? -1 : 1});
  });
  return Object.keys(groups).map(function(key){
    var gRecs = groups[key];
    var r = gRecs[0];
    var d = getDays(r) || '';
    var hasReturn = !!(r.flight_return && r.flight_return.trim());
    var routeLabel = (r.dep||'') + '-' + (r.arr||'') + (hasReturn ? '/' + (r.arr||'') + '-' + (r.dep||'') : '') + (d ? ' ' + d + '天' : '');
    var airCn = r.airline_cn || '';
    var depAirport = _aptBlockTxt(r,'dep');
    var arrAirport = _aptBlockTxt(r,'arr');
    var depTime = (r.dep_time||'').trim();
    var arrTime = (r.arr_time||'').trim();
    var outDur = _durTxt(r);
    var header = [ routeLabel + (airCn ? ' ' + airCn : '') ];
    header.push((r.flight||'') + ' ' + (depAirport ? depAirport+'-' : '') + (arrAirport||'') + (depTime||arrTime ? ' ' : '') + (depTime ? depTime : '') + (arrTime ? '-'+arrTime : '') + (outDur ? ' ' + outDur : ''));
    if (hasReturn) {
      var retDep = _aptBlockTxt(r,'return_dep');
      var retArr = _aptBlockTxt(r,'return_arr');
      var retDepTime = (r.return_dep_time||'').trim();
      var retArrTime = (r.return_arr_time||'').trim();
      var retDur = _durTxt(r,'ret');
      header.push((r.flight_return||'') + (retDep ? ' ' + retDep : '') + (retArr ? '-'+retArr : '') + (retDepTime||retArrTime ? ' ' : '') + (retDepTime ? retDepTime : '') + (retArrTime ? '-'+retArrTime : '') + (retDur ? ' ' + retDur : ''));
    }
    // 供应商行李额行（2026-08-17 用户定案：复制只含供应商在线表采集到的行李额统一格式，不含补全信息）
    var bg = ((r.baggage || '')).trim();
    if (bg) header.push('行李：' + bg);
    var dates = gRecs.map(function(rr){
      var ds = _fmtDateShort(rr.dep_date);
      var rs = rr.return_date ? _fmtDateShort(rr.return_date) : '';
      var dateStr = ds + (rs ? '-' + rs : '');
      var price = rr.retail || 0;
      var seat = _seatDisp(rr.seats);
      return dateStr + ' ￥' + price + (seat ? ' ' + seat : '');
    });
    return { header: header, dates: dates, size: gRecs.length };
  });
}

// 按 MAX_COPY(每条日期行) 切批；跨批重复组头保证每批独立可粘贴
function _buildCopyBatchTexts(groups, MAX_COPY, trailer) {
  var batches = [];
  var cur = { lines: [], n: 0 };
  function flush() {
    if (cur.lines.length) batches.push({ text: cur.lines.join('\n') + '\n\n' + trailer, n: cur.n });
    cur = { lines: [], n: 0 };
  }
  groups.forEach(function(g) {
    var L = g.dates.length, gi = 0;
    while (gi < L) {
      if (cur.n >= MAX_COPY) flush();          // 当前批满 → 新批
      if (cur.n > 0) cur.lines.push('');        // 同批内组间空行
      Array.prototype.push.apply(cur.lines, g.header);  // 组头（跨批重复）
      var room = MAX_COPY - cur.n;
      var take = Math.min(room, L - gi);
      for (var k = 0; k < take; k++) cur.lines.push(g.dates[gi + k]);
      cur.n += take; gi += take;
    }
  });
  flush();
  return batches;
}

// 复制溢出告警框：首批准入剪贴板后，剩余批次在框内渲染全文 + 「📋 复制」按钮可续复制
function _showCopyOverflowAlert(msg, batches) {
  _closeCopyOverflowAlert();
  var mask = document.createElement('div');
  mask.id = 'copyOverflowMask';
  mask.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.45);z-index:910;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow:auto';
  var html = '<div style="background:var(--bg-card,#fff);border-radius:14px;max-width:340px;width:100%;padding:18px;box-shadow:0 8px 32px rgba(0,0,0,.25);margin:auto">'
    + '<div style="font-size:15px;font-weight:700;color:var(--text,#222);margin-bottom:4px">📋 复制已分批</div>'
    + '<div style="font-size:12px;color:var(--text-secondary,#666);line-height:1.6;margin-bottom:10px">' + msg + '</div>'
    + '<div style="max-height:52vh;overflow:auto;margin-bottom:10px">';
  batches.forEach(function(b, i){
    html += '<div style="border:1px solid var(--border,#eee);border-radius:10px;padding:8px;margin-bottom:8px">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'
      + '<span style="font-size:12px;font-weight:600;color:var(--text,#222)">' + b.label + '</span>'
      + '<span onclick="_copyBatchText(this)" data-idx="'+i+'" style="padding:4px 10px;border-radius:8px;background:var(--brand,var(--red,#e64340));color:#fff;font-size:12px;font-weight:600;cursor:pointer">📋 复制</span>'
      + '</div>'
      + '<textarea readonly onclick="this.select()" style="width:100%;height:96px;font-size:11px;line-height:1.4;box-sizing:border-box;border:1px solid var(--border,#eee);border-radius:8px;padding:6px;resize:vertical;font-family:monospace;color:var(--text,#222)">' + _escHtml(b.text) + '</textarea>'
      + '</div>';
  });
  html += '</div>'
    + '<div onclick="_closeCopyOverflowAlert()" style="padding:10px;border-radius:10px;background:var(--text-light,#bbb);color:#fff;font-size:14px;font-weight:600;text-align:center;cursor:pointer">关闭</div>'
    + '</div>';
  mask.innerHTML = html;
  mask._batchTexts = batches.map(function(b){return b.text;});
  mask.addEventListener('click', function(e){ if(e.target===mask) _closeCopyOverflowAlert(); });
  document.body.appendChild(mask);
}
function _copyBatchText(el) {
  var mask = document.getElementById('copyOverflowMask');
  if (!mask || !mask._batchTexts) return;
  var idx = parseInt(el.getAttribute('data-idx'),10);
  var txt = mask._batchTexts[idx];
  if (navigator.clipboard) {
    navigator.clipboard.writeText(txt).then(function(){ showToast('✅ 已复制第 ' + (idx+2) + ' 批'); });
  } else { prompt('复制以下内容：', txt); }
}
function _closeCopyOverflowAlert() {
  var m = document.getElementById('copyOverflowMask');
  if (m && m.parentNode) m.parentNode.removeChild(m);
}

function copyFilterResults() {
  var recs = _getFilteredRecs();
  if (!recs.length) { showToast('没有可复制的报价'); return; }
  var MAX_COPY = 100; // 2026-08-17 用户定案：单批复制上限100条日期报价
  var groups = _buildCopyGroups(recs);
  var trailer = _PROMO + '\n🔗 ' + location.origin + location.pathname + _filterUrlQuery();
  var batches = _buildCopyBatchTexts(groups, MAX_COPY, trailer);
  var first = batches.shift();
  var total = groups.reduce(function(s,g){return s+g.size;},0);
  if (navigator.clipboard) {
    navigator.clipboard.writeText(first.text).then(function(){ showToast('✅ 已复制第 1 批（共 ' + (batches.length+1) + ' 批，' + MAX_COPY + ' 条/批）'); });
  } else { prompt('复制以下内容（第 1 批）：', first.text); }
  recordAction('copy_filter', {count:total, batches:batches.length+1, quote:first.text.slice(0,200)});
  if (batches.length) {
    var overflow = batches.map(function(b,i){ return { label:'第 '+(i+2)+' 批（'+b.n+' 条）', text:b.text }; });
    _showCopyOverflowAlert('已复制第 1 批（'+first.n+' 条，共 '+(batches.length+1)+' 批）。剩余批次可在下方文本框长按手动复制，或点「📋 复制」继续复制。', overflow);
  }
}

// ── 筛选链接参数 ──
function _filterUrlQuery() {
  var p = new URLSearchParams();
  if (_filter.dep) p.set('f_dep', _filter.dep);
  if (_filter.arr) p.set('f_arr', _filter.arr);
  if (_filter.days) p.set('f_days', _filter.days);
  if (_filter.month) p.set('f_month', _filter.month);
  if ((_filter.dates || []).length) p.set('f_date', _filter.dates.join(','));  // 多选：逗号分隔
  var qs = p.toString();
  return qs ? '?' + qs : '';
}
function _updateFilterUrl() {
  history.replaceState(null, '', location.pathname + _filterUrlQuery());
}
function _applyFilterFromUrl() {
  var p = new URLSearchParams(location.search);
  var hasFilter = false;
  // 向后兼容：同时识别新格式(f_*)与旧格式(dep/arr/date…)，避免历史分享链接失效
  if (p.get('f_dep') || p.get('dep')) { _filter.dep = p.get('f_dep') || p.get('dep'); hasFilter = true; }
  if (p.get('f_arr') || p.get('arr')) { _filter.arr = p.get('f_arr') || p.get('arr'); hasFilter = true; }
  if (p.get('f_days') || p.get('days')) { _filter.days = p.get('f_days') || p.get('days'); hasFilter = true; }
  if (p.get('f_month') || p.get('month')) { _filter.month = p.get('f_month') || p.get('month'); hasFilter = true; }
  if (p.get('f_date') || p.get('date')) {
    var _dv = p.get('f_date') || p.get('date');
    _filter.dates = _dv.split(',').filter(function(x){return !!x});
    _filter.date = _filter.dates.length === 1 ? _filter.dates[0] : '';
    hasFilter = true;
  }
  if (hasFilter) { currentTab = 'filter'; renderFiltered(); }
}

// ── 选择函数 ──
function selectDep(d) {
  _filter.dep = _filter.dep===d ? '' : d;
  _filter.days='';_filter.month='';_filter.date='';_filter.dates=[];
  recordAction('filter_dep', {route:_filter.dep+'→'+(d||'')});
  _updateFilterUrl(); _showFilter();
}
function selectArr(a) {
  _filter.arr = _filter.arr===a ? '' : a;
  _filter.days='';_filter.month='';_filter.date='';_filter.dates=[];
  recordAction('filter_arr', {route:(_filter.dep||'')+'→'+a});
  _updateFilterUrl(); _showFilter();
}
function selectDay(d) {
  _filter.days = _filter.days===d ? '' : d;
  _filter.date='';_filter.dates=[];
  recordAction('filter_day', {days:d});
  _updateFilterUrl(); _showFilter();
}
function selectMonth(m) {
  _filter.month = _filter.month===m ? '' : m;
  _filter.date='';_filter.dates=[];
  recordAction('filter_month', {date:_filter.month});
  _updateFilterUrl(); _showFilter();
}
function selectDate(d) {
  // 2026-08-04 用户需求：日历日期多选——点击一次选中、再点取消；选多个日期共存
  var idx = _filter.dates.indexOf(d);
  if (idx >= 0) _filter.dates.splice(idx, 1);
  else _filter.dates.push(d);
  _filter.date = _filter.dates.length === 1 ? _filter.dates[0] : '';  // 兼容旧字段（单选1个时赋值）
  _updateFilterUrl();
  // 选日期后不直接渲染滑动区，保持筛选框打开、只刷新「查看 N 条结果」条数；
  // 用户点击 filterApplyBtn（查看 N 条结果）后才 closeFilter + renderFiltered
  _showFilter();
  recordAction('filter_date', {route:(_filter.dep||'')+'→'+(_filter.arr||''),date:d,days:_filter.days});
}

// ── 智能搜索（2026-08-05 改为：输入不搜索，点「搜索」按钮/回车才搜）──

// ── 日期解析（2026-08-18 升级：区间 + 多格式单日）──
// 消歧规则（铁律级，写死不可改）：
//   区间定界符 = 连字符/波浪号 [-~～—]；月日分隔符 = [./月]（不含裸连字符）
//   ① 区间判定：左端必须自带月日分隔符(./月)或为8位无分隔(YYYYMMDD)，才视为区间
//      → 9.23-10.5 / 9月23日-10月5日 / 20260923-20261005 / 9.23-27 均为区间
//      → 9-20 左端无月日分隔符 → 不是区间 → 降级为「单日(月-日)」
//   ② 单日格式：9/20、9.20、9月20日、2026-09-20、20260920、9-20（裸连字符作月日分隔）
//   ③ 仅月份：9月（无具体日）→ 按去程月份过滤
//   ④ 区间一律解释为「去程日期区间」（非 去程-回程 组合）
function _iso(y,m,d){ return ('0000'+y).slice(-4)+'-'+('0'+m).slice(-2)+'-'+('0'+d).slice(-2); }
function _md(m,d){
  var mm=parseInt(m,10), dd=parseInt(d,10);
  var now=new Date(); var y=now.getFullYear();
  if (mm < now.getMonth()+1) y++;          // 已过月份 → 推到下一年
  return _iso(y,mm,dd);
}
function _shiftYear(iso){ return _iso(parseInt(iso.slice(0,4),10)+1, iso.slice(5,7), iso.slice(8,10)); }
// ── 节假日 → 去程日期区间（2026-08-18 新增）──
// 官方：国务院办公厅《关于2026年部分节假日安排的通知》(2025-11-04)
// 年份取“即将到来”的一档：有 start>=今天 则选最早 upcoming；否则该节假日无未来档 → 不参与筛选（不误导）
// 表内联在函数内（非顶层 var）：避免源码加载期早期语句崩溃导致顶层 var 未赋值，函数调用时再建表即可用
function _matchHoliday(q) {
  // 官方：国务院办公厅《关于2026年部分节假日安排的通知》(2025-11-04)
  // preLeave：节前请假缓冲（很多人节前调休拼假）→ start 前推 N 天（中秋提前2天 → 9/23 起）
  // 联动(merge)：相邻节假日间隔 <= MERGE_GAP 天时合并为一个连休窗口（中秋→国庆 间隔3天 → 合并 9/23~10/7）
  var _HOLIDAY_DEFS = [
    { name:'中秋',   kw:['中秋','中秋节'],  preLeave:2, ranges:[{s:'2026-09-25',e:'2026-09-27'},{s:'2027-09-25',e:'2027-09-27'}] },
    { name:'国庆',   kw:['国庆','国庆节'],  preLeave:0, ranges:[{s:'2026-10-01',e:'2026-10-07'}] },
    { name:'元旦',   kw:['元旦'],           preLeave:0, ranges:[{s:'2026-01-01',e:'2026-01-03'},{s:'2027-01-01',e:'2027-01-03'}] },
    { name:'春节',   kw:['春节','过年'],    preLeave:0, ranges:[{s:'2026-02-15',e:'2026-02-23'}] },
    { name:'劳动节', kw:['五一','劳动节'],  preLeave:0, ranges:[{s:'2026-05-01',e:'2026-05-05'}] },
    { name:'清明',   kw:['清明','清明节'],  preLeave:0, ranges:[{s:'2026-04-04',e:'2026-04-06'}] },
    { name:'端午',   kw:['端午','端午节'],  preLeave:0, ranges:[{s:'2026-06-19',e:'2026-06-21'}] }
  ];
  var MERGE_GAP = 4; // 连休合并阈值（天）：间隔在此内视为同一拼假窗口
  var now = new Date();
  var today = _iso(now.getFullYear(), now.getMonth()+1, now.getDate());
  function _effStart(d, leave){ var x=new Date(d.slice(0,4), parseInt(d.slice(5,7),10)-1, parseInt(d.slice(8,10),10)); if(leave) x.setDate(x.getDate()-leave); return _iso(x.getFullYear(), x.getMonth()+1, x.getDate()); }
  function _effEnd(d){ var x=new Date(d.slice(0,4), parseInt(d.slice(5,7),10)-1, parseInt(d.slice(8,10),10)); return _iso(x.getFullYear(), x.getMonth()+1, x.getDate()); }
  // 1) 选“即将到来”档 + 应用 preLeave → effective 区间
  var eff = [];
  for (var i=0;i<_HOLIDAY_DEFS.length;i++){
    var h=_HOLIDAY_DEFS[i], chosen=null;
    for (var j=0;j<h.ranges.length;j++){ if (h.ranges[j].s>=today && (!chosen||h.ranges[j].s<chosen.s)) chosen=h.ranges[j]; }
    if(!chosen) continue;   // 无未来档（如8月搜“春节”2026已过、2027未定）→ 不参与筛选
    eff.push({ name:h.name, kw:h.kw, start:_effStart(chosen.s, h.preLeave), end:_effEnd(chosen.e) });
  }
  // 2) 按 start 排序，贪心合并相邻（间隔 <= MERGE_GAP 天）
  eff.sort(function(a,b){ return a.start<b.start?-1:(a.start>b.start?1:0); });
  var clusters=[];
  for (var x=0;x<eff.length;x++){
    var cur=eff[x];
    if (clusters.length){
      var last=clusters[clusters.length-1];
      var ld=new Date(last.end.slice(0,4), parseInt(last.end.slice(5,7),10)-1, parseInt(last.end.slice(8,10),10));
      var cs=new Date(cur.start.slice(0,4), parseInt(cur.start.slice(5,7),10)-1, parseInt(cur.start.slice(8,10),10));
      var gap=Math.round((cs-ld)/86400000);
      if (gap>=0 && gap<=MERGE_GAP){ if(cur.end>last.end) last.end=cur.end; last.names.push(cur.name); continue; }
    }
    clusters.push({ start:cur.start, end:cur.end, names:[cur.name] });
  }
  // 3) 关键词命中 → 返回所属 cluster（中秋/国庆 同窗 → 都返回 9/23~10/7）
  for (var c=0;c<clusters.length;c++){
    for (var n=0;n<clusters[c].names.length;n++){
      var nm=clusters[c].names[n], def=null;
      for (var d=0;d<_HOLIDAY_DEFS.length;d++){ if(_HOLIDAY_DEFS[d].name===nm){def=_HOLIDAY_DEFS[d];break;} }
      if(!def) continue;
      for (var k=0;k<def.kw.length;k++){ if (q.indexOf(def.kw[k])!==-1){
        var label = clusters[c].names.length>1 ? clusters[c].names.join('·')+'连休' : clusters[c].names[0];
        return {name:label, start:clusters[c].start, end:clusters[c].end};
      } }
    }
  }
  return null;
}
function _parseDateQuery(q){
  if(!q) return {mode:'none'};
  var r;
  // —— 区间 ——（左端须带月日分隔符或8位）
  if ((r=q.match(/(\d{4})(\d{2})(\d{2})\s*[-~～—]\s*(\d{4})(\d{2})(\d{2})/))) {
    var s=_iso(r[1],r[2],r[3]), e=_iso(r[4],r[5],r[6]); if(e<s) e=_shiftYear(e);
    return {mode:'range',start:s,end:e};
  }
  if ((r=q.match(/(\d{4})-(\d{1,2})-(\d{1,2})\s*[-~～—]\s*(\d{4})-(\d{1,2})-(\d{1,2})/))) {
    var s2=_iso(r[1],r[2],r[3]), e2=_iso(r[4],r[5],r[6]); if(e2<s2) e2=_shiftYear(e2);
    return {mode:'range',start:s2,end:e2};
  }
  if ((r=q.match(/(\d{1,2})[.\/月](\d{1,2})日?\s*[-~～—]\s*(\d{1,2})[.\/月](\d{1,2})日?/))) {
    var s3=_md(r[1],r[2]), e3=_md(r[3],r[4]); if(e3<s3) e3=_shiftYear(e3);
    return {mode:'range',start:s3,end:e3};
  }
  if ((r=q.match(/(\d{1,2})[.\/月](\d{1,2})日?\s*[-~～—]\s*(\d{1,2})日?/))) {
    var s4=_md(r[1],r[2]), e4=_md(r[1],r[3]); if(e4<s4) e4=_shiftYear(e4);
    return {mode:'range',start:s4,end:e4};
  }
  // —— 单日 ——
  if ((r=q.match(/(\d{4})(\d{2})(\d{2})(?!\d)/))) return {mode:'single',date:_iso(r[1],r[2],r[3])};   // 20260920
  if ((r=q.match(/(\d{4})-(\d{1,2})-(\d{1,2})/))) return {mode:'single',date:_iso(r[1],r[2],r[3])};   // 2026-09-20
  if ((r=q.match(/(\d{1,2})[.\/月](\d{1,2})日?/))) return {mode:'single',date:_md(r[1],r[2])};         // 9/20 9.20 9月20日
  if ((r=q.match(/(\d{1,2})-(\d{1,2})(?![\d.\/月])/))) return {mode:'single',date:_md(r[1],r[2])};     // 9-20
  // —— 仅月份 —— 9月（后面不跟数字/分隔符）
  var mo=q.match(/(\d{1,2})月(?![\d.\/-])/);
  if (mo && parseInt(mo[1],10)>=1 && parseInt(mo[1],10)<=12) return {mode:'month',month:('0'+parseInt(mo[1],10)).slice(-2)};
  // —— 节假日（2026-08-18 新增）：国庆/中秋/元旦… → 去程日期区间，年份取即将到来的一档
  var _hol = _matchHoliday(q);
  if (_hol) return {mode:'range', start:_hol.start, end:_hol.end, holiday:_hol.name};
  return {mode:'none'};
}

// ── 单机票 / 自由行 搜索模式切换（2026-08-26）──
var _searchMode = 'flight';   // 'flight' | 'freetour'；默认单机票搜索
function _refreshSearchModeUI() {
  var tf = document.getElementById('searchModeToggle');
  if (!tf) return;
  tf.style.display = window.FreeTour ? 'inline-flex' : 'none';
  var mf = document.getElementById('modeFlight'), mfr = document.getElementById('modeFree');
  if (mf) {
    var on = _searchMode === 'flight';
    mf.style.background = on ? 'var(--brand,var(--red))' : 'transparent';
    mf.style.color = on ? '#fff' : 'var(--text-secondary)';
  }
  if (mfr) {
    var on2 = _searchMode === 'freetour';
    mfr.style.background = on2 ? 'var(--brand,var(--red))' : 'transparent';
    mfr.style.color = on2 ? '#fff' : 'var(--text-secondary)';
  }
}
function _setSearchMode(mode) {
  _searchMode = mode;
  _filter = { dep: '', arr: '', days: '', month: '', date: '', dates: [] };
  if (window.FreeTour && window.FreeTour.setMode) window.FreeTour.setMode(mode);
  _refreshSearchModeUI();
  _showFilter();
}

function searchFilter(q) {
  // 显式触发：不再 IME 防抖，点击搜索按钮/回车才执行
  q = (q || '').trim();
  if (!q) { _showFilter(); return; }
  // 2026-08-26：自由行模式 → 自由行套餐搜索
  if (_searchMode === 'freetour' && window.FreeTour && window.FreeTour.search) {
    window.FreeTour.search(q);
    return;
  }

    // 0. 关键字抽取（2026-08-18）：航司(中文名/IATA码，大小写无关) + 剔除供应商名
    var _kw = _extractSearchKw(q);
    var airlineHits = _kw.airlines;
    var supplierHits = _kw.suppliers;

    // 1. 提取城市名
    var knownCities = ['东京','大阪','名古屋','冲绳','札幌','福冈','仙台','首尔','济州岛','釜山',
      '曼谷','普吉岛','清迈','苏梅','巴厘岛','沙巴','新加坡','吉隆坡','胡志明','岘港','马尼拉','雅加达','河内','富国岛',
      '香港','澳门','台北','三亚','海口','厦门'];
    var foundCities = knownCities.filter(function(c){return q.indexOf(c)!==-1});
    var arrCity = foundCities.length ? foundCities[0] : '';
    
    // 2. 提取日期（2026-08-18 升级：区间 + 多格式单日，详见 _parseDateQuery）
    var _dq = _parseDateQuery(q);
    var targetDate = (_dq.mode === 'single') ? _dq.date : '';
    var monthVal = (_dq.mode === 'month') ? _dq.month : '';
    var _holidayNote = (_dq.holiday) ? '（已按 <b>' + _dq.holiday + '</b> ' + _dq.start.slice(5) + '~' + _dq.end.slice(5) + ' 筛选，去程或回程日期在窗口内即出）' : '';
    var _supNote = (supplierHits.length) ? '（供应商 <b>' + supplierHits.join(' / ') + '</b>）' : '';
    
    // 3. 提取天数
    var daysMatch = q.match(/(\d+)天|五(?=天)|四(?=天)|六(?=天)|七(?=天)|八(?=天)|九(?=天)|十(?=天)/);
    var cnNum = {'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10};
    var daysVal = '';
    if (daysMatch) {
      var raw = daysMatch[1] || daysMatch[0];
      daysVal = cnNum[raw] ? ''+cnNum[raw] : raw;
    }
    
    // 3.5 整单拒绝（2026-08-18）：只有供应商名、无任何可用关键字 → 不出结果，弹告警
    var _hasUsableKw = !!(airlineHits.length || arrCity || (_dq.mode !== 'none') || _kw.flights.length || supplierHits.length);
    if (_kw.unsupported.length && !_hasUsableKw) {
      _showSearchAlert('不支持本次关键字搜索，请重新输入。<br><br>（供应商名称不参与前端检索，可按供应商代码如 103 搜索）');
      return;
    }

    // 4. 结构化搜索（2026-08-05 修复：无条件时禁止返回全库——"8月"识别为月份条件；区间=去程日期区间）
    var hasCond = !!(arrCity || _dq.mode !== 'none' || daysVal || airlineHits.length || supplierHits.length);
    var recs = [];
    if (hasCond) {
      recs = DB.records.filter(function(r) {
        if (!_validRecord(r)) return false;
        // 多航司 = 并集(OR)：一条航班只有一个航司，AND 必然 0 条
        if (airlineHits.length && !_matchAnyAirline(r, airlineHits)) return false;
        // 供应商代码维度（与航司/城市/日期为 AND 交集，使「103GK」=供应商103的GK航班）
        if (supplierHits.length && supplierHits.indexOf(String(r.supplier || '')) === -1) return false;
        if (arrCity && r.arr !== arrCity && r.dep !== arrCity) return false;
        if (_dq.mode === 'single') {
          // 2026-08-18：去程日期 或 回程日期 任一命中即出结果
          var _ok = false;
          var _td = new Date(_dq.date);
          if (Math.abs(new Date(r.dep_date)-_td) <= 86400000) _ok = true;
          if (!_ok && r.return_date && Math.abs(new Date(r.return_date)-_td) <= 86400000) _ok = true;
          if (!_ok) return false;
        } else if (_dq.mode === 'range') {
          // 2026-08-18：去程日期 或 回程日期 落在区间即可（闭区间）
          var _ok2 = false;
          var _dStart = new Date(_dq.start), _dEnd = new Date(_dq.end);
          if (!(new Date(r.dep_date) < _dStart || new Date(r.dep_date) > _dEnd)) _ok2 = true;
          if (!_ok2 && r.return_date && !(new Date(r.return_date) < _dStart || new Date(r.return_date) > _dEnd)) _ok2 = true;
          if (!_ok2) return false;
        } else if (_dq.mode === 'month') {
          // 2026-08-18：去程月份 或 回程月份 任一命中即出结果
          var _ok3 = (r.dep_date||'').slice(5,7) === _dq.month;
          if (!_ok3 && r.return_date && (r.return_date||'').slice(5,7) === _dq.month) _ok3 = true;
          if (!_ok3) return false;
        }
        if (daysVal && getDays(r) !== daysVal) return false;
        return true;
      });
    }
    
    // 5. 模糊兜底（2026-08-18：已抽到航司关键字时不走整串兜底，
    //    否则「帮我将…列出来」整句必然 0 条，再被拼音兜底乱命中）
    //    2026-08-18 修复：已带日期/节假日条件(_dq.mode!=='none')时不再兜底，
    //    否则「0 条」会被回退成城市全量、静默吞掉日期约束
    if (!recs.length && !airlineHits.length && _dq.mode === 'none') {
      recs = DB.records.filter(function(r) {
        if (!_validRecord(r)) return false;
        var kw = q.toLowerCase();
        return _searchMatch(r, kw);
      });
    }
    

    // 5.1 拼音同音兜底（2026-08-13：精确/子串无结果时，同音字转拼音匹配机场名）
    if (!recs.length && !airlineHits.length && _dq.mode === 'none') {
      var _pyHits = _pyMatchAirports(q);
      if (_pyHits.length) {
        recs = DB.records.filter(function(r) {
          if (!_validRecord(r)) return false;
          return _recHasAirport(r, _pyHits);
        });
      }
    }

    // 5.5 保存搜索结果供复制（copySearchResults 用）
    _lastSearchRecs = recs;
    
    // 6. 在筛选框内（原搜索输入框下方）直接排布结果，可滚动查看，不进弹窗
    var body = document.getElementById('filterBody');
    if (body) {
      var INLINE_CAP = 30;
      var html = _mkSearchInput(q)
        + '<div style="font-size:11px;color:var(--text-secondary);margin:6px 0">🔍 找到 ' + recs.length + ' 条结果' + _holidayNote + _supNote + '</div>';
      if (!recs.length) {
        html += '<div style="font-size:12px;color:var(--text-light);padding:8px 0">未找到匹配结果，请调整关键词</div>';
      } else {
        html += '<div style="max-height:56vh;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;margin-bottom:8px">';
        recs.slice(0, INLINE_CAP).forEach(function(r){
          html += '<div class="fit-sr" onclick="closeFilter();showSearchResult(\'' + r.dep + '\',\'' + r.arr + '\',\'' + (r.flight||'') + '\',\'' + (r.dep_date||'') + '\')">'
            + '<span style="font-weight:600;font-size:13px">' + r.dep + '-' + r.arr + '</span>'
            + ' <span style="font-size:11px;color:var(--text-light)">' + (r.flight||'') + (r.flight_return?'/'+r.flight_return:'') + '</span>'
            + '<br><span style="font-size:11px;color:var(--text-secondary)">' + (r.dep_date||'') + (r.return_date?' → '+r.return_date:'') + ' · ' + (getDays(r)||'') + '天</span>'
            + ' <span style="font-size:12px;font-weight:700;color:var(--red)">¥' + (r.retail||0) + '</span>'
            + '</div>';
        });
        html += '</div>';
        html += '<div style="display:flex;gap:6px;margin-top:6px">';
        if (recs.length > INLINE_CAP) {
          html += '<div class="fit-apply" style="flex:1;text-align:center" onclick="closeFilter();showAllSearchResults()">查看全部 ' + recs.length + ' 条结果</div>';
        }
        html += '<div class="fit-apply" style="flex:1;text-align:center" onclick="copySearchResults()">📋 复制 ' + recs.length + ' 条</div>';
        html += '</div>';
      }
      body.innerHTML = html;
    }

    // 7. 不支持关键字告警（2026-08-18）：匹配的关键字照常出结果 + 弹窗告知被忽略的供应商维度
    if (_kw.unsupported.length) {
      _showSearchAlert('已忽略不支持的关键字（供应商名称不参与检索，可按供应商代码如 103 搜索）<br><br>本次按'
        + (airlineHits.length ? '航司 <b>' + airlineHits.join(' / ') + '</b> ' : '其余关键字 ')
        + '显示 <b>' + recs.length + '</b> 条结果');
    }
}

// 复制搜索结果（2026-08-05 用户需求：格式与搜索结果相同 + 附带链接）
function copySearchResults() {
  var recs = _lastSearchRecs || [];
  if (!recs.length) { showToast('没有可复制的报价'); return; }
  var MAX_COPY = 100; // 2026-08-17 用户定案：单批复制上限100条日期报价
  var groups = _buildCopyGroups(recs);
  var kw = (document.getElementById('fitSearch')||{}).value || '';
  var link = location.origin + location.pathname + (kw ? ('?q=' + encodeURIComponent(kw)) : '');
  var trailer = _PROMO + '\n🔗 ' + link;
  var batches = _buildCopyBatchTexts(groups, MAX_COPY, trailer);
  var first = batches.shift();
  var total = groups.reduce(function(s,g){return s+g.size;},0);
  if (navigator.clipboard) {
    navigator.clipboard.writeText(first.text).then(function(){ showToast('✅ 已复制第 1 批（共 ' + (batches.length+1) + ' 批，' + MAX_COPY + ' 条/批）'); });
  } else { prompt('复制以下内容（第 1 批）：', first.text); }
  recordAction('copy_search', {count:total, batches:batches.length+1, quote:first.text.slice(0,200)});
  if (batches.length) {
    var overflow = batches.map(function(b,i){ return { label:'第 '+(i+2)+' 批（'+b.n+' 条）', text:b.text }; });
    _showCopyOverflowAlert('已复制第 1 批（'+first.n+' 条，共 '+(batches.length+1)+' 批）。剩余批次可在下方文本框长按手动复制，或点「📋 复制」继续复制。', overflow);
  }
}

// 显示单条搜索结果
function showSearchResult(dep, arr, flight, date) {
  document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active')});
  var list=document.getElementById('cardList');
  var recs = DB.records.filter(function(r){return _validRecord(r) && r.dep===dep && r.arr===arr && r.flight===flight && r.dep_date===date});
  // 2026-08-13: 搜索态顶部栏（排序/搜索按钮 + 关键字分组标题）
  _isSearchView = true;
  if (typeof generateFooterQR === 'function') generateFooterQR();
  list.innerHTML = _searchStickyBar(recs.length, _lastSearchQ) + recs.map(cardHTML).join('');
}

// 显示全部搜索结果
var _lastSearchRecs = [];
function showAllSearchResults() {
  document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active')});
  var list=document.getElementById('cardList');
  list.innerHTML = '<div class="loading">加载中...</div>';
  // 重跑搜索获取全量结果
  var q = (document.getElementById('fitSearch')||{}).value || '';
  if (q) searchFilterAndShow(q);
}

function searchFilterAndShow(q) {
  // 2026-08-13: 标记搜索态（结果列表顶部显示 排序/搜索 按钮 + 关键字分组标题）
  _isSearchView = true;
  if (typeof generateFooterQR === 'function') generateFooterQR();
  _lastSearchQ = q;
  // 0. 关键字抽取（2026-08-18）：与 searchFilter 保持同一套语义，否则两处结果不一致
  var _kw = _extractSearchKw(q);
  var airlineHits = _kw.airlines;
  // 同上逻辑，但直接显示到cardList
  var knownCities = ['东京','大阪','名古屋','冲绳','札幌','福冈','仙台','首尔','济州岛','釜山',
    '曼谷','普吉岛','普吉岛','清迈','苏梅','巴厘岛','沙巴','新加坡','吉隆坡','胡志明','岘港','马尼拉','雅加达','河内','富国岛',
    '香港','澳门','台北','三亚','海口','厦门'];
  // 2026-08-16 修复：普吉岛=普吉岛 城市同义词归一（库内两种写法并存：HO1369=普吉岛 / FM857=普吉岛）
  // ① knownCities 匹配取「最长优先」：搜「普吉岛」应归到 普吉岛 而非 普吉岛
  // ② arrCity 过滤用同义词归一比较，避免 arr=普吉岛 与 arr=普吉岛 互相排除
  var CITY_SYN = {'普吉岛':'普吉岛', '济州':'济州岛'};
  function _normCity(c) { return CITY_SYN[c] || c; }
  var foundCities = knownCities.filter(function(c){return q.indexOf(c)!==-1});
  foundCities.sort(function(a,b){ return b.length - a.length; });
  var arrCity = foundCities.length ? _normCity(foundCities[0]) : '';
  // 2. 提取日期（2026-08-18 升级：区间 + 多格式单日，与 searchFilter 同一套 _parseDateQuery）
  var _dq = _parseDateQuery(q);
  var daysMatch = q.match(/(\d+)天|五(?=天)|四(?=天)|六(?=天)|七(?=天)|八(?=天)|九(?=天)|十(?=天)/);
  var cnNum = {'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10};
  var daysVal = '';
  if (daysMatch) {
    var raw = daysMatch[1] || daysMatch[0];
    daysVal = cnNum[raw] ? ''+cnNum[raw] : raw;
  }
  var recs = DB.records.filter(function(r) {
    if (!_validRecord(r)) return false;
    // 多航司 = 并集(OR)（2026-08-18）：一条航班只有一个航司，AND 必然 0 条
    if (airlineHits.length && !_matchAnyAirline(r, airlineHits)) return false;
    // 2026-08-16：arr/dep 用同义词归一后与 arrCity 比较（普吉岛=普吉岛）
    if (arrCity) {
      if (_normCity(r.arr) !== arrCity && _normCity(r.dep) !== arrCity) return false;
    } else if (!airlineHits.length && !_searchMatch(r, q.toLowerCase())) {
      // 2026-08-16 修复：无城市命中（如只搜航班号/机场码）→ 用通用子串匹配，避免误显示全库
      // 2026-08-18：已抽到航司关键字时跳过整串匹配（整句永远匹配不到）
      return false;
    }
    if (_dq.mode === 'single') {
      // 2026-08-18：去程日期 或 回程日期 任一命中即出结果
      var _ok = false;
      var _td = new Date(_dq.date);
      if (Math.abs(new Date(r.dep_date)-_td) <= 86400000) _ok = true;
      if (!_ok && r.return_date && Math.abs(new Date(r.return_date)-_td) <= 86400000) _ok = true;
      if (!_ok) return false;
    } else if (_dq.mode === 'range') {
      // 2026-08-18：去程日期 或 回程日期 落在区间即可（闭区间）
      var _ok2 = false;
      var _dStart = new Date(_dq.start), _dEnd = new Date(_dq.end);
      if (!(new Date(r.dep_date) < _dStart || new Date(r.dep_date) > _dEnd)) _ok2 = true;
      if (!_ok2 && r.return_date && !(new Date(r.return_date) < _dStart || new Date(r.return_date) > _dEnd)) _ok2 = true;
      if (!_ok2) return false;
    } else if (_dq.mode === 'month') {
      // 2026-08-18：去程月份 或 回程月份 任一命中即出结果
      var _ok3 = (r.dep_date||'').slice(5,7) === _dq.month;
      if (!_ok3 && r.return_date && (r.return_date||'').slice(5,7) === _dq.month) _ok3 = true;
      if (!_ok3) return false;
    }
    if (daysVal && getDays(r) !== daysVal) return false;
    return true;
  });
  if (!recs.length && !airlineHits.length && _dq.mode === 'none') {
    recs = DB.records.filter(function(r) {
      if (!_validRecord(r)) return false;
      var kw = q.toLowerCase();
      return _searchMatch(r, kw);
    });
  }
  // 2026-08-13: 排序——用户设了排序条件按 _sortModes，否则默认价格升序；列表顶部带 排序/搜索 按钮
  var sorted = (_sortModes && _sortModes.length) ? _sortRecords(recs) : recs.slice().sort(function(a,b){return (a.retail||99999)-(b.retail||99999)});
  var shown = sorted.length > 50 ? sorted.slice(0,50) : sorted;
  document.getElementById('cardList').innerHTML = _searchStickyBar(recs.length, q) + shown.map(cardHTML).join('');

  // 不支持关键字告警（2026-08-18）：与 searchFilter 同一套提示
  if (_kw.unsupported.length) {
    _showSearchAlert('已忽略不支持的关键字（供应商名称不参与检索，可按供应商代码如 103 搜索）<br><br>本次按'
      + (airlineHits.length ? '航司 <b>' + airlineHits.join(' / ') + '</b> ' : '其余关键字 ')
      + '显示 <b>' + recs.length + '</b> 条结果');
  }
}

// ── 重置 ──
function resetFilter() {
  _filter = { dep: '', arr: '', days: '', month: '', date: '', dates: [] };
  recordAction('filter_reset', {});
  _showFilter();
}

function applyFilter() {
  closeFilter();
  currentTab = 'filter';
  recordAction('filter_apply', {route:(_filter.dep||'')+'→'+(_filter.arr||''),days:_filter.days,date:_filter.month});
  if (_searchMode === 'freetour' && window.FreeTour && window.FreeTour.applyFilter) {
    window.FreeTour.applyFilter(_filter);
    return;
  }
  renderFiltered();
}

function renderFiltered() {
  var recs = _recordsInScope().filter(function(r) { return _hasSeats(r); });
  if (_filter.dep) recs = recs.filter(function(r){return r.dep===_filter.dep});
  if (_filter.arr) recs = recs.filter(function(r){return r.arr===_filter.arr});
  if (_filter.days) recs = recs.filter(function(r){return daysMatch(r,_filter.days)});
  if (_filter.month) recs = recs.filter(function(r){return (r.dep_date||'').slice(0,7)===_filter.month});
  if ((_filter.dates || []).length) recs = recs.filter(_isDateOnOrAfter);  // 2026-08-04：多选日期任意命中（与复制口径一致）
  // 拼音同音兜底（2026-08-13）
  if (!recs.length) {
    var _pyHits2 = _pyMatchAirports(q);
    if (_pyHits2.length) {
      recs = DB.records.filter(function(r) {
        if (!_validRecord(r)) return false;
        return _recHasAirport(r, _pyHits2);
      });
    }
  }
  // 2026-08-13: 排序——设了排序条件按 _sortModes，否则默认价格升序；顶部带 分组+排序+搜索 固定栏
  var sorted = (_sortModes && _sortModes.length) ? _sortRecords(recs) : recs.slice().sort(function(a,b){return (a.retail||99999)-(b.retail||99999)});
  document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active')});
  var list=document.getElementById('cardList');
  if (!sorted.length) { list.innerHTML='<div class="loading">无符合条件数据</div>'; return; }
  list.innerHTML = _filterStickyBar(sorted.length) + sorted.map(cardHTML).join('');  // 2026-08-06: 筛选报价默认显示全部数据（不再 slice 前50条，不用上下滑动看更多）
}
