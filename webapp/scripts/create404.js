import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const distDir = resolve(process.cwd(), 'dist')
const indexPath = resolve(distDir, 'index.html')
const fallbackPath = resolve(distDir, '404.html')

if (!existsSync(indexPath)) {
  console.error('[postbuild] dist/index.html does not exist; skipping 404.html creation')
  process.exit(1)
}

copyFileSync(indexPath, fallbackPath)
console.info('[postbuild] Created dist/404.html for SPA routing on GitHub Pages')
