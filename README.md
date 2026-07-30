# Friends Forever Chat

Realtime chat where **email is your ID**, with **English / Chinese** UI and **automatic message translation**.

## Features

- Register / login with email + password
- Start a chat by entering someone’s email
- Choose English (default) or Chinese — the whole UI switches
- Incoming messages auto-translate to your language (no translate button)
- Tap a received message to peek at the original text

## Stack

- **Client:** Vite + React + TypeScript + Socket.IO client
- **Server:** Express + Socket.IO + JSON file store
- **Translation:** DeepL Free (optional key) with MyMemory fallback

## Env vars (`server/.env`)

```env
DEEPL_API_KEY=your_deepl_key
JWT_SECRET=long_random_secret
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require
PORT=3001
```

### Neon Postgres setup
1. Create a free project at [https://neon.tech](https://neon.tech)
2. Open **Dashboard → Connection details**
3. Copy the connection string
4. Paste into `server/.env` as `DATABASE_URL=...`
5. Restart `npm run dev`
6. Server should log: `Postgres: connected and schema ready`

**Do not paste your Neon password/URL in chat.** Keep it only in `.env`.

Tables (`users`, `conversations`, `messages`) are created automatically on startup.

Copy from `server/.env.example`. Never commit `.env`.

## Deploying (important)

This app uses **Socket.IO** (realtime websockets). **Vercel alone is not a good fit** for the chat server — Vercel is serverless and websocket connections don't stay open reliably.

### Recommended free/cheap hosts
| Part | Where |
|------|--------|
| Frontend (React) | Vercel |
| Backend (Express + Socket.IO) | **Railway**, **Render**, or **Fly.io** |
| Database (later) | **Neon** Postgres (optional upgrade) |

### Do you need Neon?
- **Not yet** — the app currently uses a JSON file (`server/data/db.json`).
- **Yes later** if you deploy for real users — file storage won't work well on cloud; then Neon Postgres is a good free option.
- **Do not send me your Neon password/connection string in chat.** Put it in `.env` / host env vars only.

### Simple live setup
1. Deploy **server** to Railway/Render → get a URL like `https://your-api.up.railway.app`
2. Deploy **client** to Vercel with env `VITE_API_URL=https://your-api.up.railway.app`
3. Set on the server host: `JWT_SECRET`, `DEEPL_API_KEY`

I can help wire Vercel (frontend) + Railway (backend) next — say which host you prefer.

## Run

Needs Node.js 20+.

```bash
cd "chat app"
npm install --prefix server
npm install --prefix client
npm install
npm run dev
```

- App: http://localhost:5173  
- API: http://localhost:3001  

## Try it

1. Open the app in two browsers (or one normal + one private window).
2. Register `alice@test.com` with language **English**.
3. Register `bob@test.com` with language **中文**.
4. From Alice: **New chat** → `bob@test.com` → send `Hello, how are you?`
5. Bob should see a Chinese translation automatically.

## Notes

- Data is stored in `server/data/db.json`.
- MyMemory has rate limits; for production you can swap in DeepL or Google Translate in `server/src/translate.ts`.
- Image/screenshot OCR was deferred for a later version.
