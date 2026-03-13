# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Frontend only (Vite, port 3000)
npm run server     # Backend only (Express, port 3001, tsx watch)
npm run dev:all    # Both frontend and backend concurrently
npm run build      # Production build
npm run lint       # TypeScript type-check only (tsc --noEmit, no ESLint)
```

## Environment Setup

Copy `.env.example` to `.env` and fill in:
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — used by the Express server (admin access)
- `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` — used by the frontend (public access)

## Architecture

This is a Texas Hold'em poker game with a React frontend and a separate Express backend, both written in TypeScript.

### Frontend (`src/`)

- **Routing**: No React Router. `App.tsx` manages a `currentView` state (`'main' | 'lobby' | 'game' | 'settings'`) and renders the appropriate component directly.
- **Auth**: `AuthContext` wraps the app; `useAuth` hook provides `user` and `loading`. Unauthenticated users see `LoginRegister`.
- **Data layer**: All server communication goes through `src/lib/api.ts` (a thin fetch wrapper that attaches the Supabase JWT). Supabase client is in `src/lib/supabase.ts`.
- **Real-time**: `useGame` subscribes to two Supabase broadcast channels per room — a public `room:{roomId}` channel for game state, and a private `room:{roomId}:private:{userId}` channel for hole cards.
- **Hooks**: `useGame`, `useRooms`, `useChat`, `useAuth`, `useSettings` encapsulate all data fetching and real-time subscriptions.

### Backend (`server/`)

- **Entry point**: `server/index.ts` — Express app on port 3001. Routes: `/api/auth`, `/api/rooms`, `/api/games`, `/api/rooms` (chat), `/api/settings`.
- **Auth middleware**: `server/middleware/auth.ts` validates the Supabase JWT on protected routes.
- **Game engine** (`server/engine/`):
  - `types.ts` — shared TypeScript types for game state
  - `deck.ts` — card deck creation and shuffling
  - `hand-evaluator.ts` — poker hand ranking
  - `pot-calculator.ts` — side pot calculation
  - `game-state.ts` — `GameStateMachine` class managing a single hand's lifecycle (phases: preflop → flop → turn → river → showdown → complete)
  - `game-manager.ts` — `GameManager` singleton managing all active rooms' `GameStateMachine` instances, including a 30-second auto-fold turn timer
- **Real-time broadcasting** (`server/realtime/broadcaster.ts`): Uses Supabase admin client to push game state, hole cards, chat messages, and room updates to Supabase broadcast channels.

### Key Data Flow

1. Client calls `POST /api/games/{roomId}/action` with a player action
2. Server's `GameManager.handleAction()` processes it through `GameStateMachine`
3. Server calls `broadcastGameState()` which sends public state to `room:{roomId}` and private hole cards to each player's private channel
4. Client's `useGame` hook receives the broadcast and updates React state

### Deployment

Supports both local development and Vercel serverless. The server exports the Express `app` as default and only calls `app.listen()` when `process.env.VERCEL` is not set.
