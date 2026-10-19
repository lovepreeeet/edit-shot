import { useCallback, useEffect, useState } from 'react'
import { clearImages, deleteImage, getAllImages, putImage } from './db.js'
import { loadImage, readFileAsDataURL, timestampName, uid } from './files.js'

const persist = (fn) => fn().catch((err) => console.warn('Gallery storage failed:', err))

export default function useGallery() {
  const [items, setItems] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getAllImages()
      .then((all) => setItems(all.sort((a, b) => b.createdAt - a.createdAt)))
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  const addFiles = useCallback(async (files) => {
    const images = [...files].filter((f) => f.type.startsWith('image/'))
    const added = []
    for (const [i, file] of images.entries()) {
      const src = await readFileAsDataURL(file)
      const img = await loadImage(src)
      const now = new Date()
      const pasted = !file.name || file.name === 'image.png'
      added.push({
        id: uid(),
        name: pasted ? `${timestampName(now)}${images.length > 1 ? `-${i + 1}` : ''}` : file.name.replace(/\.[^.]+$/, ''),
        src,
        original: src,
        width: img.naturalWidth,
        height: img.naturalHeight,
        createdAt: now.getTime() + i,
      })
    }
    if (!added.length) return []
    setItems((prev) => [...added.reverse(), ...prev])
    added.forEach((item) => persist(() => putImage(item)))
    return added
  }, [])

  const update = useCallback((id, patch) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const next = { ...item, ...patch, updatedAt: Date.now() }
        persist(() => putImage(next))
        return next
      }),
    )
  }, [])

  const remove = useCallback((id) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
    persist(() => deleteImage(id))
  }, [])

  const clear = useCallback(() => {
    setItems([])
    persist(clearImages)
  }, [])

  return { items, loaded, addFiles, update, remove, clear }
}
