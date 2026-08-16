"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The real PDF page, drawn onto a canvas.
 *
 * The designer used to embed the browser's own PDF viewer, which centres the
 * page inside its frame with margins of its own. A box drawn halfway across the
 * *frame* was therefore not halfway across the *page*, and everything printed
 * shifted. Rasterising the page ourselves makes the canvas and the page the
 * same rectangle, so what you draw is where it prints.
 *
 * pdf.js is loaded only in the browser and only when this mounts. If it can't
 * load — an offline worker, a blocked CDN — `onFallback` lets the parent go
 * back to the embedded viewer rather than showing nothing at all.
 */

const PDFJS_VERSION = "4.4.168";
const WORKER_SRC = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/legacy/build/pdf.worker.min.mjs`;

export default function PdfPageCanvas({
  fileUrl,
  page,
  onFallback,
  onPageSize,
}: {
  fileUrl: string;
  page: number;
  onFallback: () => void;
  onPageSize?: (size: { width: number; height: number }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const docRef = useRef<any>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let renderTask: any = null;

    async function draw() {
      try {
        const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = WORKER_SRC;

        if (!docRef.current) {
          docRef.current = await pdfjs.getDocument({ url: fileUrl, isEvalSupported: false }).promise;
        }
        if (cancelled) return;

        const pdf = docRef.current;
        const pageNumber = Math.min(Math.max(1, page), pdf.numPages);
        const pdfPage = await pdf.getPage(pageNumber);
        if (cancelled) return;

        const canvas = canvasRef.current;
        const wrap = wrapRef.current;
        if (!canvas || !wrap) return;

        // Fit the page to the container's width, then draw at the screen's
        // pixel density so the text stays sharp.
        const base = pdfPage.getViewport({ scale: 1 });
        onPageSize?.({ width: base.width, height: base.height });

        const cssWidth = wrap.clientWidth || 800;
        const scale = cssWidth / base.width;
        const viewport = pdfPage.getViewport({ scale });
        const ratio = window.devicePixelRatio || 1;

        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, viewport.width, viewport.height);

        renderTask = pdfPage.render({ canvasContext: ctx, viewport });
        await renderTask.promise;
      } catch {
        if (!cancelled) {
          setError(true);
          onFallback();
        }
      }
    }

    void draw();
    return () => {
      cancelled = true;
      try { renderTask?.cancel(); } catch { /* nothing to undo */ }
    };
    // onFallback / onPageSize are stable callbacks from the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl, page]);

  if (error) return null;

  return (
    <div ref={wrapRef} className="w-full">
      <canvas ref={canvasRef} className="block h-auto w-full" />
    </div>
  );
}
