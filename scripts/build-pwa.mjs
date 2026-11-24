
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

// Restore PWA metadata for Expo SPA builds.
const indexPath = 'dist/index.html';
let indexHtml = readFileSync(indexPath, 'utf8');

if (!indexHtml.includes('BM_BUILD_VERSION_PLACEHOLDER')) {
  const pwaHead = `
    <meta name="bm-build-version" content="BM_BUILD_VERSION_PLACEHOLDER" />
    <meta name="theme-color" content="#151518" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Bar Manager" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/icons/icon-192.png" />
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
          navigator.serviceWorker.register('/sw.js', {
            updateViaCache: 'none'
          }).catch(console.error);
        });
      }
    </script>
  `;

  if (!indexHtml.includes('</head>')) {
    throw new Error('HTML head not found');
  }

  indexHtml = indexHtml.replace('</head>', pwaHead + '</head>');
  writeFileSync(indexPath, indexHtml);
}

stampHtml('dist');

const offlineFiles = new Set(['/']);

function collectOfflineFiles(directory) {
  for (const entry of readdirSync(directory, {
    withFileTypes: true
  })) {
    const path = `${directory}/${entry.name}`;

    if (entry.isDirectory()) {
      collectOfflineFiles(path);
    } else if (
      entry.name.endsWith('.html') ||
      path.startsWith('dist/_expo/static/') ||
      path.startsWith('dist/assets/') ||
      path.startsWith('dist/icons/') ||
      entry.name === 'manifest.webmanifest'
    ) {
      offlineFiles.add(path.slice(4));
    }
  }
}

collectOfflineFiles('dist');

const worker = readFileSync(swPath, 'utf8');

if (!worker.includes('BM_OFFLINE_FILES_PLACEHOLDER')) {
  throw new Error('Offline files placeholder missing');
}

writeFileSync(
  swPath,
  worker.replace(
    "'BM_OFFLINE_FILES_PLACEHOLDER'",
    JSON.stringify([...offlineFiles])
  )
);

console.log('Offline resources:', offlineFiles.size);

if (!htmlCount) throw new Error('No exported HTML files found');
console.log('Stamped HTML files:', htmlCount);
console.log('PWA build version:', version);
console.log('Build date:', builtAt);
