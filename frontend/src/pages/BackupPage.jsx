import { useRef, useState } from 'react'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from '../components/Icon.jsx'
import { ErrorBox, PageHeader } from '../components/ui.jsx'
import { blobToDataUrl, dataUrlToBlob, deleteFile, getFile, putFile } from '../fileStore.js'
import { todayISO } from '../utils.js'

const fmtStamp = (s) =>
  new Date(`${s.replace(' ', 'T')}Z`).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })

export default function BackupPage() {
  const { user, refresh } = useAuth()
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const input = useRef(null)

  const download = async () => {
    setBusy('backup')
    setError('')
    setDone('')
    try {
      const backup = await api.exportData()
      backup.files = {}
      for (const r of backup.data.reports) {
        for (const f of r.files) {
          const blob = await getFile(f.file_id).catch(() => null)
          if (blob) backup.files[f.file_id] = await blobToDataUrl(blob)
        }
      }
      const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
      const name = `maternity-backup-${user.username}-${todayISO()}.json`
      const file = new File([blob], name, { type: 'application/json' })
      const saveFile = () => {
        const url = URL.createObjectURL(blob)
        Object.assign(document.createElement('a'), { href: url, download: name }).click()
        setTimeout(() => URL.revokeObjectURL(url), 2000)
      }
      // On phones, the share sheet lets you save to Drive / WhatsApp / Files directly.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Maternity backup' }).catch(saveFile)
      } else saveFile()
      await refresh()
      setDone('Backup created. Keep the file somewhere safe, like Google Drive.')
    } catch (err) {
      setError(err.message || 'Could not create the backup')
    } finally {
      setBusy('')
    }
  }

  const restore = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setDone('')
    let backup
    try {
      backup = JSON.parse(await file.text())
    } catch {
      setError('This file could not be read. Please choose a Maternity backup (.json) file.')
      return
    }
    if (backup?.app !== 'maternity-tracker') {
      setError('This is not a Maternity backup file.')
      return
    }
    if (!confirm('Restoring will replace all data in this account with the backup. Continue?')) return

    setBusy('restore')
    try {
      const oldReports = await api.reports()
      const incoming = backup.files || {}
      for (const [id, dataUrl] of Object.entries(incoming)) await putFile(id, await dataUrlToBlob(dataUrl))
      await api.importData(backup)
      await Promise.all(
        oldReports.flatMap((r) => r.files).filter((f) => !(f.file_id in incoming)).map((f) => deleteFile(f.file_id).catch(() => {})),
      )
      await refresh()
      setDone('Your data has been restored. 🎉')
    } catch (err) {
      setError(err.message || 'Could not restore the backup')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="page">
      <PageHeader title="Backup & restore" subtitle="Keep your data safe" back />

      <div className="card tip-card">
        <h3 className="card-title">📱 Your data lives on this phone</h3>
        <p>
          Everything you enter is saved only in this browser. Clearing browser data, or changing phones, will lose it —
          so download a backup now and then and keep it in Google Drive, email or WhatsApp.
        </p>
      </div>

      <div className="card backup-card">
        <div className="backup-icon"><Icon name="download" size={26} /></div>
        <div className="grow">
          <h3>Download backup</h3>
          <p className="small">
            Profile, health logs, visits, kicks, medicines, bag, names, contractions and report files.
          </p>
          <p className="small muted">Last backup: {user.last_backup ? fmtStamp(user.last_backup) : 'never'}</p>
        </div>
      </div>
      <button className="btn btn-primary btn-block" onClick={download} disabled={!!busy}>
        {busy === 'backup' ? 'Preparing…' : 'Download backup'}
      </button>

      <div className="card backup-card">
        <div className="backup-icon backup-icon-violet"><Icon name="upload" size={26} /></div>
        <div className="grow">
          <h3>Restore from backup</h3>
          <p className="small">Pick a backup file to load it into this account (@{user.username}). This replaces the current data.</p>
        </div>
      </div>
      <button className="btn btn-ghost btn-block" onClick={() => input.current?.click()} disabled={!!busy}>
        {busy === 'restore' ? 'Restoring…' : 'Choose backup file'}
      </button>
      <input ref={input} type="file" accept="application/json,.json" hidden onChange={restore} />

      <ErrorBox message={error} />
      {done && <div className="card ok-card">{done}</div>}
    </div>
  )
}
