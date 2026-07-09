#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
统一ERP爬虫 — MergedPipeline 共享版
用法: python lib/shared_ivision_crawl.py [--output-dir=erp]
"""
import asyncio, io, os, sys, re, argparse
from datetime import datetime, timedelta
from pathlib import Path
import pandas as pd

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

parser = argparse.ArgumentParser()
parser.add_argument('--output-dir', default=None)
args = parser.parse_args()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = args.output_dir if args.output_dir else os.path.join(BASE_DIR, 'erp')

CUSTOM_CHROME_PATH = r"C:\Users\Howard\WorkBuddy\chrome-win\chrome.exe"
DOMAIN = "ivision.com.cn"
TARGET_IP = "47.100.75.142"
URL_LOGIN = f"http://{DOMAIN}/cmsweb/Default_ivision.htm"
URL_REPORT = f"http://{DOMAIN}/cmsweb/cmsreport/CmsTableReportWithHeader.aspx?mnuresid=256925974312&mtshostid=629046504613"
URL_SCHEDULE = f"http://{DOMAIN}/cmsweb/cmsreport/CmsTableReportWithHeader.aspx?mnuresid=336684462515&mtshostid=810338624761"
USERNAME = "yt_chen_h"
PASSWORD = "3edc1qaz&UJM"
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
TIMEOUT_SEC = 600
CHECK_INTERVAL_MS = 3000
BROWSER_HEADLESS = True
SLOW_MO = 300


def log(msg):
    line = f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    try:
        print(line)
    except UnicodeEncodeError:
        print(line.encode('utf-8', errors='replace').decode('utf-8', errors='replace'))


def calc_prices(p):
    try:
        p = float(p)
    except:
        return (0, 0)
    if p < 1800:
        return (p + 100, p + 200)
    elif p < 2700:
        return (p + 150, p + 300)
    elif p < 3600:
        return (p + 200, p + 400)
    elif p < 4500:
        return (p + 250, p + 500)
    elif p < 5400:
        return (p + 300, p + 600)
    elif p < 6300:
        return (p + 350, p + 700)
    elif p <= 9999:
        return (p + 500, p + 1000)
    return (0, 0)


async def collect(mode: str, page) -> bool:
    """
    采集数据核心逻辑（登录→报表→提取→保存）。
    mode: 'ip' 或 'dns'
    返回 True=成功, False=失败
    """
    try:
        # ── 登录 ──
        log(f"[{mode}] 打开登录页...")
        await page.goto(URL_LOGIN, timeout=30000)
        await page.wait_for_load_state("domcontentloaded")
        await page.fill("#user", USERNAME, timeout=5000)
        await page.fill("#upass", PASSWORD, timeout=5000)
        await page.press("#upass", "Enter")
        await page.wait_for_timeout(5000)

        login_url = page.url
        log(f"[{mode}] 登录后 URL: {login_url}")
        if "Default_ivision.htm" in login_url:
            # 备选选择器
            try:
                await page.fill("input[name='user']", USERNAME, timeout=3000)
                await page.fill("input[name='upass']", PASSWORD, timeout=3000)
                await page.press("input[name='upass']", "Enter")
                await page.wait_for_timeout(5000)
                log(f"[{mode}] 备选登录后: {page.url}")
            except Exception as e:
                log(f"[{mode}] 备选登录也失败: {e}")
                return False

        # ── 打开报表页 ──
        log(f"[{mode}] 打开报表页...")
        await page.goto(URL_REPORT, timeout=60000)
        await page.wait_for_load_state("domcontentloaded")
        await page.wait_for_timeout(3000)

        # ── 点击刷新报表 ──
        log(f"[{mode}] 点击刷新报表...")
        refresh_selectors = [
            "text=刷新报表",
            "text=刷 新 报 表",
            "input[value*='刷新']",
            "button:has-text('刷新')",
            "#btnRefresh",
            "#btnQuery",
            "text=查询",
        ]
        clicked = False
        for sel in refresh_selectors:
            try:
                await page.click(sel, timeout=3000)
                log(f"[{mode}] 已点击: {sel}")
                clicked = True
                break
            except Exception:
                continue

        if not clicked:
            try:
                btns = await page.locator(
                    "button, input[type='button'], input[type='submit']"
                ).all()
                for btn in btns:
                    txt = await btn.text_content(timeout=1000)
                    if txt and ("刷新" in txt or "查询" in txt or "生成" in txt):
                        await btn.click()
                        log(f"[{mode}] 兜底点击: {txt.strip()}")
                        clicked = True
                        break
            except Exception:
                pass

        if not clicked:
            log(f"[{mode}] 找不到刷新按钮")
            return False

        # ── 等待报表生成 ──
        log(f"[{mode}] 等待报表生成...")
        start_time = datetime.now()
        report_found = False
        while True:
            elapsed = (datetime.now() - start_time).seconds
            if elapsed > TIMEOUT_SEC:
                log(f"[{mode}] 报表生成超时 ({elapsed}秒)")
                return False

            try:
                tables = await page.locator("table").all()
                for table in tables:
                    rows = await table.locator("tr").count()
                    if rows > 1:
                        cells = await table.locator("td").count()
                        if cells > 0:
                            log(
                                f"[{mode}] 报表就绪! {rows}行, {cells}单元格"
                            )
                            report_found = True
                            break
            except Exception:
                pass

            if report_found:
                break
            await page.wait_for_timeout(CHECK_INTERVAL_MS)

        # ── 提取HTML数据 ──
        log(f"[{mode}] 提取数据...")
        html_content = ""
        try:
            table = page.locator("#DataGrid1")
            if await table.count() > 0:
                html_content = await table.first.inner_html()
                row_count = html_content.count("<tr")
                log(f"[{mode}] #DataGrid1提取成功, {row_count}行")
                html_content = f"<table>{html_content}</table>"
        except Exception:
            pass

        if not html_content:
            try:
                tables = await page.locator("table").all()
                best_html, best_rows = "", 0
                for t in tables:
                    try:
                        h = await t.inner_html(timeout=3000)
                        if "<input" in h:
                            continue
                        rows = h.count("<tr>")
                        if rows > best_rows:
                            best_html, best_rows = h, rows
                    except Exception:
                        continue
                if best_html:
                    log(f"[{mode}] 排除表单后提取, {best_rows}行")
                    html_content = f"<table>{best_html}</table>"
            except Exception:
                pass

        if not html_content:
            log(f"[{mode}] HTML提取失败")
            return False

        # ── 解析 DataFrame ──
        tables = pd.read_html(io.StringIO(html_content))
        df = max(tables, key=lambda x: x.shape[0]) if tables else pd.DataFrame()
        if df.empty:
            log(f"[{mode}] 数据解析为空")
            return False

        # 修复列名
        if all(isinstance(c, int) for c in df.columns):
            first_row = df.iloc[0].tolist()
            clean_cols = [
                str(c).strip().replace(" ", "") if pd.notna(c) else f"col{i+1}"
                for i, c in enumerate(first_row)
            ]
            df.columns = clean_cols
            df = df.iloc[1:].reset_index(drop=True)

        # 计算资源价/直客价
        if "成人人民币价格" in df.columns:
            df[["资源价", "直客价"]] = df["成人人民币价格"].apply(
                lambda x: pd.Series(calc_prices(x)) if pd.notna(x) else pd.Series([0, 0])
            )

        # ── 保存CSV ──
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        csv_path = os.path.join(OUTPUT_DIR, f"原始全数据包含直客价{timestamp}.CSV")
        df.to_csv(csv_path, index=False, encoding="utf-8-sig")
        log(f"[{mode}] 已保存: {os.path.basename(csv_path)} ({df.shape[0]}行x{df.shape[1]}列)")
        return True

    except Exception as e:
        log(f"[{mode}] 采集异常: {type(e).__name__}: {e}")
        return False


async def collect_schedule(mode: str, page) -> bool:
    """
    采集航班定义表（登录→打开定义表→刷新→提取→保存）。
    """
    try:
        # ── 登录（如果当前未登录）──
        current_url = page.url
        if "Default_ivision.htm" in current_url or "login" in current_url.lower():
            log(f"[{mode}] 登录...")
            try:
                await page.fill("#user", USERNAME, timeout=5000)
                await page.fill("#upass", PASSWORD, timeout=5000)
                await page.press("#upass", "Enter")
                await page.wait_for_timeout(5000)
            except:
                try:
                    await page.fill("input[name='user']", USERNAME, timeout=3000)
                    await page.fill("input[name='upass']", PASSWORD, timeout=3000)
                    await page.press("input[name='upass']", "Enter")
                    await page.wait_for_timeout(5000)
                except Exception as e:
                    log(f"[{mode}] 登录失败: {e}")
                    return False

        # ── 打开航班定义表 ──
        log(f"[{mode}] 打开航班定义表...")
        await page.goto(URL_SCHEDULE, timeout=60000)
        await page.wait_for_load_state("domcontentloaded")
        await page.wait_for_timeout(3000)

        # ── 点击刷新报表 ──
        log(f"[{mode}] 点击刷新报表...")
        refresh_selectors = [
            "text=刷新报表", "text=刷 新 报 表",
            "input[value*='刷新']", "button:has-text('刷新')",
            "#btnRefresh", "#btnQuery", "text=查询",
        ]
        clicked = False
        for sel in refresh_selectors:
            try:
                await page.click(sel, timeout=3000)
                log(f"[{mode}] 已点击: {sel}")
                clicked = True
                break
            except Exception:
                continue

        if not clicked:
            try:
                btns = await page.locator("button, input[type='button'], input[type='submit']").all()
                for btn in btns:
                    txt = await btn.text_content(timeout=1000)
                    if txt and ("刷新" in txt or "查询" in txt or "生成" in txt):
                        await btn.click()
                        clicked = True
                        break
            except Exception:
                pass

        if not clicked:
            log(f"[{mode}] 找不到刷新按钮")
            return False

        # ── 等待报表生成 ──
        log(f"[{mode}] 等待报表生成...")
        start_time = datetime.now()
        report_found = False
        while True:
            elapsed = (datetime.now() - start_time).seconds
            if elapsed > TIMEOUT_SEC:
                log(f"[{mode}] 报表生成超时")
                return False
            try:
                tables = await page.locator("table").all()
                for table in tables:
                    rows = await table.locator("tr").count()
                    if rows > 1:
                        cells = await table.locator("td").count()
                        if cells > 0:
                            log(f"[{mode}] 报表就绪! {rows}行, {cells}单元格")
                            report_found = True
                            break
            except Exception:
                pass
            if report_found:
                break
            await page.wait_for_timeout(CHECK_INTERVAL_MS)

        # ── 提取HTML数据 ──
        log(f"[{mode}] 提取数据...")
        html_content = ""
        try:
            table = page.locator("#DataGrid1")
            if await table.count() > 0:
                html_content = await table.first.inner_html()
                html_content = f"<table>{html_content}</table>"
        except Exception:
            pass

        if not html_content:
            try:
                tables = await page.locator("table").all()
                best_html, best_rows = "", 0
                for t in tables:
                    try:
                        h = await t.inner_html(timeout=3000)
                        if "<input" in h: continue
                        rows = h.count("<tr>")
                        if rows > best_rows:
                            best_html, best_rows = h, rows
                    except Exception:
                        continue
                if best_html:
                    html_content = f"<table>{best_html}</table>"
            except Exception:
                pass

        if not html_content:
            log(f"[{mode}] HTML提取失败")
            return False

        # ── 解析 DataFrame ──
        tables = pd.read_html(io.StringIO(html_content))
        df = max(tables, key=lambda x: x.shape[0]) if tables else pd.DataFrame()
        if df.empty:
            log(f"[{mode}] 数据解析为空")
            return False

        # 修复列名
        if all(isinstance(c, int) for c in df.columns):
            first_row = df.iloc[0].tolist()
            clean_cols = [
                str(c).strip().replace(" ", "") if pd.notna(c) else f"col{i+1}"
                for i, c in enumerate(first_row)
            ]
            df.columns = clean_cols
            df = df.iloc[1:].reset_index(drop=True)

        # 期望列: 航班定义号 航班号 开始日期 结束日期 始发城市名 到达城市名 始发机场名 到达机场名 始发时间 到达时间 修改人 修改时间
        log(f"[{mode}] 航班定义表: {df.shape[0]}行 x {df.shape[1]}列")
        log(f"[{mode}] 列名: {list(df.columns)}")

        # ── 保存 ──
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        csv_path = os.path.join(OUTPUT_DIR, f"航班定义表{timestamp}.CSV")
        df.to_csv(csv_path, index=False, encoding="utf-8-sig")
        log(f"[{mode}] 已保存: {os.path.basename(csv_path)} ({df.shape[0]}行)")
        return True

    except Exception as e:
        log(f"[{mode}] 航班定义表采集异常: {type(e).__name__}: {e}")
        return False


async def main():
    print("=" * 60)
    log("iVision ERP 数据采集 — 统一版")
    print("=" * 60)

    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        collected = False
        collected_schedule = False

        # ── 模式1: IP直连（首选）──
        log("─── [模式1] IP直连采集 ───")
        log(f"  域名: {DOMAIN} → IP: {TARGET_IP}")
        try:
            launch_kwargs = dict(
                headless=BROWSER_HEADLESS,
                slow_mo=SLOW_MO,
                args=[f"--host-resolver-rules=MAP {DOMAIN} {TARGET_IP}"],
            )
            if os.path.exists(CUSTOM_CHROME_PATH):
                launch_kwargs["executable_path"] = CUSTOM_CHROME_PATH
            browser1 = await p.chromium.launch(**launch_kwargs)
            page1 = await browser1.new_page(
                viewport={"width": 1920, "height": 1080}
            )
            # 采集ERP数据
            collected = await collect("IP", page1)
            # 采集航班定义表（复用同一浏览器会话）
            if collected:
                log("")
                log("─── 采集航班定义表 ───")
                collected_schedule = await collect_schedule("IP", page1)
            await browser1.close()
        except Exception as e:
            log(f"[IP] 浏览器启动失败: {e}")
            try:
                await browser1.close()
            except:
                pass

        # ── 模式2: 域名DNS（备用）──
        if not collected:
            url_tested = URL_LOGIN.replace("http://", "http://")
            log("")
            log(f"─── [模式2] 域名DNS采集（备用）───")
            log(f"  域名: {DOMAIN} (标准DNS解析)")
            try:
                launch_kwargs = dict(
                    headless=BROWSER_HEADLESS, slow_mo=SLOW_MO
                )
                if os.path.exists(CUSTOM_CHROME_PATH):
                    launch_kwargs["executable_path"] = CUSTOM_CHROME_PATH
                browser2 = await p.chromium.launch(**launch_kwargs)
                page2 = await browser2.new_page(
                    viewport={"width": 1920, "height": 1080}
                )
                collected = await collect("DNS", page2)
                if collected:
                    log("")
                    log("─── 采集航班定义表(DNS) ───")
                    if not collected_schedule:
                        collected_schedule = await collect_schedule("DNS", page2)
                await browser2.close()
            except Exception as e:
                log(f"[DNS] 浏览器启动失败: {e}")
                try:
                    await browser2.close()
                except:
                    pass

        # ── 结果 ──
        print("=" * 60)
        if collected:
            log("✅ ERP数据采集成功!")
        else:
            log("❌ ERP数据采集失败（IP直连和域名DNS均不可用）")
            log("  请检查 ivision.com.cn 是否可访问")
            sys.exit(1)
        if collected_schedule:
            log("✅ 航班定义表采集成功!")
        else:
            log("⚠️ 航班定义表采集失败（不影响主数据）")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
