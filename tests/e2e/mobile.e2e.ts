import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import type { Page } from 'playwright'
import { setupApp, pngFile } from './harness'

// On touch devices the export and add buttons live in a fixed bottom bar.

const app = setupApp({ mobile: true })
let page: Page
beforeEach(() => { page = app.page })

test('the bottom bar downloads the PDF and adds images', async () => {
  await app.seed('letter', [[{ id: 'a', hue: 0 }, { id: 'b', hue: 120 }]])
  const bar = page.locator('.deck-bar')
  assert.equal(await bar.isVisible(), true)
  assert.equal(await page.locator('.deck-actions--desktop').isVisible(), false)

  const download = page.waitForEvent('download')
  await bar.getByRole('button', { name: 'Download PDF' }).click()
  assert.equal((await download).suggestedFilename(), 'photocards.pdf')

  await bar.locator('input[type=file]').setInputFiles(pngFile('front.png', 300, 450, [200, 0, 0]))
  await page.getByRole('button', { name: 'Confirm crop' }).waitFor()
})
