const fs = require("fs");
const path = require("path");
const { JsonRpcProvider, isAddress } = require("ethers");
const hre = require("hardhat");

const envPath = path.resolve(process.cwd(), "server", ".env");
const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545";

async function waitForRpc() {
  const provider = new JsonRpcProvider(rpcUrl);

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      await provider.getBlockNumber();
      return provider;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw new Error(`Hardhat RPC did not become available at ${rpcUrl}`);
}

function upsertEnvValue(contents, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");

  if (pattern.test(contents)) {
    return contents.replace(pattern, line);
  }

  return `${contents.trimEnd()}\n${line}\n`;
}

function readEnvValue(contents, key) {
  const match = contents.match(new RegExp(`^${key}=(.*)$`, "m"));
  return match?.[1]?.trim();
}

function updateLocalContractAddress(address) {
  const currentEnv = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const nextEnv = upsertEnvValue(currentEnv, "CONTRACT_ADDRESS", address);
  fs.writeFileSync(envPath, nextEnv);
}

async function deployTicketingContract() {
  const [deployer] = await hre.ethers.getSigners();
  const Ticketing = await hre.ethers.getContractFactory("Ticketing");
  const contract = await Ticketing.deploy(deployer.address);
  await contract.waitForDeployment();
  return contract.getAddress();
}

async function resolveTicketingContract(provider) {
  const currentEnv = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const configuredAddress = readEnvValue(currentEnv, "CONTRACT_ADDRESS");

  // Reuse the configured local contract when the Hardhat node is already running.
  // This prevents backend restarts from orphaning tickets by deploying a new contract unnecessarily.
  if (configuredAddress && isAddress(configuredAddress)) {
    const existingCode = await provider.getCode(configuredAddress);
    if (existingCode && existingCode !== "0x") {
      console.log(`Using existing local ticketing contract at ${configuredAddress}`);
      return configuredAddress;
    }
  }

  const contractAddress = await deployTicketingContract();
  updateLocalContractAddress(contractAddress);
  console.log(`Local ticketing contract deployed to ${contractAddress}`);
  return contractAddress;
}

async function main() {
  const provider = await waitForRpc();
  await resolveTicketingContract(provider);

  require("../server/src/index");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
