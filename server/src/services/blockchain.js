const fs = require("fs");
const path = require("path");
const { Contract, JsonRpcProvider, NonceManager, Wallet, formatEther, isAddress, parseEther, toBeHex } = require("ethers");

let initialized = false;
let provider;
let signer;
let contract;
let abi;
let backendAddress;
let activeRpcUrl;
let activeContractAddress;

function resolveNetworkName(network) {
  const chainId = Number(network?.chainId);
  const name = String(network?.name || "").trim();

  if (name && name !== "unknown") {
    return name;
  }
  if (chainId === 31337) {
    return "Hardhat Local";
  }
  if (chainId === 1337) {
    return "Local Development";
  }

  return "Unknown network";
}

function artifactPath() {
  return path.resolve(process.cwd(), "artifacts", "contracts", "Ticketing.sol", "Ticketing.json");
}

function loadAbi() {
  if (abi) {
    return abi;
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath(), "utf8"));
  abi = artifact.abi;
  return abi;
}

function normalizeAddress(address) {
  return String(address || "").trim().toLowerCase();
}

function mapStatus(status) {
  const code = Number(status);
  if (code === 0) {
    return "Valid";
  }
  if (code === 1) {
    return "Used";
  }
  if (code === 2) {
    return "Revoked";
  }
  return "Unknown";
}

function mapContractError(error) {
  const candidates = [
    error?.revert?.name,
    error?.info?.error?.message,
    error?.shortMessage,
    error?.message
  ].filter(Boolean);
  const combined = candidates.join(" ");

  if (combined.includes("MatchAlreadyExists")) {
    return new Error("A match with that ID already exists on-chain.");
  }
  if (combined.includes("MatchAlreadyStarted")) {
    return new Error("The match start time must be in the future.");
  }
  if (combined.includes("MatchDoesNotExist")) {
    return new Error("The requested match does not exist on-chain.");
  }
  if (combined.includes("TransferWindowClosed")) {
    return new Error("The ticket transfer window has closed for this match.");
  }
  if (combined.includes("TransferLimitReached")) {
    return new Error("This ticket has already reached its transfer limit.");
  }
  if (combined.includes("TicketAlreadyUsed")) {
    return new Error("This ticket has already been checked in.");
  }
  if (combined.includes("TicketAlreadyRevoked")) {
    return new Error("This ticket has already been revoked.");
  }
  if (combined.includes("TicketNotValid")) {
    return new Error("Only valid tickets can be used for this action.");
  }
  if (combined.includes("ERC721NonexistentToken")) {
    return new Error("Ticket not found on-chain.");
  }
  if (combined.includes("ERC721InsufficientApproval") || combined.includes("ERC721IncorrectOwner")) {
    return new Error("This transfer must be signed by the current wallet owner in MetaMask.");
  }
  if (combined.includes("network does not support ENS")) {
    return new Error("Use a direct wallet address instead of an ENS name on the local network.");
  }

  return new Error(error?.shortMessage || error?.message || "Blockchain request failed.");
}

function ensureInitialized() {
  if (!initialized || !contract) {
    throw new Error("Ticketing contract has not been initialized.");
  }
}

function validateWalletAddress(address) {
  if (!isAddress(String(address || "").trim())) {
    throw new Error("A valid Ethereum wallet address is required.");
  }
}

async function requireLocalFundingNetwork() {
  ensureInitialized();
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);

  if (chainId !== 31337 && chainId !== 1337) {
    throw new Error("Wallet funding is only available on the local development network.");
  }

  return network;
}

function wrapWrite(methodName) {
  return async (...args) => {
    ensureInitialized();
    try {
      return await contract[methodName](...args);
    } catch (error) {
      throw mapContractError(error);
    }
  };
}

function wrapRead(methodName) {
  return async (...args) => {
    ensureInitialized();
    try {
      return await contract[methodName](...args);
    } catch (error) {
      throw mapContractError(error);
    }
  };
}

const contractFacade = {
  async createMatch(...args) {
    return wrapWrite("createMatch")(...args);
  },

  async getMatch(...args) {
    return wrapRead("getMatch")(...args);
  },

  async mintTicket(ownerAddress, ticketId, matchId, maxTransfers) {
    validateWalletAddress(ownerAddress);
    return wrapWrite("mintTicket")(ownerAddress, ticketId, matchId, maxTransfers);
  },

  async getTicket(...args) {
    return wrapRead("getTicket")(...args);
  },

  async ownerOf(...args) {
    return wrapRead("ownerOf")(...args);
  },

  async transferFrom(fromAddress, toAddress, ticketId) {
    validateWalletAddress(fromAddress);
    validateWalletAddress(toAddress);
    return wrapWrite("transferFrom")(fromAddress, toAddress, ticketId);
  },

  async revokeTicket(...args) {
    return wrapWrite("revokeTicket")(...args);
  },

  async verifyTicket(ticketId, claimedOwner) {
    validateWalletAddress(claimedOwner);
    return wrapRead("verifyTicket")(ticketId, claimedOwner);
  },

  async markTicketAsUsed(...args) {
    return wrapWrite("markTicketAsUsed")(...args);
  }
};

async function initializeTicketingContract() {
  const rpcUrl = String(process.env.RPC_URL || "").trim();
  const privateKey = String(process.env.PRIVATE_KEY || "").trim();
  const contractAddress = String(process.env.CONTRACT_ADDRESS || "").trim();

  if (!rpcUrl || !privateKey || !contractAddress) {
    throw new Error("RPC_URL, PRIVATE_KEY, and CONTRACT_ADDRESS must be set in server/.env");
  }

  provider = new JsonRpcProvider(rpcUrl);
  signer = new NonceManager(new Wallet(privateKey, provider));
  const deployedCode = await provider.getCode(contractAddress);
  if (!deployedCode || deployedCode === "0x") {
    throw new Error(`No Ticketing contract is deployed at ${contractAddress}. Start the app with npm.cmd run dev:full or run npm.cmd run server:local after Hardhat is running.`);
  }

  contract = new Contract(contractAddress, loadAbi(), signer);
  initialized = true;
  activeRpcUrl = rpcUrl;
  activeContractAddress = contractAddress;

  backendAddress = await signer.getAddress();
  console.log(`Connected to deployed ticketing contract at ${contractAddress}`);
  console.log(`Backend signer: ${backendAddress}`);

  return contractFacade;
}

function getTicketingContract() {
  ensureInitialized();
  return contractFacade;
}

function getBackendAddress() {
  ensureInitialized();
  return backendAddress;
}

async function getWalletFundingStatus(address) {
  ensureInitialized();
  validateWalletAddress(address);

  const normalizedAddress = String(address).trim();
  const network = await provider.getNetwork();
  const balanceHex = await provider.send("eth_getBalance", [normalizedAddress, "latest"]);
  const balanceWei = BigInt(balanceHex);

  return {
    address: normalizedAddress,
    chainId: Number(network.chainId),
    networkName: resolveNetworkName(network),
    balanceWei: balanceWei.toString(),
    balanceEth: formatEther(balanceWei)
  };
}

async function fundWallet(address, amountEth = "2.0") {
  ensureInitialized();
  validateWalletAddress(address);
  await requireLocalFundingNetwork();

  const normalizedAddress = String(address).trim();
  const currentBalance = await provider.getBalance(normalizedAddress);
  const nextBalance = currentBalance + parseEther(String(amountEth));
  const nextBalanceHex = toBeHex(nextBalance);

  try {
    await provider.send("hardhat_setBalance", [
      normalizedAddress,
      nextBalanceHex
    ]);
  } catch (error) {
    try {
      await provider.send("anvil_setBalance", [
        normalizedAddress,
        nextBalanceHex
      ]);
    } catch {
      throw error;
    }
  }

  const updated = await getWalletFundingStatus(normalizedAddress);
  return {
    ...updated,
    txHash: null,
    fundedAmountEth: String(amountEth)
  };
}

async function getBlockchainStatus() {
  ensureInitialized();
  const network = await provider.getNetwork();

  return {
    chainId: Number(network.chainId),
    networkName: resolveNetworkName(network),
    rpcUrl: activeRpcUrl,
    contractAddress: activeContractAddress,
    backendAddress
  };
}

module.exports = {
  fundWallet,
  getBackendAddress,
  getBlockchainStatus,
  getTicketingContract,
  getWalletFundingStatus,
  initializeTicketingContract,
  isEthereumAddress: isAddress,
  mapStatus,
  normalizeAddress
};
