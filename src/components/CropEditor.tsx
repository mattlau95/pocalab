import { useState, useCallback, useRef } from 'react'
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
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [isLowRes, setIsLowRes] = useState(false)
  const [exporting, setExporting] = useState(false)
  const colorInputRef = useRef<HTMLInputElement>(null)
  const hasEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels)
    setIsLowRes(pixels.width < CARD_BLEED.widthPx || pixels.height < CARD_BLEED.heightPx)
  }, [])

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return
    setExporting(true)
    try {
      const dataUrl = await getCroppedDataUrl(imageSrc, croppedAreaPixels, rotation, bgColor)
      onConfirm(dataUrl)
    } finally {
      setExporting(false)
    }
  }

  function rotate(deg: number) {
    setRotation((r) => ((r + deg) % 360 + 360) % 360)
  }

  async function handleEyeDropper() {
    if (!window.EyeDropper) return
    try {
      const dropper = new window.EyeDropper()
      const result = await dropper.open()
      setBgColor(result.sRGBHex)
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
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          onCropComplete={onCropComplete}
          showGrid={false}
        />

        <div className="crop-guides-layer" aria-hidden>
          <div className="crop-guides-frame" style={{ width: DISPLAY_CROP.width, height: DISPLAY_CROP.height }}>
            <div className="guide guide--bleed" style={{ width: '100%', height: '100%' }} />
            <div className="guide guide--trim" style={{ width: trimW, height: trimH }} />
            <div className="guide guide--safe" style={{ width: safeW, height: safeH }} />
          </div>
        </div>
      </div>

      <div className="crop-controls">
        <div className="control-group">
          <label className="control-label">Rotate</label>
          <div className="control-row">
            <button className="ctrl-btn" onClick={() => rotate(-90)} title="Rotate 90° left">↺</button>
            <input
              type="range"
              min={-180}
              max={180}
              value={displayRotation}
              onChange={(e) => setRotation(((+e.target.value) % 360 + 360) % 360)}
              className="ctrl-slider"
            />
            <button className="ctrl-btn" onClick={() => rotate(90)} title="Rotate 90° right">↻</button>
            <span className="ctrl-value">{Math.round(displayRotation)}°</span>
          </div>
        </div>

        <div className="control-group">
          <label className="control-label">Size</label>
          <div className="control-row">
            <button
              className="ctrl-btn"
              onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.1).toFixed(2)))}
              disabled={zoom <= MIN_ZOOM}
            >−</button>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(+e.target.value)}
              className="ctrl-slider"
            />
            <button
              className="ctrl-btn"
              onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.1).toFixed(2)))}
              disabled={zoom >= MAX_ZOOM}
            >+</button>
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
                  <path d="M2 22l4-4M18.37 2.63a2.12 2.12 0 013 3L8 19l-6 1 1-6L18.37 2.63z"/>
                </svg>
              </button>
            )}
            <span className="ctrl-value" style={{ fontSize: '11px', letterSpacing: '0.02em' }}>{bgColor}</span>
          </div>
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

      <div className="crop-actions">
        <button className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn--primary" onClick={handleConfirm} disabled={!croppedAreaPixels || exporting}>
          {exporting ? 'Exporting…' : 'Confirm crop'}
        </button>
      </div>
    </div>
  )
}
