# MindBet

## AI模块

- 每天上午10:00定时分析热点，给出用户讨论点（LLM+Prompt+Web Search）
- 每天晚上20:00定时分析群里记录，并总结讨论结果（LLM聊天Prompt，**需要有管理员权限才可以获取聊天记录**）
- 存储对每个用户的记忆/战绩，Bet结果出来以后，根据以前战绩+当前战绩，LLM对用户提供情绪价值（**是对每个用户的私聊触发**）
  - 战绩存储到中心数据库，没必要存链上或者IPFS，成本太高
- 创建议题以后，AI分析，并且返回给用户



**TODO：需要对Prompt调优，达到目标结果**

## **议题创建模块（议题存到区**块链和IPFS、数据库做缓存）

- 方式一：AI生成议题：用户讨论热闹时，直接生成题目并且上链，引导用户下注
  - **关键词库触发**或者**突破限流触发**+LLM聊天Prompt
  - NLP实时**语义分析**+**情感分析**
- 方式二：群成员自己创建议题（到bot功能里面）

### 议题数据结构

#### 链上智能合约 (Solidity)

为了极致节省 Gas，我们只存数字和逻辑判断依据。

```
struct Market {
    uint256 id;              // 自增 ID
    bytes32 contentHash;     // 议题标题和规则的指纹 (IPFS Hash)
    uint256 deadline;        // 截止时间戳
    uint256 totalYesPool;    // YES 池总额
    uint256 totalNoPool;     // NO 池总额
    address creator;         // 创建者地址
    address groupOwner;      // 群主地址，用于分润
    MarketStatus status;     // 状态：0:进行中, 1:已封盘, 2:已结算, 3:已取消
    uint8 result;            // 结果：0:空, 1:YES, 2:NO
}

// 固定押金用常量定义，不占用存储槽
uint256 public constant CREATOR_DEPOSIT = 1e6; // 1 USDC

// 状态枚举类
enum MarketStatus {
    Open,       // 0: 进行中（可下注）
    Closed,     // 1: 已封盘（停止下注，等待结果）
    Resolved,   // 2: 已结算（结果已出，可领奖）
    Cancelled   // 3: 已取消（议题作废，资金原路退还）
}

// 用户下注记录（映射存储）
// 格式：marketId => 用户地址 => 用户下注
struct UserBet {
    uint256 amount; // 下赌注金额
    bool betType; // true为是，false为否
    bool claimed; // 是否领奖
}
mapping(uint256 => mapping(address => UserBet)) public userBets;


```

#### 链下数据库 (MySQL)

用于支持前端的快速搜索、分类和排序。

- **Markets 表**

```
CREATE TABLE markets (
    id BIGINT PRIMARY KEY AUTO_INCREMENT, -- 对应链上marketId
    title VARCHAR(255) NOT NULL COMMENT '议题标题',
    description TEXT COMMENT '议题详细描述',
    category VARCHAR(50) COMMENT '分类（如体育、加密货币）',
    content_hash VARCHAR(66) NOT NULL COMMENT '链上contentHash（keccak256是64位+0x，IPFS CID也可存）',
    deadline BIGINT NOT NULL COMMENT '截止时间戳',
    creator_address VARCHAR(42) NOT NULL COMMENT '创建者钱包地址',
    group_owner_address VARCHAR(42) COMMENT '群主钱包地址',
    status TINYINT NOT NULL DEFAULT 0 COMMENT '状态（0:进行中,1:已封盘,2:已结算,3:已取消）',
    total_yes_pool BIGINT NOT NULL DEFAULT 0 COMMENT 'YES池总额（单位：USDC最小单位）',
    total_no_pool BIGINT NOT NULL DEFAULT 0 COMMENT 'NO池总额',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_content_hash (content_hash), -- 哈希唯一索引，避免重复
    INDEX idx_status_deadline (status, deadline) -- 常用查询索引
) COMMENT='议题表';
```

- **Transactions 表**：存储所有下注的历史记录（时间、金额、用户地址、交易哈希）。

```
CREATE TABLE transactions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tx_hash VARCHAR(66) NOT NULL UNIQUE COMMENT '链上交易哈希',
    market_id BIGINT COMMENT '关联的议题ID',
    user_address VARCHAR(42) NOT NULL COMMENT '用户钱包地址',
    amount BIGINT NOT NULL COMMENT '金额（USDC最小单位）',
    outcome TINYINT COMMENT '下注选项（1:YES,2:NO，仅下注类型交易有值）',
    tx_type TINYINT NOT NULL COMMENT '交易类型（1:创建议题,2:下注,3:领奖,4:押金退还,5:退款,6:结算议题,7:取消议题）',
    tx_status TINYINT NOT NULL DEFAULT 1 COMMENT '交易状态（0:失败,1:成功）',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_market_user (market_id, user_address),
    INDEX idx_user_address (user_address)
) COMMENT='交易记录表';
```

- **UserPositions 表**：存储用户与议题的持仓关系（用于快速查询可领奖/可退款状态）。

```
CREATE TABLE user_positions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_address VARCHAR(42) NOT NULL COMMENT '用户钱包地址',
    content_hash VARCHAR(66) NOT NULL COMMENT '议题内容哈希',
    role TINYINT NOT NULL COMMENT '角色（1:创建者,2:下注者）',
    bet_outcome TINYINT COMMENT '下注方向（1:YES,2:NO，仅下注者有值）',
    bet_amount DECIMAL(38,0) DEFAULT 0 COMMENT '下注金额（wei）',
    deposit_amount DECIMAL(38,0) DEFAULT 0 COMMENT '押金金额（wei，仅创建者有值）',
    has_claimed BOOLEAN DEFAULT FALSE COMMENT '是否已领奖',
    has_refunded BOOLEAN DEFAULT FALSE COMMENT '是否已退款',
    claimed_at TIMESTAMP NULL COMMENT '领取/退款时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_market_role (user_address, content_hash, role),
    INDEX idx_user (user_address),
    INDEX idx_market (content_hash),
    INDEX idx_claimable (has_claimed, has_refunded)
) COMMENT='用户持仓表';
```

### 议题创建流程

#### 第一阶段：链下预处理（用户的浏览器与你的服务器）

当用户在网页上填写“梅西会参加2026世界杯吗？”并设置截止日期后：

1. **数据打包**：前端将标题、详细描述、分类、封面图链接打包成一个 **JSON 对象**。
2. **生成哈希 (ContentHash)**：
   - **方法 **：将 JSON 上传到 **IPFS**，得到一个 CID（如 `QmXoyp...`）。这个 CID 就是唯一的哈希。
   - **准备参数**：后端或前端准备好调用合约的参数：`contentHash` 和 `deadline`。

#### 第二阶段：链上交互（核心账本落桩）

这是最关键的一步，用户需要通过钱包（如 MetaMask）发起一笔交易。



1. 合约收钱（押金）

用户调用合约的 `createMarket` 函数。合约首先执行 `USDC.transferFrom(user, address(this), 1 * 10^6)`。

- **动作**：从用户钱包扣除 1 USDC 存入合约。（先用测试网）
- **目的**：防止滥发议题。



2. 写入状态

合约在区块链的存储空间里新建一条记录

```
struct Market {
    uint256 id;              // 自增 ID
    bytes32 contentHash;     // 议题标题和规则的指纹 (IPFS Hash)
    uint256 deadline;        // 截止时间戳
    uint256 totalYesPool;    // YES 池总额
    uint256 totalNoPool;     // NO 池总额
    address creator;         // 创建者地址
    address groupOwner;      // 群主地址，用于分润
    MarketStatus status;     // 状态：0:进行中, 1:已封盘, 2:已结算, 3:已取消
    uint8 result;            // 结果：0:空, 1:YES, 2:NO
}
```



3. 抛出事件 (Event)

合约最后执行 `emit MarketCreated(marketCount, _contentHash, _deadline)`。

- **意义**：这相当于在区块链的公告栏贴了一张告示，告诉你的后端：“喂！新议题来了，快去记录！”

#### 第三阶段：数据库同步（为了让别人能看到）

区块链本身不提供“搜索”功能。如果没有这一步，其他用户打开网页时将看不到新创建的议题。

1. **监听器 (Indexer)**：你的后端程序（比如用 Node.js 写的监听脚本）抓取到了刚才那个 `MarketCreated` 事件。
2. **入库**：后端将链上的 `marketId`、`contentHash` 与之前在第一阶段暂存的**标题原文、描述**匹配起来，将IPFS的数据，存入你的 **MySQL**数据库，作为查询的缓存，不需要直接查询IPFS，不然效率太慢。
3. **展示**：此时，任何用户刷新网页，你的后端 API 就能从数据库里秒级读出这个新议题。

#### 第四阶段： 生成AI分析结果，返回群里

调用AI服务

## 下注模块

### 下注流程

- tg可以绑定钱包，并且下注

- debox自带钱包

#### 用户操作（前端）

- Alice 在网页上输入 100（固定金额），点击“确认下注”。
- 前端调用合约的 `placeBet(marketId, outcome, amount)` 函数。

#### 链上处理（智能合约）

- **全量权限校验**：检查市场状态为`Open`、当前时间早于`deadline-30分钟`封盘缓冲期、下注选项为 1 (YES)/2 (NO)、下注金额≥最小限额且符合持仓占比限制、用户 USDC 授权与余额充足。（如果当前时间在截止时间30分钟以内，则顺便将状态扭转为closed）
- **账本状态更新**：先更新链上账本，`totalYesPool`增加 100，`userBets[marketId][Alice][1]`增加 100
- **资金划转**：合约调用 USDC 的`transferFrom`，将 100 USDC 从 Alice 钱包划转至合约地址，强制校验转账结果为成功，失败则全流程回滚。
- **抛出事件**：`emit BetPlaced`，为后端同步提供精准可过滤的链上信号。

#### 链下同步（后端 Indexer）

- 你的后端程序监听到 `BetPlaced` 事件。
- 后端更新数据库中该议题内容。

## 结算模块

### 结算流程

#### 结果判定（Resolution）

当截止时间（`deadline`）到达后，议题进入“待定”状态。

- **谁来判定**：**Chainlink/UMA**预言机判定到达结果时间，**WebSearch**通过主流媒体的API查询这个事件的结果，并根据结果投票，从而判定二元问题结果
- 提议 → 挑战期 → 无争议自动结算 / 有争议则 UMA 代币
- **链上操作**：判定者调用合约的 `resolveMarket(marketId, outcome)` 函数。
- **状态变更**：合约将该议题的状态改为 `Resolved`，并记录胜出方（1 为 YES，2 为 NO）。
- **押金退还**：此时，合约自动将最初创建议题时扣除的 **1 USDC 押金**退还给创建者的钱包。

#### 计算分赃比例（数学逻辑）

这是最关键的公式。

- 总奖池为100
  - 胜方总注金为95%
  - 平台抽成5%
    - 创建人抽成1%
    - 我们抽成3%
    - 群主抽成1%

#### 用户领奖流程（Claim）

为了节省 Gas 费，**不要由合约主动打钱给几千个用户**（这会耗尽你的手续费），而是让用户**自己来领**。

1. **用户触发**：用户在网页上看到“你赢了”，点击“提取奖金”按钮，TODO：提供一个未提现的议题查询功能
2. **合约校验**：
   - 检查议题是否已 `Resolved`。
   - 检查该用户在“胜方”是否有注金。
   - 检查该用户是否已经领过奖（防止双花攻击）。
3. **资金发放**：
   - 合约计算出该用户应得的金额。
   - 合约调用 `USDC.transfer(user, amount)`。
   - 合约更新账本：将该用户的注金记录清零（标记为已领奖）。

#### 存储是怎么变化的？

- **链上 (On-Chain)**：
  - `Market` 结构体中的 `status` 从 `Open` 变为 `Resolved`。
  - 领取以后，`userBets` 映射中，该用户的记录被标记或删除，防止重复领取。
- **链下 (Off-Chain)**：
  - 你的数据库监听 `MarketResolved` 事件，将该议题标记为“已结束”。
  - 数据库监听用户的 `Claimed` 事件，在前端显示“已提现”状态。

## 分享模块

### 用户历史战绩

总参与次数、获胜次数，胜率、累计赚取的USDC

### 用户今日战绩

今天参与的次数，获胜次数，胜率，今日赚取的USDC

## 系统设计

### 代币

测试阶段统一使用Sepolia链，不使用真实链

正式环境使用Polygon的USDC（暂时无需实现）

### 状态机流转

```
[创建议题] → Open (0) 
                |
                | [下注时判断距离截止时间是否还剩30分钟，如果是的话，就扭转状态为closed]
                ↓
             Closed (1)
                |
                | [预言机+WebSearch]
                ↓
             Resolved (2) [终态：可领奖，7天有效期]
                |
                | [7天领奖有效期结束 → 无人认领资金转入国库]
                ↓
             [资金清算完成]

（并行分支）
Open (0) / Closed (1)
                |
                | [违规议题 / 无法判定结果 → 管理员调用cancelMarket]
                ↓
             Cancelled (3) [终态：退还押金+下注资金]
```

### 链下数据库设计（仅作为查询的缓存）

- **Markets 表**

```
CREATE TABLE markets (
    id BIGINT PRIMARY KEY AUTO_INCREMENT, -- 对应链上marketId
    title VARCHAR(255) NOT NULL COMMENT '议题标题',
    description TEXT COMMENT '议题详细描述',
    category VARCHAR(50) COMMENT '分类（如体育、加密货币）',
    content_hash VARCHAR(66) NOT NULL COMMENT '链上contentHash（keccak256是64位+0x，IPFS CID也可存）',
    deadline BIGINT NOT NULL COMMENT '截止时间戳',
    creator_address VARCHAR(42) NOT NULL COMMENT '创建者钱包地址',
    group_owner_address VARCHAR(42) COMMENT '群主钱包地址',
    status TINYINT NOT NULL DEFAULT 0 COMMENT '状态（0:进行中,1:已封盘,2:已结算,3:已取消）',
    total_yes_pool BIGINT NOT NULL DEFAULT 0 COMMENT 'YES池总额（单位：USDC最小单位）',
    total_no_pool BIGINT NOT NULL DEFAULT 0 COMMENT 'NO池总额',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_content_hash (content_hash), -- 哈希唯一索引，避免重复
    INDEX idx_status_deadline (status, deadline) -- 常用查询索引
) COMMENT='议题表';
```

- **Transactions 表**：存储所有下注的历史记录（时间、金额、用户地址、交易哈希）。

```
CREATE TABLE transactions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    tx_hash VARCHAR(66) NOT NULL UNIQUE COMMENT '链上交易哈希',
    market_id BIGINT COMMENT '关联的议题ID',
    user_address VARCHAR(42) NOT NULL COMMENT '用户钱包地址',
    amount BIGINT NOT NULL COMMENT '金额（USDC最小单位）',
    outcome TINYINT COMMENT '下注选项（1:YES,2:NO，仅下注类型交易有值）',
    tx_type TINYINT NOT NULL COMMENT '交易类型（1:已下注,2:待领奖，3:已领奖）',
    tx_status TINYINT NOT NULL DEFAULT 1 COMMENT '交易状态（0:失败,1:成功）',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_market_user (market_id, user_address),
    INDEX idx_user_address (user_address)
) COMMENT='交易记录表';
```

- **UserPositions 表**：存储用户与议题的持仓关系（用于快速查询可领奖/可退款状态）。

```
CREATE TABLE user_positions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_address VARCHAR(42) NOT NULL COMMENT '用户钱包地址',
    content_hash VARCHAR(66) NOT NULL COMMENT '议题内容哈希',
    role TINYINT NOT NULL COMMENT '角色（1:创建者,2:下注者）',
    bet_outcome TINYINT COMMENT '下注方向（1:YES,2:NO，仅下注者有值）',
    bet_amount DECIMAL(38,0) DEFAULT 0 COMMENT '下注金额（wei）',
    deposit_amount DECIMAL(38,0) DEFAULT 0 COMMENT '押金金额（wei，仅创建者有值）',
    has_claimed BOOLEAN DEFAULT FALSE COMMENT '是否已领奖',
    has_refunded BOOLEAN DEFAULT FALSE COMMENT '是否已退款',
    claimed_at TIMESTAMP NULL COMMENT '领取/退款时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_market_role (user_address, content_hash, role),
    INDEX idx_user (user_address),
    INDEX idx_market (content_hash),
    INDEX idx_claimable (has_claimed, has_refunded)
) COMMENT='用户持仓表';
```

- **UserProfiles表**：存储用户的历史记录

```
CREATE TABLE user_profiles (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_address VARCHAR(42) NOT NULL UNIQUE COMMENT '用户钱包地址',
    total_bets BIGINT NOT NULL DEFAULT 0 COMMENT '总下注次数',
    win_bets BIGINT NOT NULL DEFAULT 0 COMMENT '获胜次数',
    total_pnl BIGINT NOT NULL DEFAULT 0 COMMENT '累计盈亏（USDC最小单位）',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_address (user_address)
) COMMENT='用户画像表（AI模块用）';
```

### 数据流转

整体数据流转围绕 “链上记账（不可篡改）+ 链下缓存（高效查询）” 的核心逻辑，分**议题创建、用户下注、结算领奖**三大核心阶段，各阶段数据操作闭环如下：

#### 阶段 1：议题创建（链下→链上→链下）

1. 链下预处理

   - 前端将议题标题 / 描述 / 分类等打包为 JSON，上传 IPFS 生成 CID（contentHash）；
   - 后端 / 前端准备合约调用参数（contentHash、deadline）。

   

2. 链上交互

   - 用户调用合约`createMarket`，扣除 1 USDC 押金（USDC.transferFrom）；
   - 合约写入 Market 结构体（自增 ID、contentHash、deadline 等），更新链上状态；
   - 合约抛出`MarketCreated`事件。

   

3. 链下数据库同步

   - 后端 Indexer 监听`MarketCreated`事件，匹配链上 marketId/contentHash 与本地暂存的议题原文；
   - 将完整数据写入 MySQL `markets`表，供前端查询展示。

#### 阶段 2：用户下注（前端→链上→链下）

1. **前端操作**：用户输入金额，调用合约`placeBet(marketId, outcome, amount)`。
2. 链上校验与记账
   - 合约校验：市场状态为 Open、时间未到封盘期、金额 / 授权 / 余额合规；若临近截止（30 分钟内），自动将状态改为 Closed；
   - 账本更新：增加对应 YES/NO 池总额，更新`userBets[marketId][用户地址]`；
   - 资金划转：调用 USDC.transferFrom 将资金转入合约，校验转账结果；
   - 抛出`BetPlaced`事件。
3. 链下同步
   - Indexer 监听`BetPlaced`事件，更新`markets`表的 total_yes_pool/total_no_pool；
   - 写入`transactions`表（tx_hash、market_id、用户地址、金额、下注类型等）。

#### 阶段 3：结算与领奖（链上判定→分润→用户领奖→链下同步）

1. 结果判定与链上状态更新

   - 截止时间到后，预言机 / WebSearch 判定结果，调用合约`resolveMarket(marketId, outcome)`；
   - 合约将 Market 状态改为 Resolved，记录结果（YES/NO），退还创题者 1 USDC 押金；
   - 合约按分润规则（胜方 95%、平台 5%（创题 1%/ 平台 3%/ 群主 1%））计算奖池分配比例。

   

2. 用户主动领奖

   - 用户前端点击 “提取奖金”，调用合约`claim`函数；
   - 合约校验：市场已 Resolved、用户为胜方、未领奖；
   - 合约计算应得金额，调用 USDC.transfer 发放奖金，标记用户下注记录为已领奖；
   - 抛出`Claimed`事件。

   

3. 链下数据同步

   - Indexer 监听`MarketResolved`/`Claimed`事件，更新`markets`表状态、`transactions`表 tx_type（待领奖→已领奖）；
   - 更新`user_profiles`表（总下注次数、获胜次数、累计盈亏），为 AI 模块提供数据。

   

#### 补充：AI 模块数据流转

- 定时读取`user_profiles`表（用户战绩）+ `transactions`表（下注记录）+ 群聊记录；
- LLM 结合 Prompt 分析热点 / 群聊结果，生成情绪价值反馈；
- 分析结果可写入用户画像表，或通过 TG/Debox 机器人推送。



## 前端模块



## TG机器人模块



## Debox机器人模块

