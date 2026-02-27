# Manifold Markets Telegram 机器人

一个用于与 [Manifold Markets](https://manifold.markets) 预测市场交互的 Telegram 机器人，支持 AI 智能分析功能和自动化运营。

## 功能特点

### 核心功能
- 🔍 **搜索话题** - 搜索和浏览 Manifold 预测市场话题
- 💰 **投注下注** - 对任意话题进行 YES/NO 下注（使用 M$ 虚拟币）
- 📊 **查询结果** - 查看话题解决状态和结果
- 💳 **钱包管理** - 查看余额和投资组合
- 🤖 **AI 分析** - AI 驱动的市场分析（支持腾讯混元、智谱 GLM 等兼容 API）
- 💾 **用户记忆** - AI 记住对话历史

### 🆕 自动化运营功能
- 🔥 **热点推送** - 每天 10:00 自动推送热点事件到群组
- 🎯 **议题生成** - 每天 22:00 自动收集讨论并生成预测议题
- 📈 **市场创建** - 自动在 Manifold 创建预测市场
- 👥 **群组管理** - 支持多群组独立运营
- 📊 **数据统计** - 实时统计群组活跃度

### 高并发支持
- ⚡ 支持 1000+ 群组同时使用
- 🚀 支持 100,000+ 并发用户
- 💾 海量数据存储优化
- 🔄 批量消息推送

## 命令列表

### 基础命令

| 命令 | 说明 |
|------|------|
| `/start` | 开始使用机器人 |
| `/help` | 显示帮助信息 |
| `/markets [关键词]` | 搜索预测话题 |
| `/market <ID>` | 查看话题详情 |
| `/bet <ID> <YES/NO> <金额>` | 下注（金额单位 M$） |
| `/sell <ID> <YES/NO> [股数]` | 卖出股份 |
| `/result <ID>` | 查询话题结果 |
| `/wallet` | 查看钱包余额 |
| `/portfolio` | 查看投资组合 |
| `/setkey <API Key>` | 设置 Manifold API Key |
| `/history` | 查看下注历史 |
| `/ai <问题>` | 与 AI 助手对话 |
| `/analyze <ID>` | AI 智能分析话题 |

### 群组管理命令

| 命令 | 说明 | 权限 |
|------|------|------|
| `/groupinfo` | 查看群组信息 | 所有用户 |
| `/enable` | 启用群组自动推送 | 管理员 |
| `/disable` | 禁用群组自动推送 | 管理员 |
| `/config <设置> <值>` | 配置群组设置 | 管理员 |
| `/stats` | 查看群组统计 | 所有用户 |

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并填写配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# Telegram Bot Token
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Telegram Proxy (可选)
TELEGRAM_PROXY=http://127.0.0.1:7897

# AI Configuration
AI_API_URL=https://api.hunyuan.cloud.tencent.com/v1/chat/completions
AI_API_KEY=your_ai_api_key_here
AI_MODEL=hunyuan-turbos-latest

# Bot Admin API Key (用于创建市场)
BOT_ADMIN_API_KEY=your_manifold_api_key_here
```

### 3. 运行机器人

```bash
# 前台运行
python -m bot.main

# 后台运行
bash start.sh start

# 查看状态
bash start.sh status

# 查看日志
bash start.sh logs

# 停止运行
bash start.sh stop
```

## 使用流程

### 私聊使用

1. **设置 API Key**
   ```
   /setkey your_manifold_api_key
   ```

2. **搜索话题**
   ```
   /markets 特朗普
   ```

3. **查看详情**
   ```
   /market abc123
   ```

4. **下注**
   ```
   /bet abc123 YES 100
   ```

### 群聊使用

#### 管理员设置

1. **将机器人添加到群聊**

2. **启用群组**
   ```
   /enable
   ```

3. **配置推送时间**（可选）
   ```
   /config morning 10:00
   /config evening 22:00
   ```

#### 用户使用

1. **私聊设置 API Key**
   - 点击机器人头像
   - 开始私聊
   - 执行 `/setkey your_api_key`

2. **在群聊中使用命令**
   ```
   /bet abc123 YES 100
   ```

## 自动化流程

### 每天 10:00 - 热点推送

```
流程:
1. AI 搜索当前热点事件
2. 生成讨论话题
3. 推送到所有启用的群组
```

### 每天 22:00 - 议题生成

```
流程:
1. 收集当天群组讨论记录
2. AI 分析讨论内容
3. 生成预测议题
4. 在 Manifold 创建市场
5. 推送到对应群组
```

## 技术架构

详细技术架构请查看 [ARCHITECTURE.md](./ARCHITECTURE.md)

### 技术栈

- **语言**: Python 3.11+
- **Telegram Bot API**: python-telegram-bot v21.0
- **AI 集成**: 腾讯混元 API（兼容 OpenAI 格式）
- **数据库**: SQLite (开发) / PostgreSQL (生产)
- **缓存**: Redis (可选)
- **任务调度**: APScheduler
- **HTTP 客户端**: aiohttp

### 项目结构

```
manifold-telegram-bot/
├── bot/
│   ├── handlers/              # 命令处理器
│   │   ├── start.py          # /start, /help 命令
│   │   ├── markets.py        # /markets, /market 命令
│   │   ├── bet.py            # /bet, /sell 命令
│   │   ├── wallet.py         # /wallet, /portfolio 命令
│   │   ├── result.py         # /result 命令
│   │   ├── ai_chat.py        # /ai, /analyze, /setkey 命令
│   │   └── group.py          # 群组管理命令
│   ├── utils/                 # 工具模块
│   │   ├── storage.py        # 数据库操作
│   │   ├── manifold_api.py   # Manifold API 客户端
│   │   ├── ai_client.py      # AI 客户端
│   │   ├── ai_engine.py      # AI 引擎（热点搜索、议题生成）
│   │   └── scheduler.py      # 定时任务调度
│   ├── config.py             # 配置文件
│   └── main.py               # 主程序入口
├── data/                      # 数据存储
│   └── bot.db                # SQLite 数据库
├── logs/                      # 日志文件
│   └── bot.log               # 运行日志
├── proxy/                     # 代理配置
│   ├── mihomo                # Mihomo 可执行文件
│   └── config.yaml           # 代理配置
├── .env                       # 环境变量
├── requirements.txt           # Python 依赖
├── start.sh                   # 启动脚本
├── README.md                  # 英文文档
├── README_CN.md               # 中文文档
└── ARCHITECTURE.md            # 技术架构文档
```

## 数据库设计

### 核心表

- `users` - 用户信息
- `groups` - 群组信息
- `group_admins` - 群组管理员
- `discussions` - 讨论记录
- `topics` - 议题记录
- `hot_events` - 热点事件
- `bet_history` - 下注历史
- `message_queue` - 消息队列

详细表结构请查看 [ARCHITECTURE.md](./ARCHITECTURE.md#数据库设计)

## 高并发优化

### 数据库优化
- 索引优化
- 连接池管理
- 批量操作

### 缓存策略
- Redis 缓存用户数据
- 群组配置缓存
- 热点数据缓存

### 消息队列
- 批量推送
- 失败重试
- 限流控制

详细优化方案请查看 [ARCHITECTURE.md](./ARCHITECTURE.md#高并发解决方案)

## 部署

### 开发环境

```bash
# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env

# 运行
python -m bot.main
```

### 生产环境

推荐使用 Docker 部署：

```bash
# 构建镜像
docker build -t manifold-bot .

# 运行容器
docker run -d \
  --name manifold-bot \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  manifold-bot
```

详细部署方案请查看 [ARCHITECTURE.md](./ARCHITECTURE.md#部署架构)

## 监控和日志

### 日志系统
- 结构化日志
- 日志轮转
- 错误追踪

### 监控指标
- 消息处理量
- API 调用成功率
- 数据库连接数
- 缓存命中率

## 常见问题

### 1. 如何获取 Manifold API Key？

1. 访问 https://manifold.markets
2. 登录后进入个人资料页面
3. 点击编辑，找到 API Key 并刷新

### 2. 如何在群聊中使用？

1. 将机器人添加到群聊
2. 管理员执行 `/enable` 启用群组
3. 用户私聊机器人设置 API Key
4. 在群聊中使用命令

### 3. 如何自定义推送时间？

```
/config morning 09:00
/config evening 21:00
```

### 4. 如何查看群组统计？

```
/stats
```

## 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 许可证

MIT License

## 联系方式

- 项目地址: [GitHub Repository]
- 问题反馈: [GitHub Issues]

## 更新日志

### v2.0.0 (2026-02-20)
- ✨ 新增自动化运营功能
- ✨ 新增群组管理系统
- ✨ 新增热点推送功能
- ✨ 新增议题生成功能
- ✨ 新增 Manifold 市场创建
- 🚀 优化高并发性能
- 📝 完善技术文档

### v1.0.0
- ✨ 基础功能实现
