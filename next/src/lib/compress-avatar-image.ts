/** Redimensionne et compresse une image pour le profil (max ~120 Ko JPEG). */
export async function compressAvatarImage(
  file: File,
  maxBytes = 120_000
): Promise<{ dataUrl: string; error?: string }> {
  if (!file.type.startsWith('image/')) {
    return { dataUrl: '', error: 'Fichier image requis' }
  }

  const bitmap = await createImageBitmap(file)
  const maxDim = 512
  let w = bitmap.width
  let h = bitmap.height
  if (w > maxDim || h > maxDim) {
    if (w >= h) {
      h = Math.round((h * maxDim) / w)
      w = maxDim
    } else {
      w = Math.round((w * maxDim) / h)
      h = maxDim
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return { dataUrl: '', error: 'Canvas non disponible' }
  }
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  for (const quality of [0.88, 0.75, 0.6, 0.45, 0.32]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    const b64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
    const approxBytes = Math.ceil((b64.length * 3) / 4)
    if (approxBytes <= maxBytes) {
      return { dataUrl }
    }
  }

  return {
    dataUrl: '',
    error: 'Image trop lourde même après compression — choisissez une photo plus petite',
  }
}
