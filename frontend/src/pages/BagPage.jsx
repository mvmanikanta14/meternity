import { useCallback, useEffect, useState } from 'react'
import { BAG_CATEGORIES, api } from '../api.js'
import Icon from '../components/Icon.jsx'
import { ErrorBox, Loader, PageHeader, Sheet } from '../components/ui.jsx'

const CATEGORY_EMOJI = { Documents: '📁', 'For mom': '🤱', 'For baby': '👶', 'For partner': '🧑' }

export default function BagPage() {
  const [items, setItems] = useState(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ text: '', category: 'For mom' })
  const [error, setError] = useState('')

  const load = useCallback(() => api.bag().then(setItems).catch((e) => setError(e.message)), [])
  useEffect(() => {
    load()
  }, [load])

  const close = useCallback(() => setAdding(false), [])

  const toggle = async (item) => {
    setItems(items.map((i) => (i.id === item.id ? { ...i, packed: !i.packed } : i)))
    await api.updateBagItem(item.id, { packed: !item.packed })
    navigator.vibrate?.(15)
  }

  const remove = async (item) => {
    await api.deleteBagItem(item.id)
    load()
  }

  const openAdd = (category = 'For mom') => {
    setForm({ text: '', category })
    setError('')
    setAdding(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    try {
      await api.addBagItem(form)
      setForm({ ...form, text: '' })
      setAdding(false)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!items) return error ? <div className="page"><ErrorBox message={error} /></div> : <Loader />

  const packed = items.filter((i) => i.packed).length
  const pct = items.length ? packed / items.length : 0

  return (
    <div className="page">
      <PageHeader
        title="Hospital bag"
        subtitle="Pack by week 35–36"
        back
        action={
          <button className="icon-btn icon-btn-primary" onClick={() => openAdd()} aria-label="Add item">
            <Icon name="plus" />
          </button>
        }
      />

      <div className="card">
        <div className="progress-head">
          <strong>{packed} of {items.length} packed</strong>
          <span className="chip chip-soft">{Math.round(pct * 100)}%</span>
        </div>
        <div className="bar"><div style={{ width: `${pct * 100}%` }} /></div>
        {items.length > 0 && packed === items.length && <p className="small ok-text">🎉 Your bag is ready!</p>}
      </div>

      {BAG_CATEGORIES.map((cat) => {
        const group = items.filter((i) => i.category === cat)
        return (
          <div className="card checklist" key={cat}>
            <div className="checklist-head">
              <h3 className="card-title">{CATEGORY_EMOJI[cat]} {cat}</h3>
              <span className="muted small">{group.filter((i) => i.packed).length}/{group.length}</span>
            </div>
            {group.map((item) => (
              <div className={`check-row ${item.packed ? 'done' : ''}`} key={item.id}>
                <button className={`check check-sm ${item.packed ? 'checked' : ''}`} onClick={() => toggle(item)} aria-label="Toggle packed">
                  <Icon name="check" size={14} stroke={3} />
                </button>
                <button className="check-text" onClick={() => toggle(item)}>{item.text}</button>
                <button className="icon-btn icon-btn-sm" onClick={() => remove(item)} aria-label="Delete">
                  <Icon name="trash" size={16} />
                </button>
              </div>
            ))}
            <button className="add-row" onClick={() => openAdd(cat)}>
              <Icon name="plus" size={16} /> Add item
            </button>
          </div>
        )
      })}

      <Sheet open={adding} title="Add to bag" onClose={close}>
        <form className="form" onSubmit={submit}>
          <p className="field-label">Section</p>
          <div className="chips-select">
            {BAG_CATEGORIES.map((c) => (
              <button type="button" key={c} className={`chip-toggle ${form.category === c ? 'active' : ''}`} onClick={() => setForm({ ...form, category: c })}>
                {CATEGORY_EMOJI[c]} {c}
              </button>
            ))}
          </div>
          <label className="field">
            <span>Item</span>
            <input value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder="Feeding pillow" required autoFocus />
          </label>
          <ErrorBox message={error} />
          <button className="btn btn-primary btn-block">Add</button>
        </form>
      </Sheet>
    </div>
  )
}
