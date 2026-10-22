// Reads a report photo or PDF in the browser and picks out the test values we track.
// OCR (tesseract.js) and PDF (pdf.js) are loaded only when a report is scanned.
import { metricByKey } from './reportRanges.js'

const MIN_PDF_TEXT = 40 // fewer characters than this means a scanned PDF: OCR it instead
const MAX_PDF_PAGES = 5

let workerPromise = null
let progressCb = null

async function ocrWorker(onProgress) {
  progressCb = onProgress
  workerPromise ??= import('tesseract.js').then(({ createWorker }) =>
    createWorker('eng', 1, {
      logger: (m) => m.status === 'recognizing text' && progressCb?.(m.progress),
    }),
  )
  try {
    return await workerPromise
  } catch (err) {
    workerPromise = null
    throw err
  }
}

async function ocr(image, onProgress) {
  const worker = await ocrWorker(onProgress)
  const { data } = await worker.recognize(image)
  return data.text
}

async function pdfText(file, onProgress) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const { default: workerSrc } = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const pages = Math.min(pdf.numPages, MAX_PDF_PAGES)

  // Digital PDFs carry their text; keep line breaks by grouping items on the same baseline.
  let text = ''
  for (let i = 1; i <= pages; i++) {
    const content = await (await pdf.getPage(i)).getTextContent()
    let lastY = null
    for (const item of content.items) {
      const y = Math.round(item.transform?.[5] ?? 0)
      text += lastY !== null && Math.abs(y - lastY) > 2 ? `\n${item.str}` : ` ${item.str}`
      lastY = y
    }
    text += '\n'
  }
  if (text.replace(/\s/g, '').length >= MIN_PDF_TEXT) return text

  // Scanned PDF: draw each page and OCR it.
  let scanned = ''
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    scanned += `${await ocr(canvas, (p) => onProgress?.((i - 1 + p) / pages))}\n`
  }
  return scanned
}

export async function extractText(file, onProgress) {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return pdfText(file, onProgress)
  if (file.type.startsWith('image/')) return ocr(file, onProgress)
  return ''
}

// ---------- parsing ----------

// A number, but not an ordinal like the "3" in "3rd generation".
const NUM = /(\d+(?:[.,]\d+)?)(?!(?:st|nd|rd|th)\b)/

const toNumber = (s) => Number(s.replace(',', '.'))

// Label patterns, sane value limits and unit fixes for each numeric test.
const NUMERIC = [
  { key: 'hb', label: /\b(ha?emoglobin|hgb|hb)\b(?!\s*a1c)/i, min: 3, max: 25 },
  {
    key: 'fbs',
    label: /(fasting\s*(blood|plasma)?\s*(sugar|glucose)|glucose\s*[-,(]?\s*fasting|\bfbs\b|\bfpg\b|\bfbg\b)/i,
    min: 30,
    max: 500,
  },
  {
    key: 'ogtt',
    // Tried in order, so "OGTT ... 2 hr: 130" picks the 2-hour value, not the fasting one.
    label: [
      /post\s*-?\s*prandial[^\d\n]*/i,
      /\b(ppbs|ppbg|pp\s*(blood\s*)?(sugar|glucose))\b[^\d\n]*/i,
      /\b2\s*(h|hr|hrs|hour|hours)\b\.?[^\d\n]*/i,
      /\bogtt\b[^\d\n]*/i,
    ],
    min: 30,
    max: 600,
  },
  { key: 'tsh', label: /(\btsh\b|thyroid\s*stimulating\s*hormone)/i, min: 0.001, max: 150 },
  {
    key: 'platelets',
    label: /(platelet\s*(count)?|\bplt\b)/i,
    // Labs write 2.5 (lakh/µL), 250 (10³/µL) or 250000 (/µL); store lakh/µL.
    fix: (v) => (v > 1000 ? v / 100000 : v > 20 ? v / 100 : v),
    min: 0.1,
    max: 15,
  },
  {
    key: 'fhr',
    label: /(\bfhr\b|fetal\s*heart\s*(rate)?|foetal\s*heart\s*(rate)?|cardiac\s*activity|heart\s*rate)/i,
    min: 60,
    max: 250,
  },
  { key: 'afi', label: /(\bafi\b|amniotic\s*fluid\s*(index)?|liquor)/i, min: 0, max: 60 },
  {
    key: 'efw',
    label: /(\befw\b|estimated\s*(fetal|foetal)\s*weight|fetal\s*weight|foetal\s*weight)/i,
    // "1.25 kg" → 1250 g
    fix: (v, rest) => (/^\s*[\d.,]+\s*kg/i.test(rest) || v < 10 ? v * 1000 : v),
    min: 50,
    max: 6000,
  },
]

const URINE_TOKEN = /\b(nil|absent|negative|neg|not\s*detected|trace|present|positive)\b|(\+{1,4})|\b([1-4])\s*\+/i

function urineLevel(s) {
  const m = s.match(URINE_TOKEN)
  if (!m) return null
  if (m[2]) return `${Math.min(3, m[2].length)}+`
  if (m[3]) return `${Math.min(3, Number(m[3]))}+`
  const w = m[1].toLowerCase()
  if (w === 'trace') return 'Trace'
  if (w === 'present' || w === 'positive') return '1+'
  return 'Nil'
}

const URINE = [
  { key: 'urine_protein', label: /\b(albumin|protein)\b/i },
  { key: 'urine_sugar', label: /\b(sugar|glucose)\b/i },
]

// First number after the label on its line, or at the start of the next line (table layouts).
function numberAfter(lines, i, match) {
  const rest = lines[i].slice(match.index + match[0].length)
  const sameLine = rest.match(NUM)
  if (sameLine) return { value: toNumber(sameLine[1]), rest: rest.slice(sameLine.index + sameLine[1].length) }
  const next = lines[i + 1]?.match(new RegExp(`^\\s*${NUM.source}`))
  return next ? { value: toNumber(next[1]), rest: lines[i + 1].slice(next[0].length) } : null
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const pad = (n) => String(n).padStart(2, '0')

function findDate(text) {
  const near = /(collect|sample|report|receiv|registr|date|scan|exam)/i
  const patterns = [
    [/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/, (m) => [m[3], m[2], m[1]]],
    [/\b(\d{1,2})[\s/.-]*([a-z]{3})[a-z]*[\s/.,-]*(\d{4})\b/i, (m) => [m[3], MONTHS.indexOf(m[2].toLowerCase()) + 1, m[1]]],
    [/\b(\d{4})-(\d{2})-(\d{2})\b/, (m) => [m[1], m[2], m[3]]],
  ]
  const lines = text.split('\n')
  const ordered = [...lines.filter((l) => near.test(l)), ...lines]
  for (const line of ordered) {
    for (const [re, parts] of patterns) {
      const m = line.match(re)
      if (!m) continue
      let [y, mo, d] = parts(m).map(Number)
      if (y < 100) y += 2000
      if (mo < 1 || mo > 12 || d < 1 || d > 31) continue
      const iso = `${y}-${pad(mo)}-${pad(d)}`
      if (!Number.isNaN(Date.parse(iso))) return iso
    }
  }
  return null
}

export function parseReport(text) {
  const clean = text.replace(/[|¦]/g, ' ').replace(/[ \t]+/g, ' ')
  const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean)
  const values = {}

  for (const spec of NUMERIC) {
    for (const label of [spec.label].flat()) {
      for (let i = 0; i < lines.length && values[spec.key] === undefined; i++) {
        const match = lines[i].match(label)
        if (!match) continue
        const found = numberAfter(lines, i, match)
        if (!found) continue
        let v = spec.fix ? spec.fix(found.value, found.rest) : found.value
        v = Math.round(v * 100) / 100
        if (v >= spec.min && v <= spec.max) values[spec.key] = v
      }
    }
  }

  // Urine strip results are words (Nil, Trace, ++); only look in urine reports so
  // a blood "glucose" line is not mistaken for urine sugar.
  if (/\burine\b|\burinalysis\b|\bcue\b|routine\s*urine/i.test(clean)) {
    for (const spec of URINE) {
      for (const line of lines) {
        const match = line.match(spec.label)
        if (!match) continue
        const level = urineLevel(line.slice(match.index + match[0].length))
        if (level) {
          values[spec.key] = level
          break
        }
      }
    }
  }

  const types = new Set(Object.keys(values).map((k) => metricByKey[k].type))
  let type = types.size === 1 ? [...types][0] : types.size > 1 ? 'other' : null
  if (!type && /ultrasound|sonograph|\busg\b|obstetric|fetal|foetal/i.test(clean)) type = 'ultrasound'

  return { values, type, date: findDate(clean) }
}
