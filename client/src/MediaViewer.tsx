import { useEffect, useRef } from "react";
import type { MessageAttachment } from "./api";
import { mediaUrl } from "./config";

function isImage(mime: string) {
  return mime.startsWith("image/");
}

function isVideo(mime: string) {
  return mime.startsWith("video/");
}

function isPdf(mime: string, name: string) {
  return mime === "application/pdf" || name.toLowerCase().endsWith(".pdf");
}

type Props = {
  attachment: MessageAttachment;
  onClose: () => void;
  closeLabel: string;
  openLabel: string;
};

export function MediaViewer({
  attachment,
  onClose,
  closeLabel,
  openLabel,
}: Props) {
  const url = mediaUrl(attachment.url);
  const image = isImage(attachment.mime);
  const video = isVideo(attachment.mime);
  const pdf = !image && !video && isPdf(attachment.mime, attachment.name);
  const onCloseRef = useRef(onClose);
  const closedByPopRef = useRef(false);
  onCloseRef.current = onClose;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closedByPopRef.current = false;
    window.history.pushState({ ffcMediaViewer: true }, "");

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    const onPopState = () => {
      closedByPopRef.current = true;
      onCloseRef.current();
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPopState);
      if (
        !closedByPopRef.current &&
        window.history.state &&
        (window.history.state as { ffcMediaViewer?: boolean }).ffcMediaViewer
      ) {
        window.history.back();
      }
    };
  }, []);

  return (
    <div
      className="media-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={attachment.name}
      onClick={() => onClose()}
    >
      <div className="media-viewer-bar" onClick={(e) => e.stopPropagation()}>
        <p className="media-viewer-name">{attachment.name}</p>
        <button
          type="button"
          className="media-viewer-close"
          onClick={() => onClose()}
          aria-label={closeLabel}
        >
          ×
        </button>
      </div>

      <div
        className="media-viewer-stage"
        onClick={(e) => e.stopPropagation()}
      >
        {image && (
          <img className="media-viewer-image" src={url} alt={attachment.name} />
        )}
        {video && (
          <video
            className="media-viewer-video"
            src={url}
            controls
            autoPlay
            playsInline
          />
        )}
        {pdf && (
          <iframe
            className="media-viewer-frame"
            src={url}
            title={attachment.name}
          />
        )}
        {!image && !video && !pdf && (
          <div className="media-viewer-file">
            <p>{attachment.name}</p>
            <a className="btn-primary" href={url} target="_blank" rel="noreferrer">
              {openLabel}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
