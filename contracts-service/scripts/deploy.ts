import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  const platformTreasury = process.env.PLATFORM_TREASURY || deployer.address;
  
  console.log("\n--- Deploying PredictionMarket ---");
  const PredictionMarket = await ethers.getContractFactory("PredictionMarket");
  const market = await PredictionMarket.deploy(platformTreasury);
  await market.waitForDeployment();
  const marketAddress = await market.getAddress();
  console.log("PredictionMarket deployed to:", marketAddress);

  console.log("\n--- Deployment Summary ---");
  console.log({
    network: (await ethers.provider.getNetwork()).name,
    PredictionMarket: marketAddress,
    PlatformTreasury: platformTreasury,
    Deployer: deployer.address,
  });

  console.log("\n--- Contract Constants ---");
  console.log("CREATOR_DEPOSIT:", ethers.formatEther(await market.CREATOR_DEPOSIT()), "ETH");
  console.log("MIN_BET_AMOUNT:", ethers.formatEther(await market.MIN_BET_AMOUNT()), "ETH");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
