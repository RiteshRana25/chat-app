import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type ChatMessage, type User } from "./api";
import { useAuth } from "./AuthContext";
import { useSocket } from "./useSocket";

export function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const { t, user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [other, setOther] = useState<User | null>(null);
  const [text, setText] = useState("");
  const [connected, setConnected] = useState(false);
  const [peekId, setPeekId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.messages(id), api.conversations()]).then(
      ([msgRes, convRes]) => {
        setMessages(msgRes.messages);
        const conv = convRes.conversations.find((c) => c.id === id);
        setOther(conv?.otherUser ?? null);
      }
    );
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const { sendMessage } = useSocket({
    onConnect: () => setConnected(true),
    onDisconnect: () => setConnected(false),
    onMessage: (msg) => {
      if (msg.conversationId !== id) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    },
    onTranslated: (payload) => {
      if (payload.conversationId !== id) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.id
            ? {
                ...m,
                text: payload.text,
                originalText: payload.originalText,
                translating: false,
              }
            : m
        )
      );
    },
  });

  function onSend(e: FormEvent) {
    e.preventDefault();
    if (!id || !text.trim()) return;
    sendMessage(id, text.trim());
    setText("");
  }

  return (
    <div className="app-shell chat-shell">
      <header className="topbar chat-topbar panel">
        <Link to="/" className="ghost-btn back-btn">
          ← {t.back}
        </Link>
        <div className="chat-heading">
          <div className="avatar tiny">
            {(other?.displayName || "?")[0].toUpperCase()}
          </div>
          <div>
            <strong>{other?.displayName || "…"}</strong>
            <span>{other?.email}</span>
          </div>
        </div>
        <span className={`status-dot ${connected ? "on" : "off"}`}>
          <i />
          {connected ? t.online : t.offline}
        </span>
      </header>

      <div className="message-stream">
        {messages.length === 0 && (
          <p className="empty-state center">{t.emptyChat}</p>
        )}
        {messages.map((m) => {
          const mine = m.senderId === user?.id;
          const showOriginal =
            peekId === m.id &&
            !mine &&
            m.originalText &&
            m.originalText !== m.text;
          return (
            <button
              type="button"
              key={m.id}
              className={`bubble ${mine ? "mine" : "theirs"}`}
              onClick={() =>
                setPeekId(peekId === m.id ? null : !mine ? m.id : null)
              }
            >
              <p>{m.text}</p>
              {m.translating && (
                <span className="translating">{t.translating}</span>
              )}
              {showOriginal && (
                <span className="original-peek">
                  {t.original}: {m.originalText}
                </span>
              )}
            </button>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form className="composer panel" onSubmit={onSend}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.typeMessage}
        />
        <button type="submit" className="btn-primary send-btn">
          {t.send}
        </button>
      </form>
    </div>
  );
}
