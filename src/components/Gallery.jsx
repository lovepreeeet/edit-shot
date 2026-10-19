import { useState } from 'react'
import Icon from './Icon.jsx'
import { dataURLSize, downloadAllAsZip, downloadURL, fileNameOf, formatBytes } from '../lib/files.js'

export default function Gallery({ items, onOpen, onRemove, onClear }) {
  const [zipping, setZipping] = useState(false)

  const downloadAll = async () => {
    setZipping(true)
    try {
      await downloadAllAsZip(items)
    } finally {
      setZipping(false)
    }
  }

  return (
    <section className="gallery">
      <div className="gallery-head">
        <h2>
          Gallery <span className="count">{items.length}</span>
        </h2>
        <div className="gallery-actions">
          <button className="btn" onClick={downloadAll} disabled={!items.length || zipping}>
            <Icon name="download" size={16} /> {zipping ? 'Zipping…' : 'Download all (.zip)'}
          </button>
          <button
            className="btn btn-ghost-danger"
            disabled={!items.length}
            onClick={() => window.confirm(`Delete all ${items.length} images?`) && onClear()}
          >
            <Icon name="trash" size={16} /> Clear
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="gallery-empty">
          No images yet. Press <kbd>Ctrl</kbd> + <kbd>V</kbd> anywhere to paste a screenshot, or drop image files on the page.
        </div>
      ) : (
        <ul className="gallery-strip">
          {items.map((item) => (
            <li key={item.id} className="thumb">
              <button className="thumb-img" onClick={() => onOpen(item.id)} title="Open in editor">
                <img src={item.src} alt={item.name} loading="lazy" draggable="false" />
                {item.src !== item.original && <span className="badge">edited</span>}
              </button>
              <div className="thumb-meta">
                <span className="thumb-name" title={item.name}>
                  {item.name}
                </span>
                <span className="thumb-sub">
                  {item.width}×{item.height} · {formatBytes(dataURLSize(item.src))}
                </span>
              </div>
              <div className="thumb-actions">
                <button className="icon-btn sm" title="Download" onClick={() => downloadURL(item.src, fileNameOf(item))}>
                  <Icon name="download" size={16} />
                </button>
                <button className="icon-btn sm danger" title="Delete" onClick={() => onRemove(item.id)}>
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
