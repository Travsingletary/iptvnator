#!/usr/bin/env node
const { exec } = require('child_process');
const readline = require('readline');

console.log('[INFO] 🤖 Development Assistant Ready. Type a command: (test, lint, help, exit)');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'dev-assistant> '
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
      if (label === 'test' && stdout.includes('failed')) {
        console.error('[FAIL] Some tests failed. Do not ignore this. Fix before proceeding.');
      } else {
        console.log(`[OK] ${label} completed. If you see warnings or errors above, address them.`);
      }
    }
    rl.prompt();
  });
}

rl.prompt();
rl.on('line', (line) => {
  switch (line.trim()) {
    case 'test':
      run('npm test', 'test');
      break;
    case 'lint':
      run('npm run lint', 'lint');
      break;
    case 'help':
      console.log('Available commands: test, lint, help, exit');
      rl.prompt();
      break;
    case 'exit':
      rl.close();
      break;
    default:
      console.log(`[WARN] Unknown command: ${line.trim()}`);
      rl.prompt();
  }
}).on('close', () => {
  console.log('[INFO] Development Assistant exiting.');
  process.exit(0);
}); 