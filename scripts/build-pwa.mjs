
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const version = randomUUID();
const builtAt = new Date().toISOString();

const swPath = 'dist/sw.js';

const source = readFileSync(swPath, 'utf8');

const updated = source.replace(
  "const CACHE_NAME = 'bar-manager-shell-v1';",
  `const CACHE_NAME = 'bar-manager-shell-${version}';`
);

if (updated === source) {
  throw new Error('Cache version placeholder not found');
}

writeFileSync(swPath, updated);

writeFileSync(
  'dist/version.json',
  JSON.stringify({ version, builtAt }, null, 2)
);

console.log('PWA build version:', version);
console.log('Build date:', builtAt);
