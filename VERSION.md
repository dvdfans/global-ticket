# H5 前端版本管理

## 已创建 Git 仓库
`C:\Users\Howard\WorkBuddy\PriceQuote\output\sandbox\.git`

## 每次修改后提交
```bash
cd C:\Users\Howard\WorkBuddy\PriceQuote\output\sandbox
git add -A
git commit -m "描述这次改了什么"
```

## 查看历史
```bash
git log --oneline
git diff         # 看未提交的改动
```

## 回退到某版本
```bash
git log --oneline                    # 看commit ID
git checkout <commit-id> -- app.js   # 恢复单个文件
git reset --hard <commit-id>         # 整个回退
```

## 已提交版本
| commit | 说明 |
|:-------|:-----|
| v1.0   | 初始版本: 分级卡片+详情+深链分享+LOGO配色+开源字体 |
| v3.2   | 报价卡片排版优化: hmCard/cardHTML全新设计, 余位徽章, 供应商渐变底色, 层次分明的布局 |
| v4.5   | 统一天数=晚数+1（供应商住宿晚数/ERP行程晚数通用），去程红眼+2 |

## 数据库文件不纳入版本管理
`price_db.json` 和 `price_db_fe.json` 每日自动生成，已被 .gitignore 排除。
