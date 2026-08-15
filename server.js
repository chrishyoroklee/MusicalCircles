// Static file server for the production build. Run `npm run build` first.

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, 'dist');
const PORT = process.env.PORT || 3031;

if (!existsSync(path.join(dist, 'index.html'))) {
  console.error('No build found in ./dist. Run `npm run build` first.');
  process.exit(1);
}

const app = express();

app.use(
  express.static(dist, {
    // Hashed asset filenames can be cached hard; index.html must not be.
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
      else res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  }),
);

// Everything else falls back to the app shell.
app.use((req, res) => {
  res.sendFile(path.join(dist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Musical Circles running on http://localhost:${PORT}`);
});
