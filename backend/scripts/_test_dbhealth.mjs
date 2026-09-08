import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envLine = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8')
  .split('\n').find((l) => l.startsWith('DATABASE_URL='));
const url = envLine.slice('DATABASE_URL='.length).trim();
const tunneled = url.replace(/@[^/]+/, '@127.0.0.1:5434');
process.env.DATABASE_URL = tunneled;

const { runDbHealthCheck } = await import('../src/services/dbHealthWatchdog.js');
const r = await runDbHealthCheck();
console.log(JSON.stringify(r, null, 2));
process.exit(r.ok ? 0 : 1);