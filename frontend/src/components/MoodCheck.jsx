import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { detectMood } from '../moodDetect.js'
import { notifyPartner, partnerAlert, partnerMessage, whatsappUrl } from '../partner.js'
import { MOODS, todayISO } from '../utils.js'

const Recognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

const LANGS = [
  { key: 'te-IN', label: 'తెలుగు' },
  { key: 'en-IN', label: 'English' },
]

// She just talks (or types); her words are read for the mood, saved, and sent to her
// husband's phone automatically — no mood picking.
export default function MoodCheck({ week }) {
  const { user } = useAuth()
  const [lang, setLang] = useState('te-IN')
  const [listening, setListening] = useState(false)
  const [live, setLive] = useState('')
  const [typed, setTyped] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const rec = useRef(null)
  const heard = useRef('')

  useEffect(() => () => rec.current?.abort(), [])

  const partner = user.partner_name || 'Husband'
  const connected = !!user.partner_topic

  const share = async (words) => {
    const text = words.trim()
    if (!text) return
    setBusy(true)
    setError('')
    const mood = detectMood(text)?.mood || null
    try {
      await api.addLog({ log_date: todayISO(), mood, symptoms: [], notes: text.slice(0, 500) })
      const name = user.name.split(' ')[0]
      const sent = connected ? await notifyPartner(user.partner_topic, partnerAlert({ name, mood, text, week })) : false
      const wa = user.partner_phone ? whatsappUrl(user.partner_phone, partnerMessage({ name, mood: mood || 'calm', text, week })) : null
      setResult({ mood, text, sent, wa })
      setTyped('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const startListening = () => {
    setError('')
    setResult(null)
    if (!Recognition) {
      setError('Voice is not supported in this browser — please type below.')
      return
    }
    heard.current = ''
    const r = new Recognition()
    r.lang = lang
    r.interimResults = true
    r.continuous = false // stops by itself when she pauses
    r.onresult = (e) => {
      let finalText = ''
      let interim = ''
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript
        else interim += e.results[i][0].transcript
      }
      heard.current = finalText || heard.current
      setLive(`${finalText} ${interim}`.trim())
    }
    r.onerror = (e) =>
      setError(
        e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? 'Please allow the microphone (the app must be opened over https).'
          : e.error === 'no-speech'
            ? "Didn't hear anything — tap the mic and try again."
            : 'Voice stopped. Please try again or type below.',
      )
    r.onend = () => {
      setListening(false)
      setLive('')
      if (heard.current.trim()) share(heard.current)
    }
    rec.current = r
    r.start()
    setListening(true)
    navigator.vibrate?.(30)
  }

  const m = result && MOODS.find((x) => x.key === result.mood)

  return (
    <div className="card mood-check">
      <h3 className="card-title">💬 Ela unnaru? <span className="muted small">Just tell me how you feel</span></h3>

      {result ? (
        <div className="mood-result">
          <div className="mood-result-head">
            <span className="mood-result-emoji">{m?.emoji || '💬'}</span>
            <div className="grow">
              <strong>{m ? m.label : 'Saved'}</strong>
              <p className="small">“{result.text}”</p>
            </div>
          </div>
          {result.sent ? (
            <p className="small ok-text">✓ {partner} ki alert pampanu</p>
          ) : connected ? (
            <p className="small muted">No internet — the alert will go to {partner} once you're online.</p>
          ) : (
            <p className="small muted">
              Saved. <Link to="/partner" className="link">Connect {partner}'s phone</Link> to send alerts automatically.
            </p>
          )}
          <div className="mood-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setResult(null)}>Done</button>
            {result.wa && (
              <a className="btn btn-sm btn-whatsapp" href={result.wa} target="_blank" rel="noreferrer">💬 Also WhatsApp</a>
            )}
          </div>
        </div>
      ) : (
        <>
          <button className={`talk-btn ${listening ? 'on' : ''}`} onClick={() => (listening ? rec.current?.stop() : startListening())} disabled={busy}>
            <span className="talk-icon">{listening ? '■' : '🎤'}</span>
            <span>
              {busy ? 'Saving…' : listening ? (live || 'Listening… matladandi') : 'Tap & talk'}
            </span>
          </button>
          <div className="mood-lang">
            {LANGS.map((l) => (
              <button key={l.key} className={lang === l.key ? 'active' : ''} onClick={() => setLang(l.key)} disabled={listening}>
                {l.label}
              </button>
            ))}
            <span className="muted small grow" style={{ textAlign: 'right' }}>
              {connected ? `→ ${partner} gets an alert` : <Link to="/partner" className="link">Connect {partner}</Link>}
            </span>
          </div>
          <form
            className="mood-type"
            onSubmit={(e) => {
              e.preventDefault()
              share(typed)
            }}
          >
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="…or type: naku konchem tension ga undi" />
            <button className="icon-btn icon-btn-primary" disabled={!typed.trim() || busy} aria-label="Send">➤</button>
          </form>
        </>
      )}
      {error && <p className="small warn-text">{error}</p>}
    </div>
  )
}
