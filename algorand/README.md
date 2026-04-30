# Algorand Migration Track

This folder is the start of the Algorand-based version of the football ticketing project.

## Why this exists

Your course PDFs use an Algorand workflow based on:

- generating accounts in code
- storing the mnemonic
- signing transactions in backend scripts
- connecting directly to an Algorand node or public API

That is fundamentally different from the current Ethereum + Hardhat + MetaMask implementation.

## Migration direction

The Algorand version should move toward:

- fan accounts created or managed without MetaMask
- backend-side mnemonic/account management for the prototype
- Algorand transaction signing with `algosdk`
- eventual replacement of the current Solidity contract path

## Included starter scripts

- `scripts/1-create-account.js`
- `scripts/2-first-transaction.js`
- `config/client.js`

## Setup

1. Create `algorand/.env` from `algorand/.env.example`
2. Install dependencies:

```powershell
cd algorand
npm install
```

3. Generate an account:

```powershell
npm run create-account
```

4. Fund that account on Algorand testnet and paste the mnemonic into `algorand/.env`

5. Run a first transaction:

```powershell
npm run first-transaction
```

## What is next

The next implementation phase should replace the current fan wallet flow with Algorand accounts and then redesign ticket issuance and verification around Algorand transactions or Algorand smart contracts.
