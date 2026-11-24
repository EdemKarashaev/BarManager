
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

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

let htmlCount = 0;
function stampHtml(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) stampHtml(path);
    else if (entry.name.endsWith('.html')) {
      const html = readFileSync(path, 'utf8');
      if (!html.includes('BM_BUILD_VERSION_PLACEHOLDER')) throw new Error(`Missing build version marker: ${path}`);
      writeFileSync(path, html.replaceAll('BM_BUILD_VERSION_PLACEHOLDER', version));
      htmlCount++;
    }
  }
}
stampHtml('dist');
if (!htmlCount) throw new Error('No exported HTML files found');
console.log('Stamped HTML files:', htmlCount);
console.log('PWA build version:', version);
console.log('Build date:', builtAt);
