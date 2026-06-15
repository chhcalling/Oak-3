# Oak Insight Intelligence Platform

## Deploy to Railway (recommended — works from iPad)

1. **Create a free account** at https://railway.app

2. **Push this project to GitHub**
   - Create a new repo at https://github.com/new
   - Upload all these files (drag and drop works on github.com)

3. **Deploy on Railway**
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repo
   - Railway will detect the config and build automatically

4. **Add your API key**
   - In Railway, go to your project → Variables
   - Add: `ANTHROPIC_API_KEY` = your key from https://console.anthropic.com
   - Railway will redeploy automatically

5. **Open your app**
   - Railway gives you a URL like `oak-insight-production.up.railway.app`
   - Open it on any device — iPad, phone, anything

---

## Run locally (requires a laptop/desktop with Node.js 18+)

```
npm install
cp .env.example .env
# edit .env and add your Anthropic API key
npm run dev
```
Open http://localhost:3000

---

## Cost
- Railway free tier: 500 hours/month (enough for personal use)
- Anthropic API: pay per use — a letter draft costs roughly $0.01
