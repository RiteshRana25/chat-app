export function TypingCat({ label }: { label: string }) {
  return (
    <div className="typing-indicator" aria-label={label} role="status">
      <img
        className="typing-cat-gif"
        src="/typing-cat.gif"
        alt=""
        width={96}
        height={72}
        decoding="async"
      />
    </div>
  );
}
