import { useState, useCallback, useRef, useEffect } from 'react'
import Cropper from 'react-easy-crop'
import { CARD_BLEED, CARD_TRIM, CARD_SAFE } from '../utils/dimensions'
import { getCroppedDataUrl } from '../utils/cropImage'
import type { CropState } from '../models/card'
import './CropEditor.css'

declare global {
  interface Window {
    EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> }
  }
}

const DISPLAY_CROP = { width: 295, height: 445 }
const CARD_ASPECT = CARD_BLEED.widthMm / CARD_BLEED.heightMm
const MIN_ZOOM = 0.1
const MAX_ZOOM = 4
const DEFAULT_BG = '#ffffff'
const PAN_STEP = 8

interface Area { x: number; y: number; width: number; height: number }
type Snapshot = CropState

interface Props {
  imageSrc: string
  label?: string
  initialState?: CropState
  onConfirm: (dataUrl: string, state: CropState) => void
  onCancel: () => void
  onReplace?: (file: File) => void
}

export function CropEditor({ imageSrc, label, initialState, onConfirm, onCancel, onReplace }: Props) {
  const [crop, setCrop] = useState(initialState?.crop ?? { x: 0, y: 0 })
  const [zoom, setZoom] = useState(initialState?.zoom ?? 1)
  const [rotation, setRotation] = useState(initialState?.rotation ?? 0)
  const [bgColor, setBgColor] = useState(initialState?.bgColor ?? DEFAULT_BG)
  const [hexDraft, setHexDraft] = useState(initialState?.bgColor ?? DEFAULT_BG)
  const [fade, setFade] = useState(initialState?.fade ?? 0)
  const [showGrid, setShowGrid] = useState(false)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [isLowRes, setIsLowRes] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null)
  // Rendered media dimensions from react-easy-crop (zoom=1 display size, not natural pixels)
  const [renderedMedia, setRenderedMedia] = useState<{ width: number; height: number } | null>(null)
  const [cropSize, setCropSize] = useState(DISPLAY_CROP)
  const viewportRef = useRef<HTMLDivElement>(null)
  const cropRef = useRef(crop)
  cropRef.current = crop
  const [isViewportFocused, setIsViewportFocused] = useState(false)
  const hasEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window

  // Scale cropSize to always fit the viewport container, maintaining card aspect ratio
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const compute = () => {
      const { width, height } = el.getBoundingClientRect()
      if (!width || !height) return
      let w = width - 4
      let h = w / CARD_ASPECT
      if (h > height - 4) { h = height - 4; w = h * CARD_ASPECT }
      const nw = Math.floor(w), nh = Math.floor(h)
      setCropSize(s => s.width === nw && s.height === nh ? s : { width: nw, height: nh })
    }
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    compute()
    return () => ro.disconnect()
  }, [])

  // Detect natural image size; reset rendered media so stale dims don't trigger auto-fill
  useEffect(() => {
    setRenderedMedia(null)
    const img = new Image()
    img.onload = () => setImgSize({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = imageSrc
  }, [imageSrc])

  // MAT-290: auto-fill when a bleed-size export is re-uploaded
  // Fires after both imgSize and renderedMedia are available
  useEffect(() => {
    if (!imgSize || !renderedMedia) return
    if (imgSize.w === CARD_BLEED.widthPx && imgSize.h === CARD_BLEED.heightPx) {
      const fillZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM,
        Math.max(cropSize.width / renderedMedia.width, cropSize.height / renderedMedia.height)
      ))
      setZoom(fillZoom)
      setCrop({ x: 0, y: 0 })
    }
  }, [imgSize, renderedMedia, cropSize])

  // Keep hex text input in sync when bgColor changes externally (color picker, eyedropper, undo/redo)
  useEffect(() => { setHexDraft(bgColor) }, [bgColor])

  // Undo / redo — stored in refs so handlers always see current values
  const historyRef = useRef<Snapshot[]>([
    initialState ?? { crop: { x: 0, y: 0 }, zoom: 1, rotation: 0, bgColor: DEFAULT_BG }
  ])
  const histIdxRef = useRef(0)
  const [histTick, setHistTick] = useState(0) // incremented to re-render button disabled states

  function pushHistory(snap: Snapshot) {
    historyRef.current = [...historyRef.current.slice(0, histIdxRef.current + 1), snap]
    histIdxRef.current = historyRef.current.length - 1
    setHistTick(t => t + 1)
  }

  function undo() {
    if (histIdxRef.current <= 0) return
    histIdxRef.current--
    const s = historyRef.current[histIdxRef.current]
    setCrop(s.crop); setZoom(s.zoom); setRotation(s.rotation); setBgColor(s.bgColor); setFade(s.fade ?? 0)
    setHistTick(t => t + 1)
  }

  function redo() {
    if (histIdxRef.current >= historyRef.current.length - 1) return
    histIdxRef.current++
    const s = historyRef.current[histIdxRef.current]
    setCrop(s.crop); setZoom(s.zoom); setRotation(s.rotation); setBgColor(s.bgColor); setFade(s.fade ?? 0)
    setHistTick(t => t + 1)
  }

  // histTick is read here so React includes it in the render dependency — if we
  // never reference it the compiler may strip the setState calls entirely.
  const canUndo = histTick >= 0 && histIdxRef.current > 0
  const canRedo = histTick >= 0 && histIdxRef.current < historyRef.current.length - 1

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels)
    // 2px tolerance absorbs floating-point rounding in fill-zoom calculations
    setIsLowRes(pixels.width < CARD_BLEED.widthPx - 2 || pixels.height < CARD_BLEED.heightPx - 2)
  }, [])

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return
    setExportError(null)
    setExporting(true)
    try {
      const dataUrl = await getCroppedDataUrl(imageSrc, croppedAreaPixels, rotation, bgColor, fade)
      onConfirm(dataUrl, { crop, zoom, rotation, bgColor, fade })
    } catch {
      setExportError('Something went wrong exporting your crop — please try again.')
    } finally {
      setExporting(false)
    }
  }

  function rotate(deg: number) {
    const newRot = ((rotation + deg) % 360 + 360) % 360
    setRotation(newRot)
    pushHistory({ crop, zoom, rotation: newRot, bgColor, fade })
  }

  function stepZoom(delta: number) {
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(zoom + delta).toFixed(2)))
    setZoom(newZoom)
    pushHistory({ crop, zoom: newZoom, rotation, bgColor, fade })
  }

  function center() {
    const c = { x: 0, y: 0 }
    setCrop(c)
    pushHistory({ crop: c, zoom, rotation, bgColor, fade })
  }

  function fillToBleed() {
    if (!renderedMedia) return
    const transposed = rotation % 180 !== 0
    const rw = transposed ? renderedMedia.height : renderedMedia.width
    const rh = transposed ? renderedMedia.width : renderedMedia.height
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM,
      Math.max(cropSize.width / rw, cropSize.height / rh)
    ))
    const c = { x: 0, y: 0 }
    setZoom(newZoom)
    setCrop(c)
    pushHistory({ crop: c, zoom: newZoom, rotation, bgColor })
  }

  async function handleEyeDropper() {
    if (!window.EyeDropper) return
    try {
      const dropper = new window.EyeDropper()
      const result = await dropper.open()
      setBgColor(result.sRGBHex)
      pushHistory({ crop, zoom, rotation, bgColor: result.sRGBHex, fade })
    } catch {
      // user cancelled
    }
  }

  const trimW = `${(CARD_TRIM.widthMm / CARD_BLEED.widthMm) * 100}%`
  const trimH = `${(CARD_TRIM.heightMm / CARD_BLEED.heightMm) * 100}%`
  const safeW = `${(CARD_SAFE.widthMm / CARD_BLEED.widthMm) * 100}%`
  const safeH = `${(CARD_SAFE.heightMm / CARD_BLEED.heightMm) * 100}%`
  const displayRotation = rotation > 180 ? rotation - 360 : rotation

  return (
    <div className="crop-editor">
      {label && <p className="crop-editor__label">{label}</p>}

      <div
        className="crop-viewport"
        style={{ background: bgColor }}
        ref={viewportRef}
        tabIndex={0}
        aria-label="Crop viewport — use arrow keys to pan the image"
        onFocus={() => setIsViewportFocused(true)}
        onBlur={() => setIsViewportFocused(false)}
        onKeyDown={(e) => {
          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
          e.preventDefault()
          setCrop(c => ({
            x: e.key === 'ArrowLeft' ? c.x - PAN_STEP : e.key === 'ArrowRight' ? c.x + PAN_STEP : c.x,
            y: e.key === 'ArrowUp' ? c.y - PAN_STEP : e.key === 'ArrowDown' ? c.y + PAN_STEP : c.y,
          }))
        }}
        onKeyUp={(e) => {
          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
          pushHistory({ crop: cropRef.current, zoom, rotation, bgColor, fade })
        }}
      >
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={CARD_BLEED.widthMm / CARD_BLEED.heightMm}
          cropSize={cropSize}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          restrictPosition={false}
          zoomWithScroll={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          onCropComplete={onCropComplete}
          onMediaLoaded={(ms) => setRenderedMedia({ width: ms.width, height: ms.height })}
          showGrid={false}
        />

        <div className="crop-guides-layer" aria-hidden>
          <div className="crop-guides-frame" style={{ width: cropSize.width, height: cropSize.height }}>
            {showGrid && (
              <div className="guide guide--grid" style={{ width: '100%', height: '100%' }}>
                <div className="grid-line grid-line--v1" />
                <div className="grid-line grid-line--v2" />
                <div className="grid-line grid-line--h1" />
                <div className="grid-line grid-line--h2" />
              </div>
            )}
            <div className="guide guide--bleed" style={{ width: '100%', height: '100%' }} />
            <div className="guide guide--trim" style={{ width: trimW, height: trimH }} title="Trim line — your card will be cut here" />
            <div className="guide guide--safe" style={{ width: safeW, height: safeH }} />
          </div>
        </div>
        {fade > 0 && (
          <div className="crop-fade-overlay" style={{ opacity: fade / 100 }} aria-hidden />
        )}
      </div>

      {isViewportFocused && (
        <p className="crop-kb-hint" aria-hidden="true">Arrow keys to pan · Tab to move to controls</p>
      )}

      <div className="crop-controls">
        <div className="control-group">
          <label className="control-label" htmlFor="crop-rotate">Rotate</label>
          <div className="control-row">
            <button className="ctrl-btn" onClick={() => rotate(-90)} title="Rotate 90° left">↺</button>
            <input
              id="crop-rotate"
              type="range"
              min={-180}
              max={180}
              value={displayRotation}
              onChange={(e) => setRotation(((+e.target.value) % 360 + 360) % 360)}
              onPointerUp={(e) => {
                const r = (((+e.currentTarget.value) % 360) + 360) % 360
                pushHistory({ crop, zoom, rotation: r, bgColor, fade })
              }}
              className="ctrl-slider"
            />
            <button className="ctrl-btn" onClick={() => rotate(90)} title="Rotate 90° right">↻</button>
            <span className="ctrl-value">{Math.round(displayRotation)}°</span>
          </div>
        </div>

        <div className="control-group">
          <label className="control-label" htmlFor="crop-zoom">Size</label>
          <div className="control-row">
            <button className="ctrl-btn" onClick={() => stepZoom(-0.1)} disabled={zoom <= MIN_ZOOM}>−</button>
            <input
              id="crop-zoom"
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(+e.target.value)}
              onPointerUp={(e) => pushHistory({ crop, zoom: +e.currentTarget.value, rotation, bgColor, fade })}
              className="ctrl-slider"
            />
            <button className="ctrl-btn" onClick={() => stepZoom(0.1)} disabled={zoom >= MAX_ZOOM}>+</button>
            <span className="ctrl-value">{Math.round(zoom * 100)}%</span>
          </div>
        </div>

        <div className="control-group">
          <label className="control-label" htmlFor="crop-bgcolor">Background</label>
          <div className="control-row">
            <div className="ctrl-swatch-wrap">
              <div className="ctrl-swatch" style={{ background: bgColor }} />
              <input
                id="crop-bgcolor"
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                onBlur={(e) => pushHistory({ crop, zoom, rotation, bgColor: e.target.value, fade })}
                className="ctrl-swatch__input"
                title="Choose background color"
              />
            </div>
            {hasEyeDropper && (
              <button className="ctrl-btn" onClick={handleEyeDropper} title="Sample color from image">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 22l4-4M18.37 2.63a2.12 2.12 0 013 3L8 19l-6 1 1-6L18.37 2.63z" />
                </svg>
              </button>
            )}
            <input
              type="text"
              value={hexDraft}
              onChange={(e) => {
                const v = e.target.value
                setHexDraft(v)
                if (/^#[0-9a-fA-F]{6}$/.test(v)) setBgColor(v)
              }}
              onBlur={() => {
                if (/^#[0-9a-fA-F]{6}$/.test(hexDraft)) {
                  setBgColor(hexDraft)
                  pushHistory({ crop, zoom, rotation, bgColor: hexDraft, fade })
                } else {
                  setHexDraft(bgColor)
                }
              }}
              className="ctrl-hex-input"
              maxLength={7}
              spellCheck={false}
              aria-label="Background color hex value"
            />
          </div>
        </div>

        <div className="control-group">
          <label className="control-label" htmlFor="crop-fade">Fade</label>
          <div className="control-row">
            <input
              id="crop-fade"
              type="range"
              min={0}
              max={100}
              step={1}
              value={fade}
              onChange={(e) => setFade(+e.target.value)}
              onPointerUp={(e) => pushHistory({ crop, zoom, rotation, bgColor, fade: +e.currentTarget.value })}
              className="ctrl-slider"
            />
            <span className="ctrl-value">{fade}%</span>
          </div>
        </div>

        <div className="ctrl-pills">
          <button className="ctrl-pill" onClick={center} title="Center image in frame">Center</button>
          <button className="ctrl-pill" onClick={fillToBleed} disabled={!renderedMedia} title="Fill bleed frame with no white space">Fill</button>
          <button className="ctrl-pill" onClick={undo} disabled={!canUndo} title="Undo">Undo</button>
          <button className="ctrl-pill" onClick={redo} disabled={!canRedo} title="Redo">Redo</button>
          <button
            className={`ctrl-pill${showGrid ? ' ctrl-pill--on' : ''}`}
            onClick={() => setShowGrid(g => !g)}
            title="Toggle rule-of-thirds grid"
            aria-pressed={showGrid}
          >
            Grid
          </button>
        </div>
      </div>

      <div className="crop-key">
        <div className="key-row">
          <span className="key-swatch key-swatch--bleed" />
          <span className="key-label">Bleed <span className="key-dim">59×89 mm</span></span>
          <span className="key-desc">Full print area — image extends to this edge</span>
        </div>
        <div className="key-row">
          <span className="key-swatch key-swatch--trim" />
          <span className="key-label">Trim <span className="key-dim">55×85 mm</span></span>
          <span className="key-desc">Cut line — final card edge after trimming</span>
        </div>
        <div className="key-row">
          <span className="key-swatch key-swatch--safe" />
          <span className="key-label">Safe <span className="key-dim">51×81 mm</span></span>
          <span className="key-desc">Keep faces and text inside this zone</span>
        </div>
      </div>

      {isLowRes && (
        <p className="crop-low-res">
          Source resolution is below 300 DPI at card size — printed result may appear soft.
        </p>
      )}

      {exportError && (
        <p className="crop-low-res">{exportError}</p>
      )}

      <div className="crop-actions">
        {onReplace && (
          <label className="btn btn--ghost" style={{ cursor: 'pointer', marginRight: 'auto' }}>
            Replace image
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { onReplace(f); e.target.value = '' } }}
              hidden
            />
          </label>
        )}
        <button className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn--primary" onClick={handleConfirm} disabled={!croppedAreaPixels || exporting}>
          {exporting ? 'Exporting…' : 'Confirm crop'}
        </button>
      </div>
    </div>
  )
}
