# Blockchain-Based Football Ticket Authenticity and Verification System

Algorand-backed MVP for a decentralized football ticket verification system.

The running app now uses:

- `Express` for fan/admin auth, match metadata, QR generation, and gate verification
- `Next.js` for admin, fan, and gate staff interfaces
- `Algorand TestNet` for ticket proof transactions and demo account funding

Legacy Solidity/Hardhat files remain in the repository for coursework reference, but the live app flow is Algorand-only.

## What is implemented

- Super admin and admin sign-in
- Fan sign-up and sign-in
- Backend-generated Algorand fan accounts
- Automatic demo funding for new fan accounts
- Automatic demo fixture seeding for April-May 2026 matchdays
- Match creation with:
  - kickoff time
  - auto-calculated hidden end time (`+90 minutes`)
  - auto-filled transfer deadline (`-30 minutes` by default)
- Admin ticket issuance with Algorand proof transaction
- Fan ticket booking with Algorand proof transaction
- QR code generation
- Gate verification and check-in
- Ticket revocation
- Duplicate-entry rejection
- Persistent local fallback database storage

## Structure

- `algorand/` standalone tutorial-style Algorand scripts
- `contracts/` legacy Solidity prototype kept for reference
- `server/src/` Express API, Mongo models, Algorand service layer
- `client/app/` Next.js frontend routes

## Run

From the project root:

```bash
npm install
npm run server
```

In a separate terminal:

```bash
cd client
npm install
npm run dev
```

App URLs:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000`

## Backend setup

Create `server/.env` from `server/.env.example` and fill in:

- `MONGODB_URI` or leave empty to use the persistent local fallback DB
- `PERSISTENT_MONGO_PATH`
- `ALGOD_SERVER`
- `ALGOD_PORT`
- `ALGOD_TOKEN`
- `ACCOUNT_MNEMONIC`
- `ALGORAND_FAN_FUNDING_AMOUNT`
- `ALGORAND_CONFIRMATION_ROUNDS`
- `JWT_SECRET`
- `SUPER_ADMIN_NAME`
- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD`

Create `client/.env.local` from `client/.env.example` and set:

- `NEXT_PUBLIC_API_BASE_URL`

## API summary

- `GET /health`
- `POST /api/auth/admin/sign-in`
- `GET /api/auth/admin/me`
- `GET /api/auth/admin/list`
- `POST /api/auth/admin/create`
- `POST /api/auth/fan/sign-up`
- `POST /api/auth/fan/sign-in`
- `GET /api/auth/fan/me`
- `GET /api/matches`
- `POST /api/matches`
- `GET /api/tickets`
- `GET /api/tickets/:ticketId`
- `GET /api/tickets/mine`
- `POST /api/tickets`
- `POST /api/tickets/purchase`
- `POST /api/tickets/:ticketId/revoke`
- `POST /api/verification/check`
- `POST /api/verification/check-in`

## Frontend routes

- `/` landing page
- `/admin/sign-in` admin sign-in page
- `/admin` protected admin actions
- `/fan` fan auth, Algorand account details, match booking, and owned tickets
- `/fan/tickets/:ticketId` ticket detail view with proof transaction and match metadata
- `/gate` verification and check-in console with QR image upload decoding

## Demo flow

1. Sign in as admin
2. Create a match
3. Create or sign in as a fan
4. Mint or book a ticket
5. Open the ticket QR
6. Verify at `/gate`
7. Check in once
8. Verify again and confirm `Used`

## Demo fixtures

On backend startup, the app seeds a fixed demo schedule covering the supplied April-May 2026 fixtures. These are inserted idempotently, so restarting the backend refreshes the same fixture set instead of duplicating it.
