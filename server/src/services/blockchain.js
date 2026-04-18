const fs = require("fs");
const path = require("path");
const { Contract, JsonRpcProvider, NonceManager, Wallet, isAddress } = require("ethers");

let initialized = false;
let provider;
let signer;
let contract;
let abi;
let backendAddress;
let activeRpcUrl;
let activeContractAddress;

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

async function getBlockchainStatus() {
  ensureInitialized();
  const network = await provider.getNetwork();

  return {
    chainId: Number(network.chainId),
    networkName: network.name,
    rpcUrl: activeRpcUrl,
    contractAddress: activeContractAddress,
    backendAddress
  };
}

module.exports = {
  getBackendAddress,
  getBlockchainStatus,
  getTicketingContract,
  initializeTicketingContract,
  isEthereumAddress: isAddress,
  mapStatus,
  normalizeAddress
};
