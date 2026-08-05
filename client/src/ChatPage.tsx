import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Link, useParams } from "react-router-dom";
import { api, type ChatMessage, type User } from "./api";
import { useAuth } from "./AuthContext";
import { TypingCat } from "./TypingCat";
import { useSocket } from "./useSocket";

export function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const { t, user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [other, setOther] = useState<User | null>(null);
  const [text, setText] = useState("");
  const [connected, setConnected] = useState(false);
  const [peekId, setPeekId] = useState<string | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const otherTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const isTypingRef = useRef(false);
  const focusedRef = useRef(false);
  const sendTypingRef = useRef<(conversationId: string, typing: boolean) => void>(
    () => {}
  );

  useEffect(() => {
    if (!id) return;
    setOtherTyping(false);
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
  }, [messages, otherTyping]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  useEffect(() => {
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (otherTypingTimeoutRef.current) {
        clearTimeout(otherTypingTimeoutRef.current);
      }
      if (id && isTypingRef.current) {
        sendTypingRef.current(id, false);
      }
    };
  }, [id]);

  const { sendMessage, sendTyping } = useSocket({
    onConnect: () => setConnected(true),
    onDisconnect: () => setConnected(false),
    onMessage: (msg) => {
      if (msg.conversationId !== id) return;
      if (msg.senderId !== user?.id) setOtherTyping(false);
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
    onTyping: (payload) => {
      if (payload.conversationId !== id) return;
      if (payload.userId === user?.id) return;
      if (otherTypingTimeoutRef.current) {
        clearTimeout(otherTypingTimeoutRef.current);
        otherTypingTimeoutRef.current = null;
      }
      setOtherTyping(payload.typing);
      // Safety clear if the other side disconnects without sending stop
      if (payload.typing) {
        otherTypingTimeoutRef.current = setTimeout(() => {
          setOtherTyping(false);
        }, 5000);
      }
    },
  });

  sendTypingRef.current = sendTyping;

  function clearHeartbeat() {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }

  function stopTyping() {
    clearHeartbeat();
    if (!id || !isTypingRef.current) return;
    isTypingRef.current = false;
    sendTyping(id, false);
  }

  function startTyping() {
    if (!id) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      sendTyping(id, true);
    }
    clearHeartbeat();
    // Keep indicator alive while focused with text
    heartbeatRef.current = setInterval(() => {
      if (id && isTypingRef.current) sendTyping(id, true);
    }, 2000);
  }

  function syncTyping(nextText: string, focused: boolean) {
    if (focused && nextText.trim().length > 0) startTyping();
    else stopTyping();
  }

  function onSend(e: FormEvent) {
    e.preventDefault();
    if (!id || !text.trim()) return;
    stopTyping();
    sendMessage(id, text.trim());
    setText("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey) return;
    // Mobile soft keyboards often use Enter for newline; only send on desktop-like Enter.
    if (e.nativeEvent.isComposing) return;
    const isCoarse = window.matchMedia("(pointer: coarse)").matches;
    if (isCoarse) return;
    e.preventDefault();
    if (!id || !text.trim()) return;
    stopTyping();
    sendMessage(id, text.trim());
    setText("");
  }

  return (
    <div className="app-shell chat-shell">
      <header className="topbar chat-topbar panel">
        <Link to="/" className="ghost-btn back-btn" aria-label={t.back}>
          <span className="back-arrow" aria-hidden="true">
            ←
          </span>
          <span className="back-label">{t.back}</span>
        </Link>
        <div className="chat-heading">
          <div className="avatar tiny">
            {(other?.displayName || "?")[0].toUpperCase()}
          </div>
          <div className="chat-title">
            <strong>{other?.displayName || "…"}</strong>
            <span className="chat-email">{other?.email}</span>
            <span
              className={`chat-presence status-dot ${connected ? "on" : "off"}`}
            >
              <i />
              {connected ? t.online : t.offline}
            </span>
          </div>
        </div>
      </header>

      <div className="message-stream">
        {messages.length === 0 && !otherTyping && (
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
        {otherTyping && <TypingCat label={t.typing} />}
        <div ref={bottomRef} />
      </div>

      <form className="composer panel" onSubmit={onSend}>
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => {
            const next = e.target.value;
            setText(next);
            syncTyping(next, focusedRef.current);
          }}
          onFocus={() => {
            focusedRef.current = true;
            syncTyping(text, true);
          }}
          onBlur={() => {
            focusedRef.current = false;
            stopTyping();
          }}
          onKeyDown={onKeyDown}
          placeholder={t.typeMessage}
          rows={1}
          enterKeyHint="enter"
          autoComplete="off"
          autoCorrect="on"
          autoCapitalize="sentences"
        />
        <button
          type="submit"
          className="btn-primary send-btn"
          aria-label={t.send}
          disabled={!text.trim()}
        >
          <svg
            className="send-icon"
            viewBox="0 0 24 24"
            width="22"
            height="22"
            aria-hidden="true"
            focusable="false"
          >
            <path
              fill="currentColor"
              d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"
            />
          </svg>
          <span className="send-label">{t.send}</span>
        </button>
      </form>
    </div>
  );
}
