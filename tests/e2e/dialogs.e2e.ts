import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import type { Page } from 'playwright'
import { setupApp } from './harness'

// Keyboard and screen-reader behaviour of dialogs, and the logo link.

const app = setupApp()
let page: Page
beforeEach(() => { page = app.page })

const focusedInside = (role: 'dialog' | 'alertdialog') =>
  page.evaluate(r => !!document.activeElement?.closest(`[role=${r}]`), role)
const focusedName = () => page.evaluate(() => document.activeElement?.textContent?.trim() ?? '')

test('a dialog is named, takes focus, keeps Tab inside, and Escape returns focus', async () => {
  await app.seed('letter', [[{ id: 'a', hue: 0 }]])
  const opener = page.getByRole('button', { name: 'See Preview' })
  await opener.click()

  const dialog = page.getByRole('dialog', { name: 'Sheet preview' })
  await dialog.waitFor()
  assert.equal(await dialog.getAttribute('aria-modal'), 'true')
  assert.equal(await focusedInside('dialog'), true, 'focus moves into the dialog')

  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab')
    assert.equal(await focusedInside('dialog'), true, `Tab ${i + 1} stays inside`)
  }
  await page.keyboard.press('Shift+Tab')
  assert.equal(await focusedInside('dialog'), true, 'Shift+Tab stays inside')

  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'detached' })
  assert.equal(await opener.evaluate(el => el === document.activeElement), true, 'focus returns to the opener')
})

test('a confirmation starts on Cancel and Escape cancels', async () => {
  await app.seed('letter', [[{ id: 'a', hue: 0 }]])
  await page.getByRole('button', { name: 'Remove card' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Remove this card?' })
  await dialog.waitFor()
  assert.equal(await focusedInside('alertdialog'), true)
  assert.equal(await focusedName(), 'Cancel')

  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'detached' })
  assert.equal(await page.locator('.deck-card').count(), 1)
})

test('confirmations can be answered from the keyboard', async () => {
  await app.seed('letter', [[{ id: 'a', hue: 0 }]])
  await page.getByRole('button', { name: 'Remove card' }).click()
  await page.getByRole('alertdialog').waitFor()
  await page.keyboard.press('Tab')
  assert.equal(await focusedName(), 'Remove')
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => document.querySelectorAll('.deck-card').length === 0)
})

test('the logo is a link only when there is something to leave', async () => {
  assert.equal(await page.getByRole('link', { name: 'pocalab, start over' }).count(), 0, 'not a link on the empty start screen')

  await app.seed('letter', [[{ id: 'a', hue: 0 }]])
  const logo = page.getByRole('link', { name: 'pocalab, start over' })
  assert.equal(await logo.count(), 1)
  await logo.focus()
  await page.keyboard.press('Enter')
  await app.answer(/Clear your deck/, 'Cancel')
  assert.equal(await page.locator('.deck-card').count(), 1)
})
