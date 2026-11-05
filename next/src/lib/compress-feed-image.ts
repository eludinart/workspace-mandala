/**
 * Redimensionne / recadre une image pour le fil Agora (bandeau ~16:10, JPEG léger).
 */
export async function compressFeedImage(
  file: File,
  opts?: { maxBytes?: number; targetWidth?: number; targetHeight?: number }
): Promise<{ dataUrl: string; error?: string }> {
  if (!file.type.startsWith('image/')) {
    return { dataUrl: '', error: 'Fichier image requis' }
  }

  const maxBytes = opts?.maxBytes ?? 450_000
  const targetW = opts?.targetWidth ?? 1200
  const targetH = opts?.targetHeight ?? 750

  const bitmap = await createImageBitmap(file)
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
