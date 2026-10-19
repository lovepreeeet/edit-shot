import { makeCanvas } from './files.js'

export const DEFAULT_ADJUST = { brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0 }

export const supportsFilter = (() => {
  try {
    return typeof document.createElement('canvas').getContext('2d').filter === 'string'
  } catch {
    return false
  }
})()

export const filterString = (a) =>
  `brightness(${a.brightness}%) contrast(${a.contrast}%) saturate(${a.saturate}%) grayscale(${a.grayscale}%) sepia(${a.sepia}%)`

export const textFont = (size) => `600 ${size}px Inter, system-ui, -apple-system, "Segoe UI", sans-serif`

// Box-like shapes store two corner points; normalize to x/y/w/h.
export function norm(s) {
  return {
    x: Math.min(s.x1, s.x2),
    y: Math.min(s.y1, s.y2),
    w: Math.abs(s.x2 - s.x1),
    h: Math.abs(s.y2 - s.y1),
  }
}

export function contrastColor(hex) {
  const v = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16))
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? '#111827' : '#ffffff'
}

const stepRadius = (s) => Math.max(12, s.size * 0.7)

function drawArrow(ctx, s) {
  const { x1, y1, x2, y2 } = s
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const head = Math.max(14, s.width * 4)
  const bx = x2 - Math.cos(angle) * head * 0.8
  const by = y2 - Math.sin(angle) * head * 0.8
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(bx, by)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 7), y2 - head * Math.sin(angle - Math.PI / 7))
  ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 7), y2 - head * Math.sin(angle + Math.PI / 7))
  ctx.closePath()
  ctx.fill()
}

function drawBlur(ctx, s) {
  const { x, y, w, h } = norm(s)
  if (w < 1 || h < 1) return
  const canvas = ctx.canvas
  // Copy the region (plus a margin so the blur has real pixels to sample at its edges).
  const m = s.mode === 'pixelate' ? 0 : s.amount * 3
  const sx = Math.max(0, Math.floor(x - m))
  const sy = Math.max(0, Math.floor(y - m))
  const sw = Math.min(canvas.width, Math.ceil(x + w + m)) - sx
  const sh = Math.min(canvas.height, Math.ceil(y + h + m)) - sy
  if (sw < 1 || sh < 1) return
  const tmp = makeCanvas(sw, sh)
  tmp.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh)

  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  if (s.mode === 'pixelate' || !supportsFilter) {
    const block = Math.max(3, s.amount)
    const small = makeCanvas(Math.ceil(sw / block), Math.ceil(sh / block))
    small.getContext('2d').drawImage(tmp, 0, 0, small.width, small.height)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(small, 0, 0, small.width, small.height, sx, sy, sw, sh)
  } else {
    ctx.filter = `blur(${s.amount}px)`
    ctx.drawImage(tmp, sx, sy)
  }
}

export function drawShape(ctx, s) {
  ctx.save()
  ctx.strokeStyle = s.color
  ctx.fillStyle = s.color
  ctx.lineWidth = s.width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  switch (s.type) {
    case 'rect': {
      const { x, y, w, h } = norm(s)
      if (s.fill) ctx.fillRect(x, y, w, h)
      else ctx.strokeRect(x, y, w, h)
      break
    }
    case 'ellipse': {
      const { x, y, w, h } = norm(s)
      ctx.beginPath()
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
      if (s.fill) ctx.fill()
      else ctx.stroke()
      break
    }
    case 'line':
      ctx.beginPath()
      ctx.moveTo(s.x1, s.y1)
      ctx.lineTo(s.x2, s.y2)
      ctx.stroke()
      break
    case 'arrow':
      drawArrow(ctx, s)
      break
    case 'pen':
      ctx.beginPath()
      s.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
      ctx.stroke()
      break
    case 'highlight': {
      const { x, y, w, h } = norm(s)
      ctx.globalAlpha = 0.4
      ctx.globalCompositeOperation = 'multiply'
      ctx.fillRect(x, y, w, h)
      break
    }
    case 'blur':
      drawBlur(ctx, s)
      break
    case 'text': {
      ctx.font = textFont(s.size)
      ctx.textBaseline = 'top'
      const lines = s.text.split('\n')
      const lh = s.size * 1.25
      if (s.fill) {
        const pad = s.size * 0.3
        const w = Math.max(...lines.map((l) => ctx.measureText(l).width))
        ctx.fillStyle = s.color
        ctx.beginPath()
        ctx.roundRect(s.x - pad, s.y - pad, w + pad * 2, lines.length * lh + pad * 2 - (lh - s.size), pad * 0.6)
        ctx.fill()
        ctx.fillStyle = contrastColor(s.color)
      }
      lines.forEach((l, i) => ctx.fillText(l, s.x, s.y + i * lh))
      break
    }
    case 'step': {
      const r = stepRadius(s)
      ctx.beginPath()
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2)
      ctx.shadowColor = 'rgba(0,0,0,.35)'
      ctx.shadowBlur = r * 0.4
      ctx.fill()
      ctx.shadowColor = 'transparent'
      ctx.fillStyle = contrastColor(s.color)
      ctx.font = textFont(r * 1.1)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(s.n), s.x, s.y + r * 0.05)
      break
    }
  }
  ctx.restore()
}

export function shapeBounds(ctx, s) {
  const pad = (s.width ?? 0) / 2
  switch (s.type) {
    case 'rect':
    case 'ellipse':
    case 'highlight':
    case 'blur': {
      const { x, y, w, h } = norm(s)
      return { x: x - pad, y: y - pad, w: w + pad * 2, h: h + pad * 2 }
    }
    case 'line':
    case 'arrow': {
      const p = Math.max(pad, s.type === 'arrow' ? s.width * 2 : 0)
      const { x, y, w, h } = norm(s)
      return { x: x - p, y: y - p, w: w + p * 2, h: h + p * 2 }
    }
    case 'pen': {
      const xs = s.points.map((p) => p.x)
      const ys = s.points.map((p) => p.y)
      const x = Math.min(...xs)
      const y = Math.min(...ys)
      return { x: x - pad, y: y - pad, w: Math.max(...xs) - x + pad * 2, h: Math.max(...ys) - y + pad * 2 }
    }
    case 'text': {
      ctx.save()
      ctx.font = textFont(s.size)
      const lines = s.text.split('\n')
      const w = Math.max(...lines.map((l) => ctx.measureText(l).width))
      ctx.restore()
      return { x: s.x, y: s.y, w, h: (lines.length - 1) * s.size * 1.25 + s.size }
    }
    case 'step': {
      const r = stepRadius(s)
      return { x: s.x - r, y: s.y - r, w: r * 2, h: r * 2 }
    }
    default:
      return { x: 0, y: 0, w: 0, h: 0 }
  }
}

export function hitTest(ctx, s, p, tolerance) {
  const b = shapeBounds(ctx, s)
  return (
    p.x >= b.x - tolerance && p.x <= b.x + b.w + tolerance && p.y >= b.y - tolerance && p.y <= b.y + b.h + tolerance
  )
}

export function moveShape(s, dx, dy) {
  if (s.points) return { ...s, points: s.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
  if ('x1' in s) return { ...s, x1: s.x1 + dx, y1: s.y1 + dy, x2: s.x2 + dx, y2: s.y2 + dy }
  return { ...s, x: s.x + dx, y: s.y + dy }
}

/**
 * Draw a document (base image + adjustments + shapes) onto a canvas.
 * Options are editor-only overlays: an in-progress shape, the selection box, the crop region.
 */
export function renderDoc(canvas, doc, { draft, selected, crop, uiScale = 1 } = {}) {
  const { base, shapes, adjust } = doc
  if (canvas.width !== base.width || canvas.height !== base.height) {
    canvas.width = base.width
    canvas.height = base.height
  }
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.save()
  if (supportsFilter) ctx.filter = filterString(adjust)
  ctx.drawImage(base, 0, 0)
  ctx.restore()

  for (const s of shapes) drawShape(ctx, s)
  if (draft && draft.type !== 'crop') drawShape(ctx, draft)

  const ui = 1 / uiScale
  if (selected) {
    const b = shapeBounds(ctx, selected)
    const p = 4 * ui
    ctx.save()
    ctx.lineWidth = 1.5 * ui
    ctx.setLineDash([6 * ui, 4 * ui])
    ctx.strokeStyle = '#3b82f6'
    ctx.strokeRect(b.x - p, b.y - p, b.w + p * 2, b.h + p * 2)
    ctx.restore()
  }

  const cropBox = draft?.type === 'crop' ? draft : crop
  if (cropBox) {
    const r = norm(cropBox)
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,.55)'
    ctx.beginPath()
    ctx.rect(0, 0, canvas.width, canvas.height)
    ctx.rect(r.x, r.y, r.w, r.h)
    ctx.fill('evenodd')
    ctx.lineWidth = 1.5 * ui
    ctx.setLineDash([6 * ui, 4 * ui])
    ctx.strokeStyle = '#fff'
    ctx.strokeRect(r.x, r.y, r.w, r.h)
    ctx.restore()
  }
}

export function flatten(doc) {
  const c = makeCanvas(doc.base.width, doc.base.height)
  renderDoc(c, doc)
  return c
}

export function sharpen(source, amount = 0.6) {
  const { width: w, height: h } = source
  const out = makeCanvas(w, h)
  const octx = out.getContext('2d')
  octx.drawImage(source, 0, 0)
  const src = octx.getImageData(0, 0, w, h)
  const dst = octx.createImageData(w, h)
  const s = src.data
  const d = dst.data
  const center = 1 + 4 * amount
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const up = y > 0 ? i - w * 4 : i
      const down = y < h - 1 ? i + w * 4 : i
      const left = x > 0 ? i - 4 : i
      const right = x < w - 1 ? i + 4 : i
      for (let c = 0; c < 3; c++) {
        d[i + c] = s[i + c] * center - amount * (s[up + c] + s[down + c] + s[left + c] + s[right + c])
      }
      d[i + 3] = s[i + 3]
    }
  }
  octx.putImageData(dst, 0, 0)
  return out
}

// Re-map one shape through a point transform. Text keeps reading upright, so it is
// positioned by its center rather than rotated.
function mapShape(ctx, s, f) {
  if (s.points) return { ...s, points: s.points.map(f) }
  if ('x1' in s) {
    const a = f({ x: s.x1, y: s.y1 })
    const b = f({ x: s.x2, y: s.y2 })
    return { ...s, x1: a.x, y1: a.y, x2: b.x, y2: b.y }
  }
  if (s.type === 'text') {
    const bb = shapeBounds(ctx, s)
    const c = f({ x: bb.x + bb.w / 2, y: bb.y + bb.h / 2 })
    return { ...s, x: c.x - bb.w / 2, y: c.y - bb.h / 2 }
  }
  return { ...s, ...f({ x: s.x, y: s.y }) }
}

/**
 * Rotate, flip or crop a document. Only the raw base pixels are transformed:
 * adjustments stay live (still on the sliders) and shapes stay editable.
 *   { type: 'rotate', dir: 1 | -1 } | { type: 'flip', horizontal } | { type: 'crop', x, y, w, h }
 */
export function transformDoc(doc, op) {
  const { base } = doc
  const W = base.width
  const H = base.height
  let out
  let f
  if (op.type === 'rotate') {
    out = makeCanvas(H, W)
    const ctx = out.getContext('2d')
    ctx.translate(out.width / 2, out.height / 2)
    ctx.rotate((op.dir * Math.PI) / 2)
    ctx.drawImage(base, -W / 2, -H / 2)
    f = op.dir > 0 ? (p) => ({ x: H - p.y, y: p.x }) : (p) => ({ x: p.y, y: W - p.x })
  } else if (op.type === 'flip') {
    out = makeCanvas(W, H)
    const ctx = out.getContext('2d')
    ctx.translate(op.horizontal ? W : 0, op.horizontal ? 0 : H)
    ctx.scale(op.horizontal ? -1 : 1, op.horizontal ? 1 : -1)
    ctx.drawImage(base, 0, 0)
    f = op.horizontal ? (p) => ({ x: W - p.x, y: p.y }) : (p) => ({ x: p.x, y: H - p.y })
  } else {
    out = makeCanvas(op.w, op.h)
    out.getContext('2d').drawImage(base, op.x, op.y, op.w, op.h, 0, 0, op.w, op.h)
    f = (p) => ({ x: p.x - op.x, y: p.y - op.y })
  }
  const measure = out.getContext('2d')
  return { ...doc, base: out, shapes: doc.shapes.map((s) => mapShape(measure, s, f)) }
}
