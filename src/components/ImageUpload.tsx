import { useState } from 'react'
import './ImageUpload.css'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 50 * 1024 * 1024

interface Props {
  onFile: (file: File) => void
}

export function ImageUpload({ onFile }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  function validate(file: File): string | null {
    if (!ACCEPTED_TYPES.includes(file.type)) return 'Only JPEG, PNG, and WebP images are accepted.'
    if (file.size > MAX_SIZE_BYTES) return 'File must be under 50 MB.'
    return null
  }

  function handle(file: File) {
    const err = validate(file)
    if (err) { setError(err); return }
    setError(null)
    onFile(file)
  }

  return (
    <label
      className={`upload-zone${dragging ? ' upload-zone--dragging' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) handle(file)
      }}
    >
      <p className="upload-zone__prompt">
        <span className="upload-zone__prompt--touch">Tap to add an image</span>
        <span className="upload-zone__prompt--drag">Drop an image here, or <span className="upload-zone__prompt-link">click to browse</span></span>
      </p>
      <input
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f) }}
        hidden
      />
      <p className="upload-zone__hint">JPEG · PNG · WebP &nbsp;·&nbsp; max 50 MB</p>
      {error && <p className="upload-zone__error">{error}</p>}
    </label>
  )
}
