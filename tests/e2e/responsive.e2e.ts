import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import type { Page } from 'playwright'
import { setupApp, pngFile } from './harness'

// No screen should scroll sideways on a phone: a horizontal scrollbar hides
// controls and makes the crop editor hard to use (audit #14).

const app = setupApp({ mobile: true })
let page: Page
beforeEach(() => { page = app.page })

async function assertNoSidewaysScroll(screen: string) {
  const result = await page.evaluate(() => {
    const doc = document.documentElement
    const offenders: string[] = []
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      if (el.matches('.skip-link')) continue
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && (rect.right > doc.clientWidth + 1 || rect.left < -1)) {
        offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${Math.round(rect.left)}→${Math.round(rect.right)}`)
      }
    }
    return { viewport: doc.clientWidth, scrollWidth: doc.scrollWidth, offenders: offenders.slice(0, 8) }
  })
  assert.ok(
    result.scrollWidth <= result.viewport,
    `${screen}: page scrolls sideways (${result.scrollWidth} > ${result.viewport}). Overflowing: ${result.offenders.join(', ') || 'none found'}`,
  )
}

test('the deck, crop editor and back step fit a phone screen', async () => {
  await assertNoSidewaysScroll('start screen')

  await app.seed('letter', [[{ id: 'a', hue: 0, copies: 2 }, { id: 'b', hue: 120 }]])
  await assertNoSidewaysScroll('deck, Letter')

  await page.getByRole('button', { name: 'See Preview' }).click()
  await assertNoSidewaysScroll('sheet preview')
  await page.keyboard.press('Escape')

  await page.locator('.deck-bar input[type=file]').setInputFiles(pngFile('front.png', 900, 1400, [200, 0, 0]))
  await page.getByRole('button', { name: 'Confirm crop' }).waitFor()
  await page.waitForTimeout(300)
  await assertNoSidewaysScroll('crop editor')

  await page.getByRole('button', { name: 'Confirm crop' }).click()
  await page.getByText('Step 2 of 2 — Add the card back').waitFor()
  await assertNoSidewaysScroll('back step')
})

test('photo paper deck with two sheets fits a phone screen', async () => {
  await app.seed('5x7-3up', [[{ id: 'a', hue: 0 }, { id: 'b', hue: 60 }], [{ id: 'c', hue: 120 }]])
  await assertNoSidewaysScroll('photo paper deck')
  await page.getByRole('button', { name: 'Move →' }).first().click()
  await assertNoSidewaysScroll('move menu open')
  await page.locator('.print-guidance').evaluate(d => { (d as HTMLDetailsElement).open = true })
  await assertNoSidewaysScroll('print settings open')
})
