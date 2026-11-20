export async function scanImage(file: File): Promise<string | null> {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type) || file.size > 10 * 1024 * 1024) {
    throw new Error('Chọn ảnh PNG, JPG, WebP hoặc GIF tối đa 10 MB.')
  }

  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    const [{ default: decode }] = await Promise.all([import('jsqr'), image.decode()])
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Không đọc được ảnh.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const frame = context.getImageData(0, 0, canvas.width, canvas.height)
    return decode(frame.data, frame.width, frame.height)?.data ?? null
  } catch {
    throw new Error('Không đọc được tệp ảnh. Vui lòng chọn ảnh khác.')
  } finally {
    URL.revokeObjectURL(url)
  }
}
