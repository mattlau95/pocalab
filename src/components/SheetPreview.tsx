import { layout } from '../utils/printLayout'
import type { PrintPreset } from '../models/preset'
import './SheetPreview.css'

interface SheetPreviewProps {
  preset: PrintPreset
  thumbnails?: (string | null)[]
}

const PREVIEW_MAX_W = 130

export function SheetPreview({ preset, thumbnails = [] }: SheetPreviewProps) {
  const L = layout(preset)
  const b = preset.bleedMm
  const w = preset.sheetMm.w
  const h = preset.sheetMm.h
  const svgH = (h / w) * PREVIEW_MAX_W

  function cropTick(cx: number, cy: number, dx: number, dy: number) {
    const off = 0.6
    const len = 1.8
    return (
      <line
        x1={cx + dx * off} y1={cy + dy * off}
        x2={cx + dx * (off + len)} y2={cy + dy * (off + len)}
        stroke="rgba(0,0,0,0.5)"
        strokeWidth={0.22}
      />
    )
  }

  return (
    <svg
      width={PREVIEW_MAX_W}
      height={svgH}
      viewBox={`0 0 ${w} ${h}`}
      className="sheet-preview"
      role="img"
      aria-label={`${preset.label} sheet layout`}
    >
      {/* Sheet background */}
      <rect width={w} height={h} fill="#fff" />

      {/* Waste area tint */}
      <rect width={w} height={h} fill="rgba(0,0,0,0.025)" />

      {/* Content boundary */}
      <rect
        x={L.marginX} y={L.marginY}
        width={L.contentW} height={L.contentH}
        fill="rgba(255,255,255,0.9)"
        stroke="rgba(0,0,0,0.08)"
        strokeWidth={0.25}
        strokeDasharray="1.5 1"
      />

      {L.cards.map((slot, i) => {
        const thumb = thumbnails[i] ?? null
        return (
          <g key={i}>
            {/* Bleed zone */}
            <rect
              x={slot.x - b} y={slot.y - b}
              width={slot.w + 2 * b} height={slot.h + 2 * b}
              fill="rgba(238,72,151,0.06)"
            />

            {/* Card area — nested SVG clips the thumbnail */}
            <svg x={slot.x} y={slot.y} width={slot.w} height={slot.h} overflow="hidden">
              {thumb ? (
                slot.w > slot.h ? (
                  <g transform={`translate(${slot.w / 2},${slot.h / 2}) rotate(-90) translate(${-slot.h / 2},${-slot.w / 2})`}>
                    <image href={thumb} x={0} y={0} width={slot.h} height={slot.w} preserveAspectRatio="xMidYMid slice" />
                  </g>
                ) : (
                  <image href={thumb} x={0} y={0} width={slot.w} height={slot.h} preserveAspectRatio="xMidYMid slice" />
                )
              ) : (
                <rect width={slot.w} height={slot.h} fill="#f5efea" />
              )}
            </svg>

            {/* Trim border */}
            <rect
              x={slot.x} y={slot.y}
              width={slot.w} height={slot.h}
              fill="none"
              stroke="rgba(0,0,0,0.22)"
              strokeWidth={0.3}
            />

            {/* Crop marks — 8 ticks, one per corner edge */}
            {cropTick(slot.x,           slot.y,            -1,  0)}
            {cropTick(slot.x,           slot.y,             0, -1)}
            {cropTick(slot.x + slot.w,  slot.y,             1,  0)}
            {cropTick(slot.x + slot.w,  slot.y,             0, -1)}
            {cropTick(slot.x,           slot.y + slot.h,   -1,  0)}
            {cropTick(slot.x,           slot.y + slot.h,    0,  1)}
            {cropTick(slot.x + slot.w,  slot.y + slot.h,    1,  0)}
            {cropTick(slot.x + slot.w,  slot.y + slot.h,    0,  1)}
          </g>
        )
      })}
    </svg>
  )
}
