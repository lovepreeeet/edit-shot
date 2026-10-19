import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useOutletContext } from 'react-router-dom'
import Gallery from '../components/Gallery.jsx'
import ImageEditor from '../components/ImageEditor.jsx'
import Icon from '../components/Icon.jsx'
import useGallery from '../lib/useGallery.js'

const hasFiles = (e) => [...(e.dataTransfer?.types ?? [])].includes('Files')

export default function Home() {
  const { items, addFiles, update, remove, clear } = useGallery()
  const [openId, setOpenId] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [toast, setToast] = useState('')
  const { headerSlot } = useOutletContext()
  const toastTimer = useRef(null)
  const fileInput = useRef(null)

  const showToast = (msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2200)
  }

  const add = async (files) => {
    const added = await addFiles(files)
    if (added.length) showToast(added.length === 1 ? 'Screenshot added to gallery' : `${added.length} images added`)
    else showToast('No image found')
  }

  // Global Ctrl+V / Cmd+V paste and drag-and-drop anywhere on the page.
  useEffect(() => {
    const onPaste = (e) => {
      if (e.target.closest?.('textarea, input')) return
      const files = [...(e.clipboardData?.items ?? [])]
        .filter((i) => i.kind === 'file' && i.type.startsWith('image/'))
        .map((i) => i.getAsFile())
        .filter(Boolean)
      if (!files.length) return
      e.preventDefault()
      add(files)
    }
    const onDragOver = (e) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDragging(true)
    }
    const onDragLeave = (e) => {
      if (!e.relatedTarget) setDragging(false)
    }
    const onDrop = (e) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDragging(false)
      add(e.dataTransfer.files)
    }
    window.addEventListener('paste', onPaste)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('paste', onPaste)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  })

  const openIndex = items.findIndex((i) => i.id === openId)
  const openItem = openIndex >= 0 ? items[openIndex] : null

  const navigate = (dir) => {
    const next = (openIndex + dir + items.length) % items.length
    setOpenId(items[next].id)
  }

  return (
    <div className="home">
      {headerSlot &&
        createPortal(
          <div className="paste-hint">
            <span className="paste-text">
              <kbd>Ctrl</kbd> + <kbd>V</kbd> <span className="hide-sm">to paste a screenshot</span>
            </span>
            <button className="btn" onClick={() => fileInput.current.click()} title="Upload images">
              <Icon name="upload" size={16} /> <span className="hide-sm">Upload</span>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                add(e.target.files)
                e.target.value = ''
              }}
            />
          </div>,
          headerSlot,
        )}

      <Gallery items={items} onOpen={setOpenId} onRemove={remove} onClear={clear} />

      {dragging && (
        <div className="drop-overlay">
          <Icon name="upload" size={28} /> Drop images to add them
        </div>
      )}

      {openItem && (
        <ImageEditor
          key={openItem.id}
          item={openItem}
          position={openIndex + 1}
          total={items.length}
          onClose={() => setOpenId(null)}
          onNavigate={navigate}
          onSave={(id, patch) => update(id, patch)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
