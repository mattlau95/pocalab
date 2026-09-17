import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import { setupApp, pngFile } from './harness'
import { CARD_BLEED } from '../../src/utils/dimensions'

const app = setupApp()
const seed = app.seed
let page = app.page
beforeEach(() => { page = app.page })

const headerCount = () => page.locator('.app-header__count').textContent()

test('a 10+ card project well past the old localStorage quota survives a reload', async () => {
  const cards = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, hue: i * 30 }))
  await seed('letter', [cards.slice(0, 9), cards.slice(9)], { w: 697, h: 1051 })
  const size = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(r => { const q = indexedDB.open('pocalab', 1); q.onsuccess = () => r(q.result) })
    const value = await new Promise<unknown>(r => { const q = db.transaction('kv').objectStore('kv').get('project'); q.onsuccess = () => r(q.result) })
    db.close()
    return JSON.stringify(value).length
  })
  assert.ok(size > 10_000_000, `seeded project should exceed 10 MB, was ${(size / 1e6).toFixed(1)} MB`)
  assert.equal(await page.locator('.deck-card').count(), 12)

  await page.getByRole('button', { name: 'Increase copies' }).nth(9).click()
  await page.locator('.app-header__save--saved').waitFor()
  await page.reload()
  await page.waitForLoadState('networkidle')
  assert.equal(await page.locator('.deck-card').count(), 12)
  assert.equal(await page.locator('.copies-count').nth(9).textContent(), '2')
})

test('save status: nothing on load, Saved after a change, Not saved when a write fails', async () => {
  await seed('letter', [[{ id: 'a', hue: 0 }, { id: 'b', hue: 200 }]])
  assert.equal(await page.locator('.app-header__save').count(), 0)

  await page.getByRole('button', { name: 'Increase copies' }).first().click()
  await page.locator('.app-header__save--saved').waitFor()

  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () { throw new DOMException('Quota exceeded', 'QuotaExceededError') }
  })
  await page.getByRole('button', { name: 'Increase copies' }).first().click()
  await page.locator('.app-header__save--error').waitFor()
  assert.match(await page.locator('.toast--error').innerText(), /Couldn't save/)
  await page.getByRole('button', { name: 'Dismiss' }).click()
  assert.equal(await page.locator('.toast--error').count(), 0)
})

test('sheet preview shows each card as many times as its copies (Letter)', async () => {
  await seed('letter', [[{ id: 'a', hue: 0, copies: 5 }, { id: 'b', hue: 200 }]])
  const counts = async () => {
    await page.getByRole('button', { name: 'See Preview' }).click()
    const sheets = page.locator('.sheet-preview-pair svg.sheet-preview')
    const result = [await sheets.nth(0).locator('image').count(), await sheets.nth(1).locator('image').count()]
    await page.getByRole('button', { name: 'Close' }).last().click()
    return result
  }
  assert.deepEqual(await counts(), [6, 6])
  await page.getByRole('button', { name: 'Increase copies' }).nth(1).click()
  assert.deepEqual(await counts(), [7, 7])
})

test('sheet preview on photo paper shows one slot per card, like its PDF', async () => {
  await seed('5x7-4up', [[{ id: 'a', hue: 0, copies: 2 }, { id: 'b', hue: 200 }]])
  await page.getByRole('button', { name: 'See Preview' }).click()
  const sheets = page.locator('.sheet-preview-pair svg.sheet-preview')
  assert.equal(await sheets.nth(0).locator('image').count(), 2)
  assert.equal(await sheets.nth(1).locator('image').count(), 2)
})

test('Download PDF reports progress and produces a two-page PDF with every copy', async () => {
  await seed('letter', [[{ id: 'a', hue: 0, copies: 3 }, { id: 'b', hue: 200 }]])
  await page.evaluate(() => {
    const w = window as unknown as { labels: string[] }
    w.labels = []
    new MutationObserver(() => {
      const text = document.querySelector('.deck-actions__buttons button')?.textContent
      if (text && w.labels.at(-1) !== text) w.labels.push(text)
    }).observe(document.body, { subtree: true, childList: true, characterData: true })
  })
  const download = page.waitForEvent('download')
  await page.locator('.deck-actions__buttons button').first().click()
  const file = await download
  assert.equal(file.suggestedFilename(), 'photocards.pdf')

  const doc = await PDFDocument.load(await (await file.createReadStream()).toArray().then(c => Buffer.concat(c)))
  assert.equal(doc.getPageCount(), 2)

  const labels = await page.evaluate(() => (window as unknown as { labels: string[] }).labels)
  assert.ok(labels.includes('Generating… 1 / 4'), `labels: ${labels.join(' → ')}`)
  assert.equal(labels.at(-1), 'Download PDF')
})

test('crop editor: add a card end to end, with undo, redo and the hex colour field', async () => {
  await page.locator('.upload-zone input[type=file]').first().setInputFiles(pngFile('front.png', 900, 1300, [220, 40, 120]))
  await page.getByRole('button', { name: 'Confirm crop' }).waitFor()

  const zoomValue = page.locator('.ctrl-value').nth(1)
  const undo = page.getByRole('button', { name: 'Undo' })
  const redo = page.getByRole('button', { name: 'Redo' })
  const startZoom = await zoomValue.textContent()
  assert.equal(await undo.isDisabled(), true)

  await page.getByRole('button', { name: 'Zoom in' }).click()
  const zoomedIn = await zoomValue.textContent()
  assert.notEqual(zoomedIn, startZoom)
  await undo.click()
  assert.equal(await zoomValue.textContent(), startZoom)
  await redo.click()
  assert.equal(await zoomValue.textContent(), zoomedIn)

  // A committed hex value becomes the background; undo puts the field back too.
  const hex = page.getByRole('textbox', { name: 'Background color hex value' })
  const startHex = await hex.inputValue()
  await hex.fill('#00ff00')
  await hex.press('Enter')
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.crop-viewport')!).backgroundColor === 'rgb(0, 255, 0)')
  await undo.click()
  assert.equal(await hex.inputValue(), startHex)

  // Arrow keys pan the image and record one history step per key press.
  await page.getByRole('group', { name: /Crop viewport/ }).focus()
  await page.keyboard.press('ArrowRight')
  assert.equal(await undo.isDisabled(), false)

  await page.getByRole('button', { name: 'Confirm crop' }).click()
  await page.locator('.upload-zone input[type=file]').first().setInputFiles(pngFile('back.png', CARD_BLEED.widthPx, CARD_BLEED.heightPx, [40, 80, 220]))
  await page.getByRole('button', { name: 'Confirm crop' }).click()

  await page.locator('.deck-card').first().waitFor()
  assert.equal(await headerCount(), '1 / 9 cards')
  await page.locator('.app-header__save--saved').waitFor()
  await page.reload()
  await page.waitForLoadState('networkidle')
  assert.equal(await page.locator('.deck-card').count(), 1)
})

test('crop editor: a re-uploaded bleed-size export is auto-filled to the frame', async () => {
  await page.locator('.upload-zone input[type=file]').first().setInputFiles(pngFile('bleed.png', CARD_BLEED.widthPx, CARD_BLEED.heightPx, [10, 200, 200]))
  await page.getByRole('button', { name: 'Confirm crop' }).waitFor()
  const zoomValue = page.locator('.ctrl-value').nth(1)
  // Fill is the zoom where the image covers the frame; auto-fill should already be there.
  await page.waitForTimeout(300)
  const autoZoom = await zoomValue.textContent()
  assert.notEqual(autoZoom, '100%', 'auto-fill changed the zoom from its default')
  await page.getByRole('button', { name: 'Fill' }).click()
  assert.equal(await zoomValue.textContent(), autoZoom)
})
