/**
 * Redimensionne / recadre une image pour le fil Agora (bandeau ~16:10, JPEG léger).
 */

function looksLikeImage(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  // iOS / certains OS laissent type vide — on se fie à l’extension.
  return /\.(jpe?g|png|webp|gif|heic|heif|bmp|avif)$/i.test(file.name || '')
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file)
  } catch {
    const dataUrl = await readFileAsDataUrl(file)
    const img = await loadHtmlImage(dataUrl)
    try {
      return await createImageBitmap(img)
    } finally {
      img.src = ''
    }
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Lecture image impossible'))
    }
    reader.onerror = () => reject(new Error('Lecture image impossible'))
    reader.readAsDataURL(file)
  })
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image illisible'))
    img.src = src
  })
}

export async function compressFeedImage(
  file: File,
  opts?: { maxBytes?: number; targetWidth?: number; targetHeight?: number }
): Promise<{ dataUrl: string; error?: string }> {
  if (!looksLikeImage(file)) {
    return { dataUrl: '', error: 'Fichier image requis (JPEG, PNG, WebP ou GIF)' }
  }

  const maxBytes = opts?.maxBytes ?? 450_000
  const targetW = opts?.targetWidth ?? 1200
  const targetH = opts?.targetHeight ?? 750

  let bitmap: ImageBitmap
  try {
    bitmap = await loadBitmap(file)
  } catch {
    return {
      dataUrl: '',
      error: 'Impossible de lire cette image — essayez JPEG ou PNG',
    }
  }

  const srcW = bitmap.width
  const srcH = bitmap.height
  const srcRatio = srcW / srcH
  const dstRatio = targetW / targetH

  let sx = 0
  let sy = 0
  let sw = srcW
  let sh = srcH
  if (srcRatio > dstRatio) {
    sw = Math.round(srcH * dstRatio)
    sx = Math.round((srcW - sw) / 2)
  } else if (srcRatio < dstRatio) {
    sh = Math.round(srcW / dstRatio)
    sy = Math.round((srcH - sh) / 2)
  }

  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return { dataUrl: '', error: 'Canvas non disponible' }
  }
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, targetW, targetH)
  bitmap.close()

  for (const quality of [0.86, 0.74, 0.62, 0.5, 0.38]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    const b64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
    const approxBytes = Math.ceil((b64.length * 3) / 4)
    if (approxBytes <= maxBytes) {
      return { dataUrl }
    }
  }

  return {
    dataUrl: '',
    error: 'Image trop lourde même après compression — choisissez une photo plus légère',
  }
}

/**
 * Compresse une capture pour un retour support : conserve le ratio (pas de crop),
 * plafonne la plus grande dimension, JPEG léger.
 */
export async function compressSupportImage(
  file: File,
  opts?: { maxBytes?: number; maxEdge?: number }
): Promise<{ dataUrl: string; error?: string }> {
  if (!looksLikeImage(file)) {
    return { dataUrl: '', error: 'Fichier image requis (JPEG, PNG, WebP ou GIF)' }
  }

  const maxBytes = opts?.maxBytes ?? 300_000
  const maxEdge = opts?.maxEdge ?? 1600

  let bitmap: ImageBitmap
  try {
    bitmap = await loadBitmap(file)
  } catch {
    return {
      dataUrl: '',
      error: 'Impossible de lire cette image — essayez JPEG ou PNG',
    }
  }

  const srcW = bitmap.width
  const srcH = bitmap.height
  const scale = Math.min(1, maxEdge / Math.max(srcW, srcH))
  const dstW = Math.max(1, Math.round(srcW * scale))
  const dstH = Math.max(1, Math.round(srcH * scale))

  const canvas = document.createElement('canvas')
  canvas.width = dstW
  canvas.height = dstH
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return { dataUrl: '', error: 'Canvas non disponible' }
  }
  ctx.drawImage(bitmap, 0, 0, dstW, dstH)
  bitmap.close()

  for (const quality of [0.86, 0.74, 0.62, 0.5, 0.38]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    const b64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
    const approxBytes = Math.ceil((b64.length * 3) / 4)
    if (approxBytes <= maxBytes) {
      return { dataUrl }
    }
  }

  return {
    dataUrl: '',
    error: 'Image trop lourde même après compression — choisissez une capture plus légère',
  }
}

/** Extrait le premier fichier image d’un événement presse-papiers ou drop. */
export function imageFileFromDataTransfer(data: DataTransfer | null | undefined): File | null {
  if (!data) return null
  if (data.files?.length) {
    for (let i = 0; i < data.files.length; i++) {
      const f = data.files.item(i)
      if (f && looksLikeImage(f)) return f
    }
  }
  const items = data.items
  if (!items) return null
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item?.kind === 'file' && typeof item.type === 'string' && item.type.startsWith('image/')) {
      const f = item.getAsFile()
      if (f) return f
    }
  }
  return null
}
