import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'
import Icon from '../components/Icon.jsx'
import { Empty, ErrorBox, Loader, PageHeader, Sheet } from '../components/ui.jsx'

const SUGGESTIONS = {
  girl: [
    ['Aadya', 'the first, beginning'], ['Ananya', 'unique, one of a kind'], ['Diya', 'lamp, light'],
    ['Ira', 'earth'], ['Kavya', 'poetry'], ['Saanvi', 'Goddess Lakshmi'], ['Siri', 'wealth, prosperity'],
    ['Tara', 'star'], ['Myra', 'beloved'], ['Navya', 'new, young'],
  ],
  boy: [
    ['Aarav', 'peaceful'], ['Advik', 'unique'], ['Arjun', 'bright, shining'], ['Ishaan', 'the sun'],
    ['Reyansh', 'ray of light'], ['Vihaan', 'dawn, morning'], ['Aditya', 'the sun'], ['Dhruv', 'pole star'],
    ['Rohan', 'rising, ascending'], ['Karthik', 'Lord Murugan'],
  ],
}

const GENDERS = [
  { key: 'girl', label: '👧 Girl' },
  { key: 'boy', label: '👦 Boy' },
  { key: 'any', label: '🌈 Either' },
]

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'girl', label: 'Girl' },
  { key: 'boy', label: 'Boy' },
  { key: 'fav', label: '♥ Favourites' },
]

const emptyName = () => ({ name: '', gender: 'any', meaning: '' })

export default function NamesPage() {
  const [names, setNames] = useState(null)
  const [filter, setFilter] = useState('all')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(emptyName)
  const [error, setError] = useState('')

  const load = useCallback(() => api.names().then(setNames).catch((e) => setError(e.message)), [])
  useEffect(() => {
    load()
  }, [load])

  const close = useCallback(() => setAdding(false), [])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await api.addName(form)
      setAdding(false)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const quickAdd = async (gender, [name, meaning]) => {
    await api.addName({ name, meaning, gender })
    load()
  }

  const toggleFav = async (n) => {
    await api.updateName(n.id, { fav: !n.fav })
    load()
  }

  const remove = async (n) => {
    await api.deleteName(n.id)
    load()
  }

  if (!names) return error ? <div className="page"><ErrorBox message={error} /></div> : <Loader />

  const shown = names.filter((n) =>
    filter === 'all' ? true : filter === 'fav' ? n.fav : n.gender === filter || n.gender === 'any',
  )
  const taken = new Set(names.map((n) => n.name.toLowerCase()))
  const suggestionGenders = filter === 'girl' || filter === 'boy' ? [filter] : ['girl', 'boy']

  return (
    <div className="page">
      <PageHeader
        title="Baby names"
        subtitle={`${names.length} name${names.length === 1 ? '' : 's'} on your list`}
        back
        action={
          <button className="icon-btn icon-btn-primary" onClick={() => { setForm(emptyName()); setError(''); setAdding(true) }} aria-label="Add name">
            <Icon name="plus" />
          </button>
        }
      />

      <div className="segmented">
        {FILTERS.map((f) => (
          <button key={f.key} className={filter === f.key ? 'active' : ''} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Empty emoji="📝" title={filter === 'fav' ? 'No favourites yet' : 'No names yet'} text="Add names you love, or pick from the ideas below." />
      ) : (
        <div className="name-grid">
          {shown.map((n) => (
            <div className={`card name-card g-${n.gender}`} key={n.id}>
              <button className={`fav-btn ${n.fav ? 'on' : ''}`} onClick={() => toggleFav(n)} aria-label="Favourite">
                {n.fav ? '♥' : '♡'}
              </button>
              <h3>{n.name}</h3>
              {n.meaning && <p className="small">{n.meaning}</p>}
              <button className="name-del" onClick={() => remove(n)} aria-label="Delete">
                <Icon name="trash" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {filter !== 'fav' &&
        suggestionGenders.map((g) => {
          const ideas = SUGGESTIONS[g].filter(([name]) => !taken.has(name.toLowerCase()))
          if (!ideas.length) return null
          return (
            <div key={g}>
              <p className="field-label" style={{ marginBottom: 8 }}>{g === 'girl' ? '👧 Girl name ideas' : '👦 Boy name ideas'}</p>
              <div className="chips-select">
                {ideas.map((idea) => (
                  <button key={idea[0]} className="chip-toggle" onClick={() => quickAdd(g, idea)} title={idea[1]}>
                    + {idea[0]}
                  </button>
                ))}
              </div>
            </div>
          )
        })}

      <Sheet open={adding} title="Add a name" onClose={close}>
        <form className="form" onSubmit={submit}>
          <label className="field">
            <span>Name</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
          </label>
          <div className="segmented">
            {GENDERS.map((g) => (
              <button type="button" key={g.key} className={form.gender === g.key ? 'active' : ''} onClick={() => setForm({ ...form, gender: g.key })}>
                {g.label}
              </button>
            ))}
          </div>
          <label className="field">
            <span>Meaning (optional)</span>
            <input value={form.meaning} onChange={(e) => setForm({ ...form, meaning: e.target.value })} />
          </label>
          <ErrorBox message={error} />
          <button className="btn btn-primary btn-block">Add name</button>
        </form>
      </Sheet>
    </div>
  )
}
