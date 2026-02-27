// SPDX-License-Identifier: MIT
// 智能合约许可证标识
pragma solidity ^0.8.19;

// 引入 OpenZeppelin 的 Ownable 合约，用于权限管理
import "@openzeppelin/contracts/access/Ownable.sol";

// 引入 OpenZeppelin 的 ReentrancyGuard 合约，防止重入攻击
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// 引入本地配置库
import "./MarketConfig.sol";
// 引入本地数据结构库
import "./MarketData.sol";
// 引入本地事件库
import "./MarketEvents.sol";

/**
 * @title PredictionMarket
 * @dev 预测市场智能合约
 * @notice 允许用户对特定事件结果进行预测投注，支持创建市场、下注、结算和奖金领取功能
 */
contract PredictionMarket is Ownable, ReentrancyGuard {

    // ========== 状态变量 ==========

    // 平台 treasury 地址，用于接收平台手续费
    address public platformTreasury;

    // ========== 映射定义 ==========

    // 市场映射：contentHash => Market（存储所有市场数据）
    mapping(bytes32 => MarketData.Market) public markets;
    // 用户投注映射：contentHash => (user address => UserBet)（存储用户的投注信息）
    mapping(bytes32 => mapping(address => MarketData.UserBet)) public userBets;
    // 已领取奖金金额映射：contentHash => 已领取总额（用于追踪资金）
    mapping(bytes32 => uint256) public claimedAmounts;
    // creator 押金领取状态映射：contentHash => 是否已领取押金
    mapping(bytes32 => bool) public depositClaimed;

    // 市场列表数组，存储所有市场的 contentHash
    bytes32[] public marketList;

    // ========== 构造函数 ==========

    /**
     * @dev 合约构造函数
     * @param _platformTreasury 平台 treasury 地址，用于接收平台手续费
     */
    constructor(address _platformTreasury) Ownable(msg.sender) {
        platformTreasury = _platformTreasury;
    }

    // ========== 核心函数 ==========

    /**
     * @dev 创建新的预测市场
     * @param _contentHash 市场内容的哈希值，用于唯一标识市场
     * @param _deadline 市场截止时间（Unix时间戳）
     * @param _groupOwner 群主地址（可获得群主手续费）
     * @return bytes32 返回创建市场的 contentHash
     */
    function createMarket(
        bytes32 _contentHash,
        uint256 _deadline,
        address _groupOwner
    ) external payable returns (bytes32) {
        // 验证截止时间必须是未来时间
        require(_deadline > block.timestamp, "Deadline must be in future");
        // 验证发送的 ETH 金额足够支付保证金
        require(msg.value >= MarketConfig.CREATOR_DEPOSIT, "Insufficient deposit");
        // 验证市场不存在（防止重复创建）
        require(markets[_contentHash].contentHash == bytes32(0), "Market already exists");

        // 如果发送的 ETH 超过保证金，退还多余部分给创建者
        if (msg.value > MarketConfig.CREATOR_DEPOSIT) {
            payable(msg.sender).call{value: msg.value - MarketConfig.CREATOR_DEPOSIT}("");
        }

        // 创建市场并存储到映射中
        markets[_contentHash] = MarketData.Market({
            contentHash: _contentHash,
            deadline: _deadline,
            totalYesPool: 0,
            totalNoPool: 0,
            creator: msg.sender,
            groupOwner: _groupOwner,
            status: MarketData.MarketStatus.Open,
            result: 0,
            resolvedAt: 0
        });

        // 将市场哈希添加到市场列表
        marketList.push(_contentHash);

        // 触发市场创建事件
        emit MarketEvents.MarketCreated(_contentHash, _deadline, msg.sender, _groupOwner);

        // 返回市场哈希
        return _contentHash;
    }

    /**
     * @dev 用户进行投注
     * @param _contentHash 市场内容的哈希值
     * @param _betType 投注类型（true 表示"是"，false 表示"否"）
     */
    function placeBet(
        bytes32 _contentHash,
        bool _betType
    ) external payable nonReentrant {
        // 获取市场数据（storage 类型，可修改）
        MarketData.Market storage market = markets[_contentHash];

        // 验证市场处于开放状态
        require(market.status == MarketData.MarketStatus.Open, "Market not open");
        // 验证投注金额满足最小要求
        require(msg.value >= MarketConfig.MIN_BET_AMOUNT, "Amount below minimum");

        // 检查是否接近截止时间（进入缓冲期）
        // 如果当前时间 >= 截止时间 - 缓冲期，则关闭市场
        if (block.timestamp >= market.deadline - MarketConfig.CLOSE_BUFFER) {
            market.status = MarketData.MarketStatus.Closed;
            emit MarketEvents.MarketClosed(_contentHash);
            // 将用户发送的 ETH 原路退还
            payable(msg.sender).call{value: msg.value}("");
            // 终止函数，不再处理后续投注逻辑
            return;
        }

        // 获取用户的投注记录（storage 类型，可修改）
        MarketData.UserBet storage bet = userBets[_contentHash][msg.sender];

        // 如果用户之前没有投注，记录投注类型
        if (bet.amount == 0) {
            bet.betType = _betType;
        } else {
            // 用户已投注，验证不能同时投注两边
            require(bet.betType == _betType, "Cannot bet both sides");
        }

        // 更新用户投注金额
        bet.amount += msg.value;

        // 根据投注类型更新相应的资金池
        if (_betType) {
            // 投注"是"，添加到 Yes 池
            market.totalYesPool += msg.value;
        } else {
            // 投注"否"，添加到 No 池
            market.totalNoPool += msg.value;
        }

        // 触发投注事件，记录投注详细信息
        emit MarketEvents.BetPlaced(
            _contentHash,
            msg.sender,
            _betType,
            msg.value,
            market.totalYesPool,
            market.totalNoPool
        );
    }

    /**
     * @dev 结算市场（确定市场结果），只有合约所有者可以调用
     * @param _contentHash 市场内容的哈希值
     * @param _result 结算结果（1 表示"是"获胜，2 表示"否"获胜）
     */
    function resolveMarket(bytes32 _contentHash, uint8 _result) external onlyOwner {
        // 获取市场数据
        MarketData.Market storage market = markets[_contentHash];

        // 验证市场状态必须是 Open 或 Closed
        require(market.status == MarketData.MarketStatus.Closed || market.status == MarketData.MarketStatus.Open, "Invalid status");
        // 验证当前时间必须已超过截止时间
        require(block.timestamp >= market.deadline, "Not past deadline");
        // 验证结算结果必须是 1 或 2
        require(_result == 1 || _result == 2, "Invalid result");

        // 更新市场状态为已结算
        market.status = MarketData.MarketStatus.Resolved;
        market.result = _result;
        market.resolvedAt = block.timestamp;

        // 触发市场结算事件
        emit MarketEvents.MarketResolved(_contentHash, _result, market.totalYesPool, market.totalNoPool);
    }

    /**
     * @dev 获胜用户领取奖金（只有投注获胜方的用户才能领取）
     * @param _contentHash 市场内容的哈希值
     */
    function claim(bytes32 _contentHash) external nonReentrant {
        // 获取市场数据
        MarketData.Market storage market = markets[_contentHash];
        // 获取用户投注数据
        MarketData.UserBet storage bet = userBets[_contentHash][msg.sender];

        // 验证市场已结算
        require(market.status == MarketData.MarketStatus.Resolved, "Market not resolved");
        // 验证用户尚未领取过奖金
        require(!bet.betClaimed, "Bet already claimed");
        // 验证用户确实有投注
        require(bet.amount > 0, "No bet placed");

        // 判断获胜方（1 表示"是"，2 表示"否"）
        bool winningSide = (market.result == 1);
        // 验证用户投注的是获胜方
        require(bet.betType == winningSide, "Not a winner");

        // 计算获胜池和失败池的金额
        uint256 winningPool = winningSide ? market.totalYesPool : market.totalNoPool;
        uint256 losingPool = winningSide ? market.totalNoPool : market.totalYesPool;

        // 总资金池 = 获胜池 + 失败池
        uint256 totalPool = winningPool + losingPool;

        // 计算各手续费（基于 basis points，10000 = 100%）
        uint256 platformFee = (totalPool * MarketConfig.PLATFORM_FEE_BPS) / 10000;
        uint256 creatorFee = (totalPool * MarketConfig.CREATOR_FEE_BPS) / 10000;
        uint256 groupOwnerFee = (totalPool * MarketConfig.GROUP_OWNER_FEE_BPS) / 10000;

        // 手续费总额
        uint256 totalFees = platformFee + creatorFee + groupOwnerFee;
        // 可分配给获胜者的金额（总池 - 手续费）
        uint256 distributablePool = totalPool - totalFees;

        // 计算用户应得奖金（按投注比例分配）
        uint256 userShare = (bet.amount * distributablePool) / winningPool;

        // 标记该用户已领取奖金
        bet.betClaimed = true;
        // 记录已领取总额
        claimedAmounts[_contentHash] += userShare;

        // 将奖金转账给用户
        payable(msg.sender).call{value: userShare}("");

        // 触发奖金领取事件
        emit MarketEvents.BetClaimed(_contentHash, msg.sender, userShare);
    }

    /**
     * @dev 分配手续费给各方（平台、创建者、群主）
     * @param _contentHash 市场内容的哈希值
     */
    function distributeFees(bytes32 _contentHash) external {
        // 获取市场数据
        MarketData.Market storage market = markets[_contentHash];

        // 验证市场已结算
        require(market.status == MarketData.MarketStatus.Resolved, "Market not resolved");

        // 计算获胜池和失败池
        uint256 winningPool = (market.result == 1) ? market.totalYesPool : market.totalNoPool;
        uint256 losingPool = (market.result == 1) ? market.totalNoPool : market.totalYesPool;
        uint256 totalPool = winningPool + losingPool;

        // 计算各手续费
        uint256 platformFee = (totalPool * MarketConfig.PLATFORM_FEE_BPS) / 10000;
        uint256 creatorFee = (totalPool * MarketConfig.CREATOR_FEE_BPS) / 10000;
        uint256 groupOwnerFee = (totalPool * MarketConfig.GROUP_OWNER_FEE_BPS) / 10000;

        // 如果没有群主（address(0)），将群主手续费的一半分配给平台和创建者
        if (market.groupOwner == address(0)) {
            platformFee += groupOwnerFee / 2;
            creatorFee += groupOwnerFee / 2;
            groupOwnerFee = 0;
        }

        // 将平台手续费转给平台 treasury
        if (platformFee > 0) {
            payable(platformTreasury).call{value: platformFee}("");
        }

        // 将创建者手续费转给市场创建者
        if (creatorFee > 0 && market.creator != address(0)) {
            payable(market.creator).call{value: creatorFee}("");
        }

        // 将群主手续费转给群主
        if (groupOwnerFee > 0 && market.groupOwner != address(0)) {
            payable(market.groupOwner).call{value: groupOwnerFee}("");
        }
    }

    /**
     * @dev 取消市场（只有合约所有者可以调用）
     * @param _contentHash 市场内容的哈希值
     */
    function cancelMarket(bytes32 _contentHash) external onlyOwner {
        // 获取市场数据
        MarketData.Market storage market = markets[_contentHash];

        // 验证市场状态为 Open 或 Closed 才可取消
        require(
            market.status == MarketData.MarketStatus.Open || market.status == MarketData.MarketStatus.Closed,
            "Invalid status for cancel"
        );

        // 更新市场状态为已取消
        market.status = MarketData.MarketStatus.Cancelled;
        // 记录取消时间
        market.resolvedAt = block.timestamp;

        // 触发市场取消事件
        emit MarketEvents.MarketCancelled(_contentHash);
    }

    /**
     * @dev 用户领取被取消市场的退款（只有市场取消后才能领取）
     * @param _contentHash 市场内容的哈希值
     */
    function refundCancelledBet(bytes32 _contentHash) external nonReentrant {
        // 获取市场数据
        MarketData.Market storage market = markets[_contentHash];
        // 获取用户投注数据
        MarketData.UserBet storage bet = userBets[_contentHash][msg.sender];

        // 验证市场已取消
        require(market.status == MarketData.MarketStatus.Cancelled, "Market not cancelled");
        // 验证用户尚未领取过退款
        require(!bet.refundClaimed, "Bet already refunded");
        // 验证用户确实有投注
        require(bet.amount > 0, "No bet to refund");

        // 记录退款金额
        uint256 refundAmount = bet.amount;
        // 标记已领取退款
        bet.refundClaimed = true;

        // 将退款转给用户
        payable(msg.sender).call{value: refundAmount}("");

        // 触发退款事件
        emit MarketEvents.BetRefunded(_contentHash, msg.sender, refundAmount);
    }

    /**
     * @dev 市场创建者领取押金（市场结算或取消后可领取）
     * @param _contentHash 市场内容的哈希值
     */
    function claimDeposit(bytes32 _contentHash) external nonReentrant {
        // 获取市场数据
        MarketData.Market storage market = markets[_contentHash];

        // 验证调用者是市场创建者
        require(msg.sender == market.creator, "Only creator can claim deposit");
        // 验证市场状态为 Resolved 或 Cancelled
        require(
            market.status == MarketData.MarketStatus.Resolved || market.status == MarketData.MarketStatus.Cancelled,
            "Market not resolved or cancelled"
        );
        // 验证押金尚未被领取
        require(!depositClaimed[_contentHash], "Deposit already claimed");

        // 标记押金已领取
        depositClaimed[_contentHash] = true;

        // 将押金转给创建者
        payable(market.creator).call{value: MarketConfig.CREATOR_DEPOSIT}("");

        // 触发押金领取事件
        emit MarketEvents.DepositClaimed(_contentHash, market.creator, MarketConfig.CREATOR_DEPOSIT);
    }

    // ========== 查询函数 ==========

    /**
     * @dev 获取市场信息
     * @param _contentHash 市场内容的哈希值
     * @return Market 返回市场结构体
     */
    function getMarket(bytes32 _contentHash) external view returns (MarketData.Market memory) {
        return markets[_contentHash];
    }

    /**
     * @dev 获取用户投注信息
     * @param _contentHash 市场内容的哈希值
     * @param _user 用户地址
     * @return UserBet 返回用户投注结构体
     */
    function getUserBet(bytes32 _contentHash, address _user) external view returns (MarketData.UserBet memory) {
        return userBets[_contentHash][_user];
    }

    /**
     * @dev 检查市场是否存在
     * @param _contentHash 市场内容的哈希值
     * @return bool 返回市场是否存在
     */
    function marketExists(bytes32 _contentHash) external view returns (bool) {
        return markets[_contentHash].contentHash != bytes32(0);
    }

    /**
     * @dev 获取市场总数
     * @return uint256 返回创建的市场总数
     */
    function getMarketCount() external view returns (uint256) {
        return marketList.length;
    }

    /**
     * @dev 检查用户是否已领取奖金
     * @param _contentHash 市场内容的哈希值
     * @param _user 用户地址
     * @return bool 返回是否已领取奖金
     */
    function hasClaimedBet(bytes32 _contentHash, address _user) external view returns (bool) {
        return userBets[_contentHash][_user].betClaimed;
    }

    /**
     * @dev 检查用户是否已领取退款
     * @param _contentHash 市场内容的哈希值
     * @param _user 用户地址
     * @return bool 返回是否已领取退款
     */
    function hasClaimedRefund(bytes32 _contentHash, address _user) external view returns (bool) {
        return userBets[_contentHash][_user].refundClaimed;
    }

    // ========== 管理函数 ==========

    /**
     * @dev 设置平台 treasury 地址（只有合约所有者可以调用）
     * @param _treasury 新的 treasury 地址
     */
    function setPlatformTreasury(address _treasury) external onlyOwner {
        platformTreasury = _treasury;
    }

    // ========== 回调函数 ==========

    /**
     * @dev 接收 ETH 的回调函数
     * @notice 合约可以接收 ETH 转账
     */
    receive() external payable {}
}
