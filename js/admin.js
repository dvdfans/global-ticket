// === 后台管理 ===

// 2026-08-11: 哈希化（后台管理密码），源码不存明文
const ADMIN_KEY = '8447744107795a7a89b411c83c3def917ff9b9a373a4e9ec8593d0f47392bad0';
let FULL_DB = null;
let filteredData = [];

// 2026-08-18: 自动关键字抽取词表（从全量库构建，避免硬编码）
let VOCAB = {
  supCodes: new Set(),   // 供应商代码（数字）
  supNames: new Set(),   // 供应商中文名
  airlines: new Set(),   // 航司 IATA 代码（大写）
  airlineCn: new Set(),  // 航司中文名
  airports: new Set(),   // 机场 IATA 代码（大写，3 字母）
  cities: new Set(),     // 出发/到达城市中文名
};

function buildVocab() {
  if (!FULL_DB) return;
  for (const r of (FULL_DB.records || [])) {
    if (r.supplier_code) VOCAB.supCodes.add(String(r.supplier_code));
    if (r.supplier) VOCAB.supNames.add(String(r.supplier));
    if (r.airline) VOCAB.airlines.add(String(r.airline).toUpperCase());
    if (r.airline_cn) VOCAB.airlineCn.add(String(r.airline_cn));
    if (r.dep_airport) VOCAB.airports.add(String(r.dep_airport).toUpperCase());
    if (r.arr_airport) VOCAB.airports.add(String(r.arr_airport).toUpperCase());
    if (r.dep) VOCAB.cities.add(String(r.dep));
    if (r.arr) VOCAB.cities.add(String(r.arr));
  }
}

// 自动抽取关键字：供应商代码/名称、航司代码/中文名、机场 IATA、城市、航班号；
// 忽略连词与未知片段。返回小写关键字数组（已去重）。
function extractKeywords(q) {
  const kw = [];
  const s = (q || '').toLowerCase();
  if (!s) return kw;
  // 1) 供应商代码（数字，已知集合，子串即可命中）
  for (const c of VOCAB.supCodes) {
    const cs = String(c).toLowerCase();
    if (cs && s.includes(cs)) kw.push(cs);
  }
  // 2) 拆成 数字段 / 字母段 / 中文段，逐段识别
  const runs = s.match(/[0-9]+|[a-z]+|[一-鿿]+/g) || [];
  const cjkVocab = [...VOCAB.cities, ...VOCAB.supNames, ...VOCAB.airlineCn];
  for (const run of runs) {
    if (/^[0-9]+$/.test(run)) {
      if (!VOCAB.supCodes.has(run)) kw.push(run); // 非供应商代码的纯数字 → 航班号片段
    } else if (/^[a-z]+$/.test(run)) {
      // 字母段：贪心最长匹配已知航司(2)/机场(3)代码；一旦遇到无法识别的字符，
      // 整段进入「乱码」不再抽码（避免从未知片段里渗出已知代码，如 uca→ca）。
      let i = 0, garble = false;
      while (i < run.length) {
        if (garble) { i++; continue; }
        let m = false;
        for (const len of [3, 2]) {
          if (i + len <= run.length) {
            const seg = run.substr(i, len).toUpperCase();
            if (VOCAB.airlines.has(seg) || VOCAB.airports.has(seg)) {
              kw.push(seg.toLowerCase()); i += len; m = true; break;
            }
          }
        }
        if (!m) { garble = true; i++; }
      }
    } else {
      // 中文段：子串匹配已知城市/供应商名/航司中文名，连词自动忽略
      for (const name of cjkVocab) {
        if (name && run.includes(name)) kw.push(name);
      }
    }
  }
  return [...new Set(kw)];
}

// ── 登录 ──
async function doLogin() {
  const pwd = document.getElementById('pwdInput').value;
  const buf = new TextEncoder().encode(pwd);
  const h = await crypto.subtle.digest('SHA-256', buf);
  const hex = Array.from(new Uint8Array(h)).map(b => ('0' + b.toString(16)).slice(-2)).join('');
  if (hex === ADMIN_KEY) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminMain').style.display = 'block';
    // 设置 admin 标记到 localStorage 供前台使用
    localStorage.setItem('admin_mode', '1');
    loadFullDB();
  } else {
    alert('密码错误');
  }
}

// 回车登录
document.getElementById('pwdInput').onkeydown = e => { if (e.key === 'Enter') doLogin(); };

// ── 加载完整数据库 ──
async function loadFullDB() {
  try {
    const r = await fetch('price_db.json?_=' + Date.now());
    FULL_DB = await r.json();
    buildVocab();
    renderDashboard();
    doFilter();
  } catch(e) {
    // 沙箱可能没有完整版，尝试前端版
    try {
      const r = await fetch('price_db_fe.json?_=' + Date.now());
      FULL_DB = { records: await r.json(), record_count: 0 };
      buildVocab();
      document.querySelector('.login-hint').textContent = '⚠️ 仅加载前端版，部分字段不可用';
      renderDashboard();
      doFilter();
    } catch(e2) {
      alert('数据库加载失败：' + e2.message);
    }
  }
}

// ── 统计面板 ──
function renderDashboard() {
  const records = FULL_DB.records || [];
  const total = records.length;
  const matched = records.filter(r => r.match_status === 'matched').length;
  const supOnly = records.filter(r => r.match_status === 'sup_only').length;
  const erpOnly = records.filter(r => r.match_status === 'erp_only').length;
  const indep = records.filter(r => r.match_status === 'independent').length;
  const routes = new Set(records.map(r => (r.dep||'') + '-' + (r.arr||''))).size;

  document.getElementById('statCards').innerHTML = `
    <div class="stat-card total"><div class="num">${total}</div><div class="label">总记录</div></div>
    <div class="stat-card matched"><div class="num">${matched}</div><div class="label">已匹配</div></div>
    <div class="stat-card sup_only"><div class="num">${supOnly}</div><div class="label">供应商独有</div></div>
    <div class="stat-card erp_only"><div class="num">${erpOnly}</div><div class="label">ERP独有</div></div>
    <div class="stat-card" style="flex:0.5"><div class="num">${indep}</div><div class="label">独立供应商</div></div>
    <div class="stat-card" style="flex:0.5"><div class="num">${routes}</div><div class="label">航线数</div></div>
  `;
  
  FULL_DB.record_count = total;
}

// ── 筛选 + 渲染表格 ──
function doFilter() {
  if (!FULL_DB) return;
  
  const q = document.getElementById('filterInput').value.toLowerCase();
  const status = document.getElementById('statusFilter').value;
  const price = document.getElementById('priceFilter').value;
  
  filteredData = (FULL_DB.records || []).filter(r => {
    if (status && r.match_status !== status) return false;
    if (price === 'cheap' && (!r.retail || r.retail > 2000)) return false;
    if (price === 'mid' && (!r.retail || r.retail < 2001 || r.retail > 3500)) return false;
    if (price === 'high' && (!r.retail || r.retail <= 3500)) return false;
    if (q) {
      // 2026-08-18: 自动关键字抽取（供应商代码/名称 + 航司代码/中文名 + 机场 + 城市 + 航班号），
      // 忽略连词与未知片段；所有抽取到的关键字 AND 匹配 → 支持「103GK」「帮我将103下GKFMMUca列出来」等。
      const kws = extractKeywords(q);
      if (kws.length) {
        const t = [
          r.dep, r.arr, r.flight, r.flight_return, r.supplier,
          r.supplier_code || '', r.airline || '', r.airline_cn || '',
          r.dep_airport || '', r.arr_airport || ''
        ].join(' ').toLowerCase();
        if (!kws.every(k => t.includes(k))) return false;
      }
    }
    return true;
  });
  
  document.getElementById('resultCount').textContent = `共 ${filteredData.length} 条`;
  renderTable();
}

// ── 表格列配置 ──
const TABLE_COLS = [
  { key: 'supplier', label: '供应商' },
  { key: 'dep', label: '出发' },
  { key: 'arr', label: '到达' },
  { key: 'flight', label: '航班' },
  { key: 'flight_return', label: '回程航班' },
  { key: 'dep_date', label: '日期' },
  { key: 'nights', label: '晚数' },
  { key: 'price', label: '供应商报价' },
  { key: 'cost_price', label: '成本价' },
  { key: 'retail', label: '直客价' },
  { key: 'erp_wholesale', label: 'ERP批发价' },
  { key: 'erp_retail', label: 'ERP直客价' },
  { key: 'seats', label: '余位' },
  { key: 'erp_seats', label: 'ERP余位' },
  { key: 'airline_cn', label: '航司' },
  { key: 'dep_airport', label: '起飞机场' },
  { key: 'arr_airport', label: '到达机场' },
  { key: 'dep_time', label: '起飞' },
  { key: 'duration', label: '时长' },
  { key: 'match_level', label: '匹配层级' },
  { key: 'match_status', label: '状态' },
  { key: 'baggage', label: '行李' },
];

function renderTable() {
  // 表头
  document.getElementById('tableHead').innerHTML = '<tr>' + TABLE_COLS.map(c =>
    `<th onclick="sortBy('${c.key}')" title="${c.label}">${c.label}</th>`
  ).join('') + '</tr>';
  
  // 表体
  function rowClass(r) {
    if (r.match_status === 'matched') return 'tr-match';
    if (r.match_status === 'sup_only') return 'tr-sup_only';
    if (r.match_status === 'erp_only') return 'tr-erp_only';
    if (r.match_status === 'independent') return 'tr-independent';
    return '';
  }
  
  document.getElementById('tableBody').innerHTML = filteredData.map(r => {
    const cells = TABLE_COLS.map(c => {
      let v = r[c.key];
      if (v === undefined || v === null) v = '';
      // 价格显示
      if (typeof v === 'number' && c.key.includes('price')) {
        v = '¥' + Math.round(v);
      }
      return `<td>${v}</td>`;
    }).join('');
    return `<tr class="${rowClass(r)}">${cells}</tr>`;
  }).join('');
}

// ── 排序 ──
let sortField = '';
let sortAsc = true;
function sortBy(field) {
  if (sortField === field) sortAsc = !sortAsc;
  else { sortField = field; sortAsc = true; }
  filteredData.sort((a, b) => {
    const va = a[field] ?? '';
    const vb = b[field] ?? '';
    if (typeof va === 'number') return sortAsc ? va - vb : vb - va;
    return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  });
  renderTable();
}

// ── 导出CSV ──
function exportCSV() {
  const headers = TABLE_COLS.map(c => c.label).join(',');
  const rows = filteredData.map(r => {
    return TABLE_COLS.map(c => {
      let v = r[c.key];
      if (v === undefined || v === null) v = '';
      if (typeof v === 'string' && (v.includes(',') || v.includes('"'))) v = '"' + v.replace(/"/g, '""') + '"';
      return v;
    }).join(',');
  }).join('\n');
  
  const csv = '\uFEFF' + headers + '\n' + rows;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `环球度假_后台数据_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── 键盘快捷键 ──
document.onkeydown = e => {
  if (e.key === 'Escape' && document.getElementById('loginScreen').style.display !== 'none') {
    location.href = 'index.html';
  }
};
