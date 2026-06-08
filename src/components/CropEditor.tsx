import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { CARD_BLEED, CARD_TRIM, CARD_SAFE } from '../utils/dimensions'
import { getCroppedDataUrl } from '../utils/cropImage'
import './CropEditor.css'

const DISPLAY_CROP = { width: 295, height: 445 }
const MIN_ZOOM = 1
const MAX_ZOOM = 4

interface Area { x: number; y: number; width: number; height: number }

interface Props {
  imageSrc: string
  onConfirm: (dataUrl: string) => void
  onCancel: () => void
}

export function CropEditor({ imageSrc, onConfirm, onCancel }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [isLowRes, setIsLowRes] = useState(false)
  const [exporting, setExporting] = useState(false)

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels)
    setIsLowRes(pixels.width < CARD_BLEED.widthPx || pixels.height < CARD_BLEED.heightPx)
  }, [])

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return
    setExporting(true)
    try {
      const dataUrl = await getCroppedDataUrl(imageSrc, croppedAreaPixels, rotation)
      onConfirm(dataUrl)
    } finally {
      setExporting(false)
    }
  }

  function rotate(deg: number) {
    setRotation((r) => ((r + deg) % 360 + 360) % 360)
  }

  const trimW = `${(CARD_TRIM.widthMm / CARD_BLEED.widthMm) * 100}%`
  const trimH = `${(CARD_TRIM.heightMm / CARD_BLEED.heightMm) * 100}%`
  const safeW = `${(CARD_SAFE.widthMm / CARD_BLEED.widthMm) * 100}%`
  const safeH = `${(CARD_SAFE.heightMm / CARD_BLEED.heightMm) * 100}%`

  return (
    <div className="crop-editor">
      <div className="crop-viewport">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={CARD_BLEED.widthMm / CARD_BLEED.heightMm}
          cropSize={DISPLAY_CROP}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          onCropComplete={onCropComplete}
          showGrid={false}
        />

        <div className="crop-guides-layer" aria-hidden>
          <div className="crop-guides-frame" style={{ width: DISPLAY_CROP.width, height: DISPLAY_CROP.height }}>
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
              value={rotation > 180 ? rotation - 360 : rotation}
              onChange={(e) => setRotation(((+e.target.value) % 360 + 360) % 360)}
              className="ctrl-slider"
            />
            <button className="ctrl-btn" onClick={() => rotate(90)} title="Rotate 90° right">↻</button>
            <span className="ctrl-value">{Math.round(rotation > 180 ? rotation - 360 : rotation)}°</span>
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
      </div>

      <div className="crop-legend">
        <span className="legend-item legend-item--bleed">Bleed 59×89 mm</span>
        <span className="legend-item legend-item--trim">Trim 55×85 mm</span>
        <span className="legend-item legend-item--safe">Safe 51×81 mm</span>
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
