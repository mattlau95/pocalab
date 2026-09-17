interface Props {
  newBack: string
  // How many other cards in the deck use the back being replaced.
  otherCount: number
  onCancel: () => void
  onJustThis: () => void
  onAll: () => void
}

// After editing a back that other cards share: update one card or all of them.
export function BackScopeScreen({ newBack, otherCount: count, onCancel, onJustThis, onAll }: Props) {
  return (
    <div className="back-scope">
      <div className="back-scope__thumb">
        <img src={newBack} alt="New back" />
      </div>
      <p className="back-scope__title">Save to how many cards?</p>
      <p className="back-scope__desc">
        {count} other {count === 1 ? 'card' : 'cards'} in your deck {count === 1 ? 'uses' : 'use'} this same back.
      </p>
      <div className="back-scope__actions">
        <button className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn--ghost" onClick={onJustThis}>Just this card</button>
        <button className="btn btn--primary" onClick={onAll}>Update all {count + 1} cards</button>
      </div>
    </div>
  )
}
