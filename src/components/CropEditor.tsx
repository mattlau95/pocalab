import { useState, useCallback, useRef, useEffect } from 'react'
import Cropper from 'react-easy-crop'
import { CARD_BLEED, CARD_TRIM, CARD_SAFE } from '../utils/dimensions'
import { getCroppedDataUrl } from '../utils/cropImage'
import './CropEditor.css'

declare global {
  interface Window {
    EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> }
  }
}

const DISPLAY_CROP = { width: 295, height: 445 }
const MIN_ZOOM = 0.1
const MAX_ZOOM = 4
const DEFAULT_BG = '#ffffff'

interface Area { x: number; y: number; width: number; height: number }
interface Snapshot { crop: { x: number; y: number }; zoom: number; rotation: number; bgColor: string }

interface Props {
  imageSrc: string
  label?: string
  onConfirm: (dataUrl: string) => void
  onCancel: () => void
}

export function CropEditor({ imageSrc, label, onConfirm, onCancel }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [bgColor, setBgColor] = useState(DEFAULT_BG)
  const [showGrid, setShowGrid] = useState(false)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [isLowRes, setIsLowRes] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null)
  const colorInputRef = useRef<HTMLInputElement>(null)
  const hasEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img
      setImgSize({ w, h })
      // MAT-290: auto-fill if image exactly matches the bleed export dimensions
      if (w === CARD_BLEED.widthPx && h === CARD_BLEED.heightPx) {
        const fitScale = Math.min(DISPLAY_CROP.width / w, DISPLAY_CROP.height / h)
        const fillScale = Math.max(DISPLAY_CROP.width / w, DISPLAY_CROP.height / h)
        setZoom(Math.min(MAX_ZOOM, fillScale / fitScale))
        setCrop({ x: 0, y: 0 })
      }
    }
    img.src = imageSrc
  }, [imageSrc])

  // Undo / redo — stored in refs so handlers always see current values
  const historyRef = useRef<Snapshot[]>([{ crop: { x: 0, y: 0 }, zoom: 1, rotation: 0, bgColor: DEFAULT_BG }])
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
    setCrop(s.crop); setZoom(s.zoom); setRotation(s.rotation); setBgColor(s.bgColor)
    setHistTick(t => t + 1)
  }

  function redo() {
    if (histIdxRef.current >= historyRef.current.length - 1) return
    histIdxRef.current++
    const s = historyRef.current[histIdxRef.current]
    setCrop(s.crop); setZoom(s.zoom); setRotation(s.rotation); setBgColor(s.bgColor)
    setHistTick(t => t + 1)
  }

  // histTick is read here so React includes it in the render dependency — if we
  // never reference it the compiler may strip the setState calls entirely.
  const canUndo = histTick >= 0 && histIdxRef.current > 0
  const canRedo = histTick >= 0 && histIdxRef.current < historyRef.current.length - 1

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels)
    setIsLowRes(pixels.width < CARD_BLEED.widthPx || pixels.height < CARD_BLEED.heightPx)
  }, [])

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return
    setExportError(null)
    setExporting(true)
    try {
      const dataUrl = await getCroppedDataUrl(imageSrc, croppedAreaPixels, rotation, bgColor)
      onConfirm(dataUrl)
    } catch {
      setExportError('Something went wrong exporting your crop — please try again.')
    } finally {
      setExporting(false)
    }
  }

  function rotate(deg: number) {
    const newRot = ((rotation + deg) % 360 + 360) % 360
    setRotation(newRot)
    pushHistory({ crop, zoom, rotation: newRot, bgColor })
  }

  function stepZoom(delta: number) {
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(zoom + delta).toFixed(2)))
    setZoom(newZoom)
    pushHistory({ crop, zoom: newZoom, rotation, bgColor })
  }

  function center() {
    const c = { x: 0, y: 0 }
    setCrop(c)
    pushHistory({ crop: c, zoom, rotation, bgColor })
  }

  function fillToBleed() {
    if (!imgSize) return
    const { w, h } = imgSize
    const fitScale = Math.min(DISPLAY_CROP.width / w, DISPLAY_CROP.height / h)
    const fillScale = Math.max(DISPLAY_CROP.width / w, DISPLAY_CROP.height / h)
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fillScale / fitScale))
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
      pushHistory({ crop, zoom, rotation, bgColor: result.sRGBHex })
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

      <div className="crop-viewport" style={{ background: bgColor }}>
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={CARD_BLEED.widthMm / CARD_BLEED.heightMm}
          cropSize={DISPLAY_CROP}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          restrictPosition={false}
          zoomWithScroll={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          onCropComplete={onCropComplete}
          showGrid={false}
        />

        <div className="crop-guides-layer" aria-hidden>
          <div className="crop-guides-frame" style={{ width: DISPLAY_CROP.width, height: DISPLAY_CROP.height }}>
            {showGrid && (
              <div className="guide guide--grid" style={{ width: '100%', height: '100%' }}>
                <div className="grid-line grid-line--v1" />
                <div className="grid-line grid-line--v2" />
                <div className="grid-line grid-line--h1" />
                <div className="grid-line grid-line--h2" />
              </div>
            )}
            <div className="guide guide--bleed" style={{ width: '100%', height: '100%' }} />
            <div className="guide guide--trim" style={{ width: trimW, height: trimH }} />
            <div className="guide guide--safe" style={{ width: safeW, height: safeH }} />
          </div>
        </div>
      </div>

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
                pushHistory({ crop, zoom, rotation: r, bgColor })
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
              onPointerUp={(e) => pushHistory({ crop, zoom: +e.currentTarget.value, rotation, bgColor })}
              className="ctrl-slider"
            />
            <button className="ctrl-btn" onClick={() => stepZoom(0.1)} disabled={zoom >= MAX_ZOOM}>+</button>
            <span className="ctrl-value">{Math.round(zoom * 100)}%</span>
          </div>
        </div>

        <div className="control-group">
          <label className="control-label">Background</label>
          <div className="control-row">
            <button
              className="ctrl-swatch"
              style={{ background: bgColor }}
              onClick={() => colorInputRef.current?.click()}
              title="Choose background color"
            />
            <input
              ref={colorInputRef}
              type="color"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              style={{ display: 'none' }}
            />
            {hasEyeDropper && (
              <button className="ctrl-btn" onClick={handleEyeDropper} title="Sample color from image">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 22l4-4M18.37 2.63a2.12 2.12 0 013 3L8 19l-6 1 1-6L18.37 2.63z" />
                </svg>
              </button>
            )}
            <span className="ctrl-value" style={{ fontSize: '11px', letterSpacing: '0.02em' }}>{bgColor}</span>
          </div>
        </div>

        <div className="ctrl-pills">
          <button className="ctrl-pill" onClick={center} title="Center image in frame">Center</button>
          <button className="ctrl-pill" onClick={fillToBleed} disabled={!imgSize} title="Fill bleed frame with no white space">Fill</button>
          <button className="ctrl-pill" onClick={undo} disabled={!canUndo} title="Undo">Undo</button>
          <button className="ctrl-pill" onClick={redo} disabled={!canRedo} title="Redo">Redo</button>
          <button
            className={`ctrl-pill${showGrid ? ' ctrl-pill--on' : ''}`}
            onClick={() => setShowGrid(g => !g)}
            title="Toggle rule-of-thirds grid"
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
        <button className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn--primary" onClick={handleConfirm} disabled={!croppedAreaPixels || exporting}>
          {exporting ? 'Exporting…' : 'Confirm crop'}
        </button>
      </div>
    </div>
  )
}
