# MindBet - 基于区块链的预测市场微服务架构

## 架构概述

本项目采用基于HTTP的微服务架构，核心业务逻辑在智能合约上执行，后端服务作为缓存层和业务协调层。使用Sepolia测试网的ETH作为原生代币。

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              区块链层 (Sepolia测试网)                             │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                     PredictionMarket Contract                            │  │
│  │  • 议题创建（押金机制）  • 下注逻辑  • 结算逻辑  • 分润机制               │  │
│  │  • 使用原生ETH作为交易代币                                               │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                  IPFS (官方节点)                                           │ │
│  │  • 议题详细内容存储  • 内容Hash生成                                        │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
                    │                                    │
                    │ Events                             │ Content Hash
                    ↓                                    ↓
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              indexer-service (Go)                               │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  • 监听 MarketCreated/BetPlaced/MarketResolved/Claimed 事件              │  │
│  │  • 同步链上数据到MySQL缓存数据库                                          │  │
│  │  • 更新议题状态、奖池金额、用户下注记录                                    │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ↓ 写入
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Data Layer                                         │
│  ┌────────────────────────┐  ┌────────────────────────────────────────────┐   │
│  │        MySQL           │  │                  Redis                      │   │
│  │  • markets表           │  │  • 热点数据缓存  • 会话缓存                 │   │
│  │  • transactions表      │  │  • API限流       • 用户状态                 │   │
│  │  • user_profiles表     │  │                                             │   │
│  └────────────────────────┘  └────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ↓ 读取
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        backend-api-service (Go + Beego)                         │
│                                    端口: 8080                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐     │
│  │   Market API     │  │    User API      │  │      Admin API           │     │
│  │                  │  │                  │  │                          │     │
│  │  • 议题列表      │  │  • 用户战绩      │  │  • 结算管理              │     │
│  │  • 议题详情      │  │  • 下注历史      │  │  • 议题取消              │     │
│  │  • 下注预处理    │  │  • 领奖记录      │  │  • 数据统计              │     │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────┘     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐     │
│  │   IPFS Client    │  │  Blockchain RPC  │  │      JWT Auth            │     │
│  │                  │  │                  │  │                          │     │
│  │  • 上传内容      │  │  • 读取合约状态  │  │  • 服务间鉴权            │     │
│  │  • 获取内容      │  │  • 交易广播      │  │  • 用户钱包签名验证      │     │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────────┘
                    │                                      │
                    │ HTTP API                             │ HTTP API
                    ↓                                      ↓
┌──────────────────────────────────┐  ┌──────────────────────────────────────────┐
│    telegram-bot-service          │  │         debox-bot-service                │
│    (Python) 端口: 8001           │  │         (Go) 端口: 8002                  │
│                                  │  │                                          │
│  • 消息接收/发送                  │  │  • 消息接收/发送                          │
│  • 命令处理 (/bet, /claim等)     │  │  • 命令处理                               │
│  • 群组管理                      │  │  • 群组管理                               │
│  • 代理支持 (SOCKS5/HTTP)        │  │  • DeBox SDK集成                          │
└──────────────────────────────────┘  └──────────────────────────────────────────┘
                    │                                      │
                    ↓                                      ↓
┌──────────────────────────────────┐  ┌──────────────────────────────────────────┐
│       ai-service (Python)        │  │            Proxy Service                  │
│         端口: 8003               │  │              (可选)                       │
│                                  │  │                                          │
│  • 热点分析 (定时10:00)          │  │  • SOCKS5代理                             │
│  • 讨论总结 (定时20:00)          │  │  • 用于Telegram API访问                   │
│  • 议题生成 (LLM+Prompt)         │  │                                          │
│  • 用户情绪价值反馈              │  │                                          │
└──────────────────────────────────┘  └──────────────────────────────────────────┘
```

## 服务说明

### 1. 智能合约层

**网络**: Sepolia测试网  
**语言**: Solidity ^0.8.19  
**框架**: Hardhat  
**代币**: 原生ETH

#### PredictionMarket 合约
预测市场核心合约，使用原生ETH进行交易：

| 常量 | 值 | 说明 |
|------|-----|------|
| CREATOR_DEPOSIT | 0.001 ETH | 创建议题押金 |
| MIN_BET_AMOUNT | 0.0001 ETH | 最小下注金额 |
| CLOSE_BUFFER | 30分钟 | 封盘缓冲期 |
| CLAIM_PERIOD | 7天 | 领奖有效期 |

**分润规则**:
- 胜方获得: 95%
- 平台抽成: 3%
- 创建者抽成: 1%
- 群主抽成: 1%

**状态机**:
```
[创建议题] → Open (0)
                │
                │ [下注时判断距离截止时间≤30分钟]
                ↓
            Closed (1)
                │
                │ [预言机+WebSearch判定]
                ↓
            Resolved (2) [终态：可领奖，7天有效期]
                │
                │ [7天后无人认领资金转入国库]
                ↓
            [资金清算完成]

（并行分支）
Open/Closed → [违规/无法判定] → Cancelled (3) [退还押金+下注资金]
```

### 2. backend-api-service

**端口**: 8080  
**语言**: Go  
**框架**: Beego + GORM  
**职责**: 提供HTTP API，作为链上数据的缓存层

#### API 端点

##### 议题相关 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/markets` | GET | 获取议题列表（支持分页、筛选） |
| `/api/v1/markets/:id` | GET | 获取议题详情 |
| `/api/v1/markets` | POST | 创建议题（返回交易数据供前端签名） |
| `/api/v1/markets/:id/bet` | POST | 下注（返回交易数据供前端签名） |
| `/api/v1/markets/:id/claim` | POST | 领奖预处理（计算可领取金额） |

##### 用户相关 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/users/:address/profile` | GET | 获取用户画像（战绩统计） |
| `/api/v1/users/:address/bets` | GET | 获取用户下注历史 |
| `/api/v1/users/:address/claims` | GET | 获取用户领奖记录 |

##### 管理相关 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/admin/markets/:id/resolve` | POST | 结算议题 |
| `/api/v1/admin/markets/:id/cancel` | POST | 取消议题 |
| `/api/v1/admin/stats` | GET | 获取平台统计数据 |

### 3. indexer-service

**端口**: 8084  
**语言**: Go  
**职责**: 监听链上事件，同步数据到数据库

#### 监听的事件

| 事件 | 触发时机 | 数据库操作 |
|------|----------|-----------|
| MarketCreated | 议题创建 | 插入markets表 |
| BetPlaced | 用户下注 | 更新奖池、插入transactions表 |
| MarketClosed | 市场封盘 | 更新状态 |
| MarketResolved | 市场结算 | 更新状态、结果 |
| Claimed | 用户领奖 | 更新transactions表、user_profiles表 |
| MarketCancelled | 市场取消 | 更新状态 |

### 4. IPFS (官方节点)

**端口**: 5001 (API), 8081 (Gateway)  
**镜像**: ipfs/kubo:latest  
**职责**: 管理IPFS内容存储

#### 功能
- 上传议题内容到IPFS
- 获取IPFS内容
- 生成内容Hash（CID）

### 5. ai-service

**端口**: 8003  
**语言**: Python  
**职责**: AI相关功能

#### 功能
- **热点分析**: 每天10:00定时分析热点，生成讨论点
- **讨论总结**: 每天20:00总结群聊记录
- **议题生成**: 基于讨论热度生成预测议题
- **情绪价值**: 根据用户战绩提供情绪价值反馈

### 6. telegram-bot-service

**端口**: 8001  
**语言**: Python  
**职责**: Telegram平台交互

#### 功能
- 接收/发送消息
- 命令处理（/start, /bet, /claim, /profile等）
- 群组管理
- 代理支持（用于访问Telegram API）

### 7. debox-bot-service

**端口**: 8002  
**语言**: Go  
**职责**: DeBox平台交互

#### 功能
- 接收/发送消息
- 命令处理
- 群组管理
- DeBox SDK集成

## 鉴权机制

### 1. 用户鉴权（钱包签名）

```go
type SignatureMessage struct {
    Address   string `json:"address"`
    Message   string `json:"message"`
    Signature string `json:"signature"`
    Timestamp int64  `json:"timestamp"`
}

func VerifySignature(msg *SignatureMessage) bool {
    // 1. 检查时间戳是否在有效期内
    // 2. 恢复签名者地址
    // 3. 对比地址是否匹配
}
```

### 2. 服务间鉴权（JWT）

```go
type ServiceClaims struct {
    ServiceName string `json:"service"`
    jwt.RegisteredClaims
}

func GenerateServiceToken(serviceName, secret string) (string, error) {
    claims := ServiceClaims{
        ServiceName: serviceName,
        RegisteredClaims: jwt.RegisteredClaims{
            ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
            IssuedAt:  jwt.NewNumericDate(time.Now()),
        },
    }
    return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
}
```

## 项目结构

```
mindbet-bot/
├── contracts/                        # 智能合约
│   ├── contracts/
│   │   └── PredictionMarket.sol     # 预测市场合约
│   ├── scripts/
│   │   └── deploy.ts                # 部署脚本
│   ├── test/
│   │   └── PredictionMarket.test.ts # 合约测试
│   ├── hardhat.config.ts
│   ├── package.json
│   └── README.md
│
├── backend-api-service/              # 后端API服务 (Go + Beego)
│   ├── cmd/
│   │   └── main.go                  # 入口文件
│   ├── internal/
│   │   ├── controllers/             # 控制器
│   │   │   ├── market.go
│   │   │   ├── user.go
│   │   │   └── admin.go
│   │   ├── models/                  # 数据模型
│   │   │   ├── market.go
│   │   │   ├── transaction.go
│   │   │   └── user_profile.go
│   │   ├── routers/                 # 路由
│   │   │   └── router.go
│   │   ├── services/                # 业务服务
│   │   │   ├── market_service.go
│   │   │   ├── user_service.go
│   │   │   └── blockchain.go
│   │   └── middleware/              # 中间件
│   │       ├── auth.go
│   │       └── cors.go
│   ├── pkg/
│   │   ├── config/                  # 配置
│   │   └── response/                # 响应格式
│   ├── migrations/                  # 数据库迁移
│   ├── go.mod
│   ├── go.sum
│   └── Dockerfile
│
├── indexer-service/                  # 索引服务 (Go)
│   ├── cmd/
│   │   └── main.go
│   ├── internal/
│   │   ├── indexer/
│   │   │   └── event_handler.go
│   │   └── sync/
│   │       └── blockchain_sync.go
│   ├── go.mod
│   └── Dockerfile
│
├── ai-service/                       # AI服务 (Python)
│   ├── app/
│   │   ├── main.py                  # FastAPI主程序
│   │   ├── config.py
│   │   ├── routers/
│   │   │   ├── hot_events.py
│   │   │   └── topics.py
│   │   └── services/
│   │       ├── llm_client.py
│   │       └── web_search.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── telegram-bot-service/             # Telegram Bot (Python)
│   ├── bot/
│   │   ├── main.py
│   │   ├── handlers/
│   │   │   ├── start.py
│   │   │   ├── bet.py
│   │   │   └── profile.py
│   │   └── middleware/
│   │       └── auth.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── debox-bot-service/                # DeBox Bot (Go)
│   ├── cmd/
│   │   └── main.go
│   ├── internal/
│   │   ├── handlers/
│   │   │   └── handlers.go
│   │   └── client/
│   │       └── debox_sdk.go
│   ├── go.mod
│   └── Dockerfile
│
├── proxy/                            # 代理服务 (可选)
│   ├── config.yaml
│   └── mihomo
│
├── docker-compose.yml                # Docker编排
├── .env.example                      # 环境变量示例
├── ARCHITECTURE.md                   # 架构文档
├── MindBet.md                        # 产品方案
└── README.md
```

## 数据库设计

### 数据库架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MindBet 数据库架构                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐   │
│  │   MySQL     │     │     Redis       │     │      IPFS       │   │
│  │   (主库)    │     │    (缓存)       │     │   (文件存储)    │   │
│  └──────┬──────┘     └────────┬────────┘     └────────┬────────┘   │
│         │                     │                       │            │
│         ▼                     ▼                       ▼            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Backend API Service                       │  │
│  │  - markets          - user_profiles      - groups            │  │
│  │  - transactions     - telegram_users                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Indexer Service                           │  │
│  │  - markets          - transactions     - user_profiles       │  │
│  │  - indexer_state    (同步链上事件到数据库)                    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    AI Service                                │  │
│  │  (只读访问 MySQL 和 Redis)                                    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 数据表概览

| 表名 | 用途 | 服务 |
|------|------|------|
| `markets` | 预测市场信息 | Backend API, Indexer |
| `transactions` | 链上交易记录 | Backend API, Indexer |
| `user_profiles` | 用户统计档案 | Backend API, Indexer |
| `groups` | Telegram/DeBox 群组 | Backend API |
| `telegram_users` | Telegram 用户绑定 | Backend API |
| `indexer_state` | 区块链索引器状态 | Indexer |

### markets表（议题表）

```sql
CREATE TABLE markets (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    content_hash VARCHAR(66) NOT NULL COMMENT '内容哈希(SHA256(title+description+category+deadline))',
    title VARCHAR(255) NOT NULL COMMENT '议题标题',
    description TEXT COMMENT '议题详细描述',
    category VARCHAR(50) COMMENT '分类',
    deadline BIGINT NOT NULL COMMENT '截止时间戳',
    creator_address VARCHAR(42) NOT NULL COMMENT '创建者钱包地址',
    group_owner_address VARCHAR(42) COMMENT '群主钱包地址',
    status TINYINT NOT NULL DEFAULT 0 COMMENT '0:进行中,1:已封盘,2:已结算,3:已取消',
    result TINYINT DEFAULT 0 COMMENT '0:空,1:YES,2:NO',
    total_yes_pool BIGINT NOT NULL DEFAULT 0 COMMENT 'YES池总额(Wei)',
    total_no_pool BIGINT NOT NULL DEFAULT 0 COMMENT 'NO池总额(Wei)',
    resolved_at BIGINT DEFAULT NULL COMMENT '结算时间戳',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_content_hash (content_hash),
    INDEX idx_status_deadline (status, deadline),
    INDEX idx_creator (creator_address)
) COMMENT='议题表';
```

**说明**：
- `content_hash` 是议题的唯一标识，由 `SHA256(title + description + category + deadline)` 生成
- 链上合约也使用 `content_hash` 作为市场标识，不再使用计数器 ID
- 创建议题前会检查 `content_hash` 是否已存在，防止重复创建

**市场状态枚举**：

| 值 | 状态 | 说明 |
|----|------|------|
| 0 | Open | 进行中，可下注 |
| 1 | Closed | 已封盘，等待结算 |
| 2 | Resolved | 已结算，可领奖 |
| 3 | Cancelled | 已取消，退还资金 |

**市场结果枚举**：

| 值 | 结果 | 说明 |
|----|------|------|
| 0 | Empty | 未出结果 |
| 1 | Yes | YES 方获胜 |
| 2 | No | NO 方获胜 |

### transactions表（交易记录表）

```sql
CREATE TABLE transactions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tx_hash VARCHAR(66) NOT NULL UNIQUE COMMENT '链上交易哈希',
    content_hash VARCHAR(66) NOT NULL COMMENT '关联的议题内容哈希',
    user_address VARCHAR(42) NOT NULL COMMENT '用户钱包地址',
    amount BIGINT NOT NULL COMMENT '金额(Wei)',
    outcome TINYINT COMMENT '下注选项(1:YES,2:NO)',
    tx_type TINYINT NOT NULL COMMENT '1:创建议题,2:下注,3:领奖,4:押金退还,5:退款',
    tx_status TINYINT NOT NULL DEFAULT 1 COMMENT '0:失败,1:成功',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_content_hash (content_hash),
    INDEX idx_user_address (user_address)
) COMMENT='交易记录表';
```

**交易类型枚举**：

| 值 | 类型 | 说明 |
|----|------|------|
| 1 | CreateMarket | 创建市场 |
| 2 | Bet | 下注 |
| 3 | Claim | 领取奖励 |
| 4 | DepositRefund | 押金退还 |
| 5 | Refund | 退款（市场取消时） |

**交易状态枚举**：

| 值 | 状态 | 说明 |
|----|------|------|
| 0 | Failed | 交易失败 |
| 1 | Success | 交易成功 |

### user_profiles表（用户画像表）

```sql
CREATE TABLE user_profiles (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_address VARCHAR(42) NOT NULL UNIQUE COMMENT '用户钱包地址',
    total_bets BIGINT NOT NULL DEFAULT 0 COMMENT '总下注次数',
    win_bets BIGINT NOT NULL DEFAULT 0 COMMENT '获胜次数',
    total_pnl BIGINT NOT NULL DEFAULT 0 COMMENT '累计盈亏(Wei)',
    total_volume BIGINT NOT NULL DEFAULT 0 COMMENT '总交易量(Wei)',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_address (user_address)
) COMMENT='用户画像表';
```

**说明**：
- 由 Indexer Service 在处理 `Claimed` 事件时自动更新
- 用于展示用户战绩统计

### groups表（群组表）

```sql
CREATE TABLE groups (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    platform VARCHAR(20) NOT NULL COMMENT 'telegram或debox',
    platform_group_id VARCHAR(100) NOT NULL COMMENT '平台群组ID',
    group_name VARCHAR(255),
    owner_address VARCHAR(42) COMMENT '群主钱包地址',
    is_enabled BOOLEAN DEFAULT TRUE,
    member_count INT DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_platform_group (platform, platform_group_id)
) COMMENT='群组表';
```

**说明**：
- 支持多平台群组管理（Telegram、DeBox）
- `platform + platform_group_id` 组合唯一索引

### telegram_users表（Telegram用户绑定表）

```sql
CREATE TABLE telegram_users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    telegram_id BIGINT NOT NULL UNIQUE COMMENT 'Telegram用户ID',
    wallet_address VARCHAR(42) NOT NULL COMMENT '钱包地址',
    username VARCHAR(255) COMMENT 'Telegram用户名',
    signature VARCHAR(255) COMMENT '签名',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_wallet_address (wallet_address)
) COMMENT='Telegram用户绑定表';
```

**说明**：
- 存储 Telegram ID 与钱包地址的绑定关系
- 用户通过签名验证绑定钱包

### indexer_state表（索引器状态表）

```sql
CREATE TABLE indexer_state (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    contract_name VARCHAR(100) NOT NULL UNIQUE COMMENT '合约名称',
    last_block BIGINT NOT NULL DEFAULT 0 COMMENT '最后处理的区块号',
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) COMMENT='索引器状态表';
```

**说明**：
- 用于记录区块链事件同步进度
- Indexer Service 使用轮询模式监听链上事件
- 服务重启后从 `last_block` 继续同步，避免重复处理或遗漏事件

**工作原理**：
```
┌────────────────────────────────────────────────────────────────┐
│                   Indexer Service 轮询模式                      │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   每 15 秒执行一次:                                             │
│                                                                │
│   1. 读取 indexer_state 获取 last_block                        │
│                    │                                           │
│                    ▼                                           │
│   2. 查询区块链最新区块号 (latest_block)                        │
│                    │                                           │
│                    ▼                                           │
│   3. 批量处理 [last_block+1, latest_block] 区间的事件          │
│      (每次最多处理 1000 个区块)                                 │
│                    │                                           │
│                    ▼                                           │
│   4. 解析事件并写入数据库 (markets/transactions/user_profiles) │
│                    │                                           │
│                    ▼                                           │
│   5. 更新 indexer_state.last_block = latest_block             │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**监听的链上事件**：

| 事件 | 触发时机 | 数据库操作 |
|------|----------|-----------|
| `MarketCreated` | 创建预测市场 | 插入 markets 表 + transactions 表 |
| `BetPlaced` | 用户下注 | 更新市场资金池 + 插入 transactions 表 |
| `MarketClosed` | 市场封盘 | 更新 markets.status = Closed |
| `MarketResolved` | 市场结算 | 更新 markets.status + result |
| `Claimed` | 用户领奖 | 插入 transactions 表 + 更新 user_profiles |
| `MarketCancelled` | 市场取消 | 更新 markets.status = Cancelled |

## 环境变量

```env
# MySQL
MYSQL_PASSWORD=your_mysql_password

# Redis
REDIS_PASSWORD=

# JWT Secret
JWT_SECRET=your_jwt_secret_key

# Blockchain (Sepolia)
BLOCKCHAIN_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
CONTRACT_ADDRESS=0x...
CHAIN_ID=11155111

# AI Configuration
AI_API_URL=https://api.hunyuan.cloud.tencent.com/v1/chat/completions
AI_API_KEY=your_ai_api_key

# Telegram
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_PROXY=socks5://127.0.0.1:7890

# DeBox
DEBOX_API_KEY=your_debox_api_key
DEBOX_APP_SECRET=your_debox_app_secret
```

## 部署指南

### 开发环境

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 合约部署

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test
npx hardhat run scripts/deploy.ts --network sepolia
```

## 开发路线图

### Phase 1: 智能合约 ✅
- [x] PredictionMarket合约（使用ETH）
- [x] 合约测试
- [x] 部署脚本

### Phase 2: 后端服务
- [x] backend-api-service (Go + Beego)
- [x] indexer-service
- [x] IPFS集成

### Phase 3: AI服务
- [x] ai-service
- [ ] 热点分析定时任务
- [ ] 议题生成优化

### Phase 4: Bot服务
- [x] telegram-bot-service
- [x] debox-bot-service

### Phase 5: 前端
- [ ] Web前端
- [ ] 钱包集成
