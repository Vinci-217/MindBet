// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MarketConfig
 * @dev 预测市场配置常量
 */
library MarketConfig {
    // 创建市场时需要的保证金金额（0.001 ETH）
    uint256 public constant CREATOR_DEPOSIT = 0.001 ether;
    // 最小投注金额（0.0001 ETH）
    uint256 public constant MIN_BET_AMOUNT = 0.0001 ether;
    // 市场关闭缓冲期（10分钟），截止时间前10分钟停止接受新投注
    uint256 public constant CLOSE_BUFFER = 10 minutes;
    // 平台手续费（300 basis points = 3%）
    uint256 public constant PLATFORM_FEE_BPS = 300;
    // 创建者手续费（100 basis points = 1%）
    uint256 public constant CREATOR_FEE_BPS = 100;
    // 群主手续费（100 basis points = 1%）
    uint256 public constant GROUP_OWNER_FEE_BPS = 100;
}
