import { before, after, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { preview, type PreviewServer } from 'vite'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { solidPngDataUrl } from '../helpers/png'

// Shared setup for the browser tests: serves the production build (run
// `npm run build` first) and gives each test a fresh browser context, so
// storage never leaks between tests.

// ownBack: false leaves the card's back empty (the deck's sharedBack is used).
// backGroup: cards with the same group get the identical back image.
export type SeedCard = { id: string; hue: number; copies?: number; ownBack?: boolean; backGroup?: number }

// Pass { mobile: true } for a touch phone, which switches the app to its mobile layout.
export function setupApp({ mobile = false } = {}) {
  let server: PreviewServer
  let browser: Browser
  let context: BrowserContext
  let page: Page
  let baseUrl: string
  // The app asks questions in its own dialogs; any native window.confirm/alert fails the test.
  // The "leave site?" prompt from unsaved-work protection is expected on reload and accepted.
  let nativeDialogs: string[] = []

  before(async () => {
    assert.ok(existsSync('dist/index.html'), 'run `npm run build` before the e2e tests')
    server = await preview({ preview: { port: 0, strictPort: false }, logLevel: 'error' })
    baseUrl = server.resolvedUrls!.local[0]
    // CI installs Playwright's Chromium; locally fall back to an installed Chrome.
    browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' }))
  })

  after(async () => {
    await browser?.close()
    await server?.close()
  })

  beforeEach(async () => {
    context = await browser.newContext(mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true }
      : { viewport: { width: 1280, height: 900 }, acceptDownloads: true })
    // tsx compiles page.evaluate callbacks with an esbuild __name helper the page doesn't have.
    await context.addInitScript('globalThis.__name = (fn) => fn')
    page = await context.newPage()
    nativeDialogs = []
    page.on('dialog', d => {
      if (d.type() === 'beforeunload') { void d.accept(); return }
      nativeDialogs.push(`${d.type()}: ${d.message()}`)
      void d.dismiss()
    })
    await page.goto(baseUrl)
    await page.waitForLoadState('networkidle')
  })

  afterEach(async () => {
    await context?.close()
    assert.deepEqual(nativeDialogs, [], 'the app opened a native browser dialog')
  })

  async function reload() {
    await page.reload()
    await page.waitForLoadState('networkidle')
  }

  // Writes a project straight into IndexedDB, then reloads so the app hydrates it.
  async function seed(presetId: string, decks: SeedCard[][], imageSize = { w: 70, h: 105 }) {
    await page.evaluate(async ({ presetId, decks, imageSize }) => {
      const image = (hue: number) => {
        const c = document.createElement('canvas')
        c.width = imageSize.w; c.height = imageSize.h
        const g = c.getContext('2d')!
        // Coarse noise keeps each image distinct and a realistic size.
        for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) {
          g.fillStyle = `hsl(${hue + Math.random() * 40},70%,${30 + Math.random() * 40}%)`
          g.fillRect(x, y, 2, 2)
        }
        return c.toDataURL('image/png')
      }
      const groupBacks = new Map<number, string>()
      const backFor = (c: { hue: number; backGroup?: number }) => {
        if (c.backGroup === undefined) return image(c.hue + 180)
        if (!groupBacks.has(c.backGroup)) groupBacks.set(c.backGroup, image(c.backGroup * 60 + 20))
        return groupBacks.get(c.backGroup)!
      }
      const project = {
        preset: { id: presetId },
        decks: decks.map(cards => ({
          cards: cards.map(c => ({ id: c.id, front: image(c.hue), back: c.ownBack === false ? null : backFor(c) })),
          copies: Object.fromEntries(cards.map(c => [c.id, c.copies ?? 1])),
          sharedBack: cards.some(c => c.ownBack === false) ? image(300) : null,
        })),
      }
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('pocalab', 1)
        req.onupgradeneeded = () => req.result.createObjectStore('kv')
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('kv', 'readwrite')
        tx.objectStore('kv').put(project, 'project')
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
      db.close()
    }, { presetId, decks, imageSize })
    await reload()
  }

  // Reads the saved project back out of IndexedDB.
  async function stored(): Promise<{ preset: { id: string }; decks: { cards: { id: string; front: string | null; back: string | null }[]; copies: Record<string, number>; sharedBack: string | null }[] } | null> {
    return page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>(r => { const q = indexedDB.open('pocalab', 1); q.onsuccess = () => r(q.result) })
      const value = await new Promise<unknown>(r => { const q = db.transaction('kv').objectStore('kv').get('project'); q.onsuccess = () => r(q.result) })
      db.close()
      return (value ?? null) as never
    })
  }

  return {
    get page() { return page },
    // Answers the app's confirmation dialog, checking its question first.
    async answer(question: RegExp, button: string) {
      const dialog = page.getByRole('alertdialog')
      await dialog.waitFor()
      assert.match(await dialog.innerText(), question)
      await dialog.getByRole('button', { name: button, exact: true }).click()
      await dialog.waitFor({ state: 'detached' })
    },
    reload,
    seed,
    stored,
  }
}

export const pngFile = (name: string, w: number, h: number, rgb: [number, number, number]) => ({
  name,
  mimeType: 'image/png',
  buffer: Buffer.from(solidPngDataUrl(w, h, rgb).split(',')[1], 'base64'),
})
