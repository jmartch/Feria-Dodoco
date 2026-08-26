const EMOJIS = [
  "🧸", "🎀", "📌", "🖊️", "👜", "🧦", "👕", "🎨", "✨", "💖",
  "🌸", "⭐", "🎁", "🍬", "🧢", "👒", "💍", "📿", "🔑", "🎧",
  "📱", "💄", "🕶️", "🎪", "🏷️", "🛍️",
];

export function SelectorEmoji({ valor, onCambio }: { valor: string; onCambio: (emoji: string) => void }) {
  return (
    <div className="emoji-grid" role="group" aria-label="Elegir ícono">
      {EMOJIS.map((e) => (
        <button
          key={e}
          type="button"
          className={`emoji-op${valor === e ? " activo" : ""}`}
          aria-label={`Ícono ${e}`}
          aria-pressed={valor === e}
          onClick={() => onCambio(e)}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
