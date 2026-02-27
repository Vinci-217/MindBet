#!/bin/bash

echo "=== MindBet 合约部署和测试脚本 ==="
echo ""

cd /usr/local/src/mindbet-bot/contracts-service

echo "请输入你的私钥（用于部署合约到Sepolia测试网）："
echo "注意：私钥不会被保存，仅用于本次部署"
read -s PRIVATE_KEY

if [ -z "$PRIVATE_KEY" ]; then
    echo "错误：私钥不能为空"
    exit 1
fi

echo ""
echo "正在部署合约到 Sepolia 测试网..."
echo ""

# 临时设置私钥环境变量
export PRIVATE_KEY="$PRIVATE_KEY"

# 部署合约
npx hardhat run scripts/deploy.ts --network sepolia

echo ""
echo "=== 部署完成 ==="
echo ""
echo "请复制上面的合约地址（格式：0x开头的42个字符）"
echo "然后运行以下命令更新配置："
echo "sed -i 's/CONTRACT_ADDRESS=.*/CONTRACT_ADDRESS=你的合约地址/' /usr/local/src/mindbet-bot/.env"
echo "cd /usr/local/src/mindbet-bot && docker-compose up -d frontend-service backend-api-service"
