#!/bin/bash

echo "=== MindBet 合约部署脚本 ==="
echo ""

cd /usr/local/src/mindbet-bot/contracts-service

echo "请输入你的私钥（用于部署合约到Sepolia测试网）："
read -s PRIVATE_KEY

if [ -z "$PRIVATE_KEY" ]; then
    echo "错误：私钥不能为空"
    exit 1
fi

echo ""
echo "正在部署合约到 Sepolia 测试网..."
echo ""

npx hardhat run scripts/deploy.ts --network sepolia

echo ""
echo "=== 部署完成 ==="
echo "请复制上面的合约地址并更新到 .env 文件"
