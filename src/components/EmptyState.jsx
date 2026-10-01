// A friendly message for when a list is empty: a big emoji, a short bold
// title and one line saying what to do next.
//   <EmptyState emoji="🌷" title="No classes today">Enjoy your free day!</EmptyState>
export default function EmptyState({ emoji, title, children }) {
  return (
    <div className="empty empty-state">
      {emoji && <span className="empty-emoji" aria-hidden="true">{emoji}</span>}
      <p className="empty-title">{title}</p>
      {children && <p className="empty-text">{children}</p>}
    </div>
  )
}
