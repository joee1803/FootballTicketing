import { BrowserProvider, Contract } from "ethers";
import { connectMetaMaskWallet, ensureHardhatNetwork } from "./wallet";

const ticketingAbi = [
  "function transferFrom(address from, address to, uint256 tokenId) external",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function getTicket(uint256 ticketId) view returns (tuple(uint256 ticketId,uint256 matchId,uint8 status,uint8 transferCount,uint8 maxTransfers,uint256 issuedAt,uint256 usedAt,uint256 revokedAt))"
];

export async function getBrowserTicketingContract(options = {}) {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask not detected in this browser.");
  }

  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error("Missing NEXT_PUBLIC_CONTRACT_ADDRESS in client/.env.local");
  }

  if (options.requestConnection === false) {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    if (!accounts?.length) {
      throw new Error("Connect MetaMask before using blockchain ticket actions.");
    }
    const existingProvider = new BrowserProvider(window.ethereum);
    await ensureHardhatNetwork(existingProvider);
  } else {
    await connectMetaMaskWallet();
  }

  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();

  return {
    contract: new Contract(contractAddress, ticketingAbi, signer),
    provider,
    signer,
    signerAddress: await signer.getAddress()
  };
}
