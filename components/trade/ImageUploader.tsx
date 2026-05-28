'use client'

import { useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import type { ChartImage, UploadSignatureResponse } from '@/types'

interface ImageUploaderProps {
  tradeId: string
  images: ChartImage[]
  onImagesChange?: (images: ChartImage[]) => void
}

export function ImageUploader({ tradeId, images, onImagesChange }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [currentImages, setCurrentImages] = useState<ChartImage[]>(images)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true)
      setError(null)

      try {
        // Get signed upload params from server
        const sigRes = await fetch('/api/upload')
        if (!sigRes.ok) throw new Error('Failed to get upload signature')
        const sig: UploadSignatureResponse = await sigRes.json()

        // Upload directly to Cloudinary
        const formData = new FormData()
        formData.append('file', file)
        formData.append('timestamp', String(sig.timestamp))
        formData.append('signature', sig.signature)
        formData.append('api_key', sig.apiKey)
        formData.append('folder', sig.folder)

        const uploadRes = await fetch(
          `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
          { method: 'POST', body: formData }
        )
        if (!uploadRes.ok) throw new Error('Cloudinary upload failed')
        const uploaded = await uploadRes.json()

        // Save reference to DB
        const saveRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tradeId,
            cloudinaryId: uploaded.public_id,
            url: uploaded.secure_url,
            label: label || null,
          }),
        })
        if (!saveRes.ok) throw new Error('Failed to save image reference')
        const savedImage: ChartImage = await saveRes.json()

        const updated = [...currentImages, savedImage]
        setCurrentImages(updated)
        onImagesChange?.(updated)
        setLabel('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setUploading(false)
      }
    },
    [tradeId, label, currentImages, onImagesChange]
  )

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return
      uploadFile(files[0])
    },
    [uploadFile]
  )

  const handleDelete = useCallback(
    async (image: ChartImage) => {
      try {
        await fetch('/api/upload', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageId: image.id, cloudinaryId: image.cloudinaryId }),
        })
        const updated = currentImages.filter((i) => i.id !== image.id)
        setCurrentImages(updated)
        onImagesChange?.(updated)
      } catch {
        setError('Failed to delete image')
      }
    },
    [currentImages, onImagesChange]
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Image label */}
      <input
        type="text"
        placeholder='Label (e.g. "Entry Setup")'
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        maxLength={100}
        className="w-full px-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-ink)] text-sm placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
      />

      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        className={`flex flex-col items-center justify-center gap-2 py-8 rounded-[var(--radius-lg)] border-2 border-dashed cursor-pointer transition-colors ${
          dragging
            ? 'border-[var(--color-accent)] bg-[var(--color-accent-bg)]'
            : 'border-[var(--color-border)] bg-[var(--color-surface-sunken)] hover:border-[var(--color-accent)]'
        }`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--color-ink-muted)]">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
        </svg>
        <p className="text-sm text-[var(--color-ink-muted)]">
          {uploading ? 'Uploading…' : 'Drop chart or click to upload'}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && (
        <p className="text-xs text-[var(--color-loss)]">{error}</p>
      )}

      {/* Thumbnails */}
      {currentImages.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {currentImages.map((img) => (
            <div
              key={img.id}
              className="relative group rounded-[var(--radius-md)] overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-sunken)]"
              style={{ borderWidth: '0.5px' }}
            >
              <Image
                src={img.url}
                alt={img.label ?? 'Chart'}
                width={400}
                height={300}
                className="w-full h-32 object-cover"
              />
              {img.label && (
                <div className="absolute bottom-0 inset-x-0 px-2 py-1 bg-black/50 text-white text-[11px]">
                  {img.label}
                </div>
              )}
              <button
                type="button"
                onClick={() => handleDelete(img)}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
