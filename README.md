# 碳酸锂(LC)产业看板

自动更新于 **https://algo23-yunqingtian.github.io/lithium-dashboard/**

## 功能
- 📈 K线图（OHLC + 成交量 + 持仓 + MA均线）
- 📅 笔记日历（利多绿/利空红/中性黄）
- 📝 笔记CRUD（跨域→服务器API）
- 📊 价差分析 / 期限结构
- 🏭 基本面指数 / 库存变化
- 🤖 博弈Agent持仓与观点
- 📡 市场信号

## 架构
- **前端**: GitHub Pages 纯静态托管
- **数据**: 服务器cron每天18:00导出 → data.json → git push
- **笔记API**: 服务器Flask后端 + CORS跨域

## 本地访问
http://124.221.113.37:8766/lithium-gh/

## 更新频率
工作日 18:00 自动更新（cron: `碳酸锂看板每日数据更新`）

## 关联仓库
- [nickel-dashboard](https://github.com/algo23-yunqingtian/nickel-dashboard) - 镍产业看板