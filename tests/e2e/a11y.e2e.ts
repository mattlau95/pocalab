import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import type { Page } from 'playwright'
import { setupApp, pngFile } from './harness'

// Accessibility checks on every screen and dialog: axe-core against WCAG 2.2
// A/AA, and a 24×24 px minimum for pointer targets (WCAG 2.5.8).

const app = setupApp()
let page: Page
beforeEach(() => { page = app.page })

const axePath = createRequire(import.meta.url).resolve('axe-core/axe.min.js')

type AxeViolation = { id: string; impact: string; help: string; nodes: { target: string[] }[] }

async function axeViolations(): Promise<string[]> {
  // Colours mid-transition read as contrast failures; measure the settled state.
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' })
  await page.addScriptTag({ path: axePath })
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (ctx: Document, opts: object) => Promise<{ violations: AxeViolation[] }> } }).axe
    const result = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })
    return result.violations
  })
  return violations.map(v => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)
}

// Interactive elements smaller than 24×24 px. Exempt under 2.5.8: inline text
// links in a sentence, and the skip link, which is off-screen until focused.
// File inputs and checkboxes are measured through their wrapping label.
async function smallTargets(): Promise<string[]> {
  return page.evaluate(() => {
    const selector = 'button, a[href], input:not([type=hidden]):not([type=file]):not([type=checkbox]), select, textarea, label:has(> input[type=file]), label:has(> input[type=checkbox]), [role=button], [tabindex="0"]'
    const small: string[] = []
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      const rect = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      if (rect.width === 0 || rect.height === 0 || style.visibility === 'hidden') continue
      if (el.matches('.link-button, .feedback-prompt__link, .skip-link')) continue
      if (rect.width < 24 || rect.height < 24) {
        const name = (el.getAttribute('aria-label') || el.textContent || el.className).trim().slice(0, 30)
        small.push(`${el.tagName.toLowerCase()}.${el.className} "${name}" ${Math.round(rect.width)}×${Math.round(rect.height)}`)
      }
    }
    return small
  })
}

async function check(screen: string) {
  const [violations, small] = [await axeViolations(), await smallTargets()]
  assert.deepEqual(violations, [], `${screen}: axe violations`)
  assert.deepEqual(small, [], `${screen}: targets under 24×24`)
}

test('start screen', async () => {
  await check('start screen')
})

test('deck screen, Letter, then the feedback prompt after an export', async () => {
  await app.seed('letter', [[{ id: 'a', hue: 0, copies: 2 }, { id: 'b', hue: 120 }]])
  await check('deck screen')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download PDF' }).first().click()
  await download
  await page.locator('.feedback-prompt').waitFor()
  await check('feedback prompt and print checklist')
  await page.locator('.print-guidance').evaluate(d => { (d as HTMLDetailsElement).open = true })
  await check('print settings expanded')
})

test('deck screen, photo paper with two sheets and the move menu open', async () => {
  await app.seed('5x7-3up', [[{ id: 'a', hue: 0 }, { id: 'b', hue: 60 }], [{ id: 'c', hue: 120 }]])
  await page.getByRole('button', { name: 'Move →' }).first().click()
  await check('photo paper deck')
})

test('dialogs: sheet preview, paper size, remove card', async () => {
  await app.seed('letter', [[{ id: 'a', hue: 0 }]])
  await page.getByRole('button', { name: 'See Preview' }).click()
  await check('sheet preview dialog')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Paper Size' }).click()
  await check('paper size dialog')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Remove card' }).click()
  await check('remove card dialog')
})

test('undo toast after removing a card', async () => {
  await app.seed('letter', [[{ id: 'a', hue: 0 }, { id: 'b', hue: 120 }]])
  await page.getByRole('button', { name: 'Remove card' }).first().click()
  await app.answer(/Remove this card/, 'Remove')
  await page.locator('.toast--undo').waitFor()
  await check('undo toast')
})

test('storage error toast', async () => {
  await app.seed('letter', [[{ id: 'a', hue: 0 }]])
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () { throw new DOMException('Quota exceeded', 'QuotaExceededError') }
  })
  await page.getByRole('button', { name: 'Increase copies' }).click()
  await page.locator('.toast--error').waitFor()
  await check('storage error toast')
})

test('crop editor, back step, and back-scope question', async () => {
  await app.seed('letter', [[{ id: 'a', hue: 0, backGroup: 1 }, { id: 'b', hue: 90, backGroup: 1 }]])
  await page.locator('.deck-upload input[type=file]').setInputFiles(pngFile('front.png', 300, 450, [200, 0, 0]))
  await page.getByRole('button', { name: 'Confirm crop' }).waitFor()
  await check('crop editor')
  await page.getByRole('button', { name: 'Confirm crop' }).click()
  await page.getByText('Step 2 of 2 — Add the card back').waitFor()
  await check('upload back step')
  await page.getByRole('button', { name: 'Back option 1' }).click()

  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Edit back image' }).first().click()
  await (await chooser).setFiles(pngFile('back.png', 300, 450, [0, 200, 200]))
  await page.getByRole('button', { name: 'Confirm crop' }).click()
  await page.getByText('Save to how many cards?').waitFor()
  await check('back scope question')
})
