import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { downloadURL, loadCanvas, uid } from '../lib/files.js'
import {
  DEFAULT_ADJUST,
  flatten,
  hitTest,
  moveShape,
  norm,
  renderDoc,
  sharpen,
  textFont,
  transformDoc,
} from '../lib/render.js'

const TOOLS = [
  { id: 'select', label: 'Select / move', icon: 'select', key: 'v' },
  { id: 'rect', label: 'Rectangle', icon: 'rect', key: 'r' },
  { id: 'ellipse', label: 'Circle / ellipse', icon: 'ellipse', key: 'o' },
  { id: 'arrow', label: 'Arrow', icon: 'arrow', key: 'a' },
  { id: 'line', label: 'Line', icon: 'line', key: 'l' },
  { id: 'pen', label: 'Freehand', icon: 'pen', key: 'p' },
  { id: 'text', label: 'Text', icon: 'text', key: 't' },
  { id: 'highlight', label: 'Highlighter', icon: 'highlight', key: 'h' },
  { id: 'blur', label: 'Blur / pixelate', icon: 'blur', key: 'b' },
  { id: 'step', label: 'Numbered step', icon: 'step', key: 'n' },
  { id: 'crop', label: 'Crop', icon: 'crop', key: 'c' },
]

const COLORS = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899', '#ffffff', '#111827']

const ADJUSTMENTS = [
  { key: 'brightness', label: 'Brightness', min: 0, max: 200 },
  { key: 'contrast', label: 'Contrast', min: 0, max: 200 },
  { key: 'saturate', label: 'Saturation', min: 0, max: 200 },
  { key: 'grayscale', label: 'Grayscale', min: 0, max: 100 },
  { key: 'sepia', label: 'Sepia', min: 0, max: 100 },
]

const ZOOM_MIN = 0.05
const ZOOM_MAX = 8
const clampZoom = (z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))
const freshDoc = (base) => ({ base, shapes: [], adjust: DEFAULT_ADJUST })

export default function ImageEditor({ item, position, total, onClose, onSave, onNavigate }) {
  // history.key lets continuous edits (slider drags, shape moves) collapse into one undo step.
  const [history, setHistory] = useState(null)
  const [savedIndex, setSavedIndex] = useState(0)
  const [tool, setTool] = useState('rect')
  const [color, setColor] = useState('#ef4444')
  const [strokeWidth, setStrokeWidth] = useState(4)
  const [fontSize, setFontSize] = useState(32)
  const [blurAmount, setBlurAmount] = useState(10)
  const [blurMode, setBlurMode] = useState('blur')
  const [fill, setFill] = useState(false)
  const [zoom, setZoom] = useState(null) // null = fit to screen
  const [fitScale, setFitScale] = useState(1)
  const [draft, setDraft] = useState(null)
  const [crop, setCrop] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [textEdit, setTextEdit] = useState(null)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState('')
  const [fontsReady, setFontsReady] = useState(false)

  const canvasRef = useRef(null)
  const stageRef = useRef(null)
  const dragRef = useRef(null)
  const draftRef = useRef(null)
  const textareaRef = useRef(null)
  const flashTimer = useRef(null)

  const doc = history?.stack[history.index]
  const scale = zoom ?? fitScale
  const dirty = history ? history.index !== savedIndex : false
  const selected = doc?.shapes.find((s) => s.id === selectedId)

  useEffect(() => {
    let cancelled = false
    loadCanvas(item.src).then((base) => {
      if (!cancelled) setHistory({ stack: [freshDoc(base)], index: 0, key: null })
    })
    return () => {
      cancelled = true
    }
    // Only load once per image; saving updates item.src but we keep our own history.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Canvas text needs Inter loaded first, otherwise it silently falls back to the system font.
  useEffect(() => {
    document.fonts?.load(textFont(32)).then(() => setFontsReady(true), () => {})
  }, [])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const commit = useCallback((updater, key = null) => {
    setHistory((h) => {
      const cur = h.stack[h.index]
      const next = typeof updater === 'function' ? updater(cur) : updater
      if (key && h.key === key) {
        const stack = h.stack.slice(0, h.index + 1)
        stack[h.index] = next
        return { stack, index: h.index, key }
      }
      const stack = [...h.stack.slice(0, h.index + 1), next]
      return { stack, index: stack.length - 1, key }
    })
  }, [])

  const undo = () => {
    setSelectedId(null)
    setHistory((h) => (h && h.index > 0 ? { ...h, index: h.index - 1, key: null } : h))
  }
  const redo = () => {
    setSelectedId(null)
    setHistory((h) => (h && h.index < h.stack.length - 1 ? { ...h, index: h.index + 1, key: null } : h))
  }

  const notify = (msg) => {
    setFlash(msg)
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(''), 1800)
  }

  // Fit-to-screen scale follows the stage size.
  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage || !doc) return
    const update = () => {
      const s = Math.min((stage.clientWidth - 48) / doc.base.width, (stage.clientHeight - 48) / doc.base.height, 1)
      setFitScale(clampZoom(s))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(stage)
    return () => ro.disconnect()
  }, [doc?.base])

  // Ctrl/Cmd + wheel zooms.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      setZoom((z) => clampZoom((z ?? fitScale) * (e.deltaY < 0 ? 1.1 : 1 / 1.1)))
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [fitScale])

  useEffect(() => {
    if (!doc) return
    const view = textEdit?.id ? { ...doc, shapes: doc.shapes.filter((s) => s.id !== textEdit.id) } : doc
    renderDoc(canvasRef.current, view, { draft, selected, crop, uiScale: scale })
  }, [doc, draft, selected, crop, scale, textEdit?.id, fontsReady])

  useEffect(() => {
    if (!textEdit) return
    const id = requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.select()
    })
    return () => cancelAnimationFrame(id)
  }, [textEdit?.x, textEdit?.y]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- pointer interaction ---------- */

  const toPoint = (e) => {
    const c = canvasRef.current
    const r = c.getBoundingClientRect()
    return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height }
  }

  const findShapeAt = (p) => {
    const ctx = canvasRef.current.getContext('2d')
    return [...doc.shapes].reverse().find((s) => hitTest(ctx, s, p, 6 / scale))
  }

  const onPointerDown = (e) => {
    if (!doc || e.button !== 0) return
    e.preventDefault() // keeps focus on the text box we may be about to open
    if (textEdit) {
      textareaRef.current?.blur()
      return
    }
    const p = toPoint(e)
    if (tool === 'select') {
      const hit = findShapeAt(p)
      if (hit) {
        setSelectedId(hit.id)
        dragRef.current = { mode: 'move', start: p, orig: hit, key: `move-${uid()}` }
      } else {
        setSelectedId(null)
        const st = stageRef.current
        dragRef.current = { mode: 'pan', cx: e.clientX, cy: e.clientY, sl: st.scrollLeft, stp: st.scrollTop }
      }
    } else if (tool === 'text') {
      setTextEdit({ x: p.x, y: p.y, value: '', color, size: fontSize, fill })
      return
    } else if (tool === 'step') {
      const n = doc.shapes.filter((s) => s.type === 'step').length + 1
      commit((d) => ({ ...d, shapes: [...d.shapes, { id: uid(), type: 'step', x: p.x, y: p.y, n, color, size: fontSize }] }))
      return
    } else {
      setSelectedId(null)
      if (tool === 'crop') setCrop(null)
      const base = { id: uid(), type: tool, color, width: strokeWidth, fill }
      const shape =
        tool === 'pen'
          ? { ...base, points: [p] }
          : { ...base, x1: p.x, y1: p.y, x2: p.x, y2: p.y, ...(tool === 'blur' && { amount: blurAmount, mode: blurMode }) }
      draftRef.current = shape
      setDraft(shape)
      dragRef.current = { mode: 'draw' }
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e) => {
    const d = dragRef.current
    if (!d) return
    if (d.mode === 'pan') {
      const st = stageRef.current
      st.scrollLeft = d.sl - (e.clientX - d.cx)
      st.scrollTop = d.stp - (e.clientY - d.cy)
      return
    }
    const p = toPoint(e)
    if (d.mode === 'move') {
      const dx = p.x - d.start.x
      const dy = p.y - d.start.y
      commit((doc) => ({ ...doc, shapes: doc.shapes.map((s) => (s.id === d.orig.id ? moveShape(d.orig, dx, dy) : s)) }), d.key)
      return
    }
    const cur = draftRef.current
    let next
    if (cur.type === 'pen') {
      next = { ...cur, points: [...cur.points, p] }
    } else {
      let { x: x2, y: y2 } = p
      if (e.shiftKey) {
        const dx = x2 - cur.x1
        const dy = y2 - cur.y1
        if (cur.type === 'line' || cur.type === 'arrow') {
          // snap to 45° increments
          const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4)
          const len = Math.hypot(dx, dy)
          x2 = cur.x1 + Math.cos(ang) * len
          y2 = cur.y1 + Math.sin(ang) * len
        } else {
          const size = Math.max(Math.abs(dx), Math.abs(dy))
          x2 = cur.x1 + Math.sign(dx || 1) * size
          y2 = cur.y1 + Math.sign(dy || 1) * size
        }
      }
      next = { ...cur, x2, y2 }
    }
    draftRef.current = next
    setDraft(next)
  }

  const onPointerUp = () => {
    const d = dragRef.current
    dragRef.current = null
    if (d?.mode !== 'draw') return
    const s = draftRef.current
    draftRef.current = null
    setDraft(null)
    if (!s) return
    if (s.type === 'crop') {
      const r = norm(s)
      if (r.w > 4 && r.h > 4) setCrop(s)
      return
    }
    const big = s.type === 'pen' ? s.points.length > 1 : Math.hypot(s.x2 - s.x1, s.y2 - s.y1) > 3
    if (big) commit((doc) => ({ ...doc, shapes: [...doc.shapes, s] }))
  }

  const onDoubleClick = (e) => {
    if (tool !== 'select' || !doc) return
    const hit = findShapeAt(toPoint(e))
    if (hit?.type === 'text') {
      setSelectedId(null)
      setTextEdit({ id: hit.id, x: hit.x, y: hit.y, value: hit.text, color: hit.color, size: hit.size, fill: hit.fill })
    }
  }

  const commitText = () => {
    const t = textEdit
    setTextEdit(null)
    if (!t) return
    const value = t.value.trim() ? t.value.replace(/\s+$/, '') : ''
    if (t.id) {
      commit((d) => ({
        ...d,
        shapes: value ? d.shapes.map((s) => (s.id === t.id ? { ...s, text: value } : s)) : d.shapes.filter((s) => s.id !== t.id),
      }))
    } else if (value) {
      commit((d) => ({
        ...d,
        shapes: [...d.shapes, { id: uid(), type: 'text', x: t.x, y: t.y, text: value, color: t.color, size: t.size, fill: t.fill }],
      }))
    }
  }

  /* ---------- style changes (also restyle the selected shape) ---------- */

  const restyleSelected = (patch) => {
    if (!selectedId) return
    commit(
      (d) => ({ ...d, shapes: d.shapes.map((s) => (s.id === selectedId ? { ...s, ...patch } : s)) }),
      `style-${selectedId}-${Object.keys(patch)[0]}`,
    )
  }
  const changeColor = (c) => {
    setColor(c)
    setTextEdit((t) => t && { ...t, color: c })
    restyleSelected({ color: c })
  }
  const changeWidth = (w) => {
    setStrokeWidth(w)
    restyleSelected({ width: w })
  }
  const changeFontSize = (size) => {
    setFontSize(size)
    setTextEdit((t) => t && { ...t, size })
    if (selected?.type === 'text' || selected?.type === 'step') restyleSelected({ size })
  }
  const changeFill = (f) => {
    setFill(f)
    setTextEdit((t) => t && { ...t, fill: f })
    restyleSelected({ fill: f })
  }
  const changeBlur = (amount) => {
    setBlurAmount(amount)
    if (selected?.type === 'blur') restyleSelected({ amount })
  }
  const changeBlurMode = (mode) => {
    setBlurMode(mode)
    if (selected?.type === 'blur') restyleSelected({ mode })
  }

  const deleteSelected = () => {
    if (!selectedId) return
    commit((d) => ({ ...d, shapes: d.shapes.filter((s) => s.id !== selectedId) }))
    setSelectedId(null)
  }

  const nudgeSelected = (dx, dy) =>
    commit((d) => ({ ...d, shapes: d.shapes.map((s) => (s.id === selectedId ? moveShape(s, dx, dy) : s)) }), `nudge-${selectedId}`)

  /* ---------- image operations ---------- */

  const setAdjust = (key, value) => commit((d) => ({ ...d, adjust: { ...d.adjust, [key]: value } }), `adjust-${key}`)

  const autoEnhance = () =>
    commit((d) => ({ ...d, adjust: { ...d.adjust, brightness: 105, contrast: 115, saturate: 125 } }))

  const runBusy = (fn) => {
    setBusy(true)
    // let the spinner paint before the heavy pixel work
    setTimeout(() => {
      try {
        fn()
      } finally {
        setBusy(false)
      }
    }, 30)
  }

  const doSharpen = () => runBusy(() => commit((d) => ({ ...d, base: sharpen(d.base) })))

  const rotate = (dir) => {
    setSelectedId(null)
    setCrop(null)
    setZoom(null)
    commit((d) => transformDoc(d, { type: 'rotate', dir }))
  }

  const flip = (horizontal) => {
    setSelectedId(null)
    setCrop(null)
    commit((d) => transformDoc(d, { type: 'flip', horizontal }))
  }

  const applyCrop = () => {
    if (!crop) return
    const r = norm(crop)
    const x = Math.max(0, Math.round(r.x))
    const y = Math.max(0, Math.round(r.y))
    const w = Math.min(doc.base.width - x, Math.round(r.w))
    const h = Math.min(doc.base.height - y, Math.round(r.h))
    setCrop(null)
    setSelectedId(null)
    setZoom(null)
    if (w < 2 || h < 2) return
    commit((d) => transformDoc(d, { type: 'crop', x, y, w, h }))
  }

  const clearAnnotations = () => {
    setSelectedId(null)
    commit((d) => ({ ...d, shapes: [] }))
  }

  const revertToOriginal = async () => {
    const base = await loadCanvas(item.original)
    setSelectedId(null)
    setCrop(null)
    setZoom(null)
    commit(freshDoc(base))
  }

  /* ---------- output ---------- */

  const exportCanvas = () => flatten(doc)

  const download = () => {
    downloadURL(exportCanvas().toDataURL('image/png'), `${item.name}-edited.png`)
  }

  const copyToClipboard = () => {
    exportCanvas().toBlob(async (blob) => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        notify('Copied to clipboard')
      } catch {
        notify('Clipboard not available here')
      }
    }, 'image/png')
  }

  const save = () => {
    if (!doc) return
    const c = exportCanvas()
    onSave(item.id, { src: c.toDataURL('image/png'), width: c.width, height: c.height })
    setSavedIndex(history.index)
    setHistory((h) => ({ ...h, key: null }))
    notify('Saved to gallery')
  }

  const confirmLeave = () => !dirty || window.confirm('You have unsaved changes. Discard them?')
  const requestClose = () => confirmLeave() && onClose()
  const requestNavigate = (dir) => total > 1 && confirmLeave() && onNavigate(dir)

  /* ---------- keyboard ---------- */

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('textarea, input[type="text"], input[type="number"]')) return
      const mod = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      if (mod) {
        if (k === 'z') {
          e.preventDefault()
          if (e.shiftKey) redo()
          else undo()
        } else if (k === 'y') {
          e.preventDefault()
          redo()
        } else if (k === 's') {
          e.preventDefault()
          save()
        } else if (k === '=' || k === '+') {
          e.preventDefault()
          setZoom((z) => clampZoom((z ?? fitScale) * 1.25))
        } else if (k === '-') {
          e.preventDefault()
          setZoom((z) => clampZoom((z ?? fitScale) / 1.25))
        } else if (k === '0') {
          e.preventDefault()
          setZoom(null)
        }
        return
      }
      if (e.key === 'Escape') {
        if (crop) setCrop(null)
        else if (selectedId) setSelectedId(null)
        else requestClose()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault()
        deleteSelected()
      } else if (e.key === 'Enter' && crop) {
        applyCrop()
      } else if (e.key.startsWith('Arrow')) {
        if (selectedId) {
          e.preventDefault()
          const step = e.shiftKey ? 10 : 1
          const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
          const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
          nudgeSelected(dx, dy)
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          if (e.target.matches?.('input[type="range"]')) return
          requestNavigate(e.key === 'ArrowLeft' ? -1 : 1)
        }
      } else {
        const t = TOOLS.find((t) => t.key === k)
        if (t) setTool(t.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /* ---------- view ---------- */

  const showStroke = ['rect', 'ellipse', 'arrow', 'line', 'pen'].includes(selected?.type ?? tool)
  const showFill = ['rect', 'ellipse', 'text'].includes(selected?.type ?? tool)
  const showFont = ['text', 'step'].includes(selected?.type ?? tool)
  const showBlur = (selected?.type ?? tool) === 'blur'
  const cursor = tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair'

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && requestClose()}>
      <div className="editor" role="dialog" aria-modal="true" aria-label={`Edit ${item.name}`}>
        <div className="editor-top">
          <div className="editor-title">
            <button className="icon-btn" title="Previous (←)" disabled={total < 2} onClick={() => requestNavigate(-1)}>
              <Icon name="chevronLeft" />
            </button>
            <div className="editor-name">
              <strong>{item.name}</strong>
              <span>
                {position} / {total}
                {doc && ` · ${doc.base.width}×${doc.base.height}`}
                {dirty && ' · unsaved'}
              </span>
            </div>
            <button className="icon-btn" title="Next (→)" disabled={total < 2} onClick={() => requestNavigate(1)}>
              <Icon name="chevronRight" />
            </button>
          </div>

          <div className="editor-actions">
            <div className="btn-group">
              <button className="icon-btn" title="Undo (Ctrl+Z)" disabled={!history || history.index === 0} onClick={undo}>
                <Icon name="undo" />
              </button>
              <button
                className="icon-btn"
                title="Redo (Ctrl+Shift+Z)"
                disabled={!history || history.index >= history.stack.length - 1}
                onClick={redo}
              >
                <Icon name="redo" />
              </button>
            </div>
            <div className="btn-group zoom-group">
              <button className="icon-btn" title="Zoom out (Ctrl -)" onClick={() => setZoom(clampZoom(scale / 1.25))}>
                <Icon name="zoomOut" />
              </button>
              <button className="zoom-label" title="Reset to 100%" onClick={() => setZoom(1)}>
                {Math.round(scale * 100)}%
              </button>
              <button className="icon-btn" title="Zoom in (Ctrl +)" onClick={() => setZoom(clampZoom(scale * 1.25))}>
                <Icon name="zoomIn" />
              </button>
              <button className="icon-btn" title="Fit to screen (Ctrl 0)" onClick={() => setZoom(null)}>
                <Icon name="expand" />
              </button>
            </div>
            <button className="btn" onClick={copyToClipboard} disabled={!doc} title="Copy image to clipboard">
              <Icon name="copy" size={16} /> <span className="hide-sm">Copy</span>
            </button>
            <button className="btn" onClick={download} disabled={!doc}>
              <Icon name="download" size={16} /> <span className="hide-sm">Download</span>
            </button>
            <button className="btn btn-primary" onClick={save} disabled={!doc || !dirty} title="Save to gallery (Ctrl+S)">
              <Icon name="check" size={16} /> <span className="hide-sm">Save</span>
            </button>
            <button className="icon-btn" title="Close (Esc)" onClick={requestClose}>
              <Icon name="close" />
            </button>
          </div>
        </div>

        <div className="editor-tools" role="toolbar" aria-label="Drawing tools">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={`tool-btn${tool === t.id ? ' active' : ''}`}
              title={`${t.label} (${t.key.toUpperCase()})`}
              aria-pressed={tool === t.id}
              onClick={() => {
                setTool(t.id)
                if (t.id !== 'select') setSelectedId(null)
                if (t.id !== 'crop') setCrop(null)
              }}
            >
              <Icon name={t.icon} size={20} />
            </button>
          ))}
        </div>

        <div className="editor-stage" ref={stageRef}>
          {!doc && <div className="stage-loading">Loading…</div>}
          {doc && (
            <div className="canvas-wrap" style={{ width: doc.base.width * scale, height: doc.base.height * scale }}>
              <canvas
                ref={canvasRef}
                style={{ cursor }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onDoubleClick={onDoubleClick}
              />
              {textEdit && (
                <textarea
                  ref={textareaRef}
                  className="text-editor"
                  value={textEdit.value}
                  placeholder="Type…"
                  rows={Math.max(1, textEdit.value.split('\n').length)}
                  cols={Math.max(6, ...textEdit.value.split('\n').map((l) => l.length + 1))}
                  style={{
                    left: textEdit.x * scale,
                    top: textEdit.y * scale,
                    font: textFont(textEdit.size * scale),
                    lineHeight: 1.25,
                    color: textEdit.color,
                  }}
                  onChange={(e) => setTextEdit((t) => ({ ...t, value: e.target.value }))}
                  onBlur={commitText}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      e.currentTarget.blur()
                    } else if (e.key === 'Escape') {
                      e.stopPropagation()
                      setTextEdit(null)
                    }
                  }}
                />
              )}
            </div>
          )}
          {crop && (
            <div className="crop-bar">
              <span>
                {Math.round(norm(crop).w)} × {Math.round(norm(crop).h)}
              </span>
              <button className="btn btn-primary" onClick={applyCrop}>
                <Icon name="check" size={16} /> Apply crop
              </button>
              <button className="btn" onClick={() => setCrop(null)}>
                Cancel
              </button>
            </div>
          )}
          {busy && <div className="stage-loading overlay">Working…</div>}
          {flash && <div className="flash">{flash}</div>}
        </div>

        <aside className="editor-panel">
          <section>
            <h4>{selected ? `Selected ${selected.type}` : 'Style'}</h4>
            <div className="swatches">
              {COLORS.map((c) => (
                <button
                  key={c}
                  className={`swatch${color === c ? ' active' : ''}`}
                  style={{ background: c }}
                  title={c}
                  onClick={() => changeColor(c)}
                />
              ))}
              <label className="swatch custom" title="Custom color">
                <input type="color" value={color} onChange={(e) => changeColor(e.target.value)} />
              </label>
            </div>

            {showStroke && (
              <label className="field">
                <span>
                  Stroke <em>{strokeWidth}px</em>
                </span>
                <input type="range" min="1" max="30" value={strokeWidth} onChange={(e) => changeWidth(+e.target.value)} />
              </label>
            )}
            {showFont && (
              <label className="field">
                <span>
                  Size <em>{fontSize}px</em>
                </span>
                <input type="range" min="10" max="120" value={fontSize} onChange={(e) => changeFontSize(+e.target.value)} />
              </label>
            )}
            {showFill && (
              <label className="check">
                <input type="checkbox" checked={fill} onChange={(e) => changeFill(e.target.checked)} />
                {(selected?.type ?? tool) === 'text' ? 'Text background' : 'Filled shape'}
              </label>
            )}
            {showBlur && (
              <>
                <div className="segmented">
                  {['blur', 'pixelate'].map((m) => (
                    <button key={m} className={blurMode === m ? 'active' : ''} onClick={() => changeBlurMode(m)}>
                      {m}
                    </button>
                  ))}
                </div>
                <label className="field">
                  <span>
                    Strength <em>{blurAmount}</em>
                  </span>
                  <input type="range" min="2" max="40" value={blurAmount} onChange={(e) => changeBlur(+e.target.value)} />
                </label>
              </>
            )}
            {selected && (
              <button className="btn btn-danger full" onClick={deleteSelected}>
                <Icon name="trash" size={16} /> Delete shape
              </button>
            )}
            {tool === 'select' && !selected && <p className="hint">Click a shape to select it. Drag empty space to pan. Double-click text to edit.</p>}
            {tool === 'crop' && !crop && <p className="hint">Drag over the image to choose the crop area.</p>}
            {tool === 'text' && <p className="hint">Click on the image to add text. Enter to finish, Shift+Enter for a new line.</p>}
            {(tool === 'rect' || tool === 'ellipse' || tool === 'line' || tool === 'arrow') && (
              <p className="hint">Hold Shift for squares, circles and 45° lines.</p>
            )}
          </section>

          <section>
            <h4>Enhance</h4>
            <div className="grid-2">
              <button className="btn" onClick={autoEnhance} disabled={!doc}>
                <Icon name="sparkle" size={16} /> Auto
              </button>
              <button className="btn" onClick={doSharpen} disabled={!doc}>
                <Icon name="sparkle" size={16} /> Sharpen
              </button>
            </div>
            {doc &&
              ADJUSTMENTS.map((a) => (
                <label className="field" key={a.key}>
                  <span>
                    {a.label} <em>{doc.adjust[a.key]}%</em>
                  </span>
                  <input
                    type="range"
                    min={a.min}
                    max={a.max}
                    value={doc.adjust[a.key]}
                    onChange={(e) => setAdjust(a.key, +e.target.value)}
                    onDoubleClick={() => setAdjust(a.key, DEFAULT_ADJUST[a.key])}
                  />
                </label>
              ))}
            <button className="btn full" onClick={() => commit((d) => ({ ...d, adjust: DEFAULT_ADJUST }))} disabled={!doc}>
              Reset adjustments
            </button>
          </section>

          <section>
            <h4>Transform</h4>
            <div className="grid-4">
              <button className="icon-btn" title="Rotate left" onClick={() => rotate(-1)} disabled={!doc}>
                <Icon name="rotateCcw" />
              </button>
              <button className="icon-btn" title="Rotate right" onClick={() => rotate(1)} disabled={!doc}>
                <Icon name="rotateCw" />
              </button>
              <button className="icon-btn" title="Flip horizontal" onClick={() => flip(true)} disabled={!doc}>
                <Icon name="flipH" />
              </button>
              <button className="icon-btn" title="Flip vertical" onClick={() => flip(false)} disabled={!doc}>
                <Icon name="flipV" />
              </button>
            </div>
          </section>

          <section>
            <h4>Reset</h4>
            <button className="btn full" onClick={clearAnnotations} disabled={!doc?.shapes.length}>
              <Icon name="eraser" size={16} /> Clear annotations
            </button>
            <button className="btn full" onClick={revertToOriginal} disabled={!doc}>
              <Icon name="rotateCcw" size={16} /> Revert to original
            </button>
          </section>
        </aside>
      </div>
    </div>
  )
}
