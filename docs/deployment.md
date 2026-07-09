# Matchday Ledger Deployment Guide

This project deploys as three connected services:

1. Smart contract on a public EVM testnet.
2. Express API on a Node hosting service.
3. Next.js frontend on Netlify.

For local demos, use `npm.cmd run dev:full`. For a public deployment, do not use the local Hardhat network because it resets when the process stops and cannot be reached by other users.

## 1. Create A Persistent Database

Create a MongoDB Atlas database and copy the connection string.

Required backend variable:

```text
MONGODB_URI=mongodb+srv://...
```

## 2. Deploy The Smart Contract

Choose one public testnet. Sepolia is a good default for university demos. Polygon Amoy is also suitable if you prefer Polygon tooling.

Add the deployment values to `server/.env` locally:

```text
PRIVATE_KEY=your_backend_signer_private_key
SEPOLIA_RPC_URL=https://...
```

Then run:

```powershell
npm.cmd run compile
npm.cmd run deploy:sepolia
```

Copy the printed contract address and set:

```text
CONTRACT_ADDRESS=0x...
RPC_URL=https://...
```

The backend signer wallet must have testnet gas because it creates fixtures, mints tickets, revokes tickets, and confirms check-ins.

## 3. Deploy The Backend API

The included `render.yaml` can be used as a Render blueprint.

Set these environment variables in Render:

```text
MONGODB_URI=mongodb+srv://...
RPC_URL=https://...
PRIVATE_KEY=...
CONTRACT_ADDRESS=0x...
JWT_SECRET=long_random_secret
SUPER_ADMIN_NAME=System Super Admin
SUPER_ADMIN_EMAIL=superadmin@club.local
SUPER_ADMIN_PASSWORD=choose_a_strong_password
```

Render build command:

```text
npm install && npm run compile
```

Render start command:

```text
npm run server
```

After deployment, test:

```text
https://your-api-url.onrender.com/health
```

It should return:

```json
{ "status": "ok" }
```

## 4. Deploy The Frontend

The included `netlify.toml` points Netlify at the `client` app.

Set these environment variables in Netlify:

```text
NEXT_PUBLIC_API_BASE_URL=https://your-api-url.onrender.com
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
```

Netlify build settings:

```text
Base directory: client
Build command: npm run build
Publish directory: .next
```

## 5. MetaMask Setup For Users

Users need MetaMask connected to the same testnet used by the deployed contract.

For a video demo:

1. Add the testnet to MetaMask.
2. Add faucet test ETH to the supporter wallets.
3. Register each supporter with a different MetaMask account.
4. Keep the backend signer funded with test ETH.

## 6. Known Deployment Limitations

- Demo ticket balance is application credit, not real payment.
- Testnet ETH is still required for wallet-signed transfers.
- The backend signer is trusted for admin blockchain actions.
- Real stadium scanning hardware is not included; check-in is represented by supporter requests and admin verification.
- Local Hardhat is only for local demos and should not be used as the public deployment network.
