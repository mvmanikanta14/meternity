// Report photos and PDFs are too big for localStorage, so they live in IndexedDB.
const DB_NAME = 'maternity_files'
const STORE = 'files'

let opening = null

function openDb() {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      opening = null
      reject(req.error)
    }
  })
  return opening
}

async function run(mode, fn) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    tx.oncomplete = () => resolve(req.result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || new Error('Could not save the file — storage may be full'))
  })
}

export const newFileId = () => `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

export const putFile = (id, blob) => run('readwrite', (s) => s.put(blob, id))
export const getFile = (id) => run('readonly', (s) => s.get(id))
export const deleteFile = (id) => run('readwrite', (s) => s.delete(id))

export const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })

export const dataUrlToBlob = (url) => fetch(url).then((r) => r.blob())

// Phone photos are often 3–8 MB; shrink images to ~1600px JPEG before storing.
export async function shrinkImage(file, maxSide = 1600) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85))
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}
