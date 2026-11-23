// モジュール2付属：ウィンドウ関数フレーム可視化専用 HTML5 Canvas コンポーネント
// iPhone小画面（420px未満）では横スクロールコンテナ内で潰れ防止描画＋フォント自動縮小を適用
import React, { useState, useEffect, useRef } from 'react';
import {
  CANVAS_COLORS,
  CANVAS_FONT_FAMILY,
  CANVAS_MONO_FAMILY,
  setupHiDpiCanvas,
  drawRoundedRect,
  drawCanvasGrid,
  drawFittedText,
  drawPillBadge,
} from '../../utils/canvasHelpers';
import { useCanvasContainerWidth } from '../../utils/useCanvasWidth';

interface Props {
  preset?: 'moving-avg' | 'rank-compare';
}

const MOVING_DATA = [
  { part: 'S01', label: '10/01', val: 120 },
  { part: 'S01', label: '10/02', val: 150 },
  { part: 'S01', label: '10/03', val: 180 },
  { part: 'S01', label: '10/04', val: 90 },
  { part: 'S02', label: '10/01', val: 200 },
  { part: 'S02', label: '10/02', val: 140 },
  { part: 'S02', label: '10/03', val: 260 },
];

const RANK_DATA = [
  { part: '東日本', label: '佐藤', val: 500 },
  { part: '東日本', label: '鈴木', val: 500 },
  { part: '東日本', label: '高橋', val: 420 },
  { part: '西日本', label: '田中', val: 600 },
  { part: '西日本', label: '伊藤', val: 450 },
  { part: '西日本', label: '渡辺', val: 450 },
];

export const WindowFrameCanvas: React.FC<Props> = ({ preset = 'moving-avg' }) => {
  const [mode, setMode] = useState<'moving-avg' | 'rank-compare'>(preset);
  const [activeIdx, setActiveIdx] = useState(2);
  const [playing, setPlaying] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const containerWidth = useCanvasContainerWidth(containerRef, 360);

  useEffect(() => {
    setMode(preset);
    setActiveIdx(0);
  }, [preset]);

  const rows = mode === 'moving-avg' ? MOVING_DATA : RANK_DATA;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % rows.length);
    }, 1100);
    return () => window.clearInterval(timer);
  }, [playing, rows.length]);

  const isCompact = containerWidth < 420;
  const drawWidth = Math.max(containerWidth, isCompact ? 540 : 320);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = drawWidth;
    const height = isCompact ? 236 : 250;
    const ctx = setupHiDpiCanvas(canvas, width, height);
    if (!ctx) return;

    drawCanvasGrid(ctx, width, height, 24);

    const cur = rows[Math.min(activeIdx, rows.length - 1)];

    ctx.fillStyle = CANVAS_COLORS.textMain;
    ctx.font = `700 ${isCompact ? 11 : 12}px ${CANVAS_FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    drawFittedText(
      ctx,
      mode === 'moving-avg'
        ? 'ウィンドウフレーム可視化：ROWS BETWEEN 2 PRECEDING AND CURRENT ROW（直近3行移動平均）'
        : 'パーティション内ランキング可視化：RANK() vs DENSE_RANK() ＆ 部門MAX比較',
      12,
      20,
      width - 24
    );

    const n = rows.length;
    const padX = isCompact ? 10 : 14;
    const gap = isCompact ? 6 : 8;
    const cardW = (width - padX * 2 - gap * (n - 1)) / n;
    const cardTop = 48;
    const cardH = isCompact ? 120 : 128;

    const samePartIdxs = rows
      .map((r, i) => ({ r, i }))
      .filter((x) => x.r.part === cur.part)
      .map((x) => x.i);
    const posInPart = samePartIdxs.indexOf(activeIdx);

    const frameSet = new Set<number>();
    if (mode === 'moving-avg') {
      const startP = Math.max(0, posInPart - 2);
      for (let p = startP; p <= posInPart; p++) {
        frameSet.add(samePartIdxs[p]);
      }
    } else {
      samePartIdxs.forEach((i) => frameSet.add(i));
    }

    rows.forEach((row, i) => {
      const x = padX + i * (cardW + gap);
      const isCur = i === activeIdx;
      const inFrame = frameSet.has(i);
      const inPart = row.part === cur.part;

      const bg = isCur
        ? CANVAS_COLORS.amberSoft
        : inFrame
          ? CANVAS_COLORS.emeraldSoft
          : inPart
            ? CANVAS_COLORS.cyanSoft
            : CANVAS_COLORS.bgPanel;
      const stroke = isCur
        ? CANVAS_COLORS.amber
        : inFrame
          ? CANVAS_COLORS.emerald
          : inPart
            ? CANVAS_COLORS.cyan
            : CANVAS_COLORS.border;

      drawRoundedRect(ctx, x, cardTop, cardW, cardH, 8, bg, stroke, isCur ? 2.2 : 1.3);

      // パーティション境界破線
      if (i > 0 && rows[i - 1].part !== row.part) {
        ctx.save();
        ctx.strokeStyle = CANVAS_COLORS.cyan;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x - gap / 2, cardTop - 8);
        ctx.lineTo(x - gap / 2, cardTop + cardH + 8);
        ctx.stroke();
        ctx.restore();
      }

      ctx.textAlign = 'center';
      ctx.font = `700 10px ${CANVAS_FONT_FAMILY}`;
      ctx.fillStyle = CANVAS_COLORS.cyan;
      drawFittedText(ctx, row.part, x + cardW / 2, cardTop + 18, cardW - 6);

      ctx.font = `600 ${isCompact ? 10 : 11}px ${CANVAS_FONT_FAMILY}`;
      ctx.fillStyle = CANVAS_COLORS.textSub;
      drawFittedText(ctx, row.label, x + cardW / 2, cardTop + 38, cardW - 6);

      ctx.font = `700 ${isCompact ? 13 : 15}px ${CANVAS_MONO_FAMILY}`;
      ctx.fillStyle = CANVAS_COLORS.textMain;
      ctx.fillText(String(row.val), x + cardW / 2, cardTop + 68);

      const tag = isCur ? '現在行★' : inFrame ? 'フレーム内' : '対象外';
      ctx.font = `700 10px ${CANVAS_FONT_FAMILY}`;
      ctx.fillStyle = isCur
        ? CANVAS_COLORS.amber
        : inFrame
          ? CANVAS_COLORS.emerald
          : CANVAS_COLORS.textMuted;
      drawFittedText(ctx, tag, x + cardW / 2, cardTop + (isCompact ? 98 : 104), cardW - 6);
    });

    const frameVals = Array.from(frameSet).map((i) => rows[i].val);
    let summary = '';
    if (mode === 'moving-avg') {
      const avg = (frameVals.reduce((a, b) => a + b, 0) / frameVals.length).toFixed(1);
      const cumVals = samePartIdxs.slice(0, posInPart + 1).map((i) => rows[i].val);
      const cum = cumVals.reduce((a, b) => a + b, 0);
      summary = `現在行[${cur.part} ${cur.label}] → 移動平均(${frameVals.join('+')})/${frameVals.length}=${avg} ／ 累計=${cum}`;
    } else {
      const partRows = samePartIdxs.map((i) => rows[i]);
      const rnk = partRows.findIndex((r) => r.val === cur.val) + 1;
      const drnk = new Set(partRows.filter((r) => r.val > cur.val).map((r) => r.val)).size + 1;
      const maxVal = Math.max(...partRows.map((r) => r.val));
      summary = `現在行[${cur.part} ${cur.label}=${cur.val}] → RANK=${rnk} / DENSE_RANK=${drnk} / 1位差=${maxVal - cur.val}`;
    }

    drawPillBadge(
      ctx,
      summary,
      width / 2,
      height - 26,
      CANVAS_COLORS.bgDarker,
      CANVAS_COLORS.cyan,
      CANVAS_COLORS.textMain,
      isCompact ? 10 : 11
    );
  }, [mode, activeIdx, rows, drawWidth, isCompact]);

  return (
    <div className="ios-group p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-[#1D1D1F]">ウィンドウ関数フレーム可視化</span>
          <div className="inline-flex rounded-[8px] bg-black/[0.06] p-[2px]">
            <button
              type="button"
              onClick={() => {
                setMode('moving-avg');
                setActiveIdx(0);
              }}
              className={`rounded-[6.5px] px-2.5 py-1 text-[11px] font-semibold transition ${
                mode === 'moving-avg'
                  ? 'bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
                  : 'text-[#6E6E73]'
              }`}
            >
              R7秋: 移動平均(ROWS)
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('rank-compare');
                setActiveIdx(0);
              }}
              className={`rounded-[6.5px] px-2.5 py-1 text-[11px] font-semibold transition ${
                mode === 'rank-compare'
                  ? 'bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
                  : 'text-[#6E6E73]'
              }`}
            >
              R6秋: RANK vs DENSE_RANK
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              playing
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-[#007AFF] text-white hover:bg-[#0066D6]'
            }`}
          >
            {playing ? '停止' : '自動再生'}
          </button>
          <button
            type="button"
            onClick={() => setActiveIdx((prev) => (prev + 1) % rows.length)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7]"
          >
            次の行 →
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="w-full overflow-x-auto rounded-lg border border-slate-800 bg-[#0f172a]"
      >
        <canvas ref={canvasRef} className="block" />
      </div>
      {drawWidth > containerWidth && (
        <div className="text-right text-[11px] text-[#6E6E73]">
          左右にスワイプして全体を表示できます
        </div>
      )}
    </div>
  );
};
