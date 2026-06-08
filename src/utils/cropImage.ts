import { CARD_BLEED } from './dimensions'

interface PixelArea {
  x: number
  y: number
  width: number
  height: number
}

export async function getCroppedDataUrl(imageSrc: string, pixelCrop: PixelArea): Promise<string> {
  const image = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width = CARD_BLEED.widthPx
  canvas.height = CARD_BLEED.heightPx
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, canvas.width, canvas.height,
  )
  return canvas.toDataURL('image/png')
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
