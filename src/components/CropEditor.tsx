import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { CARD_BLEED, CARD_TRIM, CARD_SAFE } from '../utils/dimensions'
import { getCroppedDataUrl } from '../utils/cropImage'
import './CropEditor.css'

// Display size of the crop frame on screen (59:89 ratio, scaled for display)
const DISPLAY_CROP = { width: 295, height: 445 }

interface Area { x: number; y: number; width: number; height: number }

interface Props {
  imageSrc: string
  onConfirm: (dataUrl: string) => void
  onCancel: () => void
}

export function CropEditor({ imageSrc, onConfirm, onCancel }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
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
      const dataUrl = await getCroppedDataUrl(imageSrc, croppedAreaPixels)
      onConfirm(dataUrl)
    } finally {
      setExporting(false)
    }
  }

  // Guide dimensions as fractions of the crop frame
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
          aspect={CARD_BLEED.widthMm / CARD_BLEED.heightMm}
          cropSize={DISPLAY_CROP}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          showGrid={false}
        />

        {/* Guide overlays — centered over the crop frame */}
        <div className="crop-guides-layer" aria-hidden>
          <div className="crop-guides-frame" style={{ width: DISPLAY_CROP.width, height: DISPLAY_CROP.height }}>
            <div className="guide guide--trim" style={{ width: trimW, height: trimH }} title="Trim line (55×85 mm)" />
            <div className="guide guide--safe" style={{ width: safeW, height: safeH }} title="Safe zone (51×81 mm)" />
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
