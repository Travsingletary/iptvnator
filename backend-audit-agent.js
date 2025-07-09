// backend-audit-agent.js
const fetch = require('node-fetch');

const SUPABASE_URL = 'https://vifeazkwjreoxkspbygg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '<YOUR_SUPABASE_ANON_OR_SERVICE_KEY>';

const endpoints = [
  `${SUPABASE_URL}/rest/v1/user_playlists?select=id&limit=1`,
];

console.log('[AUDIT] Starting Supabase backend health audit...');

async function checkEndpoint(url) {
  try {
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });
    if (res.ok) {
      console.log(`[AUDIT] [OK] ${url} responded with 200`);
    } else {
      console.error(`[AUDIT] [FAIL] ${url} responded with status ${res.status}. This is not healthy. Investigate immediately.`);
    }
  } catch (err) {
    console.error(`[AUDIT] [ERROR] ${url} is unreachable: ${err.message}. This is unacceptable for a production system.`);
  }
}

(async () => {
  for (const url of endpoints) {
    await checkEndpoint(url);
  }
  console.log('[AUDIT] Supabase backend audit complete. If you see any errors above, do not ignore them. Fix them before proceeding.');
  if (SUPABASE_KEY === '<YOUR_SUPABASE_ANON_OR_SERVICE_KEY>') {
    console.warn('[AUDIT] [WARN] You must set your SUPABASE_KEY as an environment variable for this audit to work.');
  }
})(); 