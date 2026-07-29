// ═══════════════ 排序组件（独立模态框）═══════════════

// ── 排序维度定义 ──
var SORT_DIMS = [
  {key:'date',  label:'📅 出发日期'},
  {key:'price', label:'💰 价格'},
  {key:'seats', label:'🪑 余位'},
  {key:'route', label:'✈️ 航线'},
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
  
  function idx(k) {
    var asc = k+'_asc', desc = k+'_desc';
    var i = modes.indexOf(asc);
    if (i >= 0) return {i:i+1, dir:'↑'};
    i = modes.indexOf(desc);
    return i >= 0 ? {i:i+1, dir:'↓'} : {i:0, dir:''};
  }
  
  var h = '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:10px">点击条件排序，可多选组合（优先级①②③）</div>';
  
  SORT_DIMS.forEach(function(dim) {
    var state = idx(dim.key);
    var sel = state.i > 0;
    var bg = sel ? (state.i===1?'#F0F5FF':state.i===2?'#F0FFF0':'#FFF8F0') : 'var(--card-bg)';
    var border = sel ? (state.i===1?'#0C6FA8':state.i===2?'#389C39':'#FF7D00') : 'var(--border)';
    var col = sel ? (state.i===1?'#0C6FA8':state.i===2?'#389C39':'#FF7D00') : 'var(--text-secondary)';
    var badge = sel ? '<span style="background:'+col+';color:#fff;border-radius:8px;padding:0 6px;font-size:10px;font-weight:700;margin-left:auto">' + state.dir + '</span>' : '';
    var priority = sel ? '<span style="width:16px;height:16px;border-radius:50%;background:'+col+';color:#fff;font-size:9px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">'+state.i+'</span>' : '';
    
    h += '<div class="sort-dim" data-key="'+dim.key+'" style="display:flex;align-items:center;gap:8px;padding:10px 12px;margin-bottom:6px;border-radius:8px;border:1px solid '+border+';background:'+bg+';cursor:pointer;font-size:13px;color:'+(sel?'#333':'var(--text)')+'">'
      + priority + '<span>'+dim.label+'</span>'
      + badge
      + (sel ? '<span style="font-size:10px;color:#C0C0C0;cursor:pointer;margin-left:4px" onclick="event.stopPropagation();_removeSortDim(\''+dim.key+'\')">✕</span>' : '')
      + '</div>';
  });
  
  // 按路线分组开关
  h += '<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px">'
    + '<div class="sort-group-toggle" style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--text)">'
    + '<span style="width:18px;height:18px;border-radius:4px;border:2px solid '+(_groupMode?'var(--red)':'var(--border)')+';display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;color:'+(_groupMode?'var(--red)':'transparent')+'">✓</span>'
    + '按路线分组</div>'
    + '<div style="font-size:11px;color:var(--text-light);margin-top:4px;padding-left:26px">同一路线、航班的日期归为一组</div>'
    + '</div>';
  
  body.innerHTML = h;
  
  // 绑定点击事件
  body.querySelectorAll('.sort-dim').forEach(function(el) {
    el.onclick = function() {
      var k = el.dataset.key;
      var asc = k+'_asc', desc = k+'_desc';
      var existingAsc = modes.indexOf(asc);
      var existingDesc = modes.indexOf(desc);
      
      if (existingAsc >= 0) {
        // 已是升序 → 切降序
        modes[existingAsc] = desc;
      } else if (existingDesc >= 0) {
        // 已是降序 → 移除
        modes.splice(existingDesc, 1);
        if (!modes.length) modes = [];
      } else {
        // 新增
        if (modes.length >= 3) modes.shift();
        modes.push(asc);
      }
      _sortModes = modes;
      _renderSortBody(modes);
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
  _groupMode = true;
  _renderSortBody(_getModes());
}

function applySort() {
  closeSortModal();
  render();
}
