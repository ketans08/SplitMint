# SplitMint — Your Gateway to Karbon

MERN prototype for group expense splitting with balances and settlements.

## Setup

1. Start MongoDB locally or use Atlas.
2. Backend:

```powershell
cd backend
copy .env.example .env
npm install
npm run dev
```

3. Frontend:

```powershell
cd frontend
copy .env.example .env
npm install
npm run dev
```

Open http://localhost:5173.

## Invite Flow
- Add participant by email.
- If the email already has an account, it is linked immediately.
- Otherwise a pending invite is created and will link automatically when that email registers.

## MintSense (Heuristic)
- Parse natural language into expense drafts.
- Auto-category using keyword rules.
- Generate group summaries and settlement narratives.

## Features
- Email/password auth
- Groups with max 3 participants + primary user
- Participants CRUD with invite linking
- Expense splitting: equal, custom, percentage
- Balance engine with settlement suggestions
- Search and filters
- Color-coded ledger
