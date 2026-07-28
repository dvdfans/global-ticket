#!/usr/bin/env python3
"""Update production app.js with route group display + sort"""
import re

with open('js/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add sort variables
old1 = "let currentTab = 'home';\nlet isAdmin = false;"
new1 = "let currentTab = 'home';\nlet isAdmin = false;\nlet _sortModes = ['route_asc', 'days_asc', 'date_asc'];\nlet _groupMode = true;"
assert content.count(old1) == 1, "old1 not unique"
content = content.replace(old1, new1, 1)

# 2. Add sort functions after toggleTheme()
old2_start = "function toggleTheme() {"
old2_end = "  render();\n}"
# Find the exact toggleTheme block
s = content.find(old2_start)
e = content.find(old2_end, s) + len(old2_end)
old2 = content[s:e]
assert old2, "old2 not found"

new2 = old2 + """

// ── 排序工具函数 ──
function _seatNum(r) {
  var s = (r.seats||'').trim().toLowerCase();
  var m = s.match(/\\d+/);
  if (m) return parseInt(m[0]);
  if (s === '\\u5145\\u8db3') return 999;
  return 0;
}
function _compareByMode(a, b, mode) {
  if (mode === 'price_asc') return (a.retail||0) - (b.retail||0);
  if (mode === 'price_desc') return (b.retail||0) - (a.retail||0);
  if (mode === 'seats_asc') return (_seatNum(a)||999) - (_seatNum(b)||999);
  if (mode === 'seats_desc') return (_seatNum(b)||0) - (_seatNum(a)||0);
  if (mode === 'route_asc') return ((a.dep||'')+(a.arr||'')) < ((b.dep||'')+(b.arr||'')) ? -1 : 1;
  if (mode === 'route_desc') return ((a.dep||'')+(a.arr||'')) > ((b.dep||'')+(b.arr||'')) ? -1 : 1;
  if (mode === 'days_asc') return (parseInt(getDays(a)||'99')||99) - (parseInt(getDays(b)||'99')||99);
  if (mode === 'days_desc') return (parseInt(getDays(b)||'99')||99) - (parseInt(getDays(a)||'99')||99);
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
  return da < db ? -1 : 1;
}
function _sortRecords(recs) {
  var modes = _sortModes || [];
  if (!modes.length) return recs;
  var sorted = recs.slice(0);
  sorted.sort(function(a, b) {
    for (var i = 0; i < modes.length; i++) {
      var cmp = _compareByMode(a, b, modes[i]);
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
  return sorted;
}"""

content = content.replace(old2, new2, 1)

# 3. Replace renderTab()
old_render_start = "function renderTab() {"
# Find old renderTab
s = content.find(old_render_start)
# Find the end - next function at same level
next_func = content.find("\n// ═══════════════ 首页渲染", s)
assert s >= 0 and next_func > s, "renderTab bounds not found"
old_render = content[s:next_func]

new_render = """function renderTab() {
  var holidayStart = '2026-09-25', holidayEnd = '2026-10-07';
  var list = document.getElementById('cardList');
  
  if (currentTab === 'hot') {
    // 热门：中秋国庆9月25日~10月7日 — 按日期排序的报价卡片
    var all = DB.records.filter(function(r) {
      if (!_hasSeats(r) || !_validRecord(r)) return false;
      var d = r.dep_date || '';
      return d >= holidayStart && d <= holidayEnd && !(!r.flight_return && r.dep === '\\u6d4e\\u5dde\\u5c9b' && r.arr === '\\u4e0a\\u6d77');
    });
    all.sort(function(a,b) { return (a.dep_date||'') < (b.dep_date||'') ? -1 : 1; });
    list.innerHTML = _stickyBar() + all.map(function(r){return hmCard(r)}).join('');
    list.scrollTop = 0;
    return;
  }
  
  // 区域：日本/韩国/东南亚/港澳 — 统一使用路线分组模式
  var records = DB.records.filter(function(r) { return _hasSeats(r); });
  var cities = TAB_CITIES[currentTab] || [];
  records = records.filter(function(r) { return cities.some(function(c){return r.arr===c}); });
  records = records.filter(function(r) { return !(!r.flight_return && r.dep==='\\u6d4e\\u5dde\\u5c9b' && r.arr==='\\u4e0a\\u6d77'); });
  
  records = _sortRecords(records);
  var html = _stickyBar();
  
  // 路线分组
  var groups = {};
  records.forEach(function(r) {
    var k = r.dep+'\\u2192'+r.arr+'|'+(getDays(r)||'0');
    if(!groups[k]) groups[k]={dep:r.dep,arr:r.arr,nights:getDays(r)||'',records:[]};
    groups[k].records.push(r);
  });
  
  // 组间排序 — 按路线→天数→日期
  var gKeys = Object.keys(groups);
  gKeys.sort(function(ka, kb) {
    var ga = groups[ka].records, gb = groups[kb].records;
    var ra = ka.split('|')[0], rb = kb.split('|')[0];
    if (ra < rb) return -1; if (ra > rb) return 1;
    var da = parseInt(ga[0].days||ga[0].nights||'99')||99;
    var db = parseInt(gb[0].days||gb[0].nights||'99')||99;
    if (da !== db) return da - db;
    return (ga[0].dep_date||'') < (gb[0].dep_date||'') ? -1 : 1;
  });
  
  gKeys.forEach(function(k){
    var g=groups[k];var gid=k.replace(/[^a-z0-9\\u4e00-\\u9fa5]/g,'_');
    var mp=Math.min.apply(null,g.records.map(function(r){return r.retail||99999}));
    var flights = [];
    g.records.forEach(function(r){var f=r.flight||'';if(flights.indexOf(f)<0)flights.push(f);});
    var flightStr = flights.join('/');
    html+='<div class="hm-group" onclick="toggleGroup(\\''+gid+'\\')"><div class="hm-group-hd">'
      +'<span class="hm-route">'+g.dep+' \\u2192 '+g.arr+'</span>'
      +'<span class="hm-nights">'+(g.nights?g.nights+'\\u5929':'\\u81ea\\u7531')+'</span>'
      +'<span style="font-size:10px;color:var(--text-light);margin-left:4px">'+flightStr+'</span>'
      +'<span class="hm-count">'+g.records.length+'\\u6761</span>'
      +'<span class="hm-minprice">\\xa5'+mp+'\\u8d77</span>'
      +'<span class="hm-arrow">\\u25be</span></div>'
      +'<div class="hm-group-bd" id="grp_'+gid+'" style="display:none">'
      +g.records.map(function(r){return hmCard(r)}).join('')+'</div></div>';
  });
  list.innerHTML=html; list.scrollTop=0;
}"""

content = content.replace(old_render, new_render, 1)
print(f'renderTab replaced: {content.count("function renderTab()")} == 1')

with open('js/app.js', 'w', encoding='utf-8') as f:
    f.write(content)
print('✅ 写入完成')
