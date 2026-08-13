// ═══════════════ 排序组件（独立模态框）═══════════════

// ── 2026-08-07 17:1x: 两层排序 —— 分组排序(组间) + 报价卡片排序(组内) 独立可配 ──
// 分组排序（组间）：决定分组标题上下顺序；'smart'=智能(城市→省会→航线→天数升序)
// key 加 g_ 前缀避免与卡片排序（c_）的 price 等 key 冲突
var GROUP_SORT_DIMS = [
  {key:'g_smart', label:'✨ 智能排序', hint:'上海优先 → 省会 → 目的地顺序 → 天数升序'},
  {key:'g_route', label:'✈️ 航线',    dirs:['asc','desc']},
  {key:'g_days',  label:'🗓️ 天数',    dirs:['asc','desc']},
  {key:'g_count', label:'📊 条数',    dirs:['asc','desc']},
  {key:'g_price', label:'💰 价格',    dirs:['asc','desc']},
];
// 报价卡片排序（组内）：决定组内卡片顺序（去程日期/价格/余位/航司）
var CARD_SORT_DIMS = [
  {key:'date',    label:'📅 去程日期', dirs:['asc','desc']},
  {key:'price',   label:'💰 价格',    dirs:['asc','desc']},
  {key:'seats',   label:'🪑 余位',    dirs:['asc','desc']},
  {key:'airline', label:'🏢 航司',    dirs:['asc','desc']},
];

function _getModes() { return _sortModes || []; }

function openSortModal() {
  recordAction('sort_open', {});
  var modes = _getModes();
  var modal = document.getElementById('sortModal');
  if (!modal) {
    // 首次创建模态框
    modal = document.createElement('div');
    modal.id = 'sortModal';
    modal.className = 'modal';
    modal.innerHTML = '<div class="modal-content" style="min-height:40vh;display:flex;flex-direction:column">'
      + '<div style="padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">'
      + '<span style="font-size:16px;font-weight:700">排序报价</span>'
      + '<span onclick="closeSortModal()" style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--tag-bg);cursor:pointer;font-size:14px">×</span>'
      + '</div>'
      + '<div id="sortBody" style="flex:1;overflow-y:auto;padding:12px 16px"></div>'
      + '<div style="padding:12px 16px;border-top:1px solid var(--border);display:flex;gap:8px">'
      + '<button onclick="resetSort()" style="flex:1;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--card-bg);color:var(--text-secondary);font-size:13px;font-weight:500;cursor:pointer">重置</button>'
      + '<button onclick="applySort()" style="flex:2;padding:10px;border:none;border-radius:8px;background:var(--red);color:#fff;font-size:13px;font-weight:700;cursor:pointer">应用排序</button>'
      + '</div>'
      + '</div>';
    document.body.appendChild(modal);
    modal.onclick = function(e) { if (e.target.id === 'sortModal') closeSortModal(); };
  }
  _renderSortBody(modes);
  modal.classList.add('active');
}

function closeSortModal() {
  var modal = document.getElementById('sortModal');
  if (modal) modal.classList.remove('active');
}

function _renderSortBody(modes) {
  var body = document.getElementById('sortBody');
  if (!body) return;
  
  // 2026-08-07 17:1x: 两层排序
  //  分组排序（组间）：_groupSort —— 'smart'/'route_asc'/'route_desc'/'days_asc'/'days_desc'/'count_asc'/'count_desc'/'price_asc'/'price_desc'
  //  报价卡片（组内）：_sortModes —— 数组，元素为 date/price/seats/airline 的 *_asc/*_desc
  var gs = typeof _groupSort !== 'undefined' ? _groupSort : 'smart';
  
  function dimCell(label, hint, key, dir, sel, prio) {
    var bg = sel ? '#F0F5FF' : 'var(--card-bg)';
    var border = sel ? '#0C6FA8' : 'var(--border)';
    var col = sel ? '#0C6FA8' : 'var(--text-secondary)';
    var badge = sel ? '<span style="background:'+col+';color:#fff;border-radius:8px;padding:0 6px;font-size:10px;font-weight:700;margin-left:auto">' + (dir === 'asc' ? '↑' : dir === 'desc' ? '↓' : '✓') + '</span>' : '';
    var prioTag = sel && prio ? '<span style="width:16px;height:16px;border-radius:50%;background:'+col+';color:#fff;font-size:9px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">'+prio+'</span>' : '';
    return '<div class="sort-dim" data-key="'+key+'" data-group="'+ (key.indexOf('g_') === 0 ? 'g' : 'c') + '" style="display:flex;align-items:center;gap:8px;padding:9px 12px;margin-bottom:5px;border-radius:8px;border:1px solid '+border+';background:'+bg+';cursor:pointer;font-size:13px;color:'+(sel?'#333':'var(--text)')+'">'
      + prioTag + '<span>'+label+'</span>'
      + (hint ? '<span style="font-size:10px;color:#C0C0C0;flex:1;text-align:right;margin-right:2px">'+hint+'</span>' : '')
      + badge + '</div>';
  }
  
  // ── 区块1：分组排序（组间，单选）──
  var h = '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">① 分组排序（决定分组上下顺序）</div>';
  GROUP_SORT_DIMS.forEach(function(dim) {
    var sel = false, dir = '', prio = 0;
    if (dim.key === 'g_smart') {
      sel = (gs === 'smart');
      if (sel) { dir = '✓'; prio = 1; }
    } else {
      var rawKey = dim.key.slice(2);  // g_route → route
      var asc = rawKey+'_asc', desc = rawKey+'_desc';
      if (gs === asc) { sel = true; dir = 'asc'; prio = 1; }
      else if (gs === desc) { sel = true; dir = 'desc'; prio = 1; }
    }
    h += dimCell(dim.label, dim.hint, dim.key, dir, sel, prio);
  });
  
  // ── 区块2：报价卡片排序（组内，可多选组合）──
  h += '<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:10px;font-size:12px;color:var(--text-secondary);margin-bottom:8px">② 报价卡片排序（决定组内卡片顺序）</div>';
  CARD_SORT_DIMS.forEach(function(dim) {
    var asc = dim.key+'_asc', desc = dim.key+'_desc';
    var ia = modes.indexOf(asc), id = modes.indexOf(desc);
    var sel = ia >= 0 || id >= 0;
    var dir = ia >= 0 ? 'asc' : (id >= 0 ? 'desc' : '');
    var prio = sel ? ((ia>=0?ia:id)+1) : 0;
    h += dimCell(dim.label, null, dim.key, dir, sel, prio);
  });
  
  // ── 区块3：按路线分组开关 ──
  h += '<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px">'
    + '<div class="sort-group-toggle" style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--text)">'
    + '<span style="width:18px;height:18px;border-radius:4px;border:2px solid '+(_groupMode?'var(--red)':'var(--border)')+';display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;color:'+(_groupMode?'var(--red)':'transparent')+'">✓</span>'
    + '按路线分组</div>'
    + '<div style="font-size:11px;color:var(--text-light);margin-top:4px;padding-left:26px">关闭后按报价卡片排序平铺展示</div>'
    + '</div>';
  
  body.innerHTML = h;
  
  // 绑定点击事件（分组=单选切升降；卡片=多选组合）
  body.querySelectorAll('.sort-dim').forEach(function(el) {
    el.onclick = function(ev) {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      var k = el.dataset.key;
      var isGroupDim = el.dataset.group === 'g';
      if (isGroupDim) {
        // ── 分组排序：单选，点同一项切升降 ──
        if (k === 'g_smart') { _groupSort = 'smart'; }
        else {
          var rawKey = k.slice(2);
          var gAsc = rawKey+'_asc', gDesc = rawKey+'_desc';
          if (_groupSort === gAsc) _groupSort = gDesc;
          else if (_groupSort === gDesc) _groupSort = 'smart';
          else _groupSort = gAsc;
        }
      } else {
        // ── 报价卡片：多选组合 ──
        var asc = k+'_asc', desc = k+'_desc';
        var existingAsc = modes.indexOf(asc);
        var existingDesc = modes.indexOf(desc);
        if (existingAsc >= 0) {
          modes[existingAsc] = desc;
        } else if (existingDesc >= 0) {
          modes.splice(existingDesc, 1);
          if (!modes.length) modes = [];
        } else {
          if (modes.length >= 3) modes.shift();
          modes.push(asc);
        }
        _sortModes = modes;
      }
      _renderSortBody(_getModes());
    };
  });
  
  var toggle = body.querySelector('.sort-group-toggle');
  if (toggle) {
    toggle.onclick = function() {
      _groupMode = !_groupMode;
      _renderSortBody(modes);
    };
  }
}

function _removeSortDim(k) {
  var modes = _getModes();
  var asc = k+'_asc', desc = k+'_desc';
  var ia = modes.indexOf(asc);
  if (ia >= 0) modes.splice(ia, 1);
  var id = modes.indexOf(desc);
  if (id >= 0) modes.splice(id, 1);
  _sortModes = modes;
  _renderSortBody(modes);
}

function resetSort() {
  _sortModes = [];
  _groupSort = 'smart';
  _groupMode = true;
  _renderSortBody(_getModes());
}

function applySort() {
  closeSortModal();
  // 2026-08-13: 搜索结果态下排序 → 重跑搜索视图（按新排序展示结果）；常规视图走 render()
  if (typeof _isSearchView !== 'undefined' && _isSearchView && _lastSearchQ) {
    searchFilterAndShow(_lastSearchQ);
  } else {
    render();
  }
}

// 2026-08-07 20:4x: 排序按钮状态文本（两层：分组排序 + 卡片排序）
// 加「组:」/「卡:」前缀区分——分组选价格+卡片选价格时不再显示歧义的「价格↓ · 价格↑」
function _sortLabel() {
  var parts = [];
  var gs = typeof _groupSort !== 'undefined' ? _groupSort : 'smart';
  if (gs !== 'smart') {
    var gk = gs.split('_')[0];
    var gd = gs.indexOf('_desc') >= 0 ? '↓' : '↑';
    var gm = {'route':'航线','days':'天数','count':'条数','price':'价格'};
    parts.push('组:' + (gm[gk] || '排序') + gd);
  }
  var modes = _getModes();
  if (modes && modes.length) {
    var m = modes[0];
    var cd = m.indexOf('_desc') >= 0 ? '↓' : '↑';
    var cm = {'price':'价格','date':'日期','seats':'余位','airline':'航司'};
    parts.push('卡:' + (cm[m.split('_')[0]] || '排序') + cd);
  }
  if (!parts.length) return '↕ ✨ 智能排序';
  return '↕ ' + parts.join(' · ');
}
