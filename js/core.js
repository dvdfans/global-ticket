// === H5 报价网页 v3：路线日期分组 + 深链分享 ===

// 账号系统
var ADMIN_LIST = [
  {user:'admin',pwd:'1qaz9ol.7ujm$RFV',role:'admin',name:'管理员'},
  {user:'adminzch',pwd:'6yhn(OL>',role:'admin',name:'管理员zch'},
  {user:'adminxxy',pwd:'5tgb*IK<',role:'admin',name:'管理员xxy'},
];

// 统计上报地址（cloudflared 隧道，数据汇总到您电脑本地）
var STATS_API_URL = 'https://sodium-data-logical-saturn.trycloudflare.com/track';

// ── 埋点维度辅助 STATS-DIM v1（2026-08-10）──────────────────
// 应急切换上报地址（无需重新部署）：localStorage.setItem('stats_api_override','https://xxx/track')
try { var _sOv = localStorage.getItem('stats_api_override'); if (_sOv) STATS_API_URL = _sOv; } catch(e) {}

// 来源版本：按域名判断，避免各通道写死常量后被同步脚本覆盖而误判
function _statsSrc() {
  var h = (location.hostname || '').toLowerCase();
  if (h.indexOf('github.io') >= 0) return 'GitHub Pages';
  if (h.indexOf('7116b6b0') >= 0) return '正式版';
  if (h.indexOf('6677549d') >= 0) return '自由行测试版';
  if (h.indexOf('a52b3dc0') >= 0) return '客服版';
  if (h.indexOf('c3fcd2b5') >= 0) return '交付对比页';
  if (h.indexOf('402d431c') >= 0) return '新报价站';
  if (h.indexOf('2975ec0c') >= 0 || h.indexOf('de91a58') >= 0) return '镜像版';
  if (h === 'localhost' || h === '127.0.0.1' || h === '') return '本地';
  return h;
}
// 设备大类：iOS / 安卓 / 电脑 / iPad
function _statsDev() {
  var u = navigator.userAgent || '';
  if (/iPad/i.test(u) || (/Macintosh/i.test(u) && (navigator.maxTouchPoints || 0) > 1)) return 'iPad';
  if (/iPhone|iPod/i.test(u)) return 'iOS';
  if (/Android/i.test(u)) return '安卓';
  if (/Windows NT|Macintosh|X11|Linux x86/i.test(u)) return '电脑';
  return '其他';
}
// 操作系统（含版本）
function _statsOS() {
  var u = navigator.userAgent || '', m;
  if (/iPhone|iPad|iPod/i.test(u) && (m = u.match(/OS (\d+)[_.](\d+)/))) return 'iOS ' + m[1] + '.' + m[2];
  if ((m = u.match(/Android (\d+(?:\.\d+)?)/))) return 'Android ' + m[1];
  if (/Windows NT 10/.test(u)) return 'Windows 10/11';
  if (/Windows NT/.test(u)) return 'Windows';
  if (/Mac OS X/.test(u)) return 'macOS';
  if (/Linux/.test(u)) return 'Linux';
  return '未知';
}
// 浏览器 / 容器（微信内置浏览器占大头）
function _statsBr() {
  var u = navigator.userAgent || '';
  if (/MicroMessenger/i.test(u)) return '微信';
  if (/QQBrowser/i.test(u) || /\bQQ\//i.test(u)) return 'QQ';
  if (/AlipayClient/i.test(u)) return '支付宝';
  if (/DingTalk/i.test(u)) return '钉钉';
  if (/Weibo/i.test(u)) return '微博';
  if (/UCBrowser/i.test(u)) return 'UC';
  if (/Edg\//i.test(u)) return 'Edge';
  if (/Firefox/i.test(u)) return 'Firefox';
  if (/Chrome|CriOS/i.test(u)) return 'Chrome';
  if (/Safari/i.test(u)) return 'Safari';
  return '其他';
}
// 入口来源：二维码 / 分享链接 / 微信内打开 / 搜索引擎 / 外链 / 直接访问
function _statsEntry() {
  try {
    var q = location.search || '';
    if (/[?&](qr|from_qr)=/i.test(q)) return '二维码';
    if (/[?&](f|share|s)=/i.test(q)) return '分享链接';
    var rf = document.referrer || '';
    if (/MicroMessenger/i.test(navigator.userAgent || '')) return '微信内打开';
    if (!rf) return '直接访问';
    var h = (rf.split('/')[2] || '').toLowerCase();
    if (h && location.hostname && h.indexOf(location.hostname) >= 0) return '站内跳转';
    if (/baidu|google|bing|sogou|so\.com|sm\.cn|yandex|duckduckgo/i.test(h)) return '搜索引擎';
    return '外链:' + h;
  } catch (e) { return '未知'; }
}
// 会话 ID：一次浏览会话内不变，用于算会话数/人均深度
function _statsSid() {
  try {
    var s = sessionStorage.getItem('stats_sid');
    if (!s) {
      s = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      sessionStorage.setItem('stats_sid', s);
    }
    return s;
  } catch (e) { return ''; }
}
// 报价卡片指纹：航班 | 航线 | 日期 | N天 | ¥价格
function _statsCard(d) {
  d = d || {};
  if (!d.flight && !d.date) return '';
  var g = _statsGroup(d);
  return [d.flight || '', g, d.date || '', (d.days ? d.days + '天' : ''), (d.price ? '\u00a5' + d.price : '')]
    .filter(function (x) { return !!x; }).join(' | ');
}
// 干净的航线分组：部分埋点把整段复制文本塞进了 route，需剔除
function _statsGroup(d) {
  var r = (d && d.route) || '';
  if (!r || r.length > 40 || r.indexOf('\n') >= 0) return '';
  return r;
}
// 主题偏好
function _statsTheme() {
  try {
    return (localStorage.getItem('theme') || 'light') + '/' +
           (localStorage.getItem('theme_color') || localStorage.getItem('themeColor') || 'default');
  } catch (e) { return ''; }
}
// ── /STATS-DIM v1 ────────────────────────────────────────────


function loadAccounts() {
  var cs = [];
  try { cs = JSON.parse(localStorage.getItem('cs_accounts') || '[]'); } catch(e) {}
  // 首次使用：插入默认客服
  if (!cs.length) {
    var defaults = [
      {user:'hq_zhangw',pwd:'123456'},{user:'hq_liujq',pwd:'123456'},{user:'hq_liuw',pwd:'123456'},
      {user:'hq_baif',pwd:'123456'},{user:'hq_mifm',pwd:'123456'},{user:'hq_liurong',pwd:'123456'},{user:'hq_shenzy',pwd:'123456'}
    ];
    cs = defaults;
    localStorage.setItem('cs_accounts', JSON.stringify(cs));
  }
  var accs = ADMIN_LIST.map(function(a){return a;});
  cs.forEach(function(a){ accs.push({user:a.user, pwd:a.pwd, role:'cs', name:a.user}); });
  return accs;
}

var CURRENT_USER = null; // {user, role, name}

const CONFIG = { ADMIN_KEY: 'globe_admin_2026', statsAPI: null };

let DB = { records: [] };
let currentTab = 'home';
let _sortModes = [];  // 空数组=不排序（保持原始顺序）
let _groupMode = true;
let isAdmin = false;

// 初始化主题 + 游客ID
(function() {
  if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark');
    var el = document.getElementById('headerTheme');
    if (el) el.textContent = '🌙';
  }
  // 复活登录
  var saved = localStorage.getItem('current_user');
  if (saved) {
    try { CURRENT_USER = JSON.parse(saved); } catch(e) {}
  }
  // 分配游客ID
  if (!localStorage.getItem('visitor_id')) {
    var count = parseInt(localStorage.getItem('visitor_count') || '0') + 1;
    localStorage.setItem('visitor_count', '' + count);
    localStorage.setItem('visitor_id', '游客' + count);
  }
})();
let currentDetailRec = null;
let _lastSharedRec = null;

// ═══════════════ 基础加载 ═══════════════

async function loadDB() {
  try {
    const r = await fetch('price_db_fe.json?_=' + Date.now());
    DB = await r.json();
    // 2026-08-06: 售罄记录（0/售罄/满/(空)/候补/暂停/0805上调/停售）加载后一次性过滤——
    // 环球度假 H5 只渲染在售数据条，售罄不渲染也不显示到结果（数据仍一比一保留在 price_db.json 全量库/对比表）
    DB.records = DB.records.filter(function(x) { return _hasSeats(x); });
    validateDays();  // 校验天数/回程日期一致性
    updateStats();
    generateFooterQR();  // 加载完数据后生成尾部二维码
    handleDeepLink();   // 先检查URL参数
    _applyFilterFromUrl(); // 读取筛选参数
    render();
    recordAction('page_view', {route:'load→'+currentTab,days:DB.records.length+''});
  } catch(e) {
    document.getElementById('cardList').innerHTML = '<div class="loading">数据加载失败</div>';
  }
}

function updateStats() {
  const routes = new Set(DB.records.map(r => (r.dep||'') + '-' + (r.arr||''))).size;
  document.getElementById('stats-routes').textContent = routes;
  var bt = DB.build_time || '';
  if (bt && bt.length >= 16) {
    var parts = bt.split(' ');
    if (parts.length >= 2) {
      var d = parts[0].split('-'), t = parts[1].split(':');
      if (d.length >= 3 && t.length >= 2) {
        var m = parseInt(d[1]), day = parseInt(d[2]), h = t[0], min = t[1];
        var today = new Date();
        var dateLabel = (today.getFullYear()===parseInt(d[0]) && today.getMonth()+1===m && today.getDate()===day) ? '今天' : m+'月'+day+'日';
        document.getElementById('stats-time').textContent = dateLabel + ' ' + h + ':' + min;
      }
    }
  } else {
    document.getElementById('stats-time').textContent = '--';
  }
}

// ── 天数/回程日期一致性校验 ──
function validateDays() {
  var ok = 0, mismatch = 0, withRet = 0;
  var details = [];
  DB.records.forEach(function(r) {
    var rd = r.return_date, dd = r.dep_date, ds = r.days;
    if (rd && dd && ds) {
      withRet++;
      var d = parseInt(ds);
      if (!isNaN(d) && d > 0) {
        // 从 return_date 计算天数
        var p1 = dd.split('-'), p2 = rd.split('-');
        var depD = new Date(parseInt(p1[0]), parseInt(p1[1])-1, parseInt(p1[2]));
        var retD = new Date(parseInt(p2[0]), parseInt(p2[1])-1, parseInt(p2[2]));
        var diffDays = Math.round((retD - depD) / 86400000) + 1;
        if (diffDays === d) {
          ok++;
        } else {
          mismatch++;
          if (details.length < 5) details.push(r.supplier + ' ' + r.dep + '-' + r.arr + ' ' + r.flight + ': DB days=' + d + ' 公式回推=' + diffDays + ' ret=' + rd);
        }
      }
    }
  });
  console.log('[校验] 天数/回程日期一致性:');
  console.log('  return_date存在: ' + withRet + '条');
  console.log('  一致: ' + ok + '条');
  console.log('  不一致: ' + mismatch + '条');
  if (mismatch > 0) {
    details.forEach(function(d) { console.warn('  ⚠️ ' + d); });
  } else {
    console.log('  ✅ 全部一致，公式验证通过');
  }
  console.log('  结论: days=' + ok + '/' + withRet + ' 可靠，后期可直接用 return_date-dep_date+1 推导');
}

// ═══════════════ Tab分类 ═══════════════

const TAB_CITIES = {
  hot: null,
  japan: ['东京','大阪','名古屋','冲绳','札幌','福冈','仙台'],
  korea: ['首尔','济州岛','釜山','清州','清洲'],
  seasia: ['曼谷','普吉','清迈','苏梅','巴厘岛','沙巴','新加坡','吉隆坡','胡志明','岘港','马尼拉','雅加达','河内','富国岛'],
  ganga: ['香港','澳门'],
  domestic: ['上海','北京','广州','深圳','杭州','南京','无锡','成都','重庆','西安','武汉','长沙','厦门','三亚','海口','青岛','大连','沈阳','天津','郑州','济南','福州','贵阳','南宁','兰州','哈尔滨','乌鲁木齐','南通','宁波','桂林','张家界','昆明','西宁','阿勒泰','宁波栎社'],
};

function gradeLevel(r) {
  const price = r.retail || 0;
  const seats = parseInt((r.seats || '0').match(/\d+/)?.[0] || 0);
  if (price > 0 && price <= 2000 && seats >= 9) return 'hot';
  if (price > 0 && price <= 3500 && seats >= 5) return 'featured';
  if (price > 0) return 'special';
  return null;
}
const LEVEL_LABEL = { hot: '🔥 爆款', featured: '💎 精选', special: '⚡ 特价' };

// ── 余位格式化（统一处理 nan/售罄/0/10+/充足）──
function fmtSeats(s, opts) {
  s = (s || '').trim().toLowerCase();
  if (!s || s === 'nan' || s === 'na') return opts && opts.empty || '';
  if (s === '售罄' || s === '满' || s === '0') return '<span class="seat-soldout">售罄</span>';
  if (s === '充足') return '<span class="seat-full">充足</span>';
  var num = parseInt(s.match(/\d+/)?.[0]);
  if (num === undefined || num === null) return '<span class="seat-unknown">' + s + '</span>';
  if (num <= 3) return '<span class="seat-low">余' + s + '</span>';
  return '<span class="seat-ok">余' + s + '</span>';
}

// ── 供应商底色规则（2026-08-05 重设计 v2：26 家全覆盖——price_db 11 家 + ERP 资源标题检索出的 15 家，避开 logo 红 #DA3A2C / logo 金 #F9BE00）──
// dot=卡片左边条/阴影主色；glow=卡片阴影 rgba（供应商色 tint）；bg/border=浅色底
const SUPPLIER_COLORS = {
  '美亚':    { bg:'#EAF2FA', border:'#A8C8E8', dot:'#0C6FA8', glow:'rgba(12,111,168,0.18)' },
  '奇妙':    { bg:'#E6F7F8', border:'#8FD8DC', dot:'#28B7BD', glow:'rgba(40,183,189,0.18)' },
  '纵贯':    { bg:'#E8EEF7', border:'#93A8CC', dot:'#004286', glow:'rgba(0,66,134,0.18)' },
  '通宏':    { bg:'#E8F5E9', border:'#8FC890', dot:'#389C39', glow:'rgba(56,156,57,0.18)' },
  '上航':    { bg:'#F3EAFB', border:'#BFA8DC', dot:'#491B87', glow:'rgba(73,27,135,0.18)' },
  '途益':    { bg:'#E4F5F3', border:'#86CFC8', dot:'#008B8B', glow:'rgba(0,139,139,0.18)' },
  '万国':    { bg:'#FFF3E2', border:'#F0B060', dot:'#E88A00', glow:'rgba(232,138,0,0.18)' },
  '通宏国内': { bg:'#EBEFF4', border:'#A8BCCE', dot:'#5A7D9A', glow:'rgba(90,125,154,0.18)' },
  '怡行':    { bg:'#E9F4EA', border:'#98CBA0', dot:'#2E7D32', glow:'rgba(46,125,50,0.18)' },
  '春秋国际': { bg:'#F5EEE4', border:'#D0B090', dot:'#8B5A2B', glow:'rgba(139,90,43,0.18)' },
  'ERP':     { bg:'#EAECF2', border:'#98A2B8', dot:'#1F3A5F', glow:'rgba(31,58,95,0.18)' },
  // ── ERP 数据（iVision 资源标题）检索出的供应商（2026-08-05）──
  '浙江中青旅': { bg:'#E7F2FA', border:'#90BFDF', dot:'#0072A3', glow:'rgba(0,114,163,0.18)' },
  '浙江新世界': { bg:'#F3EAF9', border:'#C2A8DA', dot:'#7B1FA2', glow:'rgba(123,31,162,0.18)' },
  '上海宝臻': { bg:'#EDF7ED', border:'#A5D6A7', dot:'#4CAF50', glow:'rgba(76,175,80,0.18)' },
  '浙江海峡': { bg:'#E8F2FE', border:'#90CAF9', dot:'#2196F3', glow:'rgba(33,150,243,0.18)' },
  '宏游':    { bg:'#E4F5F2', border:'#88CFC4', dot:'#009688', glow:'rgba(0,150,136,0.18)' },
  '芒果汇':  { bg:'#FCEFE3', border:'#F0A87A', dot:'#E65100', glow:'rgba(230,81,0,0.18)' },
  '信旅飞跃': { bg:'#F2ECE7', border:'#C4AFA0', dot:'#795548', glow:'rgba(121,85,72,0.18)' },
  '杭州宝臻': { bg:'#E3F4F2', border:'#7FC9BE', dot:'#00695C', glow:'rgba(0,105,92,0.18)' },
  '江苏欣辰': { bg:'#EBEDFA', border:'#A9B4E8', dot:'#3949AB', glow:'rgba(57,73,171,0.18)' },
  '走遍全球': { bg:'#E5F8FB', border:'#8FE0EA', dot:'#00ACC1', glow:'rgba(0,172,193,0.18)' },
  '锦江':   { bg:'#E7F0FB', border:'#9EC7EA', dot:'#1565C0', glow:'rgba(21,101,192,0.18)' },
  '苏州和平': { bg:'#F0F7E8', border:'#C0DC9E', dot:'#7CB342', glow:'rgba(124,179,66,0.18)' },
  '江苏苏宁国际旅游': { bg:'#EFEAFB', border:'#BDA8E8', dot:'#5E35B1', glow:'rgba(94,53,177,0.18)' },
  '无锡国旅汤青': { bg:'#E4F4F1', border:'#8AD0C4', dot:'#00897B', glow:'rgba(0,137,123,0.18)' },
  '千巡':   { bg:'#EBEEF2', border:'#AEBAC8', dot:'#546E7A', glow:'rgba(84,110,122,0.18)' },
};
function supplierColor(name) {
  return SUPPLIER_COLORS[name] || { bg:'#F5F5F5', border:'#D0D0D0', dot:'#999' };
}

// 获取天数：优先 days 字段（纵贯等做了天数→晚数转换后回算），fallback 到 nights
function getDays(r) {
  var d = r.days || r.nights || '';
  return d;
}

// 机场名→IATA码
function _iata(name) {
  if (!name) return '';
  var m = {'上海浦东':'PVG','上海虹桥':'SHA','东京成田':'NRT','东京羽田':'HND','大阪关西':'KIX',
    '首尔仁川':'ICN','首尔金浦':'GMP','釜山金海':'PUS','济州':'CJU','冲绳那霸':'OKA',
    '札幌新千岁':'CTS','福冈':'FUK','曼谷素万那普':'BKK','普吉岛':'HKT','清迈':'CNX',
    '巴厘岛':'DPS','沙巴亚庇':'BKI','樟宜':'SIN','吉隆坡':'KUL','马尼拉':'MNL','雅加达':'CGK','河内':'HAN','胡志明':'SGN','岘港':'DAD','富国岛':'PQC',
    '香港':'HKG','澳门':'MFM','台北':'TPE','南京禄口':'NKG','杭州萧山':'HGH','宁波栎社':'NGB','南通兴东':'NTG','苏南硕放':'WUX','三亚凤凰':'SYX',
    '北京首都':'PEK','北京大兴':'PKX','广州白云':'CAN','深圳':'SZX','成都天府':'TFU','成都双流':'CTU','重庆':'CKG',
    '西安':'XIY','武汉':'WUH','长沙':'CSX','昆明':'KMG','厦门':'XMN','青岛':'TAO','大连':'DLC','沈阳':'SHE','天津':'TSN',
    '郑州':'CGO','济南':'TNA','福州':'FOC','贵阳':'KWE','南宁':'NNG','兰州':'LHW','哈尔滨':'HRB','乌鲁木齐':'URC','西宁':'XNN','阿勒泰':'AAT'};
  return m[name] || name;
}

// 机场名显示：樟宜→新加坡樟宜，普吉岛→普吉岛等
function _apt(name) {
  var iata = {'PVG':'上海','SHA':'上海','HGH':'杭州','ICN':'首尔','GMP':'首尔','PUS':'釜山','CJU':'济州岛','NRT':'东京','HND':'东京','KIX':'大阪','FUK':'福冈','OKA':'冲绳','CTS':'札幌','BKK':'曼谷','HKT':'普吉','CNX':'清迈','DPS':'巴厘岛','SIN':'新加坡','BKI':'沙巴','KUL':'吉隆坡','MFM':'澳门','HKG':'香港', 'PQC':'富国岛', 'NGB':'宁波', 'NKG':'南京', 'WUX':'无锡', 'NTG':'南通', 'SYX':'三亚', 'URC':'乌鲁木齐', 'DYG':'张家界', 'KWL':'桂林', 'HAK':'海口', 'XNN':'西宁', 'JXU':'嘉兴', 'AAT':'阿勒泰', 'PEK':'北京', 'PKX':'北京', 'CAN':'广州', 'SZX':'深圳', 'TFU':'成都', 'CTU':'成都', 'CKG':'重庆', 'XIY':'西安', 'WUH':'武汉', 'CSX':'长沙', 'KMG':'昆明', 'XMN':'厦门', 'TAO':'青岛', 'DLC':'大连', 'SHE':'沈阳', 'TSN':'天津', 'CGO':'郑州', 'TNA':'济南', 'FOC':'福州', 'KWE':'贵阳', 'NNG':'南宁', 'LHW':'兰州', 'HRB':'哈尔滨', 'CJJ':'清州', 'NGO':'名古屋', 'DMK':'曼谷', 'MNL':'马尼拉', 'CGK':'雅加达', 'HAN':'河内', 'SGN':'胡志明', 'DAD':'岘港', 'TPE':'台北', 'KHH':'高雄'
  };
  if (iata[name]) return iata[name];
  var m = {'樟宜':'新加坡樟宜','济州':'济州','沙巴亚庇':'沙巴亚庇','普吉岛':'普吉岛','曼谷素万那普':'曼谷素万那普','冲绳那霸':'冲绳那霸','札幌新千岁':'札幌新千岁'};
  return m[name] || name;
}

// 航站楼：按 航司+机场 查询
function _term(airline, airport) {
  if (!airline || !airport) return '';
  // 常见航站楼映射
  var m = {
    'PVG':{MU:'T1',FM:'T1',CA:'T2',CZ:'T1',HO:'T2','9C':'T2',CX:'T2'},
    'NRT':{CA:'T1',MU:'T1',CZ:'T1',GK:'T2',JL:'T2',NH:'T1'},
    'HND':{NH:'T2',JL:'T1',MM:'T1'},
    'KIX':{CA:'T1',MU:'T1',CZ:'T1',JL:'T1'},
    'ICN':{CA:'T1',MU:'T1',CZ:'T1',KE:'T2'},
    'HKG':{CX:'T1',MU:'T1',CA:'T1'},
    'MFM':{NX:'T1'},
    'BKK':{TG:'T1',MU:'T1',CA:'T1'},
    'SIN':{CA:'T1',MU:'T1',SQ:'T2'},
    'NGB':{MU:'T2',FM:'T2'},
    'HGH':{CA:'T2',MU:'T3',MF:'T3'},
    'NKG':{MU:'T2',CA:'T2',HO:'T2'},
  };
  var code = _iata(airport);
  if (!code) return '';
  var termMap = m[code];
  if (termMap && termMap[airline]) return '<span class="t-term">' + termMap[airline] + '</span>';
  if (code === 'PVG' || code === 'SHA') return '<span class="t-term">T2</span>';
  return '';
}

// 余位有效判断
// 2026-08-06 用户规则：余位0 = 售罄 = 满 = (空) = 候补 = 暂停 = 0805上调 = 停售 → 一律视为售罄，H5 不渲染
// （数据仍一比一保留在库/对比表；此处仅控制环球度假 H5 卡片渲染）
function _hasSeats(r) {
  var s = (r.seats || '').trim().toLowerCase();
  if (!s || s === 'nan' || s === 'na' || s === '0' || s === '售罄' || s === '满' || s === '候补' || s === '暂停' || s === '0805上调' || s === '停售' || s === '/' || s === '预留') return false;
  return true;
}

// 记录完整性判断（排除dep/arr为空的不完整数据）
// 2026-08-07 18:0x: 增加航班号完整性校验 —— 航段1/航段2 非标准航班号
// （含中文/特殊字符/候选格式如「FM看WPS报价」「FM831/832/876」）→ 数据不完整，
// H5 报价卡片不渲染（对比表独立数据流不受影响，供人工检查参考源）
function _validRecord(r) {
  if (!(r.dep||'').trim() || !(r.arr||'').trim()) return false;
  // 航班号标准格式：2-3字母+3-4位数字（如 FM831 / 9C8521 / HO1321）
  var FLT = /^[A-Z0-9]{2,3}\d{3,4}$/;
  var f1 = String(r.flight || '').trim().toUpperCase();
  var f2 = String(r.flight_return || '').trim().toUpperCase();
  // 单程（无航段2）且航段1标准 → 有效（HO 上海↔济州岛等豁免）；有航段2则两者都须标准
  if (!FLT.test(f1)) return false;
  if (f2 && !FLT.test(f2)) return false;
  return true;
}
