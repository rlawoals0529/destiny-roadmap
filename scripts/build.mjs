import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'style.css', 'app.js', 'core.js', 'data.js', 'favicon.svg']) await copyFile(file, 'dist/' + file);
console.log('Static site built. Six public files; no runtime dependencies.');
