// モジュール2付属：ウィンドウ関数フレーム可視化専用 HTML5 Canvas コンポーネント
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
  const [tick, setTick] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const onResize = () => setTick((t) => t + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = Math.max(300, container.clientWidth);
    const height = 250;
    const ctx = setupHiDpiCanvas(canvas, width, height);
    if (!ctx) return;

    drawCanvasGrid(ctx, width, height, 24);

    const cur = rows[Math.min(activeIdx, rows.length - 1)];

    ctx.fillStyle = CANVAS_COLORS.textMain;
    ctx.font = `700 12px ${CANVAS_FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      mode === 'moving-avg'
        ? 'ウィンドウフレーム可視化：ROWS BETWEEN 2 PRECEDING AND CURRENT ROW（直近3行移動平均）'
        : 'パーティション内ランキング可視化：RANK() vs DENSE_RANK() ＆ 部門MAX比較',
      12,
      20
    );

    // 各行を横並びバー/カードとして可視化（パーティション境界が一目瞭然）
    const n = rows.length;
    const padX = 14;
    const gap = 8;
    const cardW = (width - padX * 2 - gap * (n - 1)) / n;
    const cardTop = 54;
    const cardH = 128;

    // 同じパーティション内の現在インデックス計算
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

      drawRoundedRect(ctx, x, cardTop, cardW, cardH, 8, bg, stroke, isCur ? 2.4 : 1.4);

      // パーティション境界破線
      if (i > 0 && rows[i - 1].part !== row.part) {
        ctx.save();
        ctx.strokeStyle = CANVAS_COLORS.cyan;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x - gap / 2, cardTop - 10);
        ctx.lineTo(x - gap / 2, cardTop + cardH + 10);
        ctx.stroke();
        ctx.restore();
      }

      ctx.textAlign = 'center';
      ctx.font = `700 10px ${CANVAS_FONT_FAMILY}`;
      ctx.fillStyle = CANVAS_COLORS.cyan;
      drawFittedText(ctx, row.part, x + cardW / 2, cardTop + 18, cardW - 6);

      ctx.font = `600 11px ${CANVAS_FONT_FAMILY}`;
      ctx.fillStyle = CANVAS_COLORS.textSub;
      drawFittedText(ctx, row.label, x + cardW / 2, cardTop + 40, cardW - 6);

      ctx.font = `700 15px ${CANVAS_MONO_FAMILY}`;
      ctx.fillStyle = CANVAS_COLORS.textMain;
      ctx.fillText(String(row.val), x + cardW / 2, cardTop + 72);

      const tag = isCur ? '現在行★' : inFrame ? 'フレーム内' : '対象外';
      ctx.font = `700 10px ${CANVAS_FONT_FAMILY}`;
      ctx.fillStyle = isCur
        ? CANVAS_COLORS.amber
        : inFrame
          ? CANVAS_COLORS.emerald
          : CANVAS_COLORS.textMuted;
      drawFittedText(ctx, tag, x + cardW / 2, cardTop + 104, cardW - 6);
    });

    // 下段：計算結果リアルタイム表示
    const frameVals = Array.from(frameSet).map((i) => rows[i].val);
    let summary = '';
    if (mode === 'moving-avg') {
      const avg = (frameVals.reduce((a, b) => a + b, 0) / frameVals.length).toFixed(1);
      const cumVals = samePartIdxs.slice(0, posInPart + 1).map((i) => rows[i].val);
      const cum = cumVals.reduce((a, b) => a + b, 0);
      summary = `現在行[${cur.part} ${cur.label}] → 移動平均フレーム(${frameVals.join('+')})/${frameVals.length} = ${avg} ／ 累計SUM = ${cum}`;
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
      218,
      CANVAS_COLORS.bgDarker,
      CANVAS_COLORS.cyan,
      CANVAS_COLORS.textMain,
      11
    );
  }, [mode, activeIdx, rows, tick]);

  return (
    <div className="rounded-lg border border-[#e4e4e0] bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-[#18181b]">ウィンドウ関数フレーム可視化</span>
          <div className="inline-flex rounded-md border border-[#d4d4d0] bg-[#f1f1ee] p-0.5">
            <button
              type="button"
              onClick={() => {
                setMode('moving-avg');
                setActiveIdx(0);
              }}
              className={`rounded px-2.5 py-1 text-[11px] font-semibold ${
                mode === 'moving-avg' ? 'bg-white text-[#18181b] shadow-xs' : 'text-[#52525b]'
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
              className={`rounded px-2.5 py-1 text-[11px] font-semibold ${
                mode === 'rank-compare' ? 'bg-white text-[#18181b] shadow-xs' : 'text-[#52525b]'
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
            className={`rounded-md px-3 py-1 text-xs font-semibold ${
              playing
                ? 'bg-[#be123c] text-white'
                : 'bg-[#18181b] text-white hover:bg-[#27272a]'
            }`}
          >
            {playing ? '停止' : '自動ステップ再生'}
          </button>
          <button
            type="button"
            onClick={() => setActiveIdx((prev) => (prev + 1) % rows.length)}
            className="rounded-md border border-[#d4d4d0] bg-white px-2.5 py-1 text-xs font-semibold text-[#18181b] hover:bg-[#f1f1ee]"
          >
            次の行 →
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="w-full overflow-hidden rounded-md border border-[#1e293b] bg-[#0f172a]"
      >
        <canvas ref={canvasRef} className="block w-full" />
      </div>
    </div>
  );
};
