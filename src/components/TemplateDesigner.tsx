"use client";
import { useCallback, useRef, useState } from "react";
import { TEMPLATE_FIELDS, isImageField } from "@/lib/templateFields";
import { saveTemplateFields } from "@/app/(app)/events/templateActions";

type Box = {
  id: string;
  field_key: string;
  page: number;
  x: number; y: number; width: number; height: number;
  font_size: number;
  align: "left" | "center" | "right";
};

/**
 * Drag boxes onto a preview of the uploaded PDF and say what goes in each.
 *
 * Positions are kept as fractions of the page (0..1, origin top-left) so the
 * preview can render at any size and still describe the same spot on the real
 * page. The server flips y when it stamps the values on.
 */
export default function TemplateDesigner({
  templateId,
  eventId,
  pageCount,
  pageWidth,
  pageHeight,
  initialFields,
}: {
  templateId: string;
  eventId: string;
  pageCount: number;
  pageWidth: number;
  pageHeight: number;
  initialFields: Box[];
}) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [page, setPage] = useState(1);
  const [boxes, setBoxes] = useState<Box[]>(initialFields);
  const [selected, setSelected] = useState<string | null>(null);
  const [drawing, setDrawing] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [status, setStatus] = useState<string>("");

  // The page is shown in the browser's own PDF viewer rather than a JavaScript
  // renderer — no extra dependency, and every browser already does this well.
  // The container is locked to the page's aspect ratio and the viewer is asked
  // to fit the page, so the overlay lines up with what's underneath.
  const aspect = pageWidth > 0 && pageHeight > 0 ? pageWidth / pageHeight : 595.28 / 841.89;

  const rect = () => surfaceRef.current?.getBoundingClientRect();

  const toFraction = useCallback((clientX: number, clientY: number) => {
    const r = rect();
    if (!r) return { x: 0, y: 0 };
    return {
      x: Math.min(Math.max((clientX - r.left) / r.width, 0), 1),
      y: Math.min(Math.max((clientY - r.top) / r.height, 0), 1),
    };
  }, []);

  function onMouseDown(e: React.MouseEvent) {
    if ((e.target as HTMLElement).dataset.box) return; // clicking an existing box selects it
    const start = toFraction(e.clientX, e.clientY);
    setSelected(null);
    setDrawing({ x: start.x, y: start.y, w: 0, h: 0 });

    const move = (ev: MouseEvent) => {
      const now = toFraction(ev.clientX, ev.clientY);
      setDrawing({
        x: Math.min(start.x, now.x), y: Math.min(start.y, now.y),
        w: Math.abs(now.x - start.x), h: Math.abs(now.y - start.y),
      });
    };
    const up = (ev: MouseEvent) => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      const end = toFraction(ev.clientX, ev.clientY);
      const box = {
        x: Math.min(start.x, end.x), y: Math.min(start.y, end.y),
        width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y),
      };
      setDrawing(null);
      if (box.width < 0.02 || box.height < 0.008) return; // ignore stray clicks
      const id = `b${Date.now()}${Math.random().toString(16).slice(2, 6)}`;
      setBoxes((prev) => [...prev, { id, field_key: TEMPLATE_FIELDS[0].key, page, font_size: 11, align: "left", ...box }]);
      setSelected(id);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  function update(id: string, patch: Partial<Box>) {
    setBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function nudge(id: string, dx: number, dy: number) {
    setBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, x: clamp(b.x + dx), y: clamp(b.y + dy) } : b)));
  }

  const current = boxes.find((b) => b.id === selected) ?? null;
  const onPage = boxes.filter((b) => b.page === page);

  async function save() {
    setStatus("Saving...");
    const fd = new FormData();
    fd.set("templateId", templateId);
    fd.set("eventId", eventId);
    fd.set("fields", JSON.stringify(boxes.map(({ id, ...rest }) => rest)));
    try {
      await saveTemplateFields(fd);
      setStatus(`Saved ${boxes.length} field${boxes.length === 1 ? "" : "s"}.`);
    } catch {
      setStatus("Could not save. Please try again.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-secondary !px-3 !py-1.5 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous page</button>
        <span className="text-sm text-gray-600">Page {page} of {pageCount}</span>
        <button type="button" className="btn-secondary !px-3 !py-1.5 text-xs" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>Next page</button>
        <span className="ml-auto text-sm text-gray-500">{boxes.length} field{boxes.length === 1 ? "" : "s"} placed</span>
        <button type="button" className="btn-primary" onClick={save}>Save layout</button>
      </div>

      <p className="text-sm text-gray-500">
        Drag on the page to draw a box, then choose what belongs in it. Drag a box to move it, or use the arrow buttons for fine adjustment.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="overflow-hidden rounded-md border border-gray-200 bg-gray-50">
          <div className="relative w-full" style={{ aspectRatio: String(aspect) }}>
            <iframe
              key={`${templateId}-${page}`}
              title="Form template preview"
              src={`/api/templates/${templateId}/file#page=${page}&toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
              className="absolute inset-0 h-full w-full border-0"
            />
            {/* Transparent layer above the viewer catches the drawing gestures. */}
            <div
              ref={surfaceRef}
              className="absolute inset-0 select-none"
              onMouseDown={onMouseDown}
              style={{ cursor: "crosshair" }}
            >
              {onPage.map((b) => (
                <div
                  key={b.id}
                  data-box="1"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setSelected(b.id);
                    const startPoint = toFraction(e.clientX, e.clientY);
                    const origin = { x: b.x, y: b.y };
                    const move = (ev: MouseEvent) => {
                      const now = toFraction(ev.clientX, ev.clientY);
                      update(b.id, { x: clamp(origin.x + (now.x - startPoint.x)), y: clamp(origin.y + (now.y - startPoint.y)) });
                    };
                    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
                    window.addEventListener("mousemove", move);
                    window.addEventListener("mouseup", up);
                  }}
                  className={`absolute flex items-center overflow-hidden rounded-sm border-2 px-1 text-[10px] ${
                    selected === b.id ? "border-brand-600 bg-brand-600/30" : "border-brand-400/80 bg-brand-400/20"
                  }`}
                  style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.width * 100}%`, height: `${b.height * 100}%`, cursor: "move" }}
                  title={labelFor(b.field_key)}
                >
                  <span className="truncate text-brand-900">{isImageField(b.field_key) ? "✎ " : ""}{labelFor(b.field_key)}</span>
                </div>
              ))}

              {drawing && (
                <div
                  className="pointer-events-none absolute rounded-sm border-2 border-dashed border-brand-600 bg-brand-600/10"
                  style={{ left: `${drawing.x * 100}%`, top: `${drawing.y * 100}%`, width: `${drawing.w * 100}%`, height: `${drawing.h * 100}%` }}
                />
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-900">Selected field</h3>
            {!current ? (
              <p className="mt-2 text-sm text-gray-500">Draw a box on the page, or click one to edit it.</p>
            ) : (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="label text-xs">Contents</label>
                  <select className="input" value={current.field_key} onChange={(e) => update(current.id, { field_key: e.target.value })}>
                    {groupedFields().map(([group, items]) => (
                      <optgroup key={group} label={group}>
                        {items.map((f) => (<option key={f.key} value={f.key}>{f.label}</option>))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                {isImageField(current.field_key) && (
                  <p className="rounded-md border border-brand-200 bg-brand-50 px-2 py-1.5 text-xs text-brand-800">
                    Whatever the participant draws on their signing link is scaled to fit this box, keeping its shape.
                    Draw the box over the signature line on the form.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {!isImageField(current.field_key) && (
                    <div>
                      <label className="label text-xs">Text size</label>
                      <input type="number" min={5} max={48} className="input" value={current.font_size}
                        onChange={(e) => update(current.id, { font_size: Number(e.target.value) || 11 })} />
                    </div>
                  )}
                  <div>
                    <label className="label text-xs">Align</label>
                    <select className="input" value={current.align} onChange={(e) => update(current.id, { align: e.target.value as Box["align"] })}>
                      <option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option>
                    </select>
                  </div>
                </div>
                <div>
                  <span className="label text-xs">Nudge</span>
                  <div className="flex flex-wrap gap-1">
                    <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={() => nudge(current.id, -0.002, 0)}>←</button>
                    <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={() => nudge(current.id, 0.002, 0)}>→</button>
                    <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={() => nudge(current.id, 0, -0.002)}>↑</button>
                    <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={() => nudge(current.id, 0, 0.002)}>↓</button>
                  </div>
                </div>
                <button type="button" className="text-sm font-medium text-red-600 hover:underline"
                  onClick={() => { setBoxes((prev) => prev.filter((b) => b.id !== current.id)); setSelected(null); }}>
                  Remove this field
                </button>
              </div>
            )}
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-900">Fields on this page</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {onPage.map((b) => (
                <li key={b.id}>
                  <button type="button" className={`text-left hover:underline ${selected === b.id ? "font-semibold text-brand-700" : "text-gray-700"}`} onClick={() => setSelected(b.id)}>
                    {labelFor(b.field_key)}
                  </button>
                </li>
              ))}
              {onPage.length === 0 && <li className="text-gray-400">Nothing placed yet.</li>}
            </ul>
          </div>

          {status && <p className="text-sm text-gray-600">{status}</p>}
        </div>
      </div>
    </div>
  );
}

function clamp(v: number) { return Math.min(Math.max(v, 0), 1); }
function labelFor(key: string) { return TEMPLATE_FIELDS.find((f) => f.key === key)?.label ?? key; }
function groupedFields(): [string, typeof TEMPLATE_FIELDS][] {
  const groups = new Map<string, typeof TEMPLATE_FIELDS>();
  for (const f of TEMPLATE_FIELDS) {
    if (!groups.has(f.group)) groups.set(f.group, [] as unknown as typeof TEMPLATE_FIELDS);
    (groups.get(f.group) as any).push(f);
  }
  return Array.from(groups.entries());
}
