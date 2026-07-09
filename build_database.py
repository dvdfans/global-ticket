#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
环球数据库构建器 v2
====================
整合流程：
  ① 读取最新ERP CSV → ② 读取最新航班定义表CSV
  ③ 计算准确回程日期（查班期/推算）
  ④ 创建 SQLite 数据库 global_ticket.db
  ⑤ 导出 flight_data.json（供H5使用）
"""
import sqlite3, json, glob, re, io, sys
from datetime import datetime, timedelta
from pathlib import Path
import pandas as pd

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

HERE = Path(__file__).parent
DB_PATH = HERE / 'global_ticket.db'
JSON_PATH = HERE / 'flight_data.json'

# ======== 已确认的航班班期 ========
# {flight_no: schedule_days}
# '1234567'=每日, '1,3,5'=周一三五, 等等
CONFIRMED_SCHEDULES = {
    '9C8594':'1234567','HO1356':'1234567','MU206':'1234567',
    'MU5030':'1234567','FM858':'1234567','HO1632':'1,2,4,6',
    'CA140':'1234567','MU5072':'1234567','FM868':'1234567',
    '9C8522':'2,4,6','SQ836':'1234567','SQ826':'1234567',
    'CZ370':'1234567','9C8756':'1234567','9C8568':'1,2,4,6',
    'MU2990':'1234567','CA826':'1234567','NX118':'1234567',
    'FM832':'1234567','CZ8310':'1234567','GK035':'1234567',
    'CA858':'1234567','CA920':'1234567','CA930':'1234567',
    'CX362':'1234567','CX380':'1234567','FM806':'1234567',
    'MU5050':'1234567','HO1369':'1,3,5','9C8574':'1234567',
    'FM897':'1234567','FM896':'1234567','HO1339':'1234567',
    'HO1351':'1234567','ZH181':'1234567','CA740':'1234567',
    'MU203':'1234567','MU5088':'1234567','FM3063':'1,2,4,6',
    'ZE702':'1234567','KE898':'1234567','OZ364':'1234567',
    'MU8606':'1234567','FM3064':'1,2,4,6','HO1370':'1,3,5',
    'HO1360':'1,2,4,6','GJ8916':'1234567','CA152':'1234567',
    'MU507':'1234567','MU2086':'1234567','HO1636':'1234567',
    'HO1356':'1234567','NX102':'1234567','CA132':'1234567',
    'HO1358':'1,2,4,6','GJ8932':'1,3,5','MU5113':'1234567',
    '9C8952':'1234567','CA626':'1234567',
}

AIRLINE_MAP = {
    'MU':'东方航空','FM':'上海航空','CA':'中国国航','CZ':'南方航空',
    'HU':'海南航空','3U':'四川航空','ZH':'深圳航空','SC':'山东航空',
    'MF':'厦门航空','HO':'吉祥航空','9C':'春秋航空','GS':'天津航空',
    'JD':'首都航空','AQ':'九元航空','DZ':'东海航空','KN':'联合航空',
    'GJ':'浙江长龙航空','NS':'河北航空','QW':'青岛航空','KY':'昆明航空',
    'EU':'成都航空','PN':'西部航空','GT':'桂林航空','JR':'幸福航空',
    '8L':'祥鹏航空','TV':'西藏航空','FU':'福州航空','GK':'捷星日本',
    'JL':'日本航空','KE':'大韩航空','OZ':'韩亚航空','SQ':'新加坡航空',
    'NX':'澳门航空','CX':'国泰航空','NH':'全日空','ZE':'易斯达航空',
    'Y8':'金鹏航空',
}

AIRLINE_SERVICES = {
    # 全服务航空 - 国际线2件×23kg, 含餐
    'MU':{'baggage':'2件×23kg','meal':'含餐','note':'东方航空·全服务'},
    'FM':{'baggage':'2件×23kg','meal':'含餐','note':'上海航空·全服务'},
    'CA':{'baggage':'2件×23kg','meal':'含餐','note':'中国国航·全服务'},
    'CZ':{'baggage':'2件×23kg','meal':'含餐','note':'南方航空·全服务'},
    'HU':{'baggage':'2件×23kg','meal':'含餐','note':'海南航空·全服务'},
    'MF':{'baggage':'2件×23kg','meal':'含餐','note':'厦门航空·全服务'},
    '3U':{'baggage':'2件×23kg','meal':'含餐','note':'四川航空·全服务'},
    'CX':{'baggage':'2件×23kg','meal':'含餐','note':'国泰航空·全服务'},
    'KE':{'baggage':'2件×23kg','meal':'含餐','note':'大韩航空·全服务'},
    'OZ':{'baggage':'2件×23kg','meal':'含餐','note':'韩亚航空·全服务'},
    'NH':{'baggage':'2件×23kg','meal':'含餐','note':'全日空·全服务'},
    'JL':{'baggage':'2件×23kg','meal':'含餐','note':'日本航空·全服务'},
    'SQ':{'baggage':'1件×30kg','meal':'含餐','note':'新加坡航空·全服务'},
    # 全服务 - 国际线1件×23/20kg, 含餐
    'ZH':{'baggage':'1件×23kg','meal':'含餐','note':'深圳航空·全服务'},
    'SC':{'baggage':'1件×23kg','meal':'含餐','note':'山东航空·全服务'},
    'NX':{'baggage':'1件×20kg','meal':'含餐','note':'澳门航空·全服务'},
    'GS':{'baggage':'1件×20kg','meal':'含餐','note':'天津航空·全服务'},
    'JD':{'baggage':'1件×20kg','meal':'含餐','note':'首都航空·全服务'},
    'NS':{'baggage':'1件×20kg','meal':'含餐','note':'河北航空·全服务'},
    'KY':{'baggage':'1件×20kg','meal':'含餐','note':'昆明航空·全服务'},
    'TV':{'baggage':'1件×20kg','meal':'含餐','note':'西藏航空·全服务'},
    'FU':{'baggage':'1件×20kg','meal':'含餐','note':'福州航空·全服务'},
    'EU':{'baggage':'1件×20kg','meal':'含餐','note':'成都航空·全服务'},
    'PN':{'baggage':'1件×20kg','meal':'含餐','note':'西部航空·全服务'},
    'Y8':{'baggage':'1件×20kg','meal':'含餐','note':'金鹏航空·全服务'},
    # 差异化服务 - 1件×20kg, 含餐
    'HO':{'baggage':'1件×20kg','meal':'含餐','note':'吉祥航空·全服务'},
    'GJ':{'baggage':'1件×20kg','meal':'含餐','note':'浙江长龙航空'},
    '8L':{'baggage':'1件×20kg','meal':'含餐','note':'祥鹏航空·全服务'},
    'QW':{'baggage':'1件×20kg','meal':'含餐','note':'青岛航空·全服务'},
    # 廉航 - 无免费托运, 无餐食
    '9C':{'baggage':'无免费托运','meal':'无餐食','note':'春秋航空·廉航·行李另购'},
    'GK':{'baggage':'无免费托运','meal':'无餐食','note':'捷星日本·廉航·行李另购'},
    'ZE':{'baggage':'无免费托运','meal':'无餐食','note':'易斯达航空·廉航·行李另购'},
    'AQ':{'baggage':'无免费托运','meal':'无餐食','note':'九元航空·廉航·行李另购'},
}
DEFAULT_SVC = {'baggage':'1件×20kg','meal':'含餐','note':'标准服务'}

AIRLINE_COLORS = {
    '东方航空':'#2980b9','上海航空':'#c0392b','中国国航':'#e74c3c',
    '南方航空':'#27ae60','海南航空':'#8e44ad','吉祥航空':'#e67e22',
    '春秋航空':'#f39c12','厦门航空':'#2c3e50','四川航空':'#16a085',
    '深圳航空':'#d35400','山东航空':'#3498db','国泰航空':'#6c3483',
    '全日空':'#1a5276','大韩航空':'#1b4f72','新加坡航空':'#d4ac0d',
    '韩亚航空':'#5d6d7e','澳门航空':'#a93226','天津航空':'#138d75',
    '首都航空':'#e74c3c','日本航空':'#c0392b','河北航空':'#2e86c1',
    '昆明航空':'#7d3c98','西藏航空':'#5dade2','福州航空':'#f1948a',
    '成都航空':'#85c1e9','祥鹏航空':'#e59866','青岛航空':'#27ae60',
    '浙江长龙航空':'#2c3e50','捷星日本':'#f39c12','易斯达航空':'#e74c3c',
    '金鹏航空':'#5d6d7e','九元航空':'#f5b041',
}

# ─────────────────────────────────────────

def log(msg):
    ts = datetime.now().strftime('%H:%M:%S')
    print(f'[{ts}] {msg}')

def day_of_week(dt):
    return dt.isoweekday()

def schedule_to_days(s):
    if not s: return set(range(1,8))
    if ',' in s: return set(int(p) for p in s.split(',') if p.isdigit())
    return set(int(c) for c in s if c.isdigit())

def find_ret_date(dep_dt, flight2, nights):
    """计算回程日期：有班期按班期，无班期用晚数"""
    sched = CONFIRMED_SCHEDULES.get(flight2)
    if sched:
        days_set = schedule_to_days(sched)
        ret = dep_dt + timedelta(days=nights)
        for _ in range(14):
            if day_of_week(ret) in days_set: return ret
            ret += timedelta(days=1)
        return ret
    # 无班期数据，直接用晚数
    return dep_dt + timedelta(days=nights)

def extract_code(flight_no):
    if not flight_no: return 'XX'
    m = re.match(r'^([A-Z0-9][A-Z])', flight_no.strip())
    return m.group(1) if m else 'XX'

# ─────────────────────────────────────────

def load_schedule_csv():
    """加载最新的航班定义表CSV，返回 lookup dict"""
    csvs = sorted(glob.glob(str(HERE / '航班定义表*.CSV')))
    if not csvs:
        log('⚠️ 未找到航班定义表CSV')
        return {}, pd.DataFrame()
    path = csvs[-1]
    df = pd.read_csv(path)
    log(f'📂 {Path(path).name}: {len(df)}条')
    lookup = {}
    for _, row in df.iterrows():
        fn = str(row['航班号']).strip()
        dep = str(row['始发城市名']).strip()
        arr = str(row['到达城市名']).strip()
        dep_time = str(row['始发时间']).strip()[:5] if pd.notna(row['始发时间']) else ''
        arr_time = str(row['到达时间']).strip()[:5] if pd.notna(row['到达时间']) else ''
        dep_air = str(row['始发机场名']).strip() if pd.notna(row['始发机场名']) else ''
        arr_air = str(row['到达机场名']).strip() if pd.notna(row['到达机场名']) else ''
        # 多日期范围：记录所有有效日期区间
        start_d = str(row['开始日期']).strip() if pd.notna(row['开始日期']) else ''
        end_d = str(row['结束日期']).strip() if pd.notna(row['结束日期']) else ''
        key = (fn, dep, arr)
        if key not in lookup:
            lookup[key] = []
        lookup[key].append({
            'dep_time': dep_time, 'arr_time': arr_time,
            'dep_airport': dep_air, 'arr_airport': arr_air,
            'start_date': start_d, 'end_date': end_d,
        })
    log(f'   → {len(lookup)} 组(航班+城市)')
    return lookup, df

def get_schedule_info(flight_no, schedule_lookup, dep, dest):
    """从航班定义表获取某个航班的时刻信息（取最新/最匹配的）"""
    key = (flight_no, dep, dest)
    entries = schedule_lookup.get(key, [])
    if entries:
        # 取最后一条（最新的日期范围）
        e = entries[-1]
        return e['dep_time'], e['arr_time'], e['dep_airport'], e['arr_airport'], e['start_date'], e['end_date']
    return '', '', '', '', '', ''

# ─────────────────────────────────────────

def create_database(erp_df, sched_lookup):
    """创建SQLite数据库，返回 products 列表"""
    if DB_PATH.exists():
        DB_PATH.unlink()
    
    conn = sqlite3.connect(str(DB_PATH))
    c = conn.cursor()
    
    # 建表
    c.execute('''
        CREATE TABLE airlines (
            code TEXT PRIMARY KEY,
            name TEXT,
            baggage TEXT,
            meal TEXT,
            color TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE routes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dep TEXT NOT NULL,
            dest TEXT NOT NULL,
            airline_str TEXT,
            color TEXT,
            min_price REAL DEFAULT 0,
            max_price REAL DEFAULT 0,
            count INTEGER DEFAULT 0,
            UNIQUE(dep, dest)
        )
    ''')
    c.execute('''
        CREATE TABLE products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            route_id INTEGER,
            flight1 TEXT,
            flight2 TEXT,
            airline TEXT,
            airline_code TEXT,
            dep_date TEXT,
            ret_date TEXT,
            nights INTEGER,
            available INTEGER,
            price REAL,
            resource_price REAL,
            retail_price REAL,
            f1_dep_time TEXT,
            f1_arr_time TEXT,
            f1_dep_airport TEXT,
            f1_arr_airport TEXT,
            f2_dep_time TEXT,
            f2_arr_time TEXT,
            f2_dep_airport TEXT,
            f2_arr_airport TEXT,
            baggage TEXT,
            meal TEXT,
            f2_schedule TEXT,
            FOREIGN KEY (route_id) REFERENCES routes(id)
        )
    ''')
    c.execute('CREATE INDEX idx_products_dep_date ON products(dep_date)')
    c.execute('CREATE INDEX idx_products_available ON products(available)')
    c.execute('CREATE INDEX idx_products_route ON products(route_id)')
    
    # 填充 airlines
    for code, name in AIRLINE_MAP.items():
        svc = AIRLINE_SERVICES.get(code, DEFAULT_SVC)
        color = AIRLINE_COLORS.get(name, '#666')
        c.execute('INSERT OR IGNORE INTO airlines VALUES (?,?,?,?,?)',
                  (code, name, svc['baggage'], svc['meal'], color))
    
    conn.commit()
    
    # 处理数据
    rows_processed = 0
    rows_skipped = 0
    routes_cache = {}
    all_products = []
    
    for _, row in erp_df.iterrows():
        dep = str(row['始发城市名']).strip()
        dest = str(row['目的城市名']).strip()
        flight1 = str(row['航段1航班']).strip() if pd.notna(row['航段1航班']) else ''
        flight2 = str(row['航段2航班']).strip() if pd.notna(row['航段2航班']) else ''
        
        price = float(row['成人人民币价格']) if pd.notna(row['成人人民币价格']) else 0
        resource_price = float(row['资源价']) if pd.notna(row['资源价']) else 0
        retail_price = float(row['直客价']) if pd.notna(row['直客价']) else 0
        
        dep_date_str = str(row['去程日期']).strip() if pd.notna(row['去程日期']) else ''
        nights = int(row['晚数']) if pd.notna(row['晚数']) else 0
        available = int(row['可用']) if pd.notna(row['可用']) else 0
        
        main_price = int(retail_price) if retail_price > 0 else int(price)
        if main_price <= 0: continue
        
        # 航司信息
        code = extract_code(flight1)
        airline_name = AIRLINE_MAP.get(code, f'其他({code})')
        
        # 计算回程日期
        ret_date_str = ''
        dep_dt = None
        if dep_date_str:
            try:
                dep_dt = datetime.strptime(dep_date_str, '%Y-%m-%d')
                if flight2 and nights > 0:
                    ret_dt = find_ret_date(dep_dt, flight2, nights)
                    ret_date_str = ret_dt.strftime('%Y-%m-%d')
                elif nights > 0:
                    ret_dt = dep_dt + timedelta(days=nights)
                    ret_date_str = ret_dt.strftime('%Y-%m-%d')
            except:
                pass
        
        # 查询时刻
        f1_dt, f1_at, f1_da, f1_aa, _, _ = get_schedule_info(flight1, sched_lookup, dep, dest)
        f2_dt, f2_at, f2_da, f2_aa, _, _ = get_schedule_info(flight2, sched_lookup, dest, dep)
        
        svc = AIRLINE_SERVICES.get(code, DEFAULT_SVC)
        
        # 回程班期显示
        sched_info = CONFIRMED_SCHEDULES.get(flight2, '')
        day_names = ''
        if sched_info == '1234567': day_names = '每日'
        elif sched_info:
            dm = {'1':'一','2':'二','3':'三','4':'四','5':'五','6':'六','7':'日'}
            parts = sched_info.split(',')
            day_names = ','.join(dm.get(p,'?') for p in parts)
        
        # 航线主键
        route_key = f'{dep}→{dest}'
        
        all_products.append({
            'route_key': route_key, 'dep': dep, 'dest': dest,
            'flight1': flight1, 'flight2': flight2,
            'airline': airline_name, 'airline_code': code,
            'dep_date': dep_date_str, 'ret_date': ret_date_str,
            'nights': nights, 'available': available,
            'price': int(price), 'resource_price': int(resource_price),
            'retail_price': main_price,
            'f1_dep_time': f1_dt, 'f1_arr_time': f1_at,
            'f1_dep_airport': f1_da, 'f1_arr_airport': f1_aa,
            'f2_dep_time': f2_dt, 'f2_arr_time': f2_at,
            'f2_dep_airport': f2_da, 'f2_arr_airport': f2_aa,
            'baggage': svc['baggage'], 'meal': svc['meal'],
            'f2_schedule': day_names,
        })
        rows_processed += 1
    
    # 写入数据库
    route_ids = {}
    seen_routes = {}
    for p in all_products:
        rk = p['route_key']
        if rk not in seen_routes:
            seen_routes[rk] = {
                'dep': p['dep'], 'dest': p['dest'],
                'airlines': set(), 'flights': set(),
                'min_price': float('inf'), 'max_price': 0,
                'count': 0,
            }
        sr = seen_routes[rk]
        sr['airlines'].add(p['airline'])
        if p['flight1']: sr['flights'].add(p['flight1'])
        if p['flight2']: sr['flights'].add(p['flight2'])
        sr['min_price'] = min(sr['min_price'], p['retail_price'])
        sr['max_price'] = max(sr['max_price'], p['retail_price'])
        sr['count'] += 1
    
    for rk, sr in seen_routes.items():
        color = AIRLINE_COLORS.get(next(iter(sr['airlines'])), '#666')
        c.execute(
            'INSERT INTO routes (dep, dest, airline_str, color, min_price, max_price, count) VALUES (?,?,?,?,?,?,?)',
            (sr['dep'], sr['dest'], ','.join(sorted(sr['airlines'])), color,
             sr['min_price'], sr['max_price'], sr['count'])
        )
        route_ids[rk] = c.lastrowid
    
    for p in all_products:
        c.execute('''
            INSERT INTO products (route_id, flight1, flight2, airline, airline_code,
                dep_date, ret_date, nights, available, price, resource_price, retail_price,
                f1_dep_time, f1_arr_time, f1_dep_airport, f1_arr_airport,
                f2_dep_time, f2_arr_time, f2_dep_airport, f2_arr_airport,
                baggage, meal, f2_schedule)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ''', (
            route_ids[p['route_key']], p['flight1'], p['flight2'],
            p['airline'], p['airline_code'],
            p['dep_date'], p['ret_date'], p['nights'], p['available'],
            p['price'], p['resource_price'], p['retail_price'],
            p['f1_dep_time'], p['f1_arr_time'], p['f1_dep_airport'], p['f1_arr_airport'],
            p['f2_dep_time'], p['f2_arr_time'], p['f2_dep_airport'], p['f2_arr_airport'],
            p['baggage'], p['meal'], p['f2_schedule'],
        ))
    
    conn.commit()
    
    # 统计
    c.execute('SELECT COUNT(*) FROM products')
    prod_count = c.fetchone()[0]
    c.execute('SELECT COUNT(*) FROM routes')
    route_count = c.fetchone()[0]
    c.execute('SELECT COUNT(*) FROM airlines')
    air_count = c.fetchone()[0]
    
    conn.close()
    
    log(f'✅ 数据库已创建: {DB_PATH.name}')
    log(f'   航线: {route_count}, 产品: {prod_count}, 航司: {air_count}')
    
    return all_products, seen_routes

# ─────────────────────────────────────────

def export_json(all_products, seen_routes):
    """导出 flight_data.json 供H5使用"""
    output = []
    for rk, sr in seen_routes.items():
        items = [p for p in all_products if p['route_key'] == rk]
        items.sort(key=lambda x: x['retail_price'])
        
        # 航线航司颜色
        first_airline = next(iter(sr['airlines']), '')
        first_code = extract_code(list(sr['flights'])[0]) if sr['flights'] else ''
        color = AIRLINE_COLORS.get(first_airline, '#666')
        
        airline_str = ','.join(sorted(sr['airlines']))
        airline_codes = set()
        for f in sr['flights']:
            airline_codes.add(extract_code(f))
        
        route_items = []
        for p in items:
            route_items.append({
                'flight1': p['flight1'], 'flight2': p['flight2'],
                'airline': p['airline'], 'airline_code': p['airline_code'],
                'dep_date': p['dep_date'], 'ret_date': p['ret_date'],
                'nights': p['nights'], 'available': p['available'],
                'price': p['price'], 'resource_price': p['resource_price'],
                'retail_price': p['retail_price'],
                'f1_dep_time': p['f1_dep_time'], 'f1_arr_time': p['f1_arr_time'],
                'f1_dep_airport': p['f1_dep_airport'], 'f1_arr_airport': p['f1_arr_airport'],
                'f2_dep_time': p['f2_dep_time'], 'f2_arr_time': p['f2_arr_time'],
                'f2_dep_airport': p['f2_dep_airport'], 'f2_arr_airport': p['f2_arr_airport'],
                'baggage': p['baggage'], 'meal': p['meal'],
                'f2_schedule': p['f2_schedule'],
                'dayDiff': (datetime.strptime(p['dep_date'],'%Y-%m-%d') - datetime.now()).days if p['dep_date'] else 0,
            })
        
        output.append({
            'route': rk, 'dep': sr['dep'], 'dest': sr['dest'],
            'airline_str': airline_str,
            'airline_codes': list(airline_codes),
            'color': color,
            'min_price': sr['min_price'], 'max_price': sr['max_price'],
            'count': sr['count'],
            'items': route_items,
        })
    
    with open(JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    total = sum(r['count'] for r in output)
    log(f'✅ 已导出 {len(output)} 条航线, {total} 个产品 → {JSON_PATH.name}')

# ─────────────────────────────────────────

def print_summary(all_products, schedule_df):
    """打印数据库统计摘要"""
    print()
    print('=' * 60)
    print('  环球数据库 摘要')
    print('=' * 60)
    
    # 按航线分组
    routes_summary = {}
    for p in all_products:
        k = p['route_key']
        if k not in routes_summary:
            routes_summary[k] = {'dep': p['dep'], 'dest': p['dest'], 'count': 0,
                                  'min_p': float('inf'), 'max_p': 0}
        rs = routes_summary[k]
        rs['count'] += 1
        rs['min_p'] = min(rs['min_p'], p['retail_price'])
        rs['max_p'] = max(rs['max_p'], p['retail_price'])
    
    # 按区域分类
    regions = {
        '日本': ['东京','大阪','冲绳','福冈','札幌'],
        '韩国': ['首尔','济州岛','釜山','清州'],
        '东南亚': ['普吉','曼谷','巴厘岛','沙巴','新加坡','富国岛','清迈'],
        '港澳': ['香港','澳门'],
    }
    for reg_name, kws in regions.items():
        reg_routes = [(k,v) for k,v in routes_summary.items() if any(kw in v['dest'] for kw in kws)]
        if reg_routes:
            total_items = sum(v['count'] for _,v in reg_routes)
            log(f'{reg_name}: {len(reg_routes)}条航线 / {total_items}个产品')
    
    # 时刻表覆盖
    with_sched = sum(1 for p in all_products if p['f1_dep_time'])
    with_ret_sched = sum(1 for p in all_products if p['flight2'] and p['f2_dep_time'])
    total_round = sum(1 for p in all_products if p['flight2'])
    log(f'时刻覆盖: 去程{with_sched}/{len(all_products)} ({with_sched*100//len(all_products)}%)')
    log(f'         回程{with_ret_sched}/{total_round} ({with_ret_sched*100//max(total_round,1)}%)')
    
    print('=' * 60)

# ─────────────────────────────────────────

def main():
    print()
    log('🌍 环球数据库 v2 - 构建器')
    print()
    
    # ① 读取ERP CSV
    csvs = sorted(glob.glob(str(HERE / '原始全数据包含直客价*.CSV')))
    if not csvs:
        log('❌ 未找到ERP数据CSV')
        sys.exit(1)
    erp_path = csvs[-1]
    erp_df = pd.read_csv(erp_path)
    erp_df = erp_df[erp_df['成人人民币价格'] > 100]
    erp_df = erp_df[erp_df['可用'] > 0]
    log(f'📂 {Path(erp_path).name}: {len(erp_df)}条有效记录')
    
    # ② 加载时刻表
    sched_lookup, sched_df = load_schedule_csv()
    
    # ③ 创建数据库
    all_products, seen_routes = create_database(erp_df, sched_lookup)
    
    # ④ 导出JSON
    export_json(all_products, seen_routes)
    
    # ⑤ 打印摘要
    print_summary(all_products, sched_df)
    
    log('🎉 构建完成!')

if __name__ == '__main__':
    main()
