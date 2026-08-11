import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Link, useParams } from "react-router-dom";
import {
  api,
  type ChatMessage,
  type MessageAttachment,
  type User,
} from "./api";
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

const SWIPE_TRIGGER = 56;
const SWIPE_MAX = 72;
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

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

function quoteLabel(m: ChatMessage, photo: string, video: string, file: string): string {
  if (m.text?.trim()) return m.text;
  const mime = m.attachment?.mime || "";
  if (isImageMime(mime)) return photo;
  if (isVideoMime(mime)) return video;
  if (m.attachment) return m.attachment.name || file;
  return "";
}

export function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const { t, user, lang } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [other, setOther] = useState<User | null>(null);
  const [pending, setPending] = useState<PendingFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [attachError, setAttachError] = useState("");
  const [otherOnline, setOtherOnline] = useState(false);
  const [peekId, setPeekId] = useState<string | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [viewer, setViewer] = useState<MessageAttachment | null>(null);
  const [peerLastReadAt, setPeerLastReadAt] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [canSendDraft, setCanSendDraft] = useState(false);
  const [swipeUi, setSwipeUi] = useState<{ id: string; dx: number } | null>(
    null
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const otherTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const isTypingRef = useRef(false);
  const focusedRef = useRef(false);
  const pendingRef = useRef(false);
  const otherIdRef = useRef<string | null>(null);
  const sendTypingRef = useRef<(conversationId: string, typing: boolean) => void>(
    () => {}
  );
  const swipeRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    dx: number;
    locked: boolean | null;
    moved: boolean;
  } | null>(null);

  otherIdRef.current = other?.id ?? null;
  pendingRef.current = !!pending;

  useEffect(() => {
    if (!id) return;
    setOtherTyping(false);
    setOtherOnline(false);
    setPeerLastReadAt(null);
    setReplyTo(null);
    setHighlightId(null);
    setSwipeUi(null);
    clearPending();
    Promise.all([api.messages(id), api.conversations()]).then(
      ([msgRes, convRes]) => {
        setMessages(msgRes.messages);
        setPeerLastReadAt(msgRes.peerLastReadAt ?? null);
        const conv = convRes.conversations.find((c) => c.id === id);
        setOther(conv?.otherUser ?? null);
      }
    );
  }, [id]);

  useLayoutEffect(() => {
    const el = streamRef.current;
    if (!el) return;
    // Stay pinned to the latest messages (no smooth scroll jump).
    el.scrollTop = el.scrollHeight;
  }, [id, messages.length, otherTyping]);

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

  const { sendMessage, sendTyping, checkPresence, markRead, connected } =
    useSocket({
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
      onMessagesSeen: (payload) => {
        if (payload.conversationId !== id) return;
        if (payload.userId === user?.id) return;
        setPeerLastReadAt(payload.readAt);
      },
    });

  useEffect(() => {
    if (!other?.id || !connected) return;
    checkPresence(other.id);
  }, [other?.id, connected, checkPresence]);

  useEffect(() => {
    if (!id || !connected || !user) return;

    const mark = () => {
      if (document.visibilityState === "visible") {
        markRead(id);
      }
    };

    mark();
    window.addEventListener("focus", mark);
    document.addEventListener("visibilitychange", mark);
    return () => {
      window.removeEventListener("focus", mark);
      document.removeEventListener("visibilitychange", mark);
    };
  }, [id, connected, user?.id, markRead]);

  // Mark read when new incoming messages arrive while chat is open (without tying to every render).
  useEffect(() => {
    if (!id || !connected || !user) return;
    if (document.visibilityState !== "visible") return;
    markRead(id);
  }, [messages.length, id, connected, user?.id, markRead]);

  sendTypingRef.current = sendTyping;

  function clearPending() {
    setPending((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    pendingRef.current = false;
    if (fileInputRef.current) fileInputRef.current.value = "";
    setCanSendDraft(readDraft().trim().length > 0);
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
    // Keepalive only — avoid socket spam on every keystroke.
    heartbeatRef.current = setInterval(() => {
      if (id && isTypingRef.current) sendTyping(id, true);
    }, 4000);
  }

  function syncTyping(nextText: string, focused: boolean) {
    if (focused && nextText.trim().length > 0) startTyping();
    else stopTyping();
  }

  function resizeComposer() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  function readDraft(): string {
    return inputRef.current?.value ?? "";
  }

  function clearDraft() {
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.style.height = "";
    }
    setCanSendDraft(false);
  }

  function updateSendEnabled(draft: string) {
    const next = draft.trim().length > 0 || pendingRef.current;
    setCanSendDraft((prev) => (prev === next ? prev : next));
  }

  function onPickFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setAttachError("");
    if (file.size > MAX_UPLOAD_BYTES) {
      setAttachError(t.fileTooLarge);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setPending((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return {
        file,
        previewUrl: isImageMime(file.type) ? URL.createObjectURL(file) : "",
      };
    });
    setCanSendDraft(true);
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

    sendMessage(id, caption, attachment, replyTo?.id ?? null);
    clearDraft();
    setReplyTo(null);
    clearPending();
  }

  function onSend(e: FormEvent) {
    e.preventDefault();
    void sendCurrent(readDraft().trim());
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey) return;
    if (e.nativeEvent.isComposing) return;
    const isCoarse = window.matchMedia("(pointer: coarse)").matches;
    if (isCoarse) return;
    e.preventDefault();
    void sendCurrent(readDraft().trim());
  }

  const canSend = canSendDraft && !uploading;

  const lastSeenMineId = (() => {
    if (!peerLastReadAt || !user) return null;
    const readMs = new Date(peerLastReadAt).getTime();
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.senderId !== user.id) continue;
      if (new Date(m.createdAt).getTime() <= readMs) return m.id;
    }
    return null;
  })();

  function beginReply(message: ChatMessage) {
    setReplyTo(message);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function scrollToQuoted(messageId: string) {
    const el = document.getElementById(`msg-${messageId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(messageId);
    window.setTimeout(() => {
      setHighlightId((cur) => (cur === messageId ? null : cur));
    }, 1500);
  }

  function onBubblePointerDown(
    e: ReactPointerEvent<HTMLDivElement>,
    message: ChatMessage
  ) {
    if (e.button !== 0) return;
    swipeRef.current = {
      id: message.id,
      startX: e.clientX,
      startY: e.clientY,
      dx: 0,
      locked: null,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onBubblePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const s = swipeRef.current;
    if (!s || s.id !== e.currentTarget.dataset.msgid) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (s.locked === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      s.locked = Math.abs(dx) > Math.abs(dy);
    }
    if (s.locked !== true) return;
    s.moved = true;
    const next = Math.max(0, Math.min(SWIPE_MAX, dx));
    s.dx = next;
    setSwipeUi({ id: s.id, dx: next });
  }

  function onBubblePointerUp(
    e: ReactPointerEvent<HTMLDivElement>,
    message: ChatMessage
  ) {
    const s = swipeRef.current;
    swipeRef.current = null;
    setSwipeUi(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (s?.moved && s.dx >= SWIPE_TRIGGER) {
      beginReply(message);
      return;
    }
    if (!s?.moved) {
      setPeekId(peekId === message.id ? null : !mineOf(message) ? message.id : null);
    }
  }

  function mineOf(message: ChatMessage) {
    return message.senderId === user?.id;
  }

  function replyAuthorName(senderId: string) {
    if (senderId === user?.id) return t.you;
    return other?.displayName || "…";
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

      <div className="message-stream" ref={streamRef}>
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
          const dx = swipeUi?.id === m.id ? swipeUi.dx : 0;
          const quote = m.replyTo;
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
                className={`bubble-row ${mine ? "mine" : "theirs"}`}
                data-msgid={m.id}
                onPointerDown={(e) => onBubblePointerDown(e, m)}
                onPointerMove={onBubblePointerMove}
                onPointerUp={(e) => onBubblePointerUp(e, m)}
                onPointerCancel={() => {
                  swipeRef.current = null;
                  setSwipeUi(null);
                }}
              >
                <span
                  className={`bubble-reply-hint ${dx > 18 ? "show" : ""}`}
                  aria-hidden="true"
                >
                  ↩
                </span>
                <div
                  id={`msg-${m.id}`}
                  className={`bubble ${mine ? "mine" : "theirs"} ${
                    attachment ? "has-media" : ""
                  } ${highlightId === m.id ? "bubble-flash" : ""}`}
                  style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
                >
                  {quote && (
                    <button
                      type="button"
                      className="bubble-quote"
                      onClick={(e) => {
                        e.stopPropagation();
                        scrollToQuoted(quote.id);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <span className="bubble-quote-accent" aria-hidden="true" />
                      <span className="bubble-quote-copy">
                        <strong>{replyAuthorName(quote.senderId)}</strong>
                        <span>
                          {quote.text ||
                            (quote.attachmentMime &&
                            isImageMime(quote.attachmentMime)
                              ? t.photo
                              : quote.attachmentMime &&
                                  isVideoMime(quote.attachmentMime)
                                ? t.video
                                : quote.attachmentName || t.file)}
                        </span>
                      </span>
                    </button>
                  )}
                  {attachment && isImageMime(attachment.mime) && (
                    <button
                      type="button"
                      className="bubble-image-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewer(attachment);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
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
                      onPointerDown={(e) => e.stopPropagation()}
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
                        onPointerDown={(e) => e.stopPropagation()}
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
                  <div className="bubble-meta">
                    <button
                      type="button"
                      className="bubble-reply-btn"
                      aria-label={t.reply}
                      title={t.reply}
                      onClick={(e) => {
                        e.stopPropagation();
                        beginReply(m);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      ↩
                    </button>
                    <span className="bubble-time">
                      {formatMessageTime(m.createdAt, lang)}
                    </span>
                  </div>
                  {mine && m.id === lastSeenMineId && (
                    <span className="bubble-seen">{t.seen}</span>
                  )}
                </div>
              </div>
            </Fragment>
          );
        })}
        {otherTyping && <TypingCat label={t.typing} />}
        <div ref={bottomRef} />
      </div>

      {replyTo && (
        <div className="reply-dock">
          <button
            type="button"
            className="reply-preview"
            onClick={() => scrollToQuoted(replyTo.id)}
          >
            <span className="reply-preview-accent" aria-hidden="true" />
            <span className="reply-preview-copy">
              <strong>{replyAuthorName(replyTo.senderId)}</strong>
              <span className="reply-preview-snippet">
                {replyTo.attachment && isImageMime(replyTo.attachment.mime) ? (
                  <>
                    <svg
                      className="reply-media-icon"
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      aria-hidden="true"
                    >
                      <path
                        fill="currentColor"
                        d="M20 5h-3.2l-1.2-1.6A2 2 0 0 0 14 2.8H10a2 2 0 0 0-1.6.6L7.2 5H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm-8 12.2A4.2 4.2 0 1 1 16.2 13 4.2 4.2 0 0 1 12 17.2z"
                      />
                    </svg>
                    {t.photo}
                  </>
                ) : replyTo.attachment && isVideoMime(replyTo.attachment.mime) ? (
                  <>
                    <svg
                      className="reply-media-icon"
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      aria-hidden="true"
                    >
                      <path
                        fill="currentColor"
                        d="M17 10.5V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3.5l4 3.5V7l-4 3.5z"
                      />
                    </svg>
                    {t.video}
                  </>
                ) : (
                  quoteLabel(replyTo, t.photo, t.video, t.file) ||
                  t.messageUnavailable
                )}
              </span>
            </span>
            {replyTo.attachment &&
              (isImageMime(replyTo.attachment.mime) ||
                isVideoMime(replyTo.attachment.mime)) && (
                <img
                  className="reply-preview-thumb"
                  src={mediaUrl(replyTo.attachment.url)}
                  alt=""
                />
              )}
          </button>
          <button
            type="button"
            className="reply-preview-close"
            aria-label={t.cancelReply}
            onClick={() => setReplyTo(null)}
          >
            ×
          </button>
        </div>
      )}

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
          defaultValue=""
          onInput={(e) => {
            const next = e.currentTarget.value;
            resizeComposer();
            syncTyping(next, focusedRef.current);
            updateSendEnabled(next);
          }}
          onFocus={() => {
            focusedRef.current = true;
            syncTyping(readDraft(), true);
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
