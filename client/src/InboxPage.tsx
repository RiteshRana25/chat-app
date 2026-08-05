import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type ChatMessage, type ConversationSummary } from "./api";
import { useAuth } from "./AuthContext";
import { useSocket } from "./useSocket";

export function InboxPage() {
  const { t, user, logout } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationSummary[]>(
    []
  );
  const [showNew, setShowNew] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { conversations } = await api.conversations();
    setConversations(conversations);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  useSocket({
    onMessage: (msg: ChatMessage) => {
      if (msg.senderId === user?.id) return;
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === msg.conversationId);
        if (idx === -1) {
          load().catch(console.error);
          return prev;
        }
        const next = [...prev];
        const row = { ...next[idx] };
        row.lastMessage = {
          id: msg.id,
          text: msg.text,
          senderId: msg.senderId,
          createdAt: msg.createdAt,
        };
        row.updatedAt = msg.createdAt;
        next.splice(idx, 1);
        next.unshift(row);
        return next;
      });
    },
    onTranslated: (payload) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== payload.conversationId) return c;
          if (c.lastMessage?.id !== payload.id) return c;
          return {
            ...c,
            lastMessage: {
              ...c.lastMessage,
              text: payload.text,
            },
          };
        })
      );
    },
  });

  async function startChat(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { conversation } = await api.startConversation(email.trim());
      navigate(`/chat/${conversation.id}`);
    } catch {
      setError(t.userNotFound);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="brand-mark small">{t.brand}</p>
          <h1>{t.inbox}</h1>
        </div>
        <div className="topbar-actions">
          <Link to="/settings" className="ghost-btn">
            {t.settings}
          </Link>
          <button type="button" className="ghost-btn" onClick={logout}>
            {t.logout}
          </button>
        </div>
      </header>

      <div className="inbox-toolbar">
        <div className="user-chip">
          <span className="user-chip-dot" />
          <p className="muted">{user?.displayName}</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setShowNew(true)}
        >
          {t.newChat}
        </button>
      </div>

      {showNew && (
        <form className="new-chat-card reveal" onSubmit={startChat}>
          <label>
            <span>{t.searchEmail}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="friend@email.com"
              autoFocus
            />
          </label>
          <p className="hint">{t.searchHint}</p>
          {error && <p className="form-error">{error}</p>}
          <div className="row-actions">
            <button
              type="button"
              className="ghost-btn"
              onClick={() => {
                setShowNew(false);
                setError("");
                setEmail("");
              }}
            >
              {t.cancel}
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {t.startChat}
            </button>
          </div>
        </form>
      )}

      <ul className="conversation-list">
        {conversations.length === 0 && (
          <li className="empty-state panel">{t.noConversations}</li>
        )}
        {conversations.map((c, i) => (
          <li
            key={c.id}
            className="reveal"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <button
              type="button"
              className="conversation-row"
              onClick={() => navigate(`/chat/${c.id}`)}
            >
              <div className="avatar">
                {(c.otherUser?.displayName || "?")[0].toUpperCase()}
              </div>
              <div className="conversation-meta">
                <strong>{c.otherUser?.displayName || "…"}</strong>
                <span className="preview">{c.lastMessage?.text || "—"}</span>
              </div>
              <span className="row-arrow" aria-hidden="true">
                →
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
