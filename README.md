# Texas Hold'em Poker

A multiplayer Texas Hold'em poker project built with React, Vite, Express, and Supabase.

## Features

- Supabase authentication and player profiles
- Poker lobby with public and private rooms
- Table view with betting actions, chat, and live game state updates
- Server-side Texas Hold'em engine for dealing, betting rounds, and showdown resolution
- Persistent room, game, chat, and user settings data in Supabase

## Local development

### Prerequisites

- Node.js 20+
- A Supabase project with the schema from `supabase/migrations/001_initial_schema.sql`

### Environment variables

Copy `.env.example` to `.env` and fill in:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Run the app

```bash
npm install
npm run dev:all
```

This starts:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001`

## Available scripts

- `npm run dev` - start the Vite frontend
- `npm run server` - start the Express API with watch mode
- `npm run dev:all` - run frontend and backend together
- `npm run build` - create a production frontend build
- `npm run lint` - type-check the project
