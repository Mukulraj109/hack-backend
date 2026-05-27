# Deploy hackathon backend on Render

Repo: **https://github.com/Mukulraj109/hack-backend**

Config is **not** in git (`.env-cmdrc.json` is gitignored). On Render you paste the same keys as **Environment Variables**.

---

## 1. Create Web Service

1. [Render Dashboard](https://dashboard.render.com) → **New** → **Web Service**
2. Connect **GitHub** → select **hack-backend**
3. Use:

| Field | Value |
|--------|--------|
| **Name** | `hack-backend` (or your choice) |
| **Region** | Oregon (or nearest) |
| **Branch** | `main` |
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run start:render` |
| **Health Check Path** | `/health` |

Or use **Blueprint** with the repo’s `render.yaml`.

---

## 2. Environment variables (production)

Copy values from your local `backend/.env-cmdrc.json` → **`production`** block (or prod secrets from your team).

### Required

| Key | Example / notes |
|-----|------------------|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Prod Atlas connection string |
| `MONGODB_DATABASE` | `firststep_db` |
| `AUTH0_DOMAIN` | `auth.firststepjob.com` |
| `AUTH0_CLIENT_ID` | Prod SPA client ID (`b8FeZorUljdYnE8olnBA2FMM3RdJFyVv`) |
| `JWT_SECRET` | Long random string (generate new for Render) |
| `JWT_REFRESH_SECRET` | Long random string |
| `CORS_ORIGIN` | Your **frontend** URL, e.g. `https://hack-q28v.onrender.com` (comma-separate multiple) |
| `ZOHO_WEBHOOK_SECRET` | Same value you send in Zoho webhook header `x-zoho-secret` |

### Firebase (optional)

| Key | Value |
|-----|--------|
| `SKIP_FIREBASE` | `true` to skip, or `false` + keys below |

If `SKIP_FIREBASE=false`, also set:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_PRIVATE_KEY_ID`
- `FIREBASE_PRIVATE_KEY` — paste PEM as one line with `\n` between lines, or use Render’s multiline field

### Optional (Auth0 Management API)

- `USERMANAGEMENT_API_CLIENT_ID`
- `USERMANAGEMENT_API_CLIENT_SECRET`
- `USERMANAGEMENT_API_CLIENT_AUDIENCE`
- `USERMANAGEMENT_API_AUTH0_DOMAIN`

Do **not** set `PORT` — Render injects it automatically.

---

## 3. After deploy

1. Copy your service URL, e.g. `https://hack-backend.onrender.com`
2. Test: `GET https://YOUR-SERVICE.onrender.com/health` → `{"status":"ok",...}`
3. **Frontend**: set `VITE_API_BASE_URL=https://YOUR-SERVICE.onrender.com`
4. **Zoho webhook**: `POST https://YOUR-SERVICE.onrender.com/api/webhooks/zoho/registration`  
   Header: `x-zoho-secret: <ZOHO_WEBHOOK_SECRET>`
5. **MongoDB Atlas**: Network Access → allow `0.0.0.0/0` (or Render outbound IPs) so Render can reach Atlas

---

## 4. Deploy frontend (separate Static Site)

The React app lives in `protothon2021.webflow.io/` (may be a different repo).

1. **New** → **Static Site** → connect frontend repo/folder
2. **Build**: `npm install && npm run build`
3. **Publish directory**: `dist`
4. **Environment** (build-time — required for Vite):

| Key | Value |
|-----|--------|
| `VITE_API_BASE_URL` | `https://YOUR-BACKEND.onrender.com` |
| `VITE_AUTH0_DOMAIN` | `auth.firststepjob.com` |
| `VITE_AUTH0_CLIENT_ID` | Prod SPA client ID |
| `VITE_AUTH0_AUDIENCE` | `https://dev-88if81s7lx6zami7.us.auth0.com/api/v2/` |
| `VITE_AUTH0_CALLBACK_URL` | `https://YOUR-FRONTEND.onrender.com` |
| `VITE_ZOHO_FORM_URL` | Your Zoho form permalink |

5. **Auth0** (prod application): add frontend URL to **Allowed Callback URLs**, **Logout URLs**, **Web Origins**

---

## 5. Local vs Render

| | Local | Render |
|---|--------|--------|
| Config file | `backend/.env-cmdrc.json` | Dashboard env vars |
| Start | `npm run dev` | `npm run start:render` |
| Secrets in git | Never | Never |
