import type { Card } from '../models/card'
import { ImageUpload } from '../components/ImageUpload'

const EXAMPLE_BACKS = [
  { src: '/photocard-back-examples/photocard-back-example-1_album.webp',     label: 'album' },
  { src: '/photocard-back-examples/photocard-back-example-2_logo.webp',      label: 'logo' },
  { src: '/photocard-back-examples/photocard-back-example-3_signature.webp', label: 'signature' },
]

interface Props {
  pendingCard: Card
  // Distinct backs already used in the target deck, offered for reuse.
  knownBacks: string[]
  setAsShared: boolean
  onSetAsSharedChange: (value: boolean) => void
  onEditFront: () => void
  onPickBack: (dataUrl: string) => void
  onBackFile: (file: File) => void
  onStartOver: () => void
}

// Step 2 of adding a card: choose or upload its back.
export function UploadBackScreen({ pendingCard, knownBacks, setAsShared, onSetAsSharedChange, onEditFront, onPickBack, onBackFile, onStartOver }: Props) {
  return (
    <div className="upload-back">
      <div className="upload-back__preview">
        <div className="upload-back__thumb">
          {pendingCard.front && (
            <img src={pendingCard.front} alt="Card front" />
          )}
        </div>
        <span className="upload-back__front-label">Front</span>
        <button className="btn btn--ghost upload-back__edit-btn" onClick={onEditFront}>
          Edit
        </button>
      </div>

      <div className="upload-back__content">
        <p className="upload-back__step">Step 2 of 2 — Add the card back</p>

        {knownBacks.length > 0 && (
          <>
            <p className="upload-back__step" style={{ marginBottom: -4 }}>Previously used</p>
            <div className="back-gallery">
              {knownBacks.map((dataUrl, i) => (
                <button
                  key={i}
                  className="back-gallery__thumb"
                  onClick={() => onPickBack(dataUrl)}
                  title="Use this back"
                >
                  <img src={dataUrl} alt={`Back option ${i + 1}`} />
                </button>
              ))}
            </div>
          </>
        )}

        <p className="upload-back__step" style={{ marginBottom: -4 }}>Examples</p>
        <div className="back-gallery">
          {EXAMPLE_BACKS.map((item, i) => (
            <div key={`eg-${i}`} className="back-gallery-item">
              <div className="back-gallery__thumb back-gallery__thumb--static">
                <img src={item.src} alt={`Example back: ${item.label}`} />
              </div>
              <span className="back-gallery-item__label">{item.label}</span>
            </div>
          ))}
        </div>

        <div className="upload-back__divider">
          {knownBacks.length > 0 ? 'or upload different' : 'or upload your own'}
        </div>

        <ImageUpload onFile={onBackFile} />

        <label className="upload-back__set-shared">
          <input
            type="checkbox"
            checked={setAsShared}
            onChange={e => onSetAsSharedChange(e.target.checked)}
          />
          Set as shared back for all cards
        </label>

        <div className="upload-back__actions">
          <button className="btn btn--ghost" onClick={onStartOver}>Start over</button>
        </div>
      </div>
    </div>
  )
}
