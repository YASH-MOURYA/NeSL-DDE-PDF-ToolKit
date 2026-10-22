import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import Icon from "./Icon.jsx";

// PDF.js draws the pages itself, so the preview does not depend on the browser's built-in PDF viewer
// (which is missing or blocked in many embedded browsers, phones and managed work machines).
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const ASSETS = `${import.meta.env.BASE_URL}pdfjs/`;
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const PAD = 24; // space around the pages inside the scroll area
const MAX_FIT = 860; // widest a page gets at 100%, so pages stay comfortable on large screens
const MAX_PIXELS = 16_000_000; // keeps one canvas from growing too large when zoomed in

const stepZoom = (zoom, direction) => {
  const nearest = ZOOM_STEPS.reduce((best, step, i) => (Math.abs(step - zoom) < Math.abs(ZOOM_STEPS[best] - zoom) ? i : best), 0);
  return ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, nearest + direction))];
};

function Page({ page, size, scale, root, index, register }) {
  const hostRef = useRef(null);
  const [near, setNear] = useState(index < 3);

  // Only pages close to the visible area are drawn; far pages are cleared to save memory.
  useEffect(() => {
    if (!root) return undefined;
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), {
      root,
      rootMargin: "900px 0px",
    });
    observer.observe(hostRef.current);
    return () => observer.disconnect();
  }, [root]);

  useEffect(() => {
    const host = hostRef.current;
    if (!near) {
      host.replaceChildren();
      return undefined;
    }
    let off = false;
    let task;
    (async () => {
      const viewport = page.getViewport({ scale });
      const ratio = Math.max(1, Math.min(window.devicePixelRatio || 1, Math.sqrt(MAX_PIXELS / (viewport.width * viewport.height))));
      // A fresh canvas per render avoids "same canvas used twice" errors when zooming quickly.
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.cssText = "display:block;width:100%;height:100%";
      task = page.render({ canvas, viewport, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined });
      try {
        await task.promise;
        if (!off) host.replaceChildren(canvas);
      } catch (error) {
        if (error?.name !== "RenderingCancelledException") console.error("PDF render error:", error);
      }
    })();
    return () => {
      off = true;
      task?.cancel();
    };
  }, [near, page, scale]);

  return (
    <div
      ref={(el) => {
        hostRef.current = el;
        register(index, el);
      }}
      className="pdf-page"
      style={{ width: Math.floor(size.w * scale), height: Math.floor(size.h * scale) }}
      aria-label={`Page ${index + 1}`}
    />
  );
}

/**
 * Large centred preview over a blurred page.
 * Props: title, subtitle, bytes, onClose, onDownload, blockedReason (text shown when download is not allowed yet).
 */
export default function PdfViewer({ title, subtitle, bytes, onClose, onDownload, blockedReason = "" }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const pressedBackdrop = useRef(false);
  const pageEls = useRef([]);
  const lockUntil = useRef(0);
  const currentRef = useRef(1);

  const [scroller, setScroller] = useState(null);
  const [boxWidth, setBoxWidth] = useState(0);
  const [loaded, setLoaded] = useState({ status: "loading", pages: [], sizes: [], message: "" });
  const [zoom, setZoom] = useState(1);
  const [current, setCurrent] = useState(1);
  const [draft, setDraft] = useState("1");
  const [editing, setEditing] = useState(false);

  const total = loaded.pages.length;

  // ---------- open as a modal dialog: focus trap, Esc to close and a blurred backdrop come from the browser ----------
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // ---------- load the PDF ----------
  useEffect(() => {
    let off = false;
    setLoaded({ status: "loading", pages: [], sizes: [], message: "" });
    // slice(): PDF.js transfers the buffer to its worker, which would empty our copy.
    const task = pdfjs.getDocument({
      data: bytes.slice(),
      cMapUrl: `${ASSETS}cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${ASSETS}standard_fonts/`,
      wasmUrl: `${ASSETS}wasm/`,
      iccUrl: `${ASSETS}iccs/`,
    });
    (async () => {
      try {
        const pdf = await task.promise;
        const pages = await Promise.all(Array.from({ length: pdf.numPages }, (_, i) => pdf.getPage(i + 1)));
        if (off) return;
        const sizes = pages.map((page) => {
          const view = page.getViewport({ scale: 1 });
          return { w: view.width, h: view.height };
        });
        setLoaded({ status: "ready", pages, sizes, message: "" });
      } catch (error) {
        if (off) return;
        console.error("PDF load error:", error);
        setLoaded({
          status: "error",
          pages: [],
          sizes: [],
          message:
            error?.name === "PasswordException"
              ? "This PDF is password protected, so it cannot be previewed."
              : "This PDF could not be displayed.",
        });
      }
    })();
    return () => {
      off = true;
      task.destroy();
    };
  }, [bytes]);

  // ---------- size: fit to width, then zoom ----------
  useEffect(() => {
    if (!scroller) return undefined;
    const observer = new ResizeObserver(() => setBoxWidth(scroller.clientWidth));
    observer.observe(scroller);
    setBoxWidth(scroller.clientWidth);
    return () => observer.disconnect();
  }, [scroller]);

  const widest = loaded.sizes.reduce((max, s) => Math.max(max, s.w), 0);
  const fit = widest && boxWidth ? Math.max(0.2, Math.min(boxWidth - PAD * 2, MAX_FIT) / widest) : 1;
  const scale = fit * zoom;

  // ---------- page navigation ----------
  const register = useCallback((index, el) => {
    pageEls.current[index] = el;
  }, []);

  const goTo = useCallback(
    (value) => {
      const number = Math.max(1, Math.min(total, Math.round(Number(value))));
      const el = pageEls.current[number - 1];
      if (!total || Number.isNaN(number) || !scroller || !el) return;
      lockUntil.current = performance.now() + 400; // ignore scroll events caused by this jump
      scroller.scrollTo({ top: number === 1 ? 0 : Math.max(0, el.offsetTop - PAD / 2), behavior: "auto" });
      currentRef.current = number;
      setCurrent(number);
      setDraft(String(number));
    },
    [total, scroller]
  );

  // follow the scroll position to show which page is in view
  useEffect(() => {
    if (!scroller || loaded.status !== "ready") return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (performance.now() < lockUntil.current) return;
      const line = scroller.scrollTop + scroller.clientHeight * 0.4;
      let found = 1;
      for (let i = 0; i < pageEls.current.length; i++) {
        if (pageEls.current[i] && pageEls.current[i].offsetTop <= line) found = i + 1;
        else break;
      }
      currentRef.current = found;
      setCurrent(found);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [scroller, loaded.status]);

  useEffect(() => {
    if (!editing) setDraft(String(Math.min(current, total || 1)));
  }, [current, total, editing]);

  // keep the same page in view when the zoom or window size changes
  useLayoutEffect(() => {
    if (loaded.status === "ready") goTo(currentRef.current);
  }, [scale]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loaded.status === "ready") scroller?.focus({ preventScroll: true });
  }, [loaded.status, scroller]);

  function onKeyDown(event) {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === "ArrowRight") { event.preventDefault(); goTo(currentRef.current + 1); }
    else if (event.key === "ArrowLeft") { event.preventDefault(); goTo(currentRef.current - 1); }
    else if (event.key === "+" || event.key === "=") setZoom((z) => stepZoom(z, 1));
    else if (event.key === "-") setZoom((z) => stepZoom(z, -1));
  }

  const ready = loaded.status === "ready";

  return (
    <dialog
      ref={dialogRef}
      className="viewer-dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onMouseDown={(e) => { pressedBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (pressedBackdrop.current && e.target === e.currentTarget) onClose(); }}
    >
      <div className="viewer-panel" onKeyDown={onKeyDown}>
        <header className="viewer-head">
          <div className="viewer-title">
            <strong id={titleId}>{title}</strong>
            {subtitle && <span title={subtitle}>{subtitle}</span>}
          </div>
          <div className="viewer-actions">
            {blockedReason && <span className="viewer-hint">{blockedReason}</span>}
            {onDownload && (
              <button type="button" className="btn btn-primary" onClick={onDownload} disabled={Boolean(blockedReason)}>
                <Icon name="download" /> Download
              </button>
            )}
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close preview">
              <Icon name="close" />
            </button>
          </div>
        </header>

        <div className="viewer-bar">
          <div className="pager" role="group" aria-label="Page navigation">
            <button type="button" className="icon-btn" onClick={() => goTo(current - 1)} disabled={!ready || current <= 1} aria-label="Previous page">
              <Icon name="up" />
            </button>
            <span className="pager-field">
              Page
              <input
                inputMode="numeric"
                value={draft}
                disabled={!ready}
                aria-label="Go to page"
                onFocus={(e) => { setEditing(true); e.target.select(); }}
                onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
                onBlur={() => { setEditing(false); setDraft(String(current)); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { goTo(draft); e.currentTarget.blur(); }
                  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); e.currentTarget.blur(); }
                }}
              />
              of {total || "-"}
            </span>
            <button type="button" className="icon-btn" onClick={() => goTo(current + 1)} disabled={!ready || current >= total} aria-label="Next page">
              <Icon name="down" />
            </button>
          </div>

          <div className="zoom" role="group" aria-label="Zoom">
            <button type="button" className="icon-btn" onClick={() => setZoom((z) => stepZoom(z, -1))} disabled={!ready} aria-label="Zoom out">
              <Icon name="minus" />
            </button>
            <button type="button" className="zoom-value" onClick={() => setZoom(1)} disabled={!ready} title="Reset zoom">
              {Math.round(zoom * 100)}%
            </button>
            <button type="button" className="icon-btn" onClick={() => setZoom((z) => stepZoom(z, 1))} disabled={!ready} aria-label="Zoom in">
              <Icon name="plus" />
            </button>
          </div>
          <span className="viewer-keys">Left and right arrow keys change page. Esc closes.</span>
        </div>

        <div className="viewer-scroll" ref={setScroller} tabIndex={0}>
          {loaded.status === "loading" && (
            <div className="viewer-state"><span className="spinner" aria-hidden="true" />Loading preview</div>
          )}
          {loaded.status === "error" && <div className="viewer-state">{loaded.message}</div>}
          {ready && (
            <div className="pdf-pages">
              {loaded.pages.map((page, i) => (
                <Page key={i} page={page} size={loaded.sizes[i]} scale={scale} root={scroller} index={i} register={register} />
              ))}
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
