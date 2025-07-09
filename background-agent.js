#!/usr/bin/env node
const { exec } = require('child_process');
const readline = require('readline');
const fs = require('fs');

console.log('[INFO] 🚀 Background Agent Ready. Type a command: (deploy, git-status, check-health, setup-env, help, exit)');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'background-agent> '
});

function run(cmd, label) {
  console.log(`[INFO] Running: ${cmd}`);
  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.error(`[FAIL] ${label} failed. Details below:`);
      console.error(stderr || err.message);
    } else {
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
      if (label === 'deploy' && stdout.includes('error')) {
        console.error('[FAIL] Deployment failed. Fix all errors before retrying.');
      } else {
        console.log(`[OK] ${label} completed. If you see warnings or errors above, address them.`);
      }
    }
    rl.prompt();
  });
}

function setupEnv() {
  const envContent = `VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpZmVhemt3anJlb3hrc3BieWdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEzMDQ4MDMsImV4cCI6MjA2Njg4MDgwM30.uVLMPifHDUgdkOno3xfzM3NvPJf5EwzHJkx6_-xe4PM
`;
  
  try {
    fs.writeFileSync('.env', envContent);
    console.log('[OK] .env file created successfully with Supabase anon key.');
    console.log('[INFO] Restart your dev server (Ctrl+C then npm run serve) to load the new environment variables.');
  } catch (err) {
    console.error('[FAIL] Failed to create .env file:', err.message);
  }
  rl.prompt();
}

rl.prompt();
rl.on('line', (line) => {
  switch (line.trim()) {
    case 'deploy':
      run('npm run build:prod', 'deploy');
      break;
    case 'git-status':
      run('git status', 'git-status');
      break;
    case 'check-health':
      run('node backend-audit-agent.js', 'check-health');
      break;
    case 'setup-env':
      setupEnv();
      break;
    case 'help':
      console.log('Available commands: deploy, git-status, check-health, setup-env, help, exit');
      rl.prompt();
      break;
    case 'exit':
      rl.close();
      break;
    case 'migration-plan':
      console.log(`\n[Migration Plan: Move to Supabase]\n\
1. Install Supabase JS SDK in your frontend: npm install @supabase/supabase-js\n\
2. Create a Supabase client in your Angular app:\n   import { createClient } from '@supabase/supabase-js';\n   export const supabase = createClient('https://vifeazkwjreoxkspbygg.supabase.co', '<anon-key>');\n\
3. Refactor all services (PlaylistsService, ChannelsService, EpgService, FavoritesService, etc.) to use Supabase REST API calls instead of IndexedDB or IPC.\n   Example:\n     const { data, error } = await supabase.from('playlists').select('*').eq('user_id', user.id);\n\
4. Update all data models to match the Supabase schema (field names, types, relationships).\n\
5. Implement Supabase Auth flows:\n   - Sign up, sign in, sign out users\n   - Use the user's JWT for all API requests\n\
6. Update NgRx effects and selectors to use Supabase API responses.\n\
7. Remove all Tauri/IndexedDB/IPC code that is no longer needed.\n\
8. Test all flows: playlist import, channel browsing, EPG, favorites, etc.\n\
9. Use the audit agent to verify backend health after each migration step.\n\
10. Document any new backend needs as you discover them.\n\
[End Migration Plan]\n`);
      rl.prompt();
      break;
    default:
      console.log(`[INFO] Unknown command: ${line.trim()}. Type 'help' for available commands.`);
      rl.prompt();
      break;
  }
});