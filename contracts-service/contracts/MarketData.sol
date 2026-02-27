// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MarketData
 * @dev 预测市场数据结构定义
 */
library MarketData {
    /**
     * @dev 市场状态枚举
     * - Open: 市场开放，可接受投注
     * - Closed: 市场已关闭（到达截止时间缓冲期）
     * - Resolved: 市场已结算，结果已确定
     * - Cancelled: 市场已取消
     */
    enum MarketStatus {
        Open,
        Closed,
        Resolved,
        Cancelled
    }

    /**
     * @dev 市场结构体，存储市场的所有相关信息
     */
    struct Market {
        bytes32 contentHash;      // 市场内容的哈希值，用于唯一标识市场
        uint256 deadline;         // 市场截止时间（Unix时间戳）
        uint256 totalYesPool;     // 投注"是"的资金池总额
        uint256 totalNoPool;      // 投注"否"的资金池总额
        address creator;         // 市场创建者地址
        address groupOwner;       // 群主地址（可获得群主手续费）
        MarketStatus status;     // 市场当前状态
        uint8 result;            // 市场结果（1表示"是"，2表示"否"）
        uint256 resolvedAt;      // 市场结算/取消时间（Unix时间戳）
    }

    /**
     * @dev 用户投注结构体，存储单个用户的投注信息
     */
    struct UserBet {
        uint256 amount;       // 投注金额
        bool betType;         // 投注类型（true表示"是"，false表示"否"）
        bool betClaimed;      // 是否已领取奖金（Resolved状态时使用）
        bool refundClaimed;   // 是否已领取退款（Cancelled状态时使用）
    }
}
