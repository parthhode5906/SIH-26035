import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const distRoot = new URL('../dist/', import.meta.url)
const swUrl = new URL('sw.js', distRoot)
const assets = (await readdir(new URL('assets/', distRoot)))
  .filter((name) => /\.(?:js|css)$/.test(name))
  .sort()
  .map((name) => `/assets/${name}`)

const source = await readFile(swUrl, 'utf8')
const manifest = assets.map((asset) => `  '${asset}',`).join('\n')
const updated = source.replace('  /* @vite-asset-manifest */', manifest)
if (updated === source) throw new Error('service-worker asset manifest marker not found')
await writeFile(swUrl, updated)
