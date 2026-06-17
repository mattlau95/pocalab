import { test } from 'node:test'
import assert from 'node:assert/strict'
import { layout, maxBleed } from '../src/utils/printLayout.ts'
import { PRESETS } from '../src/models/preset.ts'

const EPSILON = 0.01

test('preset A (4×6 2-up): valid layout with correct margins', () => {
  const p = PRESETS['4x6-2up']
  const L = layout(p)
  assert.equal(L.valid, true)
  assert.ok(Math.abs(L.marginX - 8.3) < EPSILON, `marginX expected ~8.3, got ${L.marginX}`)
  assert.ok(Math.abs(L.marginY - 18.2) < EPSILON, `marginY expected ~18.2, got ${L.marginY}`)
  assert.ok(maxBleed(p) >= p.bleedMm, `maxBleed must be >= preset bleed`)
  assert.equal(L.cards.length, 2)
})

test('preset B (5×7 2-up): valid layout with correct margins', () => {
  const p = PRESETS['5x7-2up']
  const L = layout(p)
  assert.equal(L.valid, true)
  assert.ok(Math.abs(L.marginX - 21.0) < EPSILON, `marginX expected ~21.0, got ${L.marginX}`)
  assert.ok(Math.abs(L.marginY - 30.9) < EPSILON, `marginY expected ~30.9, got ${L.marginY}`)
  assert.ok(maxBleed(p) >= p.bleedMm)
  assert.equal(L.cards.length, 2)
})

test('preset C (5×7 3-up): valid layout with correct margins', () => {
  const p = PRESETS['5x7-3up']
  const L = layout(p)
  assert.equal(L.valid, true)
  assert.ok(Math.abs(L.marginX - 21.0) < EPSILON, `marginX expected ~21.0, got ${L.marginX}`)
  assert.ok(Math.abs(L.marginY - 3.4) < EPSILON, `marginY expected ~3.4, got ${L.marginY}`)
  assert.ok(maxBleed(p) >= p.bleedMm)
  assert.equal(L.cards.length, 3)
})

test('preset D (5×7 4-up): valid layout with correct margins', () => {
  const p = PRESETS['5x7-4up']
  const L = layout(p)
  assert.equal(L.valid, true)
  assert.ok(Math.abs(L.marginX - 7.0) < EPSILON, `marginX expected ~7.0, got ${L.marginX}`)
  assert.ok(Math.abs(L.marginY - 2.4) < EPSILON, `marginY expected ~2.4, got ${L.marginY}`)
  assert.ok(maxBleed(p) >= p.bleedMm)
  assert.equal(L.cards.length, 4)
})

test('card positions are non-overlapping for all photo paper presets', () => {
  const ids = ['4x6-2up', '5x7-2up', '5x7-3up', '5x7-4up'] as const
  for (const id of ids) {
    const L = layout(PRESETS[id])
    for (let i = 0; i < L.cards.length; i++) {
      for (let j = i + 1; j < L.cards.length; j++) {
        const a = L.cards[i]
        const b = L.cards[j]
        const overlapX = a.x < b.x + b.w && a.x + a.w > b.x
        const overlapY = a.y < b.y + b.h && a.y + a.h > b.y
        assert.ok(!(overlapX && overlapY), `Cards ${i} and ${j} overlap in preset ${id}`)
      }
    }
  }
})
