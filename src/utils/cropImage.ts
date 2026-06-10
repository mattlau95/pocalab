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
  const rotCtx = rotCanvas.getContext('2d')!
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
  const outCtx = out.getContext('2d')!
  outCtx.fillStyle = bgColor
  outCtx.fillRect(0, 0, out.width, out.height)
  outCtx.drawImage(
    rotCanvas,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, out.width, out.height,
  )

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
