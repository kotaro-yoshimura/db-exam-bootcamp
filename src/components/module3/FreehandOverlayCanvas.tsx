// CBT特化①：A4手元メモ用紙の略記お手本Canvas図 ＆ 指/Apple Pencil対応「透明フリーハンド描画オーバーレイCanvas」
import React, { useState, useEffect, useRef } from 'react';
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
  const [tick, setTick] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeStrokeRef = useRef<Stroke | null>(null);
  const isDrawingRef = useRef(false);

  // 問題切替時に描画リセット
  useEffect(() => {
    setStrokes([]);
  }, [exam.id]);

  useEffect(() => {
    const onResize = () => setTick((t) => t + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const canvasHeight = 330;

  // 下層Canvas：問題E-R図 または A4手元メモ用紙お手本を描画
  useEffect(() => {
    const canvas = baseCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = Math.max(300, container.clientWidth);
    const ctx = setupHiDpiCanvas(canvas, width, canvasHeight);
    if (!ctx) return;

    if (viewMode === 'er') {
      drawCanvasGrid(ctx, width, canvasHeight, 22);
      ctx.fillStyle = CANVAS_COLORS.textMain;
      ctx.font = `700 12px ${CANVAS_FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`問題図表（${exam.year}）— 上から指・Apple Pencilで直接矢印やメモを描き込めます`, 12, 18);

      const boxW = Math.min(148, Math.max(96, width * 0.24));
      const nodes = new Map<
        string,
        { cx: number; cy: number; w: number; h: number; e: CbtPastExam['diagramEntities'][number] }
      >();

      exam.diagramEntities.forEach((e) => {
        const lines = e.pkAttrs.length + (e.otherAttrs?.length || 0) + (e.redundantAttrs?.length || 0);
        const h = Math.max(60, 30 + lines * 14);
        const cx = Math.max(boxW / 2 + 10, Math.min(width - boxW / 2 - 10, e.x * width));
        const cy = Math.max(h / 2 + 34, Math.min(canvasHeight - h / 2 - 10, e.y * canvasHeight));
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
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(f.cx - 22, topY);
          ctx.bezierCurveTo(f.cx - 38, Math.max(36, topY - 46), f.cx + 38, Math.max(36, topY - 46), f.cx + 22, topY);
          ctx.stroke();
          ctx.restore();
          if (rel.label) {
            drawPillBadge(ctx, rel.label, f.cx, Math.max(38, topY - 34), CANVAS_COLORS.emeraldSoft, CANVAS_COLORS.emerald, CANVAS_COLORS.emerald, 9);
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
          const mx = (p1.x + p2.x) / 2 - Math.sin(ang) * rel.curveOffset;
          const my = (p1.y + p2.y) / 2 + Math.cos(ang) * rel.curveOffset;
          drawCurvedArrow(ctx, p1.x, p1.y, mx, my, p2.x, p2.y, col, 1.8, false, 7);
          if (rel.label) {
            drawPillBadge(ctx, rel.label, (p1.x + 2 * mx + p2.x) / 4, (p1.y + 2 * my + p2.y) / 4, CANVAS_COLORS.bgDarker, col, CANVAS_COLORS.textSub, 9);
          }
        } else {
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
          if (!rel.isSubtypeEdge) {
            drawCardinalityMarker(ctx, p1.x, p1.y, ang, rel.fromCard, col);
            drawCardinalityMarker(ctx, p2.x, p2.y, ang + Math.PI, rel.toCard, col);
          }
          if (rel.label) {
            drawPillBadge(ctx, rel.label, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2 - 10, CANVAS_COLORS.bgDarker, CANVAS_COLORS.borderLight, CANVAS_COLORS.textSub, 9);
          }
        }
      });

      // エンティティ
      nodes.forEach(({ cx, cy, w, h, e }) => {
        const x = cx - w / 2;
        const y = cy - h / 2;
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
        drawRoundedRect(ctx, x, y, w, h, 7, CANVAS_COLORS.bgPanel, border, 1.6);
        drawRoundedRect(ctx, x + 1, y + 1, w - 2, 22, 6, hdr);
        ctx.fillStyle = CANVAS_COLORS.textMain;
        ctx.font = `700 11px ${CANVAS_FONT_FAMILY}`;
        ctx.textAlign = 'center';
        drawFittedText(ctx, e.name, cx, y + 12, w - 10);

        let ry = y + 32;
        ctx.textAlign = 'left';
        ctx.font = `600 10px ${CANVAS_FONT_FAMILY}`;
        e.pkAttrs.forEach((pk) => {
          ctx.fillStyle = pk.includes('(FK)') ? CANVAS_COLORS.amber : CANVAS_COLORS.cyan;
          drawFittedText(ctx, `# ${pk}`, x + 6, ry, w - 12);
          ry += 14;
        });
        (e.otherAttrs || []).forEach((ot) => {
          ctx.fillStyle = ot.includes('(FK)') ? CANVAS_COLORS.emerald : CANVAS_COLORS.textSub;
          drawFittedText(ctx, ot, x + 6, ry, w - 12);
          ry += 13;
        });
        (e.redundantAttrs || []).forEach((rd) => {
          ctx.fillStyle = CANVAS_COLORS.amber;
          drawFittedText(ctx, rd, x + 6, ry, w - 12);
          ry += 13;
        });
      });
    } else {
      // A4手元メモ用紙 略記お手本Canvas（CBT本番試験配布A4用紙の書き方見本）
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, canvasHeight);

      // A4用紙風のダークブルー方眼シート
      const pad = 12;
      drawRoundedRect(ctx, pad, pad, width - pad * 2, canvasHeight - pad * 2, 10, '#111827', '#475569', 1.6);
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

      // ヘッダ
      ctx.fillStyle = CANVAS_COLORS.amber;
      ctx.font = `700 12px ${CANVAS_FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`CBT本番 A4配布メモ用紙 略記お手本（${exam.year}：最初の5分で書く骨格）`, 24, 30);

      // 4象限にA4メモ構成を配置
      const innerW = (width - 56) / 2;
      const innerH = (canvasHeight - 76) / 2;

      const drawMemoQuadrant = (
        qx: number,
        qy: number,
        title: string,
        color: string,
        lines: string[]
      ) => {
        drawRoundedRect(ctx, qx, qy, innerW, innerH, 8, '#0f172a', color, 1.4);
        ctx.fillStyle = color;
        ctx.font = `700 11px ${CANVAS_FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.fillText(title, qx + 10, qy + 18);

        ctx.fillStyle = CANVAS_COLORS.textMain;
        ctx.font = `500 11px ${CANVAS_MONO_FAMILY}`;
        lines.forEach((ln, i) => {
          const ly = qy + 38 + i * 22;
          if (ly < qy + innerH - 8) {
            drawFittedText(ctx, `・${ln}`, qx + 10, ly, innerW - 20);
          }
        });
      };

      drawMemoQuadrant(24, 48, '① エンティティ略記（左上）', CANVAS_COLORS.cyan, exam.a4MemoNotes.entities);
      drawMemoQuadrant(32 + innerW, 48, '② 多重度矢印・物理メモ（右上）', CANVAS_COLORS.emerald, exam.a4MemoNotes.arrows);
      drawMemoQuadrant(24, 56 + innerH, '③ 主キー候補 # 整理（左下）', CANVAS_COLORS.amber, exam.a4MemoNotes.pkCandidates);
      drawMemoQuadrant(32 + innerW, 56 + innerH, '④ ひっかけ＆NULL注意（右下）', CANVAS_COLORS.rose, exam.a4MemoNotes.traps);
    }
  }, [exam, viewMode, tick]);

  // 上層：透明フリーハンドオーバーレイCanvasの再描画
  const redrawOverlay = (currentList: Stroke[], draft?: Stroke | null) => {
    const canvas = overlayCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const width = Math.max(300, container.clientWidth);
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
  };

  useEffect(() => {
    redrawOverlay(strokes, null);
  }, [strokes, tick]);

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
    <div className="rounded-lg border border-[#e4e4e0] bg-white p-3.5 space-y-3">
      {/* ツールバー */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-md border border-[#d4d4d0] bg-[#f1f1ee] p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('er')}
            className={`rounded px-2.5 py-1 text-xs font-semibold ${
              viewMode === 'er' ? 'bg-white text-[#18181b] shadow-xs' : 'text-[#52525b]'
            }`}
          >
            問題E-R図
          </button>
          <button
            type="button"
            onClick={() => setViewMode('a4memo')}
            className={`rounded px-2.5 py-1 text-xs font-semibold ${
              viewMode === 'a4memo' ? 'bg-white text-[#18181b] shadow-xs' : 'text-[#52525b]'
            }`}
          >
            A4手元メモ略記お手本
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setDrawEnabled((d) => !d)}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
              drawEnabled
                ? 'bg-[#18181b] text-white'
                : 'border border-[#d4d4d0] bg-[#f6f6f4] text-[#52525b]'
            }`}
          >
            {drawEnabled ? '手書きON' : 'スクロール優先'}
          </button>

          {/* ペン色パレット */}
          <div className="flex items-center gap-1 rounded-md border border-[#d4d4d0] bg-[#f6f6f4] px-2 py-1">
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
                  penColor === c.hex ? 'ring-2 ring-[#18181b] scale-110' : 'opacity-75'
                }`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>

          <select
            value={penWidth}
            onChange={(e) => setPenWidth(Number(e.target.value))}
            className="rounded-md border border-[#d4d4d0] bg-white px-2 py-1 text-xs text-[#18181b]"
          >
            <option value={2}>細</option>
            <option value={3}>中</option>
            <option value={5}>太</option>
          </select>

          <button
            type="button"
            disabled={strokes.length === 0}
            onClick={() => setStrokes((prev) => prev.slice(0, -1))}
            className="rounded-md border border-[#d4d4d0] bg-white px-2.5 py-1 text-xs font-medium text-[#52525b] hover:bg-[#f1f1ee] disabled:opacity-40"
          >
            戻す
          </button>
          <button
            type="button"
            disabled={strokes.length === 0}
            onClick={() => setStrokes([])}
            className="rounded-md border border-[#fecdd3] bg-[#fff1f2] px-2.5 py-1 text-xs font-medium text-[#be123c] disabled:opacity-40"
          >
            全消去
          </button>
        </div>
      </div>

      {/* 下層図解Canvas ＋ 上層透明フリーハンドオーバーレイCanvas */}
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-md border border-[#1e293b] bg-[#0f172a]"
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

      <div className="flex flex-wrap items-center justify-between text-[11px] text-[#71717a]">
        <span>Apple Pencilや指で、図表上に直接矢印・複合キー・NULL注記を書き込めます。</span>
        <span className="font-mono">ストローク：{strokes.length}画</span>
      </div>
    </div>
  );
};
