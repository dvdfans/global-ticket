function render() {
  // 首页-尾单; 热门-中秋国庆; 其他-区域筛选
  if (currentTab === 'home') return renderHome();
  if (currentTab === 'filter') return renderFiltered();
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
  // 默认 date_asc
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
  var label = {'home':'尾单','hot':'热门','japan':'日本','korea':'韩国','seasia':'东南亚','ganga':'港澳','domestic':'国内'};
  var name = label[currentTab] || currentTab;
  return '<div class="sticky-bar" style="display:flex;align-items:center;justify-content:space-between;padding:6px 12px">'
    + '<span class="sticky-label" style="font-weight:500;font-size:13px">'+name+'</span>'
    + '<div style="display:flex;gap:4px;align-items:center">'
    + '<span class="sticky-filter" onclick="openSortModal()" style="font-size:11px;padding:3px 8px;border-radius:10px;border:0.5px solid var(--border);cursor:pointer;color:#888;margin-right:8px">↕ 排序</span>'
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
  var holidayStart = '2026-09-25', holidayEnd = '2026-10-07';
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
      html+='<div class="hm-group" onclick="toggleGroup(\''+gid+'\')"><div class="hm-group-hd">'
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
  
  // 首页：尾单 — 所有航线1周内余位≤3（排除售罄）
  var records = DB.records.filter(function(r) {
    if (!_hasSeats(r) || !_validRecord(r)) return false;
    var d = r.dep_date || '';
    if (d < todayStr || d > weekEndStr) return false;
    var s = parseInt((r.seats||'0').match(/\d+/)?.[0] || '999');
    return s <= 3 && !(!r.flight_return && (r.dep === '济州岛' || r.dep === '济州') && r.arr === '上海');
  });
  records.sort(function(a,b) { return (a.dep_date||'') < (b.dep_date||'') ? -1 : 1; });
  
  var html = _stickyBar();
  var useSimple = location.pathname.indexOf('_simple') !== -1;
  if (records.length) records.slice(0, 100).forEach(function(r) { html += useSimple ? renderCardSimple(r) : hmCard(r); });
  else html += '<div class="loading" style="padding:20px">暂无尾单</div>';
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
  var IATA_CITY = {'AAT':'阿勒泰', 'BKI':'沙巴', 'BKK':'曼谷', 'CAN':'广州', 'CGK':'雅加达', 'CGO':'郑州', 'CJJ':'清州', 'CJU':'济州岛', 'CKG':'重庆', 'CNX':'清迈', 'CSX':'长沙', 'CTS':'札幌', 'CTU':'成都', 'DAD':'岘港', 'DLC':'大连', 'DMK':'曼谷', 'DPS':'巴厘岛', 'DYG':'张家界', 'FOC':'福州', 'FUK':'福冈', 'GMP':'首尔', 'HAK':'海口', 'HAN':'河内', 'HGH':'杭州', 'HKG':'香港', 'HKT':'普吉', 'HND':'东京', 'HRB':'哈尔滨', 'ICN':'首尔', 'JXU':'嘉兴', 'KHH':'高雄', 'KIX':'大阪', 'KMG':'昆明', 'KUL':'吉隆坡', 'KWE':'贵阳', 'KWL':'桂林', 'LHW':'兰州', 'MFM':'澳门', 'MNL':'马尼拉', 'NGB':'宁波', 'NGO':'名古屋', 'NKG':'南京', 'NNG':'南宁', 'NRT':'东京', 'NTG':'南通', 'OKA':'冲绳', 'PEK':'北京', 'PKX':'北京', 'PQC':'富国岛', 'PUS':'釜山', 'PVG':'上海', 'SGN':'胡志明', 'SHA':'上海', 'SHE':'沈阳', 'SIN':'新加坡', 'SYX':'三亚', 'SZX':'深圳', 'TAO':'青岛', 'TFU':'成都', 'TNA':'济南', 'TPE':'台北', 'TSN':'天津', 'URC':'乌鲁木齐', 'WUH':'武汉', 'WUX':'无锡', 'XIY':'西安', 'XMN':'厦门', 'XNN':'西宁'};
  var retCity = r.arr;
  var retDepAirport = (r.return_dep_airport || '').trim();
  if (retDepAirport && retDepAirport !== r.arr) {
    if (IATA_CITY[retDepAirport]) {
      retCity = IATA_CITY[retDepAirport];
    } else {
      var knownCities = ['东京','大阪','首尔','济州','香港','澳门','普吉','曼谷','冲绳','三亚','巴厘岛','沙巴','新加坡','福冈','釜山','清迈','名古屋','札幌','仙台'];
      for (var ci = 0; ci < knownCities.length; ci++) {
        if (retDepAirport.indexOf(knownCities[ci]) !== -1) { retCity = knownCities[ci]; break; }
      }
      if (retCity === r.arr) {
        var airportCityMap = {'樟宜':'新加坡','济州':'济州岛','沙巴亚庇':'沙巴','苏南硕放':'无锡','南京禄口':'南京','杭州萧山':'杭州','宁波栎社':'宁波','南通兴东':'南通','三亚凤凰':'三亚','普吉岛':'普吉','曼谷素万那普':'曼谷','冲绳那霸':'冲绳','札幌新千岁':'札幌'};
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
  '济州':'济州岛','普吉':'普吉岛'
};
// 机场名规范化：源表原文（上海浦东/上海浦东机场/成田）→ 约定俗成名（上海浦东/东京成田）
function _airportCN(name, code) {
  var n = String(name || '').trim();
  if (n) {
    n = n.replace(/T\d+$/, '').replace(/机场$/, '').trim();   // 去航站楼残留 + 去"机场"后缀
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
// 详情页行李行：有值才输出（2026-08-05 用户：行李额只渲染在详情页，不渲染在卡片）
function _bagDetailRow(r) {
  var b = ((r.baggage || '')).trim();
  if (!b) return '';
  return '<div class="detail-row"><span class="label">行李</span><span class="value">🧳 ' + b + '</span></div>';
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
    '曼谷':7,'普吉':7,'清迈':7,'清迈5天':7,'胡志明':7,'岘港':7,'河内':7,'雅加达':7,'富国岛':7,
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
    '曼谷':7,'普吉':7,'清迈':7,'清迈5天':7,'胡志明':7,'岘港':7,'河内':7,'雅加达':7,'富国岛':7,
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
  var IATA_CITY = {'AAT':'阿勒泰', 'BKI':'沙巴', 'BKK':'曼谷', 'CAN':'广州', 'CGK':'雅加达', 'CGO':'郑州', 'CJJ':'清州', 'CJU':'济州岛', 'CKG':'重庆', 'CNX':'清迈', 'CSX':'长沙', 'CTS':'札幌', 'CTU':'成都', 'DAD':'岘港', 'DLC':'大连', 'DMK':'曼谷', 'DPS':'巴厘岛', 'DYG':'张家界', 'FOC':'福州', 'FUK':'福冈', 'GMP':'首尔', 'HAK':'海口', 'HAN':'河内', 'HGH':'杭州', 'HKG':'香港', 'HKT':'普吉', 'HND':'东京', 'HRB':'哈尔滨', 'ICN':'首尔', 'JXU':'嘉兴', 'KHH':'高雄', 'KIX':'大阪', 'KMG':'昆明', 'KUL':'吉隆坡', 'KWE':'贵阳', 'KWL':'桂林', 'LHW':'兰州', 'MFM':'澳门', 'MNL':'马尼拉', 'NGB':'宁波', 'NGO':'名古屋', 'NKG':'南京', 'NNG':'南宁', 'NRT':'东京', 'NTG':'南通', 'OKA':'冲绳', 'PEK':'北京', 'PKX':'北京', 'PQC':'富国岛', 'PUS':'釜山', 'PVG':'上海', 'SGN':'胡志明', 'SHA':'上海', 'SHE':'沈阳', 'SIN':'新加坡', 'SYX':'三亚', 'SZX':'深圳', 'TAO':'青岛', 'TFU':'成都', 'TNA':'济南', 'TPE':'台北', 'TSN':'天津', 'URC':'乌鲁木齐', 'WUH':'武汉', 'WUX':'无锡', 'XIY':'西安', 'XMN':'厦门', 'XNN':'西宁'};
  var retCity = r.arr;
  var retDepAirport = (r.return_dep_airport||'').trim();
  if (retDepAirport && retDepAirport !== r.arr) {
    if (IATA_CITY[retDepAirport]) {
      retCity = IATA_CITY[retDepAirport];
    } else {
    // 从机场名提取城市名
    var knownCities = ['东京','大阪','首尔','济州','香港','澳门','普吉','曼谷','冲绳','三亚','巴厘岛','沙巴','新加坡','福冈','釜山','清迈','名古屋','札幌','仙台'];
    for (var ci=0; ci<knownCities.length; ci++) {
      if (retDepAirport.indexOf(knownCities[ci]) !== -1) { retCity = knownCities[ci]; break; }
    }
    // 机场名→城市名映射（已知不包含城市名的）
    if (retCity === r.arr) {
      var airportCityMap = {'樟宜':'新加坡','济州':'济州岛','沙巴亚庇':'沙巴','苏南硕放':'无锡','南京禄口':'南京','杭州萧山':'杭州','宁波栎社':'宁波','南通兴东':'南通','三亚凤凰':'三亚','普吉岛':'普吉','曼谷素万那普':'曼谷','冲绳那霸':'冲绳','札幌新千岁':'札幌'};
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
      '曼谷':7,'普吉':7,'清迈':7,'清迈5天':7,'胡志明':7,'岘港':7,'河内':7,'雅加达':7,'富国岛':7,
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

// ═══ 简化版卡片（用于首页尾单）═══
function renderCardSimple(r) {
  var hasReturn = !!(r.flight_return && r.flight_return.trim());
  var daysVal = getDays(r);
  var durationStr = daysVal ? ' ' + daysVal + '天' : '';
  var IATA_CITY = {'AAT':'阿勒泰', 'BKI':'沙巴', 'BKK':'曼谷', 'CAN':'广州', 'CGK':'雅加达', 'CGO':'郑州', 'CJJ':'清州', 'CJU':'济州岛', 'CKG':'重庆', 'CNX':'清迈', 'CSX':'长沙', 'CTS':'札幌', 'CTU':'成都', 'DAD':'岘港', 'DLC':'大连', 'DMK':'曼谷', 'DPS':'巴厘岛', 'DYG':'张家界', 'FOC':'福州', 'FUK':'福冈', 'GMP':'首尔', 'HAK':'海口', 'HAN':'河内', 'HGH':'杭州', 'HKG':'香港', 'HKT':'普吉', 'HND':'东京', 'HRB':'哈尔滨', 'ICN':'首尔', 'JXU':'嘉兴', 'KHH':'高雄', 'KIX':'大阪', 'KMG':'昆明', 'KUL':'吉隆坡', 'KWE':'贵阳', 'KWL':'桂林', 'LHW':'兰州', 'MFM':'澳门', 'MNL':'马尼拉', 'NGB':'宁波', 'NGO':'名古屋', 'NKG':'南京', 'NNG':'南宁', 'NRT':'东京', 'NTG':'南通', 'OKA':'冲绳', 'PEK':'北京', 'PKX':'北京', 'PQC':'富国岛', 'PUS':'釜山', 'PVG':'上海', 'SGN':'胡志明', 'SHA':'上海', 'SHE':'沈阳', 'SIN':'新加坡', 'SYX':'三亚', 'SZX':'深圳', 'TAO':'青岛', 'TFU':'成都', 'TNA':'济南', 'TPE':'台北', 'TSN':'天津', 'URC':'乌鲁木齐', 'WUH':'武汉', 'WUX':'无锡', 'XIY':'西安', 'XMN':'厦门', 'XNN':'西宁'};
  var retCity = r.arr;
  var retDepAirport = (r.return_dep_airport||'').trim();
  if (retDepAirport && retDepAirport !== r.arr) {
    if (IATA_CITY[retDepAirport]) { retCity = IATA_CITY[retDepAirport]; }
    else {
    var kc = ['东京','大阪','首尔','济州','香港','澳门','普吉','曼谷','冲绳','三亚','巴厘岛','沙巴','新加坡','福冈','釜山','清迈','名古屋','札幌','仙台'];
    for (var ci=0; ci<kc.length; ci++) { if (retDepAirport.indexOf(kc[ci])!==-1) { retCity=kc[ci]; break; } }
    if (retCity===r.arr) {
      var acm={'樟宜':'新加坡','济州':'济州岛','沙巴亚庇':'沙巴','苏南硕放':'无锡','南京禄口':'南京','杭州萧山':'杭州','宁波栎社':'宁波','南通兴东':'南通','三亚凤凰':'三亚','普吉岛':'普吉','曼谷素万那普':'曼谷','冲绳那霸':'冲绳','札幌新千岁':'札幌'};
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
  // 同航司 + 反向路线 + 日期在去程+1天 到 去程+15天
  var maxDate = new Date(rec.dep_date);
  maxDate.setDate(maxDate.getDate() + 15);
  var maxDateStr = maxDate.toISOString().slice(0,10);
  var minDate = new Date(rec.dep_date);
  minDate.setDate(minDate.getDate() + 1);
  var minDateStr = minDate.toISOString().slice(0,10);
  var rets = DB.records.filter(function(r) {
    return r.dep === rec.arr && r.arr === rec.dep
      && r.dep_date >= minDateStr && r.dep_date <= maxDateStr
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
// 组合行程固定栏（详情页顶部 sticky，2026-08-13）：去程+回程+合计+天数+余位+同航司徽标
function _comboBarHtml(outRec, ret) {
  var days = _comboDays(outRec, ret);
  var total = (outRec.retail||0) + (ret.retail||0);
  var outSeat = _seatDispRender(outRec.seats);
  var retSeat = _seatDispRender(ret.seats);
  return '<div id="comboStickyBar" style="position:sticky;top:0;z-index:5;background:var(--card-bg);border-bottom:1px solid var(--border);padding:10px 16px;font-size:12px;line-height:1.8;box-shadow:0 1px 4px rgba(0,0,0,.05)">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">'
    + '<span id="comboStickyTitle" style="font-size:11px;font-weight:600;color:var(--text-secondary)">组合行程' + (days ? ' · ' + days + '天' : '') + '</span>'
    + '<span style="font-size:11px;color:var(--green)">同航司</span>'
    + '</div>'
    + '<div><span class="label" style="font-size:11px;color:var(--text-light)">去程</span> ' + _fmtDateShort(outRec.dep_date) + ' ' + (outRec.flight||'') + ' ' + _aptBlockTxt(outRec,'dep') + '→' + _aptBlockTxt(outRec,'arr') + ' ' + (outRec.dep_time||'') + '-' + (outRec.arr_time||'') + (outSeat ? ' <span style="color:var(--green);font-size:11px">' + outSeat + '</span>' : '') + '</div>'
    + '<div id="comboStickyRet"><span class="label" style="font-size:11px;color:var(--text-light)">回程</span> ' + _fmtDateShort(ret.dep_date) + ' ' + (ret.flight||'') + ' ' + _aptBlockTxt(ret,'dep') + '→' + _aptBlockTxt(ret,'arr') + ' ' + (ret.dep_time||'') + '-' + (ret.arr_time||'') + (retSeat ? ' <span style="color:var(--green);font-size:11px">' + retSeat + '</span>' : '') + '</div>'
    + '<div id="comboStickyTotal" style="margin-top:4px;padding-top:4px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">'
    + '<span style="font-weight:700;font-size:14px;color:var(--red)">合计 ¥' + total + '</span>'
    + '<span style="font-size:11px;color:var(--text-light)">= 去¥' + (outRec.retail||0) + ' + 回¥' + (ret.retail||0) + '</span>'
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
  var t = (outRec.dep||'') + '-' + (outRec.arr||'') + '/' + (ret.dep||'') + '-' + (outRec.dep||'') + (days ? ' ' + days + '天' : '')
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
  var html = '<div class="detail-section" style="padding:0 16px"><h4>需搭配回程航班 <span style="font-size:11px;font-weight:400;color:var(--text-light)">' + (staff ? '同航司·可勾选多条复制' : '同航司·可选日期') + '</span></h4>'
    + '<div style="max-height:200px;overflow-y:auto;margin-top:6px">';
  rets.forEach(function(r, idx) {
    html += '<div class="rodate" onclick="selectReturn(' + idx + ')" id="ropt_' + idx + '">'
      + (staff ? '<input type="checkbox" class="ro-multi" data-idx="' + idx + '" onclick="event.stopPropagation()" onchange="updateMultiBtn()" style="accent-color:var(--red);width:15px;height:15px;flex:none">' : '')
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
// 客服批量复制：动态刷新按钮计数（去程数×回程数的有效组合数）
function updateMultiBtn() {
  try {
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
// 计算组合数 = 去程数 × 回程数（纯乘积，按钮计数用）
function _comboCount() {
  var outs = _checkedOutRecs();
  if (!outs.length && currentDetailRec) outs = [currentDetailRec];
  var rets = _checkedRetRecs();
  if (!rets.length) rets = _curReturnOptions.length ? [_curReturnOptions[_selectedReturnIdx] || _curReturnOptions[0]] : [];
  return outs.length * rets.length;
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
  var rets = _checkedRetRecs();
  if (!rets.length) rets = _curReturnOptions.length ? [_curReturnOptions[_selectedReturnIdx] || _curReturnOptions[0]] : [];
  if (!outs.length || !rets.length) { showToast('⚠ 请先勾选要复制的回程航班'); return; }
  var lines = [];
  outs.forEach(function(out) {
    rets.forEach(function(ret) {
      lines.push(_comboText(out, ret));
    });
  });
  if (!lines.length) { showToast('⚠ 请先勾选要复制的回程航班'); return; }
  // 2026-08-13 深链：当前红点选中的组合（_deepUrl 由 openDetail/selectReturn 维护），客人打开所见即所得；
  // 统一推广文案（与 copyAll 同款）
  var text = lines.join('\n\n') + '\n\n' + _PROMO + '\n🔗 ' + _deepUrl;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function() { showToast('✅ 已复制 ' + lines.length + ' 条组合（' + outs.length + ' 去程 × ' + rets.length + ' 回程），可直接粘贴'); });
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
  // 更新组合行程
  var ret = _curReturnOptions[idx];
  if (!ret) return;
  var outRec = currentDetailRec;
  var total = (outRec.retail||0) + (ret.retail||0);
  var days = _comboDays(outRec, ret);
  var retSeat = _seatDispRender(ret.seats);
  // 顶部固定栏：回程行 + 合计行 + 标题天数
  var stickyRet = document.getElementById('comboStickyRet');
  if (stickyRet) {
    stickyRet.innerHTML = '<span class="label" style="font-size:11px;color:var(--text-light)">回程</span> ' + _fmtDateShort(ret.dep_date) + ' ' + (ret.flight||'') + ' ' + _aptBlockTxt(ret,'dep') + '→' + _aptBlockTxt(ret,'arr') + ' ' + (ret.dep_time||'') + '-' + (ret.arr_time||'') + (retSeat ? ' <span style="color:var(--green);font-size:11px">' + retSeat + '</span>' : '');
  }
  var stickyTitle = document.getElementById('comboStickyTitle');
  if (stickyTitle) stickyTitle.textContent = '组合行程' + (days ? ' · ' + days + '天' : '');
  var stickyTotal = document.getElementById('comboStickyTotal');
  if (stickyTotal) {
    stickyTotal.innerHTML = '<span style="font-weight:700;font-size:14px;color:var(--red)">合计 ¥' + total + '</span>'
      + '<span style="font-size:11px;color:var(--text-light)">= 去¥' + (outRec.retail||0) + ' + 回¥' + (ret.retail||0) + '</span>';
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

function openDetail(rec) {
  if (!rec) return;
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
  
  var f1 = rec.flight || '';
  var f2 = rec.flight_return || '';
  var hasReturn = !!(f2 && f2.trim());
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
    var sel = active ? ' style="background:#FFF1F0;border:1px solid var(--red)"' : '';
    var dot = active ? '<span class="odate-dot" style="color:var(--red)">●</span>' : '<span class="odate-dot">○</span>';
    return '<div class="odate" onclick="openDetail(_sameRoute[' + idx + '])"' + sel + '>'
      + (staff ? '<input type="checkbox" class="odate-multi" data-idx="' + idx + '" onclick="event.stopPropagation()" onchange="updateODateBtn();updateMultiBtn()" style="accent-color:var(--red);width:15px;height:15px;flex:none">' : '')
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
  var IATA_CITY = {'AAT':'阿勒泰', 'BKI':'沙巴', 'BKK':'曼谷', 'CAN':'广州', 'CGK':'雅加达', 'CGO':'郑州', 'CJJ':'清州', 'CJU':'济州岛', 'CKG':'重庆', 'CNX':'清迈', 'CSX':'长沙', 'CTS':'札幌', 'CTU':'成都', 'DAD':'岘港', 'DLC':'大连', 'DMK':'曼谷', 'DPS':'巴厘岛', 'DYG':'张家界', 'FOC':'福州', 'FUK':'福冈', 'GMP':'首尔', 'HAK':'海口', 'HAN':'河内', 'HGH':'杭州', 'HKG':'香港', 'HKT':'普吉', 'HND':'东京', 'HRB':'哈尔滨', 'ICN':'首尔', 'JXU':'嘉兴', 'KHH':'高雄', 'KIX':'大阪', 'KMG':'昆明', 'KUL':'吉隆坡', 'KWE':'贵阳', 'KWL':'桂林', 'LHW':'兰州', 'MFM':'澳门', 'MNL':'马尼拉', 'NGB':'宁波', 'NGO':'名古屋', 'NKG':'南京', 'NNG':'南宁', 'NRT':'东京', 'NTG':'南通', 'OKA':'冲绳', 'PEK':'北京', 'PKX':'北京', 'PQC':'富国岛', 'PUS':'釜山', 'PVG':'上海', 'SGN':'胡志明', 'SHA':'上海', 'SHE':'沈阳', 'SIN':'新加坡', 'SYX':'三亚', 'SZX':'深圳', 'TAO':'青岛', 'TFU':'成都', 'TNA':'济南', 'TPE':'台北', 'TSN':'天津', 'URC':'乌鲁木齐', 'WUH':'武汉', 'WUX':'无锡', 'XIY':'西安', 'XMN':'厦门', 'XNN':'西宁'};
  if (retDepAirport && retDepAirport !== rec.arr) {
    if (IATA_CITY[retDepAirport]) {
      retCity = IATA_CITY[retDepAirport];
    } else {
      var kc = ['东京','大阪','首尔','济州','香港','澳门','普吉','曼谷','冲绳','三亚','巴厘岛','沙巴','新加坡','福冈','釜山','清迈','名古屋','札幌','仙台'];
      for (var ci=0; ci<kc.length; ci++) { if (retDepAirport.indexOf(kc[ci]) !== -1) { retCity = kc[ci]; break; } }
      if (retCity === rec.arr) {
        var acm = {'樟宜':'新加坡','济州':'济州岛','沙巴亚庇':'沙巴','苏南硕放':'无锡','南京禄口':'南京','杭州萧山':'杭州','宁波栎社':'宁波','南通兴东':'南通','三亚凤凰':'三亚','普吉岛':'普吉','曼谷素万那普':'曼谷','冲绳那霸':'冲绳','札幌新千岁':'札幌'};
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

  var html = '<div class="detail-header" style="position:relative">'
    + '<div class="dh-top"><span class="detail-close" onclick="closeDetail()">← 返回</span><span class="detail-x" onclick="closeDetail()">✕</span></div>'
    + '<div class="dh-route">' + (rec.dep||'—') + '-' + (rec.arr||'—') + (hasReturn ? '/' + retCity + '-' + (rec.dep||'') : '') + ' ' + supTagHtml(rec.supplier, 'dh-sup-tag') + '</div>'
    + '<div class="dh-flight"><span class="dh-time">' + (rec.dep_time||'') + '</span> <span class="dh-dur">' + outDuration + '</span> <span class="dh-time">' + (rec.arr_time||'') + '</span> ' + _aptBlock(rec, 'dep') + '→' + _aptBlock(rec, 'arr') + '</div>'
    + '<div class="dh-dates">' + (rec.dep_date||'') + (rec.return_date ? ' → ' + rec.return_date : '') + '  •  ' + (getDays(rec)||'') + '天</div>'
    + '</div>'
    // 组合行程顶部固定栏（仅单程自由组合，2026-08-13）：sticky 吸顶，滚动回程列表时始终可见
    + (!hasReturn ? (function(){ var _rets0 = getReturnOptions(rec); _curReturnOptions = _rets0; return _rets0.length ? _comboBarHtml(rec, _rets0[0]) : ''; })() : '')
    + '<div class="detail-body">'
    // 价格行：一行排列 ¥3749（含税）/人    余位1
    + '<div class="dp-row"><span class="dp-price">¥' + (rec.retail||0) + '</span><span class="dp-tax">（含税）/人</span><span class="dp-seat">' + seatsBadge + '</span></div>'
    + '<div class="detail-section"><h4>航班信息 <span style="font-size:11px;font-weight:400;color:var(--text-light)">' + typeStr + '</span></h4>'
    + '<div class="detail-row"><span class="label">航司</span><span class="value">' + (rec.airline_cn||rec.airline||'—') + '</span></div>'
    + ''
    + _bagDetailRow(rec)
    + '<div class="detail-row" style="border-bottom:none"><span class="label">去程</span><span class="value">' + outDateLong + ' ' + f1 + ' ' + _aptBlock(rec, 'dep') + ' ' + (rec.dep_time||'') + ' ' + outDuration + ' ' + (rec.arr_time||'') + ' ' + _aptBlock(rec, 'arr') + '</span></div>'
    + (hasReturn
      ? '<div class="detail-row" style="border-bottom:none"><span class="label">回程</span><span class="value">' + retDateLong + ' ' + f2 + ' ' + _aptBlock(rec, 'return_dep') + ' ' + (rec.return_dep_time||'') + ' ' + retDuration + ' ' + (rec.return_arr_time||'') + ' ' + _aptBlock(rec, 'return_arr') + '</span></div>'
      : '')
    // 其他去程日期（默认折叠）— 与当前天数、回程航班一致
    + '<div class="dd-toggle" onclick="toggleDates()">📅 其他去程日期 <span id="darrow">▸</span></div>'
    + '<div id="ddates" style="display:none;padding:0 16px 8px">' + dateListHtml
    + (staff ? '<div style="margin-top:8px"><button id="odateMultiBtn" onclick="copySelectedDates()" style="width:100%;padding:10px;border:none;border-radius:8px;background:var(--red);color:#fff;font-size:13px;font-weight:700;cursor:pointer">📋 复制选中日期</button></div>' : '')
    + '</div>'
    + (!hasReturn ? renderReturnOptions(rec) : '')
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
  // 折叠=单日期复制文本，展开=全日期复制文本
  _shareText = isOpen ? _shareTextSingle : _shareTextAll;
}

// ═══════════════ 复制全部信息 ═══════════════

var _shareText = '', _shareTextSingle = '', _shareTextAll = '', _deepUrl = '', _sameRoute = [], _curReturnOptions = [];
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
  consultCS('一般咨询');
};

// ═══════════════ 分享（含二维码）═══════════════

function openShareModal() {
  recordAction('share_open', {});
  var url = location.origin + location.pathname + _filterUrlQuery();
  var text = _shareText || '🌍 环球度假 · 特价机票每日更新\n' + url;
  
  var html = '<div style="text-align:center;padding:20px 16px">'
    + '<p style="font-size:15px;font-weight:700;color:var(--text)">分享报价</p>'
    + '<div style="margin:14px 0;background:var(--tag-bg);border-radius:8px;padding:12px;font-size:12px;color:var(--text-secondary);word-break:break-all;line-height:1.5;text-align:left">' + text + '</div>'
    + '<div style="display:flex;gap:8px">'
    + '<button class="share-copy" onclick="copyShareText()" style="flex:1;padding:10px;border:none;border-radius:8px;background:var(--brand,var(--red));color:#fff;font-weight:700;font-size:13px">📋 复制文字</button>'
    + '<button class="share-wx" onclick="wechatShare()" style="flex:1;padding:10px;border:none;border-radius:8px;background:var(--green);color:#fff;font-weight:700;font-size:13px">💚 微信分享</button>'
    + '</div>'
    + '<div id="qrCanvasWrap" style="width:200px;height:200px;margin:12px auto;border-radius:8px;overflow:hidden;background:#fff;padding:8px"></div>'
    + '<p style="font-size:12px;color:var(--text);font-weight:600">⬆ 截图此区域发送给好友</p>'
    + '<p style="font-size:11px;color:var(--text-light);margin-top:4px">好友长按或微信扫描二维码即可查看报价</p>'
    + '<div style="margin-top:12px;background:#FFF1F0;border-radius:8px;padding:10px;font-size:11px;color:#DA3A2C;text-align:left">💡 已自动复制链接，也可直接粘贴到微信发送</div>'
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
  var text = (_shareText || '🌍 环球度假 · 特价机票每日更新\n' + location.href);
  recordAction('share_copy', {quote:text});
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function() { showToast('✅ 已复制，可直接粘贴'); });
  } else { prompt('复制：', text); }
}

function wechatShare() {
  // 微信内直接通过右上角分享，提示用户操作
  if (/micromessenger/i.test(navigator.userAgent)) {
    copyShareText();
    showToast('💡 已复制，请点击右上角「...」发送');
  } else {
    copyShareText();
    showToast('💡 已复制，可粘贴到微信发送');
  }
}

function closeShareModal() {
  document.getElementById('shareModal').classList.remove('active');
}
document.getElementById('shareModal').onclick = function(e) {
  if (e.target.id === 'shareModal') closeShareModal();
};

// ═══════════════ Tab切换 ═══════════════

document.getElementById('tabBar').onclick = function(e) {
  if (e.target.classList.contains('tab')) {
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

// 全局卡片点击委托 — 所有 .hmcard 和 .card 通过 data-rec 触发详情
document.getElementById('cardList').addEventListener('click', function(e) {
  var card = e.target.closest('.card[data-rec]');
  if (!card) return;
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
  var shareUrl = location.origin + location.pathname + _filterUrlQuery();
  // 清空可能存在的占位
  wrap.innerHTML = '';
  new QRCode(wrap, { text: shareUrl, width: 72, height: 72 });
  // 点击打开分享弹层 + 自动复制链接
  document.getElementById('qrShare').onclick = function() {
    openShareModal();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).catch(function(){});
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
var _AIRPORT_PY = {"三亚": {"full": "sanya", "initial": "sy"}, "三亚凤凰": {"full": "sanyafenghuang", "initial": "syfh"}, "上海浦东": {"full": "shanghaipudong", "initial": "shpd"}, "上海浦东机场": {"full": "shanghaipudongjichang", "initial": "shpdjc"}, "上海虹桥": {"full": "shanghaihongqiao", "initial": "shhq"}, "上海虹桥机场": {"full": "shanghaihongqiaojichang", "initial": "shhqjc"}, "东京成田": {"full": "dongjingchengtian", "initial": "djct"}, "东京成田机场": {"full": "dongjingchengtianjichang", "initial": "djctjc"}, "东京羽田": {"full": "dongjingyutian", "initial": "djyt"}, "东京羽田机场": {"full": "dongjingyutianjichang", "initial": "djytjc"}, "乌鲁木齐": {"full": "wulumuqi", "initial": "wlmq"}, "亚庇国际机场": {"full": "yabiguojijichang", "initial": "ybgjjc"}, "仁川国际机场": {"full": "renchuanguojijichang", "initial": "rcgjjc"}, "冲绳那霸机场": {"full": "chongshengnabajichang", "initial": "csnbjc"}, "南京禄口": {"full": "nanjinglukou", "initial": "njlk"}, "南通兴东": {"full": "nantongxingdong", "initial": "ntxd"}, "吉隆坡": {"full": "jilongpo", "initial": "jlp"}, "吉隆坡国际机场": {"full": "jilongpoguojijichang", "initial": "jlpgjjc"}, "吉隆坡机场": {"full": "jilongpojichang", "initial": "jlpjc"}, "嘉兴": {"full": "jiaxing", "initial": "jx"}, "大阪关西": {"full": "dabanguanxi", "initial": "dbgx"}, "大阪关西机场": {"full": "dabanguanxijichang", "initial": "dbgxjc"}, "宁波栎社": {"full": "ningbolishe", "initial": "nbls"}, "富国岛": {"full": "fuguodao", "initial": "fgd"}, "巴厘岛": {"full": "balidao", "initial": "bld"}, "巴厘岛机场": {"full": "balidaojichang", "initial": "bldjc"}, "成田": {"full": "chengtian", "initial": "ct"}, "新加坡": {"full": "xinjiapo", "initial": "xjp"}, "普吉国际机场": {"full": "pujiguojijichang", "initial": "pjgjjc"}, "普吉岛": {"full": "pujidao", "initial": "pjd"}, "普吉机场": {"full": "pujijichang", "initial": "pjjc"}, "曼谷素万": {"full": "mangusuwan", "initial": "mgsw"}, "曼谷素万那普机场": {"full": "mangusuwannapujichang", "initial": "mgswnpjc"}, "杭州萧山": {"full": "hangzhouxiaoshan", "initial": "hzxs"}, "杭州萧山机场": {"full": "hangzhouxiaoshanjichang", "initial": "hzxsjc"}, "樟宜机场": {"full": "zhangyijichang", "initial": "zyjc"}, "沙巴亚庇": {"full": "shabayabi", "initial": "sbyb"}, "济州": {"full": "jizhou", "initial": "jz"}, "济州国际机场": {"full": "jizhouguojijichang", "initial": "jzgjjc"}, "济州岛": {"full": "jizhoudao", "initial": "jzd"}, "济州机场": {"full": "jizhoujichang", "initial": "jzjc"}, "浦东国际机场": {"full": "pudongguojijichang", "initial": "pdgjjc"}, "海口美兰": {"full": "haikoumeilan", "initial": "hkml"}, "清州国际机场": {"full": "qingzhouguojijichang", "initial": "qzgjjc"}, "清迈": {"full": "qingmai", "initial": "qm"}, "清迈机场": {"full": "qingmaijichang", "initial": "qmjc"}, "澳门": {"full": "aomen", "initial": "am"}, "澳门机场": {"full": "aomenjichang", "initial": "amjc"}, "福冈机场": {"full": "fugangjichang", "initial": "fgjc"}, "西宁曹家堡": {"full": "xiningcaojiabao", "initial": "xncjb"}, "釜山金海机场": {"full": "fushanjinhaijichang", "initial": "fsjhjc"}, "首尔仁川": {"full": "shouerrenchuan", "initial": "serc"}, "首尔仁川机场": {"full": "shouerrenchuanjichang", "initial": "sercjc"}, "首尔金浦": {"full": "shouerjinpu", "initial": "sejp"}, "首尔金浦机场": {"full": "shouerjinpujichang", "initial": "sejpjc"}, "香港": {"full": "xianggang", "initial": "xg"}, "香港机场": {"full": "xianggangjichang", "initial": "xgjc"}};
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

function _searchMatch(r, kw) {
  if ((r.flight||'').toLowerCase().indexOf(kw)!==-1) return true;
  if ((r.dep||'').indexOf(kw)!==-1) return true;
  if ((r.arr||'').indexOf(kw)!==-1) return true;
  if ((r.airline_cn||'').indexOf(kw)!==-1) return true;
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
    + '<span style="color:var(--text-secondary);display:inline-flex;flex-shrink:0"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><line x1="16.5" y1="16.5" x2="21" y2="21"></line></svg></span>' + '<input class="fit-search" id="' + _searchInputId + '" placeholder="搜航线、航班号、目的地..."'
    + ' onkeydown="if(event.key===\'Enter\'){searchFilter(this.value)}"'
    + ' value="' + v.replace(/"/g,'&quot;') + '"'
    + ' style="flex:1;min-width:0;padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:13px;outline:none;box-sizing:border-box">'
    + '<button onclick="searchFilter(document.getElementById(\'' + _searchInputId + '\').value)"'
    + ' style="flex-shrink:0;padding:8px 14px;border:none;border-radius:8px;background:var(--brand,var(--red));color:#fff;font-size:13px;font-weight:600;cursor:pointer">搜索</button>'
    + '</div>';
}

function _filterSearchBox() {
  return '<div style="padding:0 0 10px">' + _mkSearchInput('') + '</div>';
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

function copyFilterResults() {
  var recs = _getFilteredRecs();
  if (!recs.length) { showToast('没有可复制的报价'); return; }
  
  // 按 (dep+arr+days+flight+flight_return) 分组
  var groups = {};
  recs.forEach(function(r) {
    var key = (r.dep||'') + '|' + (r.arr||'') + '|' + (getDays(r)||'') + '|' + (r.flight||'') + '|' + ((r.flight_return||'').trim());
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });
  
  // 每组内按日期排序
  Object.keys(groups).forEach(function(k) {
    groups[k].sort(function(a,b){return (a.dep_date||'') < (b.dep_date||'') ? -1 : 1});
  });
  
  var lines = [];
  var groupKeys = Object.keys(groups);
  var maxGroups = 15; // 最多15组
  groupKeys.slice(0, maxGroups).forEach(function(key, gi) {
    var recs = groups[key];
    var r = recs[0];
    var d = getDays(r) || '';
    var hasReturn = !!(r.flight_return && r.flight_return.trim());
    var routeLabel = (r.dep||'') + '-' + (r.arr||'') + (hasReturn ? '/' + (r.arr||'') + '-' + (r.dep||'') : '') + (d ? ' ' + d + '天' : '');
    var airCn = r.airline_cn || '';
    var depAirport = _aptBlockTxt(r,'dep');
    var arrAirport = _aptBlockTxt(r,'arr');
    var depTime = (r.dep_time||'').trim();
    var arrTime = (r.arr_time||'').trim();
    var outDurB = _durTxt(r);
    
    // 组头：航线路由+航司名 第一行
    lines.push(routeLabel + (airCn ? ' ' + airCn : ''));
    // 航班号+机场+时间+时长 第二行
    lines.push((r.flight||'') + ' ' + (depAirport ? depAirport+'-' : '') + (arrAirport||'') + (depTime||arrTime ? ' ' : '') + (depTime ? depTime : '') + (arrTime ? '-'+arrTime : '') + (outDurB ? ' ' + outDurB : ''));
    
    // 回程航班行
    if (hasReturn) {
      var retDep = _aptBlockTxt(r,'return_dep');
      var retArr = _aptBlockTxt(r,'return_arr');
      var retDepTime = (r.return_dep_time||'').trim();
      var retArrTime = (r.return_arr_time||'').trim();
      var retDurB = _durTxt(r,'ret');
      lines.push((r.flight_return||'') + (retDep ? ' ' + retDep : '') + (retArr ? '-'+retArr : '') + (retDepTime||retArrTime ? ' ' : '') + (retDepTime ? retDepTime : '') + (retArrTime ? '-'+retArrTime : '') + (retDurB ? ' ' + retDurB : ''));
    }
    
    // 日期行（无缩进）
    var maxDatesPerGroup = 30;
    recs.slice(0, maxDatesPerGroup).forEach(function(rr) {
      var ds = _fmtDateShort(rr.dep_date);
      var rs = rr.return_date ? _fmtDateShort(rr.return_date) : '';
      var dateStr = ds + (rs ? '-' + rs : '');
      var price = rr.retail || 0;
      var seat = _seatDisp(rr.seats);
      lines.push(dateStr + ' ￥' + price + (seat ? ' ' + seat : ''));
    });
    if (recs.length > maxDatesPerGroup) lines.push('  ...共' + recs.length + '个日期');
    if (gi < groupKeys.length - 1) lines.push(''); // 组间空行
  });
  if (groupKeys.length > maxGroups) lines.push('...共' + groupKeys.length + '组');
  
  var text = lines.join('\n') + '\n\n' + _PROMO + '\n🔗 ' + location.origin + location.pathname + _filterUrlQuery();
  
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function() { showToast('✅ 已复制 ' + recs.length + ' 条报价，' + groupKeys.length + ' 组'); });
  } else { prompt('复制以下内容：', text); }
  recordAction('copy_filter', {count:recs.length,quote:text.slice(0,200)});
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
  if (p.get('f_dep')) { _filter.dep = p.get('f_dep'); hasFilter = true; }
  if (p.get('f_arr')) { _filter.arr = p.get('f_arr'); hasFilter = true; }
  if (p.get('f_days')) { _filter.days = p.get('f_days'); hasFilter = true; }
  if (p.get('f_month')) { _filter.month = p.get('f_month'); hasFilter = true; }
  if (p.get('f_date')) {
    _filter.dates = p.get('f_date').split(',').filter(function(x){return !!x});
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
function searchFilter(q) {
  // 显式触发：不再 IME 防抖，点击搜索按钮/回车才执行
  q = (q || '').trim();
  if (!q) { _showFilter(); return; }
  
    // 1. 提取城市名
    var knownCities = ['东京','大阪','名古屋','冲绳','札幌','福冈','仙台','首尔','济州岛','釜山',
      '曼谷','普吉','清迈','苏梅','巴厘岛','沙巴','新加坡','吉隆坡','胡志明','岘港','马尼拉','雅加达','河内','富国岛',
      '香港','澳门','台北','三亚','海口','厦门'];
    var foundCities = knownCities.filter(function(c){return q.indexOf(c)!==-1});
    var arrCity = foundCities.length ? foundCities[0] : '';
    
    // 2. 提取日期
    var dateMatch = q.match(/(\d{1,2})[\/\.月](\d{1,2})[日号]?/);
    var targetDate = '';
    if (dateMatch) {
      var m = parseInt(dateMatch[1]), d = parseInt(dateMatch[2]);
      var now = new Date();
      var y = now.getFullYear();
      if (m < now.getMonth()+1 && m <= 12) y++;
      var dt = new Date(y, m-1, d);
      targetDate = dt.toISOString().slice(0,10);
    }
    // 2.5 提取月份（"8月"这种无具体日的 → 按去程月份过滤，避免返回全库含他月）
    var monthVal = '';
    if (!targetDate) {
      var mm = q.match(/(\d{1,2})月/);
      if (mm && !isNaN(parseInt(mm[1])) && parseInt(mm[1]) >= 1 && parseInt(mm[1]) <= 12) {
        monthVal = ('0' + parseInt(mm[1])).slice(-2);
      }
    }
    
    // 3. 提取天数
    var daysMatch = q.match(/(\d+)天|五(?=天)|四(?=天)|六(?=天)|七(?=天)|八(?=天)|九(?=天)|十(?=天)/);
    var cnNum = {'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10};
    var daysVal = '';
    if (daysMatch) {
      var raw = daysMatch[1] || daysMatch[0];
      daysVal = cnNum[raw] ? ''+cnNum[raw] : raw;
    }
    
    // 4. 结构化搜索（2026-08-05 修复：无条件时禁止返回全库——"8月"识别为月份条件）
    var hasCond = !!(arrCity || targetDate || daysVal || monthVal);
    var recs = [];
    if (hasCond) {
      recs = DB.records.filter(function(r) {
        if (!_validRecord(r)) return false;
        if (arrCity && r.arr !== arrCity && r.dep !== arrCity) return false;
        if (targetDate) {
          var rd = new Date(r.dep_date);
          var td = new Date(targetDate);
          if (Math.abs(rd-td) > 86400000) return false;
        }
        if (monthVal && (r.dep_date||'').slice(5,7) !== monthVal) return false;
        if (daysVal && getDays(r) !== daysVal) return false;
        return true;
      });
    }
    
    // 5. 模糊兜底
    if (!recs.length) {
      recs = DB.records.filter(function(r) {
        if (!_validRecord(r)) return false;
        var kw = q.toLowerCase();
        return _searchMatch(r, kw);
      });
    }
    

    // 5.1 拼音同音兜底（2026-08-13：精确/子串无结果时，同音字转拼音匹配机场名）
    if (!recs.length) {
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
    
    // 6. 在筛选框内展示结果
    var body = document.getElementById('filterBody');
    if (body) {
      var html = _mkSearchInput(q) + '<div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px">🔍 找到 ' + recs.length + ' 条结果</div>';
      recs.slice(0,10).forEach(function(r){
        html += '<div class="fit-sr" onclick="closeFilter();showSearchResult(\'' + r.dep + '\',\'' + r.arr + '\',\'' + (r.flight||'') + '\',\'' + (r.dep_date||'') + '\')">'
          + '<span style="font-weight:600;font-size:13px">' + r.dep + '-' + r.arr + '</span>'
          + ' <span style="font-size:11px;color:var(--text-light)">' + (r.flight||'') + (r.flight_return?'/'+r.flight_return:'') + '</span>'
          + '<br><span style="font-size:11px;color:var(--text-secondary)">' + (r.dep_date||'') + (r.return_date?' → '+r.return_date:'') + ' · ' + (getDays(r)||'') + '天</span>'
          + ' <span style="font-size:12px;font-weight:700;color:var(--red)">¥' + (r.retail||0) + '</span>'
          + '</div>';
      });
      if (recs.length > 10) {
        html += '<div style="display:flex;gap:6px;margin-top:6px">'
          + '<div class="fit-apply" style="flex:1;text-align:center" onclick="closeFilter();showAllSearchResults()">查看全部 ' + recs.length + ' 条结果</div>'
          + '<div class="fit-apply" style="flex:1;text-align:center" onclick="copySearchResults()">📋 复制 ' + recs.length + ' 条</div>'
          + '</div>';
      } else if (recs.length) {
        html += '<div style="display:flex;gap:6px;margin-top:6px">'
          + '<div class="fit-apply" style="flex:1;text-align:center" onclick="copySearchResults()">📋 复制 ' + recs.length + ' 条</div>'
          + '</div>';
      }
      body.innerHTML = html;
    }
}

// 复制搜索结果（2026-08-05 用户需求：格式与搜索结果相同 + 附带链接）
function copySearchResults() {
  var recs = _lastSearchRecs || [];
  if (!recs.length) { showToast('没有可复制的报价'); return; }
  var groups = {};
  recs.forEach(function(r) {
    var key = (r.dep||'') + '|' + (r.arr||'') + '|' + (getDays(r)||'') + '|' + (r.flight||'') + '|' + ((r.flight_return||'').trim());
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });
  Object.keys(groups).forEach(function(k) { groups[k].sort(function(a,b){return (a.dep_date||'') < (b.dep_date||'') ? -1 : 1;}); });
  var lines = [];
  var groupKeys = Object.keys(groups);
  var maxGroups = 15;
  groupKeys.slice(0, maxGroups).forEach(function(key, gi) {
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
    var outDurS = _durTxt(r);
    lines.push(routeLabel + (airCn ? ' ' + airCn : ''));
    lines.push((r.flight||'') + ' ' + (depAirport ? depAirport+'-' : '') + (arrAirport||'') + (depTime||arrTime ? ' ' : '') + (depTime ? depTime : '') + (arrTime ? '-'+arrTime : '') + (outDurS ? ' ' + outDurS : ''));
    if (hasReturn) {
      var retDep = _aptBlockTxt(r,'return_dep');
      var retArr = _aptBlockTxt(r,'return_arr');
      var retDepTime = (r.return_dep_time||'').trim();
      var retArrTime = (r.return_arr_time||'').trim();
      var retDurS = _durTxt(r,'ret');
      lines.push((r.flight_return||'') + (retDep ? ' ' + retDep : '') + (retArr ? '-'+retArr : '') + (retDepTime||retArrTime ? ' ' : '') + (retDepTime ? retDepTime : '') + (retArrTime ? '-'+retArrTime : '') + (retDurS ? ' ' + retDurS : ''));
    }
    var maxDatesPerGroup = 30;
    gRecs.slice(0, maxDatesPerGroup).forEach(function(rr) {
      var ds = _fmtDateShort(rr.dep_date);
      var rs = rr.return_date ? _fmtDateShort(rr.return_date) : '';
      var dateStr = ds + (rs ? '-' + rs : '');
      var price = rr.retail || 0;
      var seat = _seatDisp(rr.seats);
      lines.push(dateStr + ' ￥' + price + (seat ? ' ' + seat : ''));
    });
    if (gRecs.length > maxDatesPerGroup) lines.push('  ...共' + gRecs.length + '个日期');
    if (gi < groupKeys.length - 1) lines.push('');
  });
  if (groupKeys.length > maxGroups) lines.push('...共' + groupKeys.length + '组');
  var kw = (document.getElementById('fitSearch')||{}).value || '';
  var link = location.origin + location.pathname + (kw ? ('?q=' + encodeURIComponent(kw)) : '');
  var text = lines.join('\n') + '\n\n' + _PROMO + '\n🔗 ' + link;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function() { showToast('✅ 已复制 ' + recs.length + ' 条报价，' + groupKeys.length + ' 组'); });
  } else { prompt('复制以下内容：', text); }
  recordAction('copy_search', {count:recs.length, quote:text.slice(0,200)});
}

// 显示单条搜索结果
function showSearchResult(dep, arr, flight, date) {
  document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active')});
  var list=document.getElementById('cardList');
  var recs = DB.records.filter(function(r){return _validRecord(r) && r.dep===dep && r.arr===arr && r.flight===flight && r.dep_date===date});
  list.innerHTML = recs.map(cardHTML).join('');
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
  // 同上逻辑，但直接显示到cardList
  var knownCities = ['东京','大阪','名古屋','冲绳','札幌','福冈','仙台','首尔','济州岛','釜山',
    '曼谷','普吉','清迈','苏梅','巴厘岛','沙巴','新加坡','吉隆坡','胡志明','岘港','马尼拉','雅加达','河内','富国岛',
    '香港','澳门','台北','三亚','海口','厦门'];
  var foundCities = knownCities.filter(function(c){return q.indexOf(c)!==-1});
  var arrCity = foundCities.length ? foundCities[0] : '';
  var dateMatch = q.match(/(\d{1,2})[\/\.月](\d{1,2})[日号]?/);
  var targetDate = '';
  if (dateMatch) {
    var m = parseInt(dateMatch[1]), d = parseInt(dateMatch[2]);
    var now = new Date();
    var y = now.getFullYear();
    if (m < now.getMonth()+1 && m <= 12) y++;
    var dt = new Date(y, m-1, d);
    targetDate = dt.toISOString().slice(0,10);
  }
  var daysMatch = q.match(/(\d+)天|五(?=天)|四(?=天)|六(?=天)|七(?=天)|八(?=天)|九(?=天)|十(?=天)/);
  var cnNum = {'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10};
  var daysVal = '';
  if (daysMatch) {
    var raw = daysMatch[1] || daysMatch[0];
    daysVal = cnNum[raw] ? ''+cnNum[raw] : raw;
  }
  var recs = DB.records.filter(function(r) {
    if (!_validRecord(r)) return false;
    if (arrCity && r.arr !== arrCity && r.dep !== arrCity) return false;
    if (targetDate) {
      var rd = new Date(r.dep_date);
      var td = new Date(targetDate);
      if (Math.abs(rd-td) > 86400000) return false;
    }
    if (daysVal && getDays(r) !== daysVal) return false;
    return true;
  });
  if (!recs.length) {
    recs = DB.records.filter(function(r) {
      if (!_validRecord(r)) return false;
      var kw = q.toLowerCase();
      return _searchMatch(r, kw);
    });
  }
  recs.sort(function(a,b){return (a.retail||99999)-(b.retail||99999)});
  document.getElementById('cardList').innerHTML = (recs.length>50?recs.slice(0,50):recs).map(cardHTML).join('');
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
  recs.sort(function(a,b){return (a.retail||99999)-(b.retail||99999)});
  document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active')});
  var list=document.getElementById('cardList');
  if (!recs.length) { list.innerHTML='<div class="loading">无符合条件数据</div>'; return; }
  list.innerHTML = recs.map(cardHTML).join('');  // 2026-08-06: 筛选报价默认显示全部数据（不再 slice 前50条，不用上下滑动看更多）
}
