// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MarketEvents
 * @dev 预测市场事件定义
 */
library MarketEvents {
    /**
     * @dev 市场创建事件
     * @param contentHash 市场的内容哈希
     * @param deadline 市场截止时间
     * @param creator 市场创建者
     * @param groupOwner 群主地址
     */
    event MarketCreated(
        bytes32 indexed contentHash,
        uint256 deadline,
        address indexed creator,
        address indexed groupOwner
    );

    /**
     * @dev 用户投注事件
     * @param contentHash 市场的内容哈希
     * @param user 投注用户地址
     * @param betType 投注类型（true表示"是"，false表示"否"）
     * @param amount 投注金额
     * @param totalYesPool 当前"是"资金池总额
     * @param totalNoPool 当前"否"资金池总额
     */
    event BetPlaced(
        bytes32 indexed contentHash,
        address indexed user,
        bool betType,
        uint256 amount,
        uint256 totalYesPool,
        uint256 totalNoPool
    );

    /**
     * @dev 市场关闭事件
     * @param contentHash 市场的内容哈希
     */
    event MarketClosed(bytes32 indexed contentHash);

    /**
     * @dev 市场结算事件
     * @param contentHash 市场的内容哈希
     * @param result 结算结果（1表示"是"，2表示"否"）
     * @param totalYesPool "是"资金池总额
     * @param totalNoPool "否"资金池总额
     */
    event MarketResolved(
        bytes32 indexed contentHash,
        uint8 result,
        uint256 totalYesPool,
        uint256 totalNoPool
    );

    /**
     * @dev 用户领取奖金事件
     * @param contentHash 市场的内容哈希
     * @param user 领取奖金的用户地址
     * @param amount 领取的奖金金额
     */
    event BetClaimed(
        bytes32 indexed contentHash,
        address indexed user,
        uint256 amount
    );

    /**
     * @dev 市场取消事件
     * @param contentHash 市场的内容哈希
     */
    event MarketCancelled(bytes32 indexed contentHash);

    /**
     * @dev 用户领取退款事件
     * @param contentHash 市场的内容哈希
     * @param user 领取退价的用户地址
     * @param amount 领取的退款金额
     */
    event BetRefunded(
        bytes32 indexed contentHash,
        address indexed user,
        uint256 amount
    );

    /**
     * @dev 押金领取事件
     * @param contentHash 市场的内容哈希
     * @param creator 市场创建者地址
     * @param amount 领取的押金金额
     */
    event DepositClaimed(
        bytes32 indexed contentHash,
        address indexed creator,
        uint256 amount
    );
}
