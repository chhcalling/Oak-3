require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const app = express();
app.use(express.json({ limit: '2mb' }));

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('\n❌  ANTHROPIC_API_KEY is not set — please add it in Railway environment variables.\n');
  process.exit(1);
}

// PostgreSQL connection pool
if (!process.env.DATABASE_URL) {
  console.warn('\n⚠️   DATABASE_URL is not set — database features will be unavailable.\n');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.connect()
  .then(client => {
    console.log('✅  Connected to PostgreSQL database');
    client.release();
  })
  .catch(err => {
    console.error('❌  Failed to connect to PostgreSQL database:', err.message);
  });

// Proxy to Anthropic
app.post('/api/messages', async (req, res) => {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(500).json({ error: { type: 'proxy_error', message: err.message } });
  }
});

// Health check — verifies database connectivity
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS now');
    res.json({ status: 'ok', db_time: result.rows[0].now });
  } catch (err) {
    console.error('Health check failed:', err.message);
    res.status(503).json({ status: 'error', message: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅  Oak Insight running on port ${PORT}`);
});

// Serve built React app in production
// NOTE: must be registered AFTER all API routes so the catch-all does not
// intercept requests like /api/health before they reach their handlers.
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}
