import { mkdir, rm, readFile, writeFile } from 'node:fs/promises'

const html = await readFile('index.html', 'utf8')
let css = await readFile('src/styles.css', 'utf8')
let model = await readFile('src/model.js', 'utf8')
let app = await readFile('src/app.js', 'utf8')

// Собираем ES-модули в один IIFE без import/export.
const stripExports = (code) => code
  .replace(/^export\s+function\s+/gm, 'function ')
  .replace(/^export\s+/gm, '')

model = stripExports(model)
app = app.replace(/import\s*{[^}]*}\s*from\s*['"]\.\/model\.js['"]\s*;?\n?/, '')

// Порядок важен: model раньше app.
const bundle = `(function(){\n${model}\n${app}\n})();`

// Разрешаем cache-busting query (?v=...) в исходном index.html.
const inlined = html
  .replace(
    /<link\s+rel=["']stylesheet["']\s+href=["']\.\/src\/styles\.css(?:\?[^"']*)?["']\s*\/?>/,
    `<style>\n${css}\n</style>`,
  )
  .replace(
    /<script\s+type=["']module["']\s+src=["']\.\/src\/app\.js(?:\?[^"']*)?["']\s*><\/script>/,
    `<script>\n${bundle}\n</script>`,
  )

// Не выдаем ложное "single file", если шаблон внезапно изменился.
if (/\.\/src\/(?:app\.js|styles\.css)/.test(inlined)) {
  throw new Error('Build failed: app.js or styles.css was not inlined into dist/index.html')
}

await rm('dist', { recursive: true, force: true })
await mkdir('dist', { recursive: true })
await writeFile('dist/index.html', inlined)
await writeFile('dist/.nojekyll', '')
console.log(`Built dist/index.html (${Math.round(inlined.length / 1024)} KB, single file)`)
