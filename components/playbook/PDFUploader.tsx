'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/Button'

interface PDFUploaderProps {
  setupId: string
  initialPdfUrl: string | null
  initialPdfCloudinaryId: string | null
}

export function PDFUploader({ setupId, initialPdfUrl, initialPdfCloudinaryId }: PDFUploaderProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(initialPdfUrl)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // unused but tracked for future delete-old logic
  void initialPdfCloudinaryId

  async function uploadFile(file: File) {
    if (!file || file.type !== 'application/pdf') {
      alert('Please select a PDF file')
      return
    }
    setUploading(true)
    try {
      const sigRes = await fetch(`/api/upload?folder=trade-journal/playbook/pdfs`)
      if (!sigRes.ok) throw new Error('Failed to get upload signature')
      const { timestamp, signature, cloudName, apiKey, folder } = await sigRes.json()

      const formData = new FormData()
      formData.append('file', file)
      formData.append('timestamp', String(timestamp))
      formData.append('signature', signature)
      formData.append('api_key', apiKey)
      formData.append('folder', folder)
      formData.append('resource_type', 'raw')

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`,
        { method: 'POST', body: formData }
      )
      if (!uploadRes.ok) throw new Error('Cloudinary upload failed')
      const { public_id, secure_url } = await uploadRes.json()

      const saveRes = await fetch(`/api/setups/${setupId}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloudinaryId: public_id, url: secure_url }),
      })
      if (!saveRes.ok) throw new Error('Failed to save PDF reference')
      setPdfUrl(secure_url)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    e.target.value = ''
  }

  if (pdfUrl) {
    const filename = decodeURIComponent(pdfUrl.split('/').pop() ?? 'playbook.pdf')
    return (
      <div
        className="flex items-center justify-between p-3 rounded-[var(--radius-md)] border bg-[var(--color-surface-sunken)]"
        style={{ borderWidth: '0.5px', borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-[var(--color-ink-muted)]">PDF</span>
          <span className="text-sm text-[var(--color-ink)] truncate">{filename}</span>
        </div>
        <div className="flex gap-2 shrink-0">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--color-accent)] hover:opacity-80 transition-opacity"
          >
            View PDF
          </a>
          <button
            onClick={() => inputRef.current?.click()}
            className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
            disabled={uploading}
          >
            {uploading ? 'Uploading…' : 'Replace'}
          </button>
        </div>
        <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={handleChange} />
      </div>
    )
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`flex flex-col items-center justify-center gap-2 p-6 rounded-[var(--radius-md)] border-2 border-dashed cursor-pointer transition-colors ${
        dragOver
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-bg)]'
          : 'border-[var(--color-border)] hover:border-[var(--color-ink-muted)]'
      }`}
    >
      {uploading ? (
        <span className="text-sm text-[var(--color-ink-secondary)]">Uploading…</span>
      ) : (
        <>
          <span className="text-sm text-[var(--color-ink-secondary)]">Drop PDF here or click to upload</span>
          <span className="text-xs text-[var(--color-ink-muted)]">Playbook / strategy rules</span>
        </>
      )}
      <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={handleChange} />
    </div>
  )
}
