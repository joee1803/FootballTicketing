require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "server/.env" });

const privateKey = process.env.PRIVATE_KEY || "";
const sepoliaRpcUrl = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL || "";
const amoyRpcUrl = process.env.AMOY_RPC_URL || "";
const requestedNetwork = process.argv.includes("--network")
  ? process.argv[process.argv.indexOf("--network") + 1]
  : "";

if (["sepolia", "amoy"].includes(requestedNetwork) && !optionalAccounts().length) {
  throw new Error(`PRIVATE_KEY must be set in server/.env before deploying to ${requestedNetwork}.`);
}

if (requestedNetwork === "sepolia" && !sepoliaRpcUrl) {
  throw new Error("SEPOLIA_RPC_URL must be set in server/.env before deploying to Sepolia.");
}

if (requestedNetwork === "amoy" && !amoyRpcUrl) {
  throw new Error("AMOY_RPC_URL must be set in server/.env before deploying to Polygon Amoy.");
}

function optionalAccounts() {
  return privateKey && privateKey !== "replace_with_admin_private_key" ? [privateKey] : [];
}

module.exports = {
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    sepolia: {
      url: sepoliaRpcUrl || "http://127.0.0.1:8545",
      accounts: optionalAccounts()
    },
    amoy: {
      url: amoyRpcUrl || "http://127.0.0.1:8545",
      accounts: optionalAccounts()
    }
  },
  solidity: {
    version: "0.8.26",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  }
};
