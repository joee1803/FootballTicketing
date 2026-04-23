"use client";

import { BrowserProvider, isAddress } from "ethers";

const HARDHAT_CHAIN_ID = "0x7a69";

export async function ensureHardhatNetwork(provider) {
  const network = await provider.getNetwork();
  if (`0x${network.chainId.toString(16)}` === HARDHAT_CHAIN_ID) {
    return;
  }

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
      return;
    }

    throw new Error("Switch MetaMask to the local Hardhat network to continue.");
  }
}

async function readSignerAddress(provider) {
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  if (!isAddress(address)) {
    throw new Error("MetaMask returned an invalid wallet address.");
  }

  return address;
}

export async function getConnectedMetaMaskWallet() {
  if (typeof window === "undefined" || !window.ethereum) {
    return "";
  }

  const accounts = await window.ethereum.request({ method: "eth_accounts" });
  if (!accounts?.length) {
    return "";
  }

  const provider = new BrowserProvider(window.ethereum);
  await ensureHardhatNetwork(provider);
  return readSignerAddress(provider);
}

export async function connectMetaMaskWallet() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask is not available in this browser.");
  }

  const provider = new BrowserProvider(window.ethereum);
  await window.ethereum.request({ method: "eth_requestAccounts" });
  await ensureHardhatNetwork(provider);
  return readSignerAddress(provider);
}

export function watchMetaMaskWallet(onChange) {
  if (typeof window === "undefined" || !window.ethereum?.on) {
    return () => {};
  }

  const handleAccountsChanged = (accounts) => {
    onChange(accounts?.[0] || "");
  };

  window.ethereum.on("accountsChanged", handleAccountsChanged);
  return () => {
    if (window.ethereum?.removeListener) {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
    }
  };
}
