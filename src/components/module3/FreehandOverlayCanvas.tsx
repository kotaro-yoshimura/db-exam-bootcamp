// CBT特化①：A4手元メモ用紙の略記お手本Canvas図 ＆ 指/Apple Pencil対応「透明フリーハンド描画オーバーレイCanvas」
// ResizeObserver でタブ切替時・回転時も即座に再描画し、420px未満ではフォント・ノードパディングを自動縮小する
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { CbtPastExam } from '../../types/exam';
import {
  CANVAS_COLORS,
  CANVAS_FONT_FAMILY,
  CANVAS_MONO_FAMILY,
  setupHiDpiCanvas,
  drawRoundedRect,
  drawCardinalityMarker,
  drawCurvedArrow,
  drawFittedText,
  drawPillBadge,
  drawCanvasGrid,
} from '../../utils/canvasHelpers';
import { useCanvasContainerWidth } from '../../utils/useCanvasWidth';

interface Props {
  exam: CbtPastExam;
}

interface Stroke {
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>;
}

const PEN_COLORS = [
  { hex: '#fb7185', name: '赤(重要矢印)' },
  { hex: '#38bdf8', name: '青(主キー)' },
  { hex: '#34d399', name: '緑(外部キー)' },
  { hex: '#f59e0b', name: '黄(注意)' },
  { hex: '#f8fafc', name: '白(メモ)' },
];

export const FreehandOverlayCanvas: React.FC<Props> = ({ exam }) => {
  const [viewMode, setViewMode] = useState<'er' | 'a4memo'>('er');
  const [drawEnabled, setDrawEnabled] = useState(true);
  const [penColor, setPenColor] = useState('#fb7185');
  const [penWidth, setPenWidth] = useState(3);
  const [strokes, setStrokes] = useState<Stroke[]>([]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeStrokeRef = useRef<Stroke | null>(null);
  const isDrawingRef = useRef(false);

  const containerWidth = useCanvasContainerWidth(containerRef, 340);
  const isCompact = containerWidth < 420;
  const canvasHeight = isCompact ? 310 : 330;

  // 問題切替時に描画リセット
  useEffect(() => {
    setStrokes([]);
  }, [exam.id]);

  // 下層Canvas：問題E-R図 または A4手元メモ用紙お手本を描画
  useEffect(() => {
    const canvas = baseCanvasRef.current;
    if (!canvas) return;

    const width = Math.max(280, containerWidth);
    const ctx = setupHiDpiCanvas(canvas, width, canvasHeight);
    if (!ctx) return;

    const titleFont = isCompact ? 10.5 : 12;
    const nodeTitleFont = isCompact ? 10 : 11;
    const attrFont = isCompact ? 9.5 : 10;
    const badgeFont = isCompact ? 8.5 : 9;
    const lineStep = isCompact ? 12 : 14;
    const padInner = isCompact ? 4 : 6;

    if (viewMode === 'er') {
      drawCanvasGrid(ctx, width, canvasHeight, 22);
      ctx.fillStyle = CANVAS_COLORS.textMain;
      ctx.font = `700 ${titleFont}px ${CANVAS_FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      drawFittedText(
        ctx,
        isCompact
          ? `問題図表（${exam.year}）— 指・Pencilで直接書き込み可`
          : `問題図表（${exam.year}）— 上から指・Apple Pencilで直接矢印やメモを描き込めます`,
        10,
        17,
        width - 20
      );

      const boxW = isCompact
        ? Math.min(108, Math.max(82, width * 0.27))
        : Math.min(148, Math.max(96, width * 0.24));

      const nodes = new Map<
        string,
        { cx: number; cy: number; w: number; h: number; e: CbtPastExam['diagramEntities'][number] }
      >();

      exam.diagramEntities.forEach((e) => {
        const lines = e.pkAttrs.length + (e.otherAttrs?.length || 0) + (e.redundantAttrs?.length || 0);
        const h = Math.max(isCompact ? 50 : 60, (isCompact ? 26 : 30) + lines * lineStep);
        const marginX = isCompact ? 6 : 10;
        const cx = Math.max(boxW / 2 + marginX, Math.min(width - boxW / 2 - marginX, e.x * width));
        const cy = Math.max(h / 2 + 32, Math.min(canvasHeight - h / 2 - 8, e.y * canvasHeight));
        nodes.set(e.id, { cx, cy, w: boxW, h, e });
      });

      // リレーションシップ
      exam.diagramRelationships.forEach((rel) => {
        const f = nodes.get(rel.from);
        const t = nodes.get(rel.to);
        if (!f || !t) return;

        const col = rel.isSubtypeEdge ? CANVAS_COLORS.amber : CANVAS_COLORS.cyan;
        if (rel.from === rel.to) {
          const topY = f.cy - f.h / 2;
          ctx.save();
          ctx.strokeStyle = CANVAS_COLORS.emerald;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(f.cx - 18, topY);
          ctx.bezierCurveTo(
            f.cx - 32,
            Math.max(34, topY - 40),
            f.cx + 32,
            Math.max(34, topY - 40),
            f.cx + 18,
            topY
          );
          ctx.stroke();
          ctx.restore();
          if (rel.label) {
            drawPillBadge(
              ctx,
              rel.label,
              f.cx,
              Math.max(36, topY - 30),
              CANVAS_COLORS.emeraldSoft,
              CANVAS_COLORS.emerald,
              CANVAS_COLORS.emerald,
              badgeFont
            );
          }
          return;
        }

        const ang = Math.atan2(t.cy - f.cy, t.cx - f.cx);
        const edgePt = (b: { cx: number; cy: number; w: number; h: number }, a: number) => {
          const c = Math.cos(a);
          const s = Math.sin(a);
          const k = Math.min(
            Math.abs(c) > 0.001 ? b.w / 2 / Math.abs(c) : 999,
            Math.abs(s) > 0.001 ? b.h / 2 / Math.abs(s) : 999
          );
          return { x: b.cx + c * k, y: b.cy + s * k };
        };
        const p1 = edgePt(f, ang);
        const p2 = edgePt(t, ang + Math.PI);

        if (rel.curveOffset) {
          const scaledOffset = isCompact ? rel.curveOffset * 0.72 : rel.curveOffset;
          const mx = (p1.x + p2.x) / 2 - Math.sin(ang) * scaledOffset;
          const my = (p1.y + p2.y) / 2 + Math.cos(ang) * scaledOffset;
          drawCurvedArrow(ctx, p1.x, p1.y, mx, my, p2.x, p2.y, col, 1.6, false, 6);
          if (rel.label) {
            drawPillBadge(
              ctx,
              rel.label,
              (p1.x + 2 * mx + p2.x) / 4,
              (p1.y + 2 * my + p2.y) / 4,
              CANVAS_COLORS.bgDarker,
              col,
              CANVAS_COLORS.textSub,
              badgeFont
            );
          }
        } else {
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
          if (!rel.isSubtypeEdge) {
            drawCardinalityMarker(ctx, p1.x, p1.y, ang, rel.fromCard, col);
            drawCardinalityMarker(ctx, p2.x, p2.y, ang + Math.PI, rel.toCard, col);
          }
          if (rel.label) {
            drawPillBadge(
              ctx,
              rel.label,
              (p1.x + p2.x) / 2,
              (p1.y + p2.y) / 2 - 9,
              CANVAS_COLORS.bgDarker,
              CANVAS_COLORS.borderLight,
              CANVAS_COLORS.textSub,
              badgeFont
            );
          }
        }
      });

      // エンティティ
      nodes.forEach(({ cx, cy, w, h, e }) => {
        const x = cx - w / 2;
        const y = cy - h / 2;
        const hdrH = isCompact ? 19 : 22;
        const border =
          e.kind === 'associative'
            ? CANVAS_COLORS.emerald
            : e.kind === 'supertype' || e.kind === 'subtype'
              ? CANVAS_COLORS.amber
              : CANVAS_COLORS.cyan;
        const hdr =
          e.kind === 'associative'
            ? CANVAS_COLORS.emeraldSoft
            : e.kind === 'supertype' || e.kind === 'subtype'
              ? CANVAS_COLORS.amberSoft
              : CANVAS_COLORS.cyanSoft;
        drawRoundedRect(ctx, x, y, w, h, 7, CANVAS_COLORS.bgPanel, border, 1.5);
        drawRoundedRect(ctx, x + 1, y + 1, w - 2, hdrH, 6, hdr);
        ctx.fillStyle = CANVAS_COLORS.textMain;
        ctx.font = `700 ${nodeTitleFont}px ${CANVAS_FONT_FAMILY}`;
        ctx.textAlign = 'center';
        drawFittedText(ctx, e.name, cx, y + hdrH / 2 + 1, w - padInner * 2);

        let ry = y + hdrH + (isCompact ? 9 : 10);
        ctx.textAlign = 'left';
        ctx.font = `600 ${attrFont}px ${CANVAS_FONT_FAMILY}`;
        e.pkAttrs.forEach((pk) => {
          ctx.fillStyle = pk.includes('(FK)') ? CANVAS_COLORS.amber : CANVAS_COLORS.cyan;
          drawFittedText(ctx, `# ${pk}`, x + padInner, ry, w - padInner * 2);
          ry += lineStep;
        });
        (e.otherAttrs || []).forEach((ot) => {
          ctx.fillStyle = ot.includes('(FK)') ? CANVAS_COLORS.emerald : CANVAS_COLORS.textSub;
          drawFittedText(ctx, ot, x + padInner, ry, w - padInner * 2);
          ry += lineStep - 1;
        });
        (e.redundantAttrs || []).forEach((rd) => {
          ctx.fillStyle = CANVAS_COLORS.amber;
          drawFittedText(ctx, rd, x + padInner, ry, w - padInner * 2);
          ry += lineStep - 1;
        });
      });
    } else {
      // A4手元メモ用紙 略記お手本Canvas
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, canvasHeight);

      const pad = isCompact ? 8 : 12;
      drawRoundedRect(
        ctx,
        pad,
        pad,
        width - pad * 2,
        canvasHeight - pad * 2,
        8,
        '#111827',
        '#475569',
        1.5
      );
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let gx = pad + 20; gx < width - pad; gx += 20) {
        ctx.moveTo(gx, pad);
        ctx.lineTo(gx, canvasHeight - pad);
      }
      for (let gy = pad + 20; gy < canvasHeight - pad; gy += 20) {
        ctx.moveTo(pad, gy);
        ctx.lineTo(width - pad, gy);
      }
      ctx.stroke();

      ctx.fillStyle = CANVAS_COLORS.amber;
      ctx.font = `700 ${titleFont}px ${CANVAS_FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      drawFittedText(
        ctx,
        `CBT本番 A4配布メモ用紙 略記お手本（${exam.year}：最初の5分で書く骨格）`,
        pad + 10,
        pad + 16,
        width - pad * 2 - 20
      );

      const gapQ = isCompact ? 6 : 8;
      const innerW = (width - (pad + 8) * 2 - gapQ) / 2;
      const topStart = pad + 32;
      const innerH = (canvasHeight - topStart - pad - 8 - gapQ) / 2;

      const drawMemoQuadrant = (
        qx: number,
        qy: number,
        title: string,
        color: string,
        lines: string[]
      ) => {
        drawRoundedRect(ctx, qx, qy, innerW, innerH, 7, '#0f172a', color, 1.3);
        ctx.fillStyle = color;
        ctx.font = `700 ${isCompact ? 9.5 : 11}px ${CANVAS_FONT_FAMILY}`;
        ctx.textAlign = 'left';
        drawFittedText(ctx, title, qx + 8, qy + 15, innerW - 16);

        ctx.fillStyle = CANVAS_COLORS.textMain;
        ctx.font = `500 ${isCompact ? 9.5 : 11}px ${CANVAS_MONO_FAMILY}`;
        const rowGap = isCompact ? 18 : 22;
        lines.forEach((ln, i) => {
          const ly = qy + (isCompact ? 32 : 38) + i * rowGap;
          if (ly < qy + innerH - 6) {
            drawFittedText(ctx, `・${ln}`, qx + 8, ly, innerW - 16);
          }
        });
      };

      const leftQ = pad + 8;
      const rightQ = leftQ + innerW + gapQ;
      drawMemoQuadrant(leftQ, topStart, '① エンティティ略記', CANVAS_COLORS.cyan, exam.a4MemoNotes.entities);
      drawMemoQuadrant(rightQ, topStart, '② 多重度・物理メモ', CANVAS_COLORS.emerald, exam.a4MemoNotes.arrows);
      drawMemoQuadrant(leftQ, topStart + innerH + gapQ, '③ 主キー候補 # 整理', CANVAS_COLORS.amber, exam.a4MemoNotes.pkCandidates);
      drawMemoQuadrant(rightQ, topStart + innerH + gapQ, '④ ひっかけ＆NULL注意', CANVAS_COLORS.rose, exam.a4MemoNotes.traps);
    }
  }, [exam, viewMode, containerWidth, canvasHeight, isCompact]);

  // 上層：透明フリーハンドオーバーレイCanvasの再描画
  const redrawOverlay = useCallback(
    (currentList: Stroke[], draft?: Stroke | null) => {
      const canvas = overlayCanvasRef.current;
      if (!canvas) return;
      const width = Math.max(280, containerWidth);
      const ctx = setupHiDpiCanvas(canvas, width, canvasHeight);
      if (!ctx) return;

      ctx.clearRect(0, 0, width, canvasHeight);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const all = draft ? [...currentList, draft] : currentList;
      all.forEach((st) => {
        if (st.points.length < 2) return;
        ctx.strokeStyle = st.color;
        ctx.lineWidth = st.width;
        ctx.beginPath();
        ctx.moveTo(st.points[0].x, st.points[0].y);
        for (let i = 1; i < st.points.length; i++) {
          ctx.lineTo(st.points[i].x, st.points[i].y);
        }
        ctx.stroke();
      });
    },
    [containerWidth, canvasHeight]
  );

  useEffect(() => {
    redrawOverlay(strokes, null);
  }, [strokes, redrawOverlay]);

  const getLocalPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawEnabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const pt = getLocalPoint(e);
    activeStrokeRef.current = {
      color: penColor,
      width: penWidth,
      points: [pt, { x: pt.x + 0.5, y: pt.y + 0.5 }],
    };
    redrawOverlay(strokes, activeStrokeRef.current);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawEnabled || !isDrawingRef.current || !activeStrokeRef.current) return;
    const pt = getLocalPoint(e);
    activeStrokeRef.current.points.push(pt);
    redrawOverlay(strokes, activeStrokeRef.current);
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current || !activeStrokeRef.current) return;
    isDrawingRef.current = false;
    const finished = activeStrokeRef.current;
    activeStrokeRef.current = null;
    setStrokes((prev) => [...prev, finished]);
  };

  return (
    <div className="ios-group p-3.5 space-y-3">
      {/* ツールバー */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-[8px] bg-black/[0.06] p-[2px]">
          <button
            type="button"
            onClick={() => setViewMode('er')}
            className={`rounded-[6.5px] px-2.5 py-1 text-xs font-semibold transition ${
              viewMode === 'er'
                ? 'bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
                : 'text-[#6E6E73]'
            }`}
          >
            問題E-R図
          </button>
          <button
            type="button"
            onClick={() => setViewMode('a4memo')}
            className={`rounded-[6.5px] px-2.5 py-1 text-xs font-semibold transition ${
              viewMode === 'a4memo'
                ? 'bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
                : 'text-[#6E6E73]'
            }`}
          >
            A4メモお手本
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setDrawEnabled((d) => !d)}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              drawEnabled
                ? 'bg-[#007AFF] text-white'
                : 'border border-slate-200 bg-[#F5F5F7] text-[#6E6E73]'
            }`}
          >
            {drawEnabled ? '手書きON' : 'スクロール優先'}
          </button>

          {/* ペン色パレット */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-[#F5F5F7] px-2 py-1">
            {PEN_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                title={c.name}
                onClick={() => {
                  setPenColor(c.hex);
                  setDrawEnabled(true);
                }}
                className={`h-4 w-4 rounded-full border border-black/20 transition ${
                  penColor === c.hex ? 'ring-2 ring-[#007AFF] scale-110' : 'opacity-75'
                }`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>

          <select
            value={penWidth}
            onChange={(e) => setPenWidth(Number(e.target.value))}
            aria-label="ペンの太さ"
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-base md:text-sm text-[#1D1D1F]"
          >
            <option value={2}>細</option>
            <option value={3}>中</option>
            <option value={5}>太</option>
          </select>

          <button
            type="button"
            disabled={strokes.length === 0}
            onClick={() => setStrokes((prev) => prev.slice(0, -1))}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-[#6E6E73] hover:bg-[#F5F5F7] disabled:opacity-40"
          >
            戻す
          </button>
          <button
            type="button"
            disabled={strokes.length === 0}
            onClick={() => setStrokes([])}
            className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 disabled:opacity-40"
          >
            全消去
          </button>
        </div>
      </div>

      {/* 下層図解Canvas ＋ 上層透明フリーハンドオーバーレイCanvas */}
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-lg border border-slate-800 bg-[#0f172a]"
        style={{ height: `${canvasHeight}px` }}
      >
        <canvas ref={baseCanvasRef} className="block w-full h-full" />
        <canvas
          ref={overlayCanvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`absolute inset-0 block w-full h-full ${
            drawEnabled ? 'cursor-crosshair touch-none' : 'pointer-events-none'
          }`}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#6E6E73]">
        <span>Apple Pencilや指で、図表上に直接矢印・複合キー・NULL注記を書き込めます。</span>
        <span className="font-mono tabular-nums">ストローク：{strokes.length}画</span>
      </div>
    </div>
  );
};
