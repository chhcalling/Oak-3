# Oak Insight Intelligence Platform

## Deploy to Railway

### 1. Push to GitHub
- Create a repo at https://github.com/new
- Upload all files (drag and drop on github.com works fine)

### 2. Create Railway project
- Go to railway.app → New Project → Deploy from GitHub repo
- Select your repo — Railway will build automatically

### 3. Add a Postgres database
- In your Railway project, click **+ New** → **Database** → **Postgres**
- Railway automatically sets `DATABASE_URL` in your service — no copying needed

### 4. Add your Anthropic API key
- Click your service → **Variables**
- Add: `ANTHROPIC_API_KEY` = your key from https://console.anthropic.com

### 5. Get your URL
- Click your service → **Settings** → scroll to **Networking**
- Click **Generate Domain** — bookmark that URL on your iPad

---

## Run locally (requires Node.js 18+ and a Postgres database)

```
npm install
cp .env.example .env
# Fill in ANTHROPIC_API_KEY and DATABASE_URL in .env
npm run dev
```
Open http://localhost:3000

---

## What gets stored in Postgres
- Pipeline CRM logs and notes (`oak-crm-logs`, `oak-crm-notes`)
- Calendar custom events (`oak-calendar-custom`)

All data syncs across devices in real time.
