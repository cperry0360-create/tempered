import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'
// vitest/config re-exports Vite's defineConfig with the `test` key added.
import { defineConfig } from 'vitest/config'

// Project pages are served from https://<user>.github.io/tempered/, so every
// asset URL needs that prefix. Override with BASE_PATH=/ for a root deploy.
const base = process.env.BASE_PATH ?? '/tempered/'

// Files copied verbatim from public/ never appear in the Rollup bundle, so the
// service worker would not know to precache them. List them here.
const publicPrecache = [
  'manifest.webmanifest',
  'icons/icon-180.png',
  'icons/icon-512.png',
  'icons/icon-1024.png',
]

/**
 * Emits dist/sw.js from src/pwa/sw-template.js with the real, content-hashed
 * build output baked into its precache list.
 */
function serviceWorker(): Plugin {
  return {
    name: 'tempered-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const resolvedBase = base.endsWith('/') ? base : `${base}/`
      const urls = new Set<string>([resolvedBase])
      for (const fileName of Object.keys(bundle)) urls.add(resolvedBase + fileName)
      for (const fileName of publicPrecache) urls.add(resolvedBase + fileName)

      const precache = [...urls].sort()
      // Naming the cache after its contents means activate() only clears the
      // old cache when the build actually changed.
      const cacheName = `tempered-${createHash('sha256')
        .update(precache.join('\n'))
        .digest('hex')
        .slice(0, 12)}`

      const template = readFileSync(new URL('./src/pwa/sw-template.js', import.meta.url), 'utf8')
      const constants: Record<string, string> = {
        __CACHE_NAME__: cacheName,
        __PRECACHE__: JSON.stringify(precache, null, 2),
        __SHELL__: resolvedBase,
      }
      // replaceAll, not replace: a token left behind would ship a broken worker.
      const source = Object.entries(constants).reduce(
        (out, [token, value]) => out.replaceAll(token, value),
        template,
      )

      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

export default defineConfig({
  base,
  plugins: [serviceWorker()],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
