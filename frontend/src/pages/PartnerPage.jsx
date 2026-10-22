import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { ErrorBox, PageHeader } from '../components/ui.jsx'
import { notifyPartner, setupMessage, topicUrl, whatsappUrl } from '../partner.js'

export default function PartnerPage() {
  const { user, updateProfile, refresh } = useAuth()
  const [form, setForm] = useState({ partner_name: user.partner_name || '', partner_phone: user.partner_phone || '' })
  const [topic, setTopic] = useState(user.partner_topic || '')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (user.partner_topic) return
    api.partnerTopic().then((t) => {
      setTopic(t)
      refresh()
    })
  }, [user.partner_topic, refresh])

  const partner = form.partner_name || 'Husband'
  const name = user.name.split(' ')[0]

  const save = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await updateProfile({ partner_name: form.partner_name || null, partner_phone: form.partner_phone || null })
      setMsg('Saved ✓')
    } catch (err) {
      setError(err.message)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(topic)
      setMsg('Code copied ✓')
    } catch {
      setMsg('Select the code and copy it')
    }
  }

  const test = async () => {
    setMsg('Sending…')
    const ok = await notifyPartner(topic, {
      title: `💗 Test from ${name}`,
      message: `${partner} garu, mood alerts are working! 🎉`,
      mood: 'happy',
    })
    setMsg(ok ? `Test alert sent — check ${partner}'s phone ✓` : 'No internet — it will be sent once online.')
  }

  const renew = async () => {
    if (!confirm('Make a new code? The old one stops working, and your husband must subscribe again.')) return
    const t = await api.partnerTopic({ renew: true })
    setTopic(t)
    await refresh()
    setMsg('New code made — send the setup again.')
  }

  return (
    <div className="page">
      <PageHeader title="Husband alerts" subtitle="Mood updates go to your husband's phone automatically" back />

      <div className="card tip-card">
        <h3 className="card-title">💑 Ela panichestundi?</h3>
        <p>
          Meeru Home lo 🎤 nokki ela unnaro cheppandi. App mee matala nunchi mood gurtinchi, {partner} phone ki
          ventane notification pampistundi — meeru em select cheyakkarledu.
        </p>
      </div>

      <form className="card form" onSubmit={save}>
        <h3 className="card-title">1. {partner} details</h3>
        <div className="row-2">
          <label className="field">
            <span>Name</span>
            <input value={form.partner_name} onChange={(e) => setForm({ ...form, partner_name: e.target.value })} placeholder="Husband" />
          </label>
          <label className="field">
            <span>WhatsApp number</span>
            <input type="tel" value={form.partner_phone} onChange={(e) => setForm({ ...form, partner_phone: e.target.value })} placeholder="98xxxxxx10" />
          </label>
        </div>
        <button className="btn btn-ghost btn-sm">Save</button>
      </form>

      <div className="card form">
        <h3 className="card-title">2. Connect {partner}'s phone</h3>
        <ol className="steps small">
          <li>On {partner}'s phone, install the free <b>ntfy</b> app (Play Store / App Store).</li>
          <li>Open ntfy → tap <b>+</b> → paste this code as the topic → <b>Subscribe</b>.</li>
        </ol>
        <div className="topic-box">
          <code>{topic || '…'}</code>
          <button type="button" className="btn btn-ghost btn-sm" onClick={copy} disabled={!topic}>Copy</button>
        </div>
        {topic && (
          <div className="mood-actions">
            <a className="btn btn-whatsapp btn-sm" href={whatsappUrl(form.partner_phone, setupMessage(topic, name))} target="_blank" rel="noreferrer">
              💬 Send setup to {partner} on WhatsApp
            </a>
          </div>
        )}
        <p className="fine-print">No app? {partner} can also open {topic ? topicUrl(topic) : 'the link'} in Chrome and allow notifications.</p>
      </div>

      <div className="card form">
        <h3 className="card-title">3. Test it</h3>
        <button className="btn btn-primary btn-block" onClick={test} disabled={!topic}>Send a test alert</button>
        <button className="btn btn-danger-ghost btn-sm" onClick={renew}>Make a new code</button>
      </div>

      {msg && <div className="card ok-card">{msg}</div>}
      <ErrorBox message={error} />

      <p className="fine-print">
        Alerts go through ntfy.sh, a free notification service. The long code keeps them private — share it only with
        your husband. Needs internet; if offline, alerts are sent once you're back online.
      </p>
    </div>
  )
}
