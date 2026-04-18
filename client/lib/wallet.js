"use client";

import { BrowserProvider, isAddress } from "ethers";

const HARDHAT_CHAIN_ID = "0x7a69";

export async function connectMetaMaskWallet() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask is not available in this browser.");
  }

  const provider = new BrowserProvider(window.ethereum);
  await window.ethereum.request({ method: "eth_requestAccounts" });

  const network = await provider.getNetwork();
  if (`0x${network.chainId.toString(16)}` !== HARDHAT_CHAIN_ID) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: HARDHAT_CHAIN_ID }]
      });
    } catch (error) {
      if (error?.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: HARDHAT_CHAIN_ID,
              chainName: "Hardhat Localhost 8545",
              nativeCurrency: {
                name: "ETH",
                symbol: "ETH",
                decimals: 18
              },
              rpcUrls: ["http://127.0.0.1:8545"]
            }
          ]
        });
      } else {
        throw new Error("Switch MetaMask to the local Hardhat network to continue.");
      }
    }
  }

  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  if (!isAddress(address)) {
    throw new Error("MetaMask returned an invalid wallet address.");
  }

  return address;
}
