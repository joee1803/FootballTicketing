# Blockchain-Based Football Ticket Authenticity and Verification System

Contract-first MVP scaffold for a decentralized football ticket verification system.

The repository now includes a minimal Express backend for off-chain metadata, QR generation, and blockchain-backed verification flows.
It also includes a separate Next.js frontend for admin and fan views, with matchday verification folded into the admin dashboard.
The admin side supports role-based sign-in with `SUPER_ADMIN` and `ADMIN` accounts.

## What is implemented

- `Ticketing.sol` based on `ERC721 + AccessControl`
- Match creation by admin
- Ticket minting by admin
- Owner transfer with rules:
  - transfer count limit
  - transfer cutoff support
  - no transfer after match start
- Matchday check-in (`markTicketAsUsed`)
- Admin revocation
- Ticket verification (`verifyTicket`)
- Ownership history tracking

## Structure

- `contracts/Ticketing.sol` smart contract
- `test/Ticketing.test.js` core MVP tests
- `scripts/deploy.js` deployment script
- `hardhat.config.js` hardhat config
- `server/src` Express API, Mongo models, blockchain service layer
- `client/app` Next.js frontend routes for authentication, admin, and fan flows

## Run

```bash
npm install
npx hardhat test
npx hardhat compile
npx hardhat run scripts/deploy.js --network sepolia
npm run server
npm run client
```

## Core roles

- `ADMIN_ROLE`: create match, mint, revoke, role management
- `GATE_ROLE`: mark ticket as used during entry scan

## Notes

- On-chain stores trust-critical state only.
- Match/team/seat display metadata should remain off-chain in backend DB.

## Backend setup

Create `server/.env` from `server/.env.example` and fill in:

- `MONGODB_URI`
- `RPC_URL`
- `PRIVATE_KEY`
- `CONTRACT_ADDRESS`
- `JWT_SECRET`
- `SUPER_ADMIN_NAME`
- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD`

Create `client/.env.local` from `client/.env.example` and set:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_CONTRACT_ADDRESS`

## API summary

- `GET /health`
- `POST /api/auth/admin/sign-in`
- `GET /api/auth/admin/me`
- `GET /api/auth/admin/list`
- `POST /api/auth/admin/create`
- `GET /api/matches`
- `POST /api/matches`
- `GET /api/tickets`
- `GET /api/tickets/:ticketId`
- `POST /api/tickets`
- `POST /api/tickets/purchase`
- `POST /api/tickets/:ticketId/transfer`
- `POST /api/tickets/:ticketId/revoke`
- `POST /api/verification/check`
- `POST /api/verification/check-in`

## Transfer note

The current transfer endpoint is intentionally conservative. For wallet-owned tickets, transfers should be initiated from the owner's wallet in the frontend unless the backend signer is the current token owner.

## Frontend routes

- `/` auth-first homepage with sign-in/register wipe animation
- `/admin/sign-in` alias for the admin sign-in experience
- `/admin` protected admin actions for matches, minting, revocation, and super-admin account creation
- `/fan` supporter profile, match booking, and owned ticket display
