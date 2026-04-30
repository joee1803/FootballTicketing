# Algorand Migration Plan

## Source tutorial patterns

From the provided course material, the repeated pattern is:

- create accounts programmatically
- save mnemonic and address
- fund accounts from a faucet or local dev wallet
- use `algosdk` directly
- sign transactions in code
- connect to Algorand APIs or local Algorand tooling

## What changes from the current app

Current app:

- Solidity smart contract
- Hardhat local chain
- ERC-721 ticket model
- MetaMask browser wallet for fan transfer

Target Algorand app:

- Algorand accounts instead of Ethereum wallets
- mnemonic-based account handling
- backend or app-level account management
- Algorand transaction or app-call based ticket logic

## Practical migration order

1. Add Algorand account creation and config scripts.
2. Replace fan MetaMask dependency with Algorand account onboarding.
3. Introduce Algorand-backed ticket issue / transfer / verify operations.
4. Retire the Ethereum-specific contract routes once the Algorand flow covers the same use cases.

## Recommendation

Do not delete the Ethereum version yet. Keep it as a working baseline while the Algorand version is built in parallel.
