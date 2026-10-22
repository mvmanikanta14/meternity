import { useCallback, useEffect, useRef, useState } from 'react'
import { REPORT_TYPES, api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from '../components/Icon.jsx'
import { Empty, ErrorBox, Loader, PageHeader, Sheet } from '../components/ui.jsx'
import { deleteFile, getFile, newFileId, putFile, shrinkImage } from '../fileStore.js'
import { METRICS, REPORT_TYPE_LABEL, analyse, metricsFor } from '../reportRanges.js'
import { fmtDate, fmtShort, fmtSize, todayISO, weekOn } from '../utils.js'

const LEVEL_CHIP = { ok: 'chip-ok', low: 'chip-warn', high: 'chip-warn', info: '' }
const LEVEL_LABEL = { ok: 'Normal', low: 'Low', high: 'High', info: '' }
const TREND_KEYS = ['hb', 'fbs', 'ogtt', 'tsh', 'efw']

const emptyForm = () => ({ type: 'blood', title: '', date: todayISO(), notes: '', values: {}, files: [], pending: [] })

function useFileUrl(fileId) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let alive = true
    let made = null
    getFile(fileId)
      .then((blob) => {
        if (alive && blob) setUrl((made = URL.createObjectURL(blob)))
      })
      .catch(() => {})
    return () => {
      alive = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [fileId])
  return url
}

function FileThumb({ file, large = false }) {
  const url = useFileUrl(file.file_id)
  const isImage = file.type.startsWith('image/')
  const open = () => url && window.open(url, '_blank')
  return (
    <button type="button" className={`thumb ${large ? 'thumb-lg' : ''}`} onClick={open} title={file.name}>
      {isImage && url ? <img src={url} alt={file.name} /> : <span className="thumb-doc"><Icon name="file" size={large ? 34 : 22} /></span>}
      {large && <span className="thumb-name">{file.name} · {fmtSize(file.size)}</span>}
    </button>
  )
}

function TrendChart({ points, metric }) {
  const W = 300
  const H = 90
  const pad = 12
  const vs = points.map((p) => p.value)
  const min = Math.min(...vs)
  const max = Math.max(...vs)
  const spread = max - min || Math.max(1, max * 0.1)
  const x = (i) => pad + (i * (W - pad * 2)) / (points.length - 1)
  const y = (v) => H - pad - ((v - min + spread * 0.15) / (spread * 1.3)) * (H - pad * 2)
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ')
  return (
    <div className="trend">
      <div className="trend-head">
        <strong>{metric.label}</strong>
        <span className="muted small">{vs[0]} → {vs[vs.length - 1]} {metric.unit}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`${metric.label} trend`}>
        <path d={line} fill="none" stroke="#8b6cf0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.value)} r="4" fill="#fff" stroke={p.level === 'ok' || p.level === 'info' ? '#8b6cf0' : '#e54848'} strokeWidth="2.5" />
        ))}
      </svg>
      <div className="chart-foot">
        <span>{fmtShort(points[0].date)}</span>
        <span>{fmtShort(points[points.length - 1].date)}</span>
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const { user } = useAuth()
  const [reports, setReports] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const fileInput = useRef(null)

  const load = useCallback(() => api.reports().then(setReports).catch((e) => setError(e.message)), [])
  useEffect(() => {
    load()
  }, [load])

  const closeEdit = useCallback(() => setEditing(null), [])
  const closeView = useCallback(() => setViewing(null), [])

  const week = (date) => weekOn(user.lmp_date, date)
  const resultsOf = (r) =>
    Object.entries(r.values || {})
      .map(([k, v]) => analyse(k, v, week(r.date)))
      .filter(Boolean)

  const openAdd = () => {
    setForm(emptyForm())
    setError('')
    setEditing('new')
  }

  const openEdit = (r) => {
    setForm({ type: r.type, title: r.title || '', date: r.date, notes: r.notes || '', values: { ...r.values }, files: [...r.files], pending: [] })
    setError('')
    setViewing(null)
    setEditing(r)
  }

  const pickFiles = (e) => {
    const picked = Array.from(e.target.files || [])
    e.target.value = ''
    setForm((f) => ({ ...f, pending: [...f.pending, ...picked] }))
  }

  const setValue = (key, v) => setForm((f) => ({ ...f, values: { ...f.values, [key]: v } }))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const saved = []
    try {
      for (const file of form.pending) {
        const blob = await shrinkImage(file)
        const id = newFileId()
        await putFile(id, blob)
        saved.push({ file_id: id, name: file.name, type: blob.type || file.type, size: blob.size })
      }
      const fields = metricsFor(form.type).map((m) => m.key)
      const values = Object.fromEntries(Object.entries(form.values).filter(([k, v]) => fields.includes(k) && v !== ''))
      const body = {
        type: form.type,
        title: form.title.trim() || REPORT_TYPE_LABEL[form.type].label,
        date: form.date,
        notes: form.notes || null,
        values,
        files: [...form.files, ...saved],
      }
      if (editing === 'new') await api.addReport(body)
      else {
        await api.updateReport(editing.id, body)
        const kept = new Set(form.files.map((f) => f.file_id))
        await Promise.all(editing.files.filter((f) => !kept.has(f.file_id)).map((f) => deleteFile(f.file_id).catch(() => {})))
      }
      setEditing(null)
      load()
    } catch (err) {
      await Promise.all(saved.map((f) => deleteFile(f.file_id).catch(() => {})))
      setError(err.message || 'Could not save the report')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (r) => {
    if (!confirm('Delete this report and its files?')) return
    await api.deleteReport(r.id)
    await Promise.all(r.files.map((f) => deleteFile(f.file_id).catch(() => {})))
    setViewing(null)
    load()
  }

  if (!reports) return error && !editing ? <div className="page"><ErrorBox message={error} /></div> : <Loader />

  // Latest value of each test, plus its history for trend charts (reports are newest first).
  const latest = []
  const trends = []
  for (const m of METRICS) {
    const history = reports
      .filter((r) => r.values?.[m.key] !== undefined)
      .map((r) => ({ date: r.date, ...analyse(m.key, r.values[m.key], week(r.date)) }))
    if (!history.length) continue
    latest.push(history[0])
    const numeric = history.filter((h) => typeof h.value === 'number').reverse()
    if (TREND_KEYS.includes(m.key) && numeric.length >= 2) trends.push({ metric: m, points: numeric })
  }
  const concerns = latest.filter((r) => r.level === 'low' || r.level === 'high')

  return (
    <div className="page">
      <PageHeader
        title="Scan & lab reports"
        subtitle="Upload reports and check your results"
        back
        action={
          <button className="icon-btn icon-btn-primary" onClick={openAdd} aria-label="Add report">
            <Icon name="plus" />
          </button>
        }
      />

      {latest.length > 0 && (
        <div className="card">
          <h3 className="card-title">🔍 Your results at a glance</h3>
          {concerns.length === 0 ? (
            <p className="ok-text small">✅ All your latest entered values are in the usual range.</p>
          ) : (
            <div className="concerns">
              {concerns.map((c) => (
                <div className="concern" key={c.metric.key}>
                  <strong>{c.metric.label}: {c.value} {c.metric.unit}</strong>
                  <p className="small">{c.text}</p>
                </div>
              ))}
            </div>
          )}
          <div className="result-list">
            {latest.map((r) => (
              <div className="result-row" key={r.metric.key}>
                <div className="grow">
                  <strong>{r.metric.label}</strong>
                  <p className="muted small">Normal: {r.range} · {fmtShort(r.date)}</p>
                </div>
                <div className="result-val">
                  <strong>{r.value}{r.metric.unit ? ` ${r.metric.unit}` : ''}</strong>
                  {LEVEL_LABEL[r.level] && <span className={`chip ${LEVEL_CHIP[r.level]}`}>{LEVEL_LABEL[r.level]}</span>}
                </div>
              </div>
            ))}
          </div>
          <p className="fine-print" style={{ marginTop: 10 }}>
            Ranges are general pregnancy guidance. Your doctor reads your reports in full — always follow their advice.
          </p>
        </div>
      )}

      {trends.length > 0 && (
        <div className="card">
          <h3 className="card-title">📈 Trends</h3>
          <div className="trend-list">
            {trends.map((t) => <TrendChart key={t.metric.key} {...t} />)}
          </div>
        </div>
      )}

      <h3 className="section-title">All reports</h3>
      {reports.length === 0 ? (
        <Empty emoji="🩻" title="No reports yet" text="Take a photo of your scan or lab report, or upload a PDF. Enter the key values to see if they're in range.">
          <button className="btn btn-primary" onClick={openAdd}>Add first report</button>
        </Empty>
      ) : (
        <div className="list">
          {reports.map((r) => {
            const results = resultsOf(r)
            const t = REPORT_TYPE_LABEL[r.type]
            return (
              <div
                className="card report-card"
                key={r.id}
                role="button"
                tabIndex={0}
                onClick={() => setViewing(r)}
                onKeyDown={(e) => e.key === 'Enter' && setViewing(r)}
              >
                <div className="report-head">
                  <span className="report-emoji">{t.emoji}</span>
                  <div className="grow">
                    <h4>{r.title || t.label}</h4>
                    <p className="muted small">{fmtDate(r.date)} · Week {week(r.date)}</p>
                  </div>
                  <Icon name="chevron" size={18} className="chev" />
                </div>
                {results.length > 0 && (
                  <div className="log-values">
                    {results.map((x) => (
                      <span key={x.metric.key} className={`chip ${LEVEL_CHIP[x.level]}`}>
                        {x.metric.label.split(' (')[0]}: {x.value}
                      </span>
                    ))}
                  </div>
                )}
                {r.files.length > 0 && (
                  <div className="thumbs" onClick={(e) => e.stopPropagation()}>
                    {r.files.map((f) => <FileThumb key={f.file_id} file={f} />)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Sheet open={!!viewing} title={viewing ? viewing.title || REPORT_TYPE_LABEL[viewing.type].label : ''} onClose={closeView}>
        {viewing && (
          <div className="form">
            <p className="muted">{fmtDate(viewing.date)} · Week {week(viewing.date)} · {REPORT_TYPE_LABEL[viewing.type].label}</p>
            {viewing.files.length > 0 && (
              <div className="thumbs thumbs-lg">
                {viewing.files.map((f) => <FileThumb key={f.file_id} file={f} large />)}
              </div>
            )}
            {resultsOf(viewing).map((x) => (
              <div className={`result-card lvl-${x.level}`} key={x.metric.key}>
                <div className="result-row">
                  <strong className="grow">{x.metric.label}</strong>
                  <strong>{x.value}{x.metric.unit ? ` ${x.metric.unit}` : ''}</strong>
                </div>
                <p className="small">{x.level === 'info' ? `Recorded at week ${week(viewing.date)}.` : x.text} <span className="muted">(normal: {x.range})</span></p>
              </div>
            ))}
            {viewing.notes && <p className="muted">{viewing.notes}</p>}
            <div className="row-2">
              <button className="btn btn-ghost" onClick={() => openEdit(viewing)}><Icon name="edit" size={18} /> Edit</button>
              <button className="btn btn-danger-ghost" onClick={() => remove(viewing)}><Icon name="trash" size={18} /> Delete</button>
            </div>
          </div>
        )}
      </Sheet>

      <Sheet open={!!editing} title={editing === 'new' ? 'Add report' : 'Edit report'} onClose={closeEdit}>
        <form className="form" onSubmit={submit}>
          <div className="chips-select">
            {REPORT_TYPES.map((t) => (
              <button type="button" key={t} className={`chip-toggle ${form.type === t ? 'active' : ''}`} onClick={() => setForm({ ...form, type: t })}>
                {REPORT_TYPE_LABEL[t].emoji} {REPORT_TYPE_LABEL[t].label}
              </button>
            ))}
          </div>
          <div className="row-2">
            <label className="field">
              <span>Title</span>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={REPORT_TYPE_LABEL[form.type].label} />
            </label>
            <label className="field">
              <span>Date</span>
              <input type="date" value={form.date} max={todayISO()} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </label>
          </div>

          <p className="field-label">Report photo / PDF</p>
          <div className="thumbs">
            {form.files.map((f) => (
              <div className="thumb-wrap" key={f.file_id}>
                <FileThumb file={f} />
                <button type="button" className="thumb-x" onClick={() => setForm({ ...form, files: form.files.filter((x) => x !== f) })} aria-label="Remove file">×</button>
              </div>
            ))}
            {form.pending.map((f, i) => (
              <div className="thumb-wrap" key={`p${i}`}>
                <span className="thumb thumb-new"><Icon name="file" size={20} /><small>{f.name.slice(0, 10)}</small></span>
                <button type="button" className="thumb-x" onClick={() => setForm({ ...form, pending: form.pending.filter((x) => x !== f) })} aria-label="Remove file">×</button>
              </div>
            ))}
            <button type="button" className="thumb thumb-add" onClick={() => fileInput.current?.click()}>
              <Icon name="upload" size={22} />
              <small>Add</small>
            </button>
          </div>
          <input ref={fileInput} type="file" accept="image/*,application/pdf" multiple hidden onChange={pickFiles} />

          <p className="field-label">Values from the report (optional)</p>
          <div className="metric-inputs">
            {metricsFor(form.type).map((m) => {
              const v = form.values[m.key] ?? ''
              const result = v !== '' ? analyse(m.key, m.options ? v : Number(v), week(form.date)) : null
              return (
                <label className="field" key={m.key}>
                  <span>{m.label}{m.unit ? ` (${m.unit})` : ''}</span>
                  {m.options ? (
                    <select value={v} onChange={(e) => setValue(m.key, e.target.value)}>
                      <option value="">—</option>
                      {m.options.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type="number" inputMode="decimal" step={m.step || '1'} value={v} onChange={(e) => setValue(m.key, e.target.value)} />
                  )}
                  {result && result.level !== 'info' && (
                    <small className={result.level === 'ok' ? 'ok-text' : 'warn-text'}>
                      {LEVEL_LABEL[result.level]} · normal {result.range}
                    </small>
                  )}
                </label>
              )
            })}
          </div>

          <label className="field">
            <span>Notes</span>
            <textarea rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="What the doctor said…" />
          </label>
          <ErrorBox message={error} />
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Saving…' : 'Save report'}</button>
        </form>
      </Sheet>
    </div>
  )
}
