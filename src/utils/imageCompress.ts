export type CompressResult = {
  blob: Blob
  width: number
  height: number
  mimeType: string
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Failed to create blob'))
        resolve(blob)
      },
      mimeType,
      quality,
    )
  })
}

export async function compressImageFile(file: File, quality: number): Promise<CompressResult> {
  const q = Math.min(1, Math.max(0.1, quality))
  const dataUrl = await readAsDataUrl(file)
  const img = await loadImage(dataUrl)

  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D not supported')
  ctx.drawImage(img, 0, 0)

  const mimeType = file.type || 'image/jpeg'
  const blob = await canvasToBlob(canvas, mimeType, q)

  return { blob, width: canvas.width, height: canvas.height, mimeType }
}

