# Deploy backend to Railway

## If you deployed the full chat-app repo (not only server)

That’s fine. In Railway:

1. Open **chat-app** service → **Settings**
2. Set **Root Directory** to: `server`
3. Save
4. Add Variables (`DATABASE_URL`, `JWT_SECRET`, `DEEPL_API_KEY`)
5. Click **Redeploy**

Or leave Root Directory empty — root `railway.toml` will install/start the server folder.

## Before you start
1. Push this project to GitHub (do **not** commit `server/.env`).
2. Have ready: Neon `DATABASE_URL`, `JWT_SECRET`, `DEEPL_API_KEY`.

## Steps on Railway

1. Go to [https://railway.app](https://railway.app) → sign in with GitHub.
2. **New Project** → **Deploy from GitHub repo** → select this repo.
3. Open the service → **Settings**:
   - **Root Directory:** `server`
4. Open **Variables** and add:

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | your Neon connection string |
| `JWT_SECRET` | same long secret from local `.env` |
| `DEEPL_API_KEY` | your DeepL key |
| `VAPID_PUBLIC_KEY` | from `npx web-push generate-vapid-keys` (same as local `server/.env`) |
| `VAPID_PRIVATE_KEY` | matching private key |
| `VAPID_SUBJECT` | e.g. `mailto:hello@friendforeverchat.app` |
| `CLIENT_ORIGIN` | leave empty for now; set to Netlify URL later (e.g. `https://yoursite.netlify.app`) |

5. **Settings → Networking → Generate Domain**  
   Copy the URL, e.g. `https://friends-forever-chat-production.up.railway.app`
6. Wait until deploy is **Success**.
7. Test in browser: `https://YOUR-RAILWAY-URL/api/health`  
   Should show: `{"ok":true}`

## After Railway works
Deploy the frontend to Netlify with:

```
VITE_API_URL=https://YOUR-RAILWAY-URL
```

Then set on Railway:

```
CLIENT_ORIGIN=https://YOUR-NETLIFY-URL
```

Redeploy Railway after adding `CLIENT_ORIGIN`.

## Local still works
`npm run dev` in the project root — Vite proxy handles `/api` locally; no `VITE_API_URL` needed.
