# MindBet Contracts

基于Hardhat的预测市场智能合约，使用ETH作为原生代币。

## 合约说明

### PredictionMarket
预测市场核心合约，使用Sepolia测试网的ETH进行交易。

#### 常量
- `CREATOR_DEPOSIT` = 0.001 ETH (创建议题押金)
- `MIN_BET_AMOUNT` = 0.0001 ETH (最小下注金额)
- `CLOSE_BUFFER` = 30分钟 (封盘缓冲期)
- `CLAIM_PERIOD` = 7天 (领奖有效期)

#### 分润规则
- 胜方获得：95%
- 平台抽成：3%
- 创建者抽成：1%
- 群主抽成：1%

#### 状态流转
```
Open -> Closed -> Resolved -> [清算完成]
                    ↓
              Cancelled (退还资金)
```

## 开发环境设置

### 安装依赖
```bash
npm install
```

### 编译合约
```bash
npm run compile
```

### 运行测试
```bash
npm run test
```

### 部署到本地网络
```bash
# 终端1: 启动本地节点
npm run node

# 终端2: 部署合约
npm run deploy:localhost
```

### 部署到Sepolia测试网
```bash
# 复制环境变量
cp .env.example .env
# 编辑.env文件填入实际值

# 部署
npm run deploy:sepolia
```

## 合约交互

### 创建议题
```solidity
// 发送0.001 ETH作为押金
market.createMarket{value: 0.001 ether}(contentHash, deadline, groupOwnerAddress);
```

### 下注
```solidity
// 下注YES，发送ETH
market.placeBet{value: 0.01 ether}(marketId, true);

// 下注NO
market.placeBet{value: 0.01 ether}(marketId, false);
```

### 结算
```solidity
// 只有合约所有者可以结算
market.resolveMarket(marketId, 1); // 1=YES wins, 2=NO wins
```

### 领奖
```solidity
market.claim(marketId);
```

## 事件

合约发出以下事件供Indexer监听：

- `MarketCreated` - 议题创建
- `BetPlaced` - 下注
- `MarketClosed` - 市场封盘
- `MarketResolved` - 市场结算
- `Claimed` - 用户领奖
- `MarketCancelled` - 市场取消
- `DepositRefunded` - 押金退还

## 目录结构

```
contracts/
├── contracts/           # 合约源码
│   └── PredictionMarket.sol
├── scripts/             # 部署脚本
│   └── deploy.ts
├── test/                # 测试文件
│   └── PredictionMarket.test.ts
├── hardhat.config.ts    # Hardhat配置
├── package.json
└── tsconfig.json
```
