import { cp, mkdir, rm } from 'node:fs/promises'

await rm('dist', { recursive: true, force: true })
await mkdir('dist/src', { recursive: true })
await cp('index.html', 'dist/index.html')
await cp('src/app.js', 'dist/src/app.js')
await cp('src/model.js', 'dist/src/model.js')
await cp('src/styles.css', 'dist/src/styles.css')
console.log('Built dist/ with self-contained static Mini App')
