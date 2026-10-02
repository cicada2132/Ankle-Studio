const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'web'), { recursive: true });
for (const name of ['index.html', 'web/app.js', 'web/core.js', 'web/styles.css']) fs.copyFileSync(path.join(root, name), path.join(out, name));
console.log('Built static app in dist/ (API requires separate local server).');
