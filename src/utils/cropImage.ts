import { CARD_BLEED } from './dimensions'

interface PixelArea {
  x: number
  y: number
  width: number
  height: number
}

export async function getCroppedDataUrl(
  imageSrc: string,
  pixelCrop: PixelArea,
  rotation = 0,
  bgColor = '#ffffff',
  fade = 0,
): Promise<string> {
  const image = await loadImage(imageSrc)

  // Draw the source image rotated onto an intermediate canvas so that
  // pixelCrop coordinates (which react-easy-crop gives in rotated space) are correct.
  const rotRad = (rotation * Math.PI) / 180
  const bBoxW = Math.abs(Math.cos(rotRad) * image.width) + Math.abs(Math.sin(rotRad) * image.height)
  const bBoxH = Math.abs(Math.sin(rotRad) * image.width) + Math.abs(Math.cos(rotRad) * image.height)

  const rotCanvas = document.createElement('canvas')
  rotCanvas.width = bBoxW
  rotCanvas.height = bBoxH
  const rotCtx = rotCanvas.getContext('2d', { colorSpace: 'srgb' })!
  rotCtx.translate(bBoxW / 2, bBoxH / 2)
  rotCtx.rotate(rotRad)
  rotCtx.translate(-image.width / 2, -image.height / 2)
  rotCtx.drawImage(image, 0, 0)

  // Crop from the rotated canvas and scale to the 300 DPI bleed dimensions.
  // Fill with bgColor first so transparent image pixels and any areas outside
  // the image (when zoomed out below 100%) show the chosen background.
  const out = document.createElement('canvas')
  out.width = CARD_BLEED.widthPx
  out.height = CARD_BLEED.heightPx
  const outCtx = out.getContext('2d', { colorSpace: 'srgb' })!
  outCtx.fillStyle = bgColor
  outCtx.fillRect(0, 0, out.width, out.height)

  // Clip pixelCrop to the rotated canvas bounds — when the image is smaller than
  // the crop frame, pixelCrop may extend outside the image area. Drawing only the
  // visible portion at the correct proportional position composites the image onto
  // the background rather than stretching it to fill the output.
  const srcX = Math.max(0, pixelCrop.x)
  const srcY = Math.max(0, pixelCrop.y)
  const srcW = Math.min(rotCanvas.width, pixelCrop.x + pixelCrop.width) - srcX
  const srcH = Math.min(rotCanvas.height, pixelCrop.y + pixelCrop.height) - srcY

  if (srcW > 0 && srcH > 0) {
    const scaleX = out.width / pixelCrop.width
    const scaleY = out.height / pixelCrop.height
    outCtx.drawImage(
      rotCanvas,
      srcX, srcY, srcW, srcH,
      (srcX - pixelCrop.x) * scaleX,
      (srcY - pixelCrop.y) * scaleY,
      srcW * scaleX,
      srcH * scaleY,
    )
  }

  if (fade > 0) {
    outCtx.fillStyle = `rgba(255,255,255,${fade / 100})`
    outCtx.fillRect(0, 0, out.width, out.height)
  }

  return out.toDataURL('image/png')
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
