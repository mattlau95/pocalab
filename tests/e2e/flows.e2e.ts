import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import type { Page } from 'playwright'
import { setupApp, pngFile } from './harness'

// Characterisation tests for the deck and step flows in App.tsx, written
// before the MAT-724 split so the refactor has to keep all of this working.

const app = setupApp()
let page: Page
beforeEach(() => { page = app.page })

const deckCards = () => page.locator('.deck-card').count()
const headerCount = () => page.locator('.app-header__count').textContent()
const confirmCrop = () => page.getByRole('button', { name: 'Confirm crop' })

async function addCardThroughUi(frontRgb: [number, number, number], backRgb: [number, number, number], opts: { shared?: boolean } = {}) {
  await page.locator('.upload-zone input[type=file]').first().setInputFiles(pngFile('front.png', 300, 450, frontRgb))
  await confirmCrop().click()
  if (opts.shared) await page.getByLabel('Set as shared back for all cards').check()
  await page.locator('.upload-zone input[type=file]').first().setInputFiles(pngFile('back.png', 300, 450, backRgb))
  await confirmCrop().click()
  await page.locator('.deck-card').first().waitFor()
}

test('cancelling the front crop returns to the empty start screen', async () => {
  await page.locator('.upload-zone input[type=file]').first().setInputFiles(pngFile('front.png', 300, 450, [200, 0, 0]))
  await page.getByRole('button', { name: 'Cancel' }).click()
  assert.equal(await confirmCrop().count(), 0)
  assert.equal(await deckCards(), 0)
})

test('Start over on the back step asks first, and keeps the step if dismissed', async () => {
  await page.locator('.upload-zone input[type=file]').first().setInputFiles(pngFile('front.png', 300, 450, [200, 0, 0]))
  await confirmCrop().click()
  await page.getByText('Step 2 of 2 — Add the card back').waitFor()

  await page.getByRole('button', { name: 'Start over' }).click()
  await app.answer(/Discard this card\? Your cropped front image will be lost\./, 'Cancel')
  assert.equal(await page.getByText('Step 2 of 2 — Add the card back').count(), 1)

  await page.getByRole('button', { name: 'Start over' }).click()
  await app.answer(/Discard this card/, 'Discard')
  await page.getByText('Step 2 of 2 — Add the card back').waitFor({ state: 'detached' })
  assert.equal(await deckCards(), 0)
})

test('Edit on the back step reopens the front crop, then returns to the back step', async () => {
  await page.locator('.upload-zone input[type=file]').first().setInputFiles(pngFile('front.png', 300, 450, [200, 0, 0]))
  await confirmCrop().click()
  await page.locator('.upload-back__edit-btn').click()
  await page.getByText('Edit front').waitFor()
  await confirmCrop().click()
  await page.getByText('Step 2 of 2 — Add the card back').waitFor()
})

test('a previously used back can be picked for the next card', async () => {
  await addCardThroughUi([200, 0, 0], [0, 0, 200])
  await page.locator('.deck-upload .upload-zone input[type=file]').setInputFiles(pngFile('front2.png', 300, 450, [0, 200, 0]))
  await confirmCrop().click()
  await page.getByText('Previously used').waitFor()
  await page.getByRole('button', { name: 'Back option 1' }).click()
  await page.locator('.deck-card').nth(1).waitFor()

  await page.locator('.app-header__save--saved').waitFor()
  const project = await app.stored()
  const [first, second] = project!.decks[0].cards
  assert.ok(first.back && first.back === second.back, 'second card reuses the first card\'s back')
})

test('"Set as shared back" stores the back as the deck\'s shared back', async () => {
  await addCardThroughUi([200, 0, 0], [0, 0, 200], { shared: true })
  await page.locator('.app-header__save--saved').waitFor()
  const project = await app.stored()
  assert.ok(project!.decks[0].sharedBack, 'sharedBack is set')
  assert.equal(project!.decks[0].sharedBack, project!.decks[0].cards[0].back)
})

test('editing a card side replaces that image', async () => {
  await app.seed('letter', [[{ id: 'a', hue: 0 }, { id: 'b', hue: 120 }]])
  const before = await app.stored()
  // Seeded cards have no original upload, so Edit opens a file picker.
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Edit front image' }).first().click()
  await (await chooser).setFiles(pngFile('new-front.png', 300, 450, [255, 255, 0]))
  await page.getByText('Edit front').waitFor()
  await confirmCrop().click()
  await page.locator('.deck-card').first().waitFor()
  await page.locator('.app-header__save--saved').waitFor()

  const after = await app.stored()
  assert.notEqual(after!.decks[0].cards[0].front, before!.decks[0].cards[0].front)
  assert.equal(after!.decks[0].cards[1].front, before!.decks[0].cards[1].front)
  assert.equal(after!.decks[0].cards[0].back, before!.decks[0].cards[0].back)
})

test('editing a back shared by other cards asks how many cards to update', async () => {
  await app.seed('letter', [[{ id: 'a', hue: 0, backGroup: 1 }, { id: 'b', hue: 90, backGroup: 1 }, { id: 'c', hue: 180, backGroup: 1 }]])
  const editBack = async () => {
    const chooser = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Edit back image' }).first().click()
    await (await chooser).setFiles(pngFile('new-back.png', 300, 450, [0, 255, 255]))
    await confirmCrop().click()
    await page.getByText('Save to how many cards?').waitFor()
  }

  await editBack()
  assert.match(await page.locator('.back-scope__desc').innerText(), /2 other cards in your deck use this same back/)
  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.locator('.deck-card').first().waitFor()
  const unchanged = await app.stored()
  assert.equal(new Set(unchanged!.decks[0].cards.map(c => c.back)).size, 1)

  await editBack()
  await page.getByRole('button', { name: 'Just this card' }).click()
  await page.locator('.deck-card').first().waitFor()
  await page.locator('.app-header__save--saved').waitFor()
  const justOne = await app.stored()
  const backs = justOne!.decks[0].cards.map(c => c.back)
  assert.notEqual(backs[0], backs[1])
  assert.equal(backs[1], backs[2])

  // Card b and c still share; editing b's back offers to update both.
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Edit back image' }).nth(1).click()
  await (await chooser).setFiles(pngFile('newer-back.png', 300, 450, [255, 0, 255]))
  await confirmCrop().click()
  await page.getByRole('button', { name: 'Update all 2 cards' }).click()
  await page.locator('.deck-card').first().waitFor()
  await page.waitForTimeout(300)
  const all = await app.stored()
  const finalBacks = all!.decks[0].cards.map(c => c.back)
  assert.equal(finalBacks[1], finalBacks[2])
  assert.notEqual(finalBacks[1], backs[1])
})

test('removing a card asks in a dialog, and can be undone', async () => {
  await app.seed('letter', [[{ id: 'a', hue: 0 }, { id: 'b', hue: 120 }]])
  await page.getByRole('button', { name: 'Remove card' }).first().click()
  await app.answer(/Remove this card\?/, 'Cancel')
  assert.equal(await deckCards(), 2)

  await page.getByRole('button', { name: 'Remove card' }).first().click()
  await app.answer(/Remove this card\?/, 'Remove')
  await page.waitForFunction(() => document.querySelectorAll('.deck-card').length === 1)
  assert.equal(await headerCount(), '1 / 9 cards')

  const toast = page.locator('.toast--undo')
  assert.match(await toast.innerText(), /Card removed/)
  await toast.getByRole('button', { name: 'Undo' }).click()
  await page.waitForFunction(() => document.querySelectorAll('.deck-card').length === 2)
  await page.locator('.app-header__save--saved').waitFor()
  const project = await app.stored()
  assert.deepEqual(project!.decks[0].cards.map(c => c.id), ['a', 'b'])
})

test('Undo is withdrawn once the deck changes again', async () => {
  await app.seed('letter', [[{ id: 'a', hue: 0 }, { id: 'b', hue: 120 }]])
  await page.getByRole('button', { name: 'Remove card' }).first().click()
  await app.answer(/Remove this card\?/, 'Remove')
  await page.locator('.toast--undo').waitFor()
  await page.getByRole('button', { name: 'Increase copies' }).first().click()
  await page.locator('.toast--undo').waitFor({ state: 'detached' })
  assert.equal(await deckCards(), 1)
})

test('removing a sheet with cards asks first', async () => {
  await app.seed('4x6-2up', [[{ id: 'a', hue: 0 }, { id: 'b', hue: 60 }], [{ id: 'c', hue: 120 }]])
  assert.equal(await headerCount(), '3 cards · 2 sheets')

  await page.getByRole('button', { name: 'Remove ×' }).last().click()
  await app.answer(/Remove Sheet 2 and its 1 card\?/, 'Cancel')
  assert.equal(await deckCards(), 3)

  await page.getByRole('button', { name: 'Remove ×' }).last().click()
  await app.answer(/Remove Sheet 2/, 'Remove sheet')
  await page.waitForFunction(() => document.querySelectorAll('.deck-card').length === 2)

  const toast = page.locator('.toast--undo')
  assert.match(await toast.innerText(), /Sheet 2 removed/)
  await toast.getByRole('button', { name: 'Undo' }).click()
  await page.waitForFunction(() => document.querySelectorAll('.deck-card').length === 3)
  assert.equal(await headerCount(), '3 cards · 2 sheets')
})

test('a card can be moved to another sheet with room', async () => {
  await app.seed('5x7-3up', [[{ id: 'a', hue: 0 }, { id: 'b', hue: 60 }], [{ id: 'c', hue: 120 }]])
  await page.getByRole('button', { name: 'Move →' }).first().click()
  await page.getByRole('button', { name: 'Sheet 2', exact: true }).click()
  await page.locator('.app-header__save--saved').waitFor()
  const project = await app.stored()
  assert.deepEqual(project!.decks.map(d => d.cards.map(c => c.id)), [['b'], ['c', 'a']])
})

test('the header counts copies, not just cards, across sheets', async () => {
  await app.seed('letter', [[{ id: 'a', hue: 0, copies: 5 }, { id: 'b', hue: 60 }], [{ id: 'c', hue: 120 }]])
  assert.equal(await headerCount(), '7 cards · 2 sheets')
  await page.getByRole('button', { name: 'Increase copies' }).nth(1).click()
  assert.equal(await headerCount(), '8 cards · 2 sheets')
})

test('print settings are available for every paper size, with the validated values', async () => {
  await app.seed('letter', [[{ id: 'a', hue: 0 }]])
  const guidance = page.locator('.print-guidance')
  await guidance.evaluate(d => { (d as HTMLDetailsElement).open = true })
  let text = await guidance.innerText()
  assert.match(text, /Actual size/)
  assert.match(text, /Borderless off/)
  assert.match(text, /long edge/)
  assert.match(text, /Paper Size to Letter/)
  assert.match(text, /cassette auto-duplex/)

  await page.getByRole('button', { name: 'Paper Size' }).click()
  await page.locator('.paper-size-option', { hasText: '4×6"' }).click()
  await guidance.evaluate(d => { (d as HTMLDetailsElement).open = true })
  text = await guidance.innerText()
  assert.match(text, /Paper Size to 4 × 6 in/)
  assert.match(text, /photo or matte profile/)
})

test('the sheet preview explains that the back page is flipped when printed', async () => {
  await app.seed('letter', [[{ id: 'a', hue: 0 }]])
  await page.getByRole('button', { name: 'See Preview' }).click()
  assert.match(await page.locator('.sheet-preview-pair__note').innerText(), /flips the back page for you/)
})

test('changing paper size re-flows cards across sheets and says so', async () => {
  await app.seed('letter', [[{ id: 'a', hue: 0 }, { id: 'b', hue: 60 }, { id: 'c', hue: 120 }]])
  await page.getByRole('button', { name: 'Paper Size' }).click()
  await page.locator('.paper-size-option', { hasText: '4×6"' }).click()
  await page.getByText('Cards split across 2 sheets').waitFor()
  assert.equal(await headerCount(), '3 cards · 2 sheets')
  assert.match(await page.locator('.deck-list__toolbar').innerText(), /4×6"/)
})

test('photo paper downloads per sheet and all sheets', async () => {
  await app.seed('4x6-2up', [[{ id: 'a', hue: 0 }, { id: 'b', hue: 60 }], [{ id: 'c', hue: 120 }]])
  const one = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download sheet 2' }).click()
  assert.equal((await one).suggestedFilename(), 'sheet-2.pdf')
  const all = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download all sheets' }).click()
  assert.equal((await all).suggestedFilename(), 'photocards-all.pdf')
})

test('Try again after a failed export repeats that same export', async () => {
  await app.seed('4x6-2up', [[{ id: 'a', hue: 0 }, { id: 'b', hue: 60 }], [{ id: 'c', hue: 120 }]])
  // Make the download step fail once.
  await page.evaluate(() => {
    const original = URL.createObjectURL
    URL.createObjectURL = () => { URL.createObjectURL = original; throw new Error('simulated failure') }
  })
  await page.getByRole('button', { name: 'Download all sheets' }).click()
  const error = page.locator('.deck-actions__error')
  await error.waitFor()
  assert.match(await error.innerText(), /PDF generation failed/)

  const download = page.waitForEvent('download')
  await error.getByRole('button', { name: 'Try again' }).click()
  assert.equal((await download).suggestedFilename(), 'photocards-all.pdf')
  await error.waitFor({ state: 'detached' })
})

test('clicking the logo with cards asks, then clears the project', async () => {
  await app.seed('letter', [[{ id: 'a', hue: 0 }]])
  const logo = page.getByRole('link', { name: 'pocalab, start over' })
  await logo.click()
  await app.answer(/Clear your deck\? This cannot be undone\./, 'Cancel')
  assert.equal(await deckCards(), 1)

  await logo.click()
  await app.answer(/Clear your deck/, 'Clear deck')
  await page.waitForFunction(() => document.querySelectorAll('.deck-card').length === 0)
  await page.waitForTimeout(300)
  const project = await app.stored()
  assert.equal(project!.decks.flatMap(d => d.cards).length, 0)
  await app.reload()
  assert.equal(await deckCards(), 0)
})

test('clicking the logo mid-crop with no cards cancels the crop', async () => {
  await page.locator('.upload-zone input[type=file]').first().setInputFiles(pngFile('front.png', 300, 450, [200, 0, 0]))
  await confirmCrop().waitFor()
  await page.getByRole('link', { name: 'pocalab, start over' }).click()
  await app.answer(/Cancel this crop and start over\?/, 'Start over')
  await confirmCrop().waitFor({ state: 'detached' })
})
