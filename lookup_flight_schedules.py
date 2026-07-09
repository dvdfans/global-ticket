#!/usr/bin/env python3
"""
从 flightmapper.net 查询回程航班实际班期，补正经的回程日期
"""
import pandas as pd, json, glob, re, os, sys, time, urllib.request, urllib.error
from datetime import datetime, timedelta

# 航司代码 → flightmapper 名称映射
AIRLINE_MAP = {
    'MU':'China_Eastern', 'FM':'Shanghai_Airlines', 'CA':'Air_China',
    'CZ':'China_Southern', 'HU':'Hainan_Airlines', '3U':'Sichuan_Airlines',
    'ZH':'Shenzhen_Airlines', 'SC':'Shandong_Airlines', 'MF':'Xiamen_Airlines',
    'HO':'Juneyao_Airlines', '9C':'Spring_Airlines', 'GS':'Tianjin_Airlines',
    'JD':'Beijing_Capital_Airlines', 'AQ':'Nine_Air', 'DZ':'Donghai_Airlines',
    'KN':'China_United_Airlines', 'GJ':'Loong_Air', 'NS':'Hebei_Airlines',
    'QW':'Qingdao_Airlines', 'KY':'Kunming_Airlines', 'EU':'Chengdu_Airlines',
    'PN':'West_Air', 'GT':'Guilin_Airlines', 'JR':'Joy_Air',
    '8L':'Lucky_Air', 'TV':'Tibet_Airlines', 'FU':'Fuzhou_Airlines',
    'GK':'Jetstar_Japan', 'JL':'Japan_Airlines', 'KE':'Korean_Air',
    'OZ':'Asiana_Airlines', 'SQ':'Singapore_Airlines', 'NX':'Air_Macau',
    'CX':'Cathay_Pacific', 'NH':'All_Nippon_Airways', 'ZE':'Eastar_Jet',
    'Y8':'Suparna_Airlines', '9C':'Spring_Airlines',
}

def parse_schedule(text):
    """从flightmapper页面文本中提取运营日"""
    # 查找 "每日" (daily)
    if '每日' in text:
        return '1234567'  # 每天
    # 查找类似 "一,三,五" 或 "一-三,五" 的格式
    day_map = {'一':'1','二':'2','三':'3','四':'4','五':'5','六':'6','日':'7'}
    result_days = set()
    # 找类似 "一,三,五" 的pattern
    patterns = re.findall(r'[\u4e00-\u4e9f\u663c][\u4e00-\u4e9f\u663c,\-]*[\u4e00-\u4e9f\u663c]', text)
    for pat in patterns:
        days = set()
        parts = pat.split(',')
        for part in parts:
            part = part.strip()
            if '-' in part:
                start, end = part.split('-')
                start_idx = list(day_map.keys()).index(start.strip()) if start.strip() in day_map else -1
                end_idx = list(day_map.keys()).index(end.strip()) if end.strip() in day_map else -1
                if start_idx >= 0 and end_idx >= 0:
                    for i in range(start_idx, end_idx+1):
                        days.add(str(i+1))
            elif part in day_map:
                days.add(day_map[part])
        if days:
            result_days.update(days)
    if result_days:
        return ''.join(sorted(result_days))
    return None

def fetch_schedule(flight_no, airline_code):
    """查询单个航班的班期"""
    fm_name = AIRLINE_MAP.get(airline_code, airline_code)
    url = f"https://info.flightmapper.net/zh-CN/flight/{fm_name}_{airline_code}_{flight_no[len(airline_code):]}"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    }
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode('utf-8', errors='replace')
        
        # 提取标题判断是否成功
        if '很抱歉' in html[:500]:
            print(f'    ⚠️ {flight_no}: flightmapper无数据')
            return None
        
        # 提取运营日
        result = parse_schedule(html)
        if result:
            return result
        else:
            print(f'    ⚠️ {flight_no}: 未解析到班期')
            return None
    except Exception as e:
        print(f'    ❌ {flight_no}: {type(e).__name__}: {str(e)[:60]}')
        return None

def main():
    # 读取CSV
    csv = sorted(glob.glob('原始全数据包含直客价*.CSV'))
    if not csv:
        print('❌ 没找到CSV')
        sys.exit(1)
    df = pd.read_csv(csv[-1])
    
    # 过滤有效记录
    df = df[df['成人人民币价格'] > 100]
    df = df[df['可用'] > 0]
    
    # 找出有回程航班号的唯一条目
    has_f2 = df[df['航段2航班'].notna() & (df['航段2航班'].str.strip()!='')]
    unique_f2 = sorted(has_f2['航段2航班'].unique())
    
    print(f'需要查询 {len(unique_f2)} 个回程航班班期')
    
    # 逐批查询（每批间隔1秒防封锁）
    schedules = {}  # {flight_no: schedule_string}
    for i, f2 in enumerate(unique_f2):
        # 提取航司代码
        m = re.match(r'([A-Z]+)', f2)
        code = m.group(1) if m else ''
        print(f'[{i+1}/{len(unique_f2)}] 查询 {f2} (航司:{code})...', end=' ')
        
        sched = fetch_schedule(f2, code)
        if sched:
            schedules[f2] = sched
            print(f'✅ 班期: {sched}')
        else:
            schedules[f2] = None
            print(f'❌ 查询失败')
        
        time.sleep(1.5)  # 礼貌间隔
    
    # 保存查询结果
    result_path = 'flight_schedules.json'
    with open(result_path, 'w', encoding='utf-8') as f:
        json.dump(schedules, f, ensure_ascii=False, indent=2)
    
    # 统计
    found = sum(1 for v in schedules.values() if v)
    print(f'\n✅ 查询完成: {found}/{len(unique_f2)} 个航班班期已获取')
    print(f'   已保存到 {result_path}')

if __name__ == '__main__':
    main()
