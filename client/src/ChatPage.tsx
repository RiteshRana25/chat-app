import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Link, useParams } from "react-router-dom";
import { api, type ChatMessage, type MessageAttachment, type User } from "./api";
import { useAuth } from "./AuthContext";
import { mediaUrl } from "./config";
import { MediaViewer } from "./MediaViewer";
import {
  formatDayLabel,
  formatMessageTime,
  isSameDay,
} from "./timeFormat";
import { TypingCat } from "./TypingCat";
import { useSocket } from "./useSocket";

type PendingFile = {
  file: File;
  previewUrl: string;
};

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}

function isVideoMime(mime: string): boolean {
  return mime.startsWith("video/");
}

export function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const { t, user, lang } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [other, setOther] = useState<User | null>(null);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<PendingFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [attachError, setAttachError] = useState("");
  const [otherOnline, setOtherOnline] = useState(false);
  const [peekId, setPeekId] = useState<string | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [viewer, setViewer] = useState<MessageAttachment | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const otherTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const isTypingRef = useRef(false);
  const focusedRef = useRef(false);
  const otherIdRef = useRef<string | null>(null);
  const sendTypingRef = useRef<(conversationId: string, typing: boolean) => void>(
    () => {}
  );

  otherIdRef.current = other?.id ?? null;

  useEffect(() => {
    if (!id) return;
    setOtherTyping(false);
    setOtherOnline(false);
    clearPending();
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

  const { sendMessage, sendTyping, checkPresence, connected } = useSocket({
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
      if (payload.typing) {
        otherTypingTimeoutRef.current = setTimeout(() => {
          setOtherTyping(false);
        }, 5000);
      }
    },
    onPresence: (payload) => {
      if (!otherIdRef.current || payload.userId !== otherIdRef.current) return;
      setOtherOnline(payload.online);
      if (!payload.online) setOtherTyping(false);
    },
  });

  useEffect(() => {
    if (!other?.id || !connected) return;
    checkPresence(other.id);
  }, [other?.id, connected, checkPresence]);

  sendTypingRef.current = sendTyping;

  function clearPending() {
    setPending((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

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
    heartbeatRef.current = setInterval(() => {
      if (id && isTypingRef.current) sendTyping(id, true);
    }, 2000);
  }

  function syncTyping(nextText: string, focused: boolean) {
    if (focused && nextText.trim().length > 0) startTyping();
    else stopTyping();
  }

  function onPickFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setAttachError("");
    setPending((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return {
        file,
        previewUrl: isImageMime(file.type) ? URL.createObjectURL(file) : "",
      };
    });
  }

  async function sendCurrent(caption: string) {
    if (!id) return;
    if (!caption && !pending) return;
    setAttachError("");
    stopTyping();

    let attachment: MessageAttachment | null = null;
    if (pending) {
      setUploading(true);
      try {
        const res = await api.uploadFile(pending.file);
        attachment = res.attachment;
      } catch (err) {
        setAttachError(err instanceof Error ? err.message : t.uploading);
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    sendMessage(id, caption, attachment);
    setText("");
    clearPending();
  }

  function onSend(e: FormEvent) {
    e.preventDefault();
    void sendCurrent(text.trim());
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey) return;
    if (e.nativeEvent.isComposing) return;
    const isCoarse = window.matchMedia("(pointer: coarse)").matches;
    if (isCoarse) return;
    e.preventDefault();
    void sendCurrent(text.trim());
  }

  const canSend = (!!text.trim() || !!pending) && !uploading;

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
          <img
            className="presence-gif"
            src={
              otherOnline ? "/presence-online.gif" : "/presence-offline.gif"
            }
            alt=""
            width={52}
            height={52}
            decoding="async"
          />
          <div className="chat-title">
            <strong>{other?.displayName || "…"}</strong>
            <span className="chat-email">{other?.email}</span>
            <span
              className={`chat-presence status-dot ${
                otherOnline ? "on" : "off"
              }`}
            >
              <i />
              {otherOnline ? t.online : t.offline}
            </span>
          </div>
        </div>
      </header>

      <div className="message-stream">
        {messages.length === 0 && !otherTyping && (
          <p className="empty-state center">{t.emptyChat}</p>
        )}
        {messages.map((m, index) => {
          const mine = m.senderId === user?.id;
          const prev = index > 0 ? messages[index - 1] : null;
          const showDay =
            !prev || !isSameDay(prev.createdAt, m.createdAt, lang);
          const showOriginal =
            peekId === m.id &&
            !mine &&
            m.originalText &&
            m.originalText !== m.text;
          const attachment = m.attachment;
          return (
            <Fragment key={m.id}>
              {showDay && (
                <div className="date-chip">
                  {formatDayLabel(m.createdAt, lang, {
                    today: t.today,
                    yesterday: t.yesterday,
                  })}
                </div>
              )}
              <div
                className={`bubble ${mine ? "mine" : "theirs"} ${
                  attachment ? "has-media" : ""
                }`}
                onClick={() =>
                  setPeekId(peekId === m.id ? null : !mine ? m.id : null)
                }
              >
                {attachment && isImageMime(attachment.mime) && (
                  <button
                    type="button"
                    className="bubble-image-link"
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewer(attachment);
                    }}
                  >
                    <img
                      className="bubble-image"
                      src={mediaUrl(attachment.url)}
                      alt={attachment.name}
                      loading="lazy"
                    />
                  </button>
                )}
                {attachment && isVideoMime(attachment.mime) && (
                  <button
                    type="button"
                    className="bubble-video-link"
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewer(attachment);
                    }}
                  >
                    <video
                      className="bubble-video"
                      src={mediaUrl(attachment.url)}
                      muted
                      playsInline
                      preload="metadata"
                    />
                    <span className="bubble-video-play" aria-hidden="true" />
                  </button>
                )}
                {attachment &&
                  !isImageMime(attachment.mime) &&
                  !isVideoMime(attachment.mime) && (
                    <button
                      type="button"
                      className="bubble-file"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewer(attachment);
                      }}
                    >
                      <span className="bubble-file-icon" aria-hidden="true" />
                      <span className="bubble-file-meta">
                        <strong>{attachment.name}</strong>
                        <small>
                          {formatBytes(attachment.size)} · {t.openFile}
                        </small>
                      </span>
                    </button>
                  )}
                {!!m.text && <p>{m.text}</p>}
                {m.translating && (
                  <span className="translating">{t.translating}</span>
                )}
                {showOriginal && (
                  <span className="original-peek">
                    {t.original}: {m.originalText}
                  </span>
                )}
                <span className="bubble-time">
                  {formatMessageTime(m.createdAt, lang)}
                </span>
              </div>
            </Fragment>
          );
        })}
        {otherTyping && <TypingCat label={t.typing} />}
        <div ref={bottomRef} />
      </div>

      {(pending || attachError) && (
        <div className="attach-preview panel">
          {pending && isImageMime(pending.file.type) && pending.previewUrl && (
            <img src={pending.previewUrl} alt="" className="attach-thumb" />
          )}
          {pending && !isImageMime(pending.file.type) && (
            <div className="attach-file-chip">
              <strong>{pending.file.name}</strong>
              <small>{formatBytes(pending.file.size)}</small>
            </div>
          )}
          {attachError && <p className="attach-error">{attachError}</p>}
          {pending && (
            <button
              type="button"
              className="ghost-btn"
              onClick={clearPending}
              disabled={uploading}
            >
              {t.removeAttachment}
            </button>
          )}
        </div>
      )}

      <form className="composer panel" onSubmit={onSend}>
        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.mp3,.mp4,.webm,.mov"
          onChange={(e) => onPickFile(e.target.files)}
        />
        <button
          type="button"
          className="attach-btn"
          aria-label={t.attachFile}
          title={t.attachFile}
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path
              fill="currentColor"
              d="M16.5 6.75v8.25a4.5 4.5 0 1 1-9 0V6a3 3 0 1 1 6 0v8.25a1.5 1.5 0 1 1-3 0V7.5h1.5v6.75a3 3 0 1 0 6 0V6a4.5 4.5 0 1 0-9 0v9a6 6 0 1 0 12 0V6.75H16.5z"
            />
          </svg>
        </button>
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
          placeholder={uploading ? t.uploading : t.typeMessage}
          rows={1}
          enterKeyHint="enter"
          autoComplete="off"
          autoCorrect="on"
          autoCapitalize="sentences"
          disabled={uploading}
        />
        <button
          type="submit"
          className="btn-primary send-btn"
          aria-label={t.send}
          disabled={!canSend}
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

      {viewer && (
        <MediaViewer
          attachment={viewer}
          onClose={() => setViewer(null)}
          closeLabel={t.close}
          openLabel={t.openFile}
        />
      )}
    </div>
  );
}
