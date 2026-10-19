import JSZip from 'jszip'

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load image'))
    img.src = src
  })
}

export function makeCanvas(width, height) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(width))
  c.height = Math.max(1, Math.round(height))
  return c
}

export async function loadCanvas(src) {
  const img = await loadImage(src)
  const c = makeCanvas(img.naturalWidth, img.naturalHeight)
  c.getContext('2d').drawImage(img, 0, 0)
  return c
}

const pad = (n) => String(n).padStart(2, '0')
export function timestampName(date = new Date()) {
  return `screenshot-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(
    date.getHours(),
  )}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
}

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/bmp': 'bmp' }
export function extensionOf(dataURL) {
  const mime = dataURL.slice(5, dataURL.indexOf(';'))
  return EXT[mime] ?? 'png'
}

export const fileNameOf = (item) => `${item.name}.${extensionOf(item.src)}`

export function dataURLSize(dataURL) {
  const base64 = dataURL.slice(dataURL.indexOf(',') + 1)
  return Math.round((base64.length * 3) / 4)
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function downloadURL(url, filename) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export async function downloadAllAsZip(items, zipName = 'screenshots.zip') {
  const zip = new JSZip()
  const used = new Set()
  for (const item of items) {
    let name = fileNameOf(item)
    for (let i = 2; used.has(name); i++) name = `${item.name}-${i}.${extensionOf(item.src)}`
    used.add(name)
    zip.file(name, item.src.slice(item.src.indexOf(',') + 1), { base64: true })
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  downloadURL(url, zipName)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
