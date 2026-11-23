// シミュレーター②：ウィンドウ関数スライサー ＆ 再帰SQL展開 ＆ 排他制御・デッドロック・2相コミット(2PC) vs 補償TX(Saga)
// iPhone小画面（420px未満）では横スクロールコンテナ内でフォント・パディングを最適化し潰れを防止
import React, { useState, useEffect, useRef } from 'react';
import { WINDOW_VISUALIZER_ROWS } from '../../data/sqlDrills';
import {
  CANVAS_COLORS,
  CANVAS_FONT_FAMILY,
  CANVAS_MONO_FAMILY,
  setupHiDpiCanvas,
  drawRoundedRect,
  drawArrow,
  drawCurvedArrow,
  drawPillBadge,
  drawCanvasGrid,
  drawFittedText,
} from '../../utils/canvasHelpers';
import { useCanvasContainerWidth } from '../../utils/useCanvasWidth';

type SubSimTab = 'window' | 'recursive' | 'tx';
type FrameMode = 'ROWS' | 'RANGE';
type WinFunc = 'SUM' | 'AVG' | 'RANK' | 'DENSE_RANK' | 'ROW_NUMBER' | 'LAG';

const BOM_EDGES = [
  { parent: 'P100', child: 'A10', qty: 2, step: 1 },
  { parent: 'P100', child: 'B20', qty: 1, step: 1 },
  { parent: 'A10', child: 'C01', qty: 4, step: 2 },
  { parent: 'A10', child: 'C02', qty: 3, step: 2 },
  { parent: 'B20', child: 'C01', qty: 2, step: 2 },
  { parent: 'C02', child: 'D99', qty: 5, step: 3 },
];

const BOM_STEPS = [
  {
    step: 0,
    title: 'Step 0: 開始前（BOM親子テーブル準備）',
    desc: '完成品 P100 を起点に下位部品をすべて展開し、必要員数を掛け合わせる。',
    working: [] as Array<{ part: string; lvl: number; qty: number; path: string }>,
    accumulated: [] as Array<{ part: string; lvl: number; qty: number; path: string }>,
  },
  {
    step: 1,
    title: 'Step 1: アンカーメンバ評価（lvl = 1）',
    desc: "WHERE parent_id = 'P100' を評価し、直下の子部品 A10(×2), B20(×1) を初期ワーキング表へ格納。",
    working: [
      { part: 'A10', lvl: 1, qty: 2, path: 'P100→A10' },
      { part: 'B20', lvl: 1, qty: 1, path: 'P100→B20' },
    ],
    accumulated: [
      { part: 'A10', lvl: 1, qty: 2, path: 'P100→A10' },
      { part: 'B20', lvl: 1, qty: 1, path: 'P100→B20' },
    ],
  },
  {
    step: 2,
    title: 'Step 2: 再帰メンバ 1回目（lvl = 2）',
    desc: 'ワーキング表 {A10, B20} を bom と結合。C01 は A10経由(2×4=8) と B20経由(1×2=2) の2行が出る！UNION ALL が必須！',
    working: [
      { part: 'C01', lvl: 2, qty: 8, path: 'P100→A10→C01' },
      { part: 'C02', lvl: 2, qty: 6, path: 'P100→A10→C02' },
      { part: 'C01', lvl: 2, qty: 2, path: 'P100→B20→C01' },
    ],
    accumulated: [
      { part: 'A10', lvl: 1, qty: 2, path: 'P100→A10' },
      { part: 'B20', lvl: 1, qty: 1, path: 'P100→B20' },
      { part: 'C01', lvl: 2, qty: 8, path: 'P100→A10→C01' },
      { part: 'C02', lvl: 2, qty: 6, path: 'P100→A10→C02' },
      { part: 'C01', lvl: 2, qty: 2, path: 'P100→B20→C01' },
    ],
  },
  {
    step: 3,
    title: 'Step 3: 再帰メンバ 2回目（lvl = 3）',
    desc: 'ワーキング表から C02→D99(6×5=30) を生成。次回は D99 の子が存在せずワーキング表が空になり再帰終了！',
    working: [{ part: 'D99', lvl: 3, qty: 30, path: 'P100→A10→C02→D99' }],
    accumulated: [
      { part: 'A10', lvl: 1, qty: 2, path: 'P100→A10' },
      { part: 'B20', lvl: 1, qty: 1, path: 'P100→B20' },
      { part: 'C01', lvl: 2, qty: 8, path: 'P100→A10→C01' },
      { part: 'C02', lvl: 2, qty: 6, path: 'P100→A10→C02' },
      { part: 'C01', lvl: 2, qty: 2, path: 'P100→B20→C01' },
      { part: 'D99', lvl: 3, qty: 30, path: 'P100→A10→C02→D99' },
    ],
  },
];

export const SqlTxSim: React.FC = () => {
  const [subTab, setSubTab] = useState<SubSimTab>('window');

  // ウィンドウ関数スライサー状態
  const [usePartition, setUsePartition] = useState(true);
  const [frameMode, setFrameMode] = useState<FrameMode>('ROWS');
  const [preceding, setPreceding] = useState<number>(2); // -1 = UNBOUNDED
  const [following, setFollowing] = useState<number>(0); // 99 = UNBOUNDED
  const [winFunc, setWinFunc] = useState<WinFunc>('SUM');
  const [currentRowIdx, setCurrentRowIdx] = useState<number>(2);

  // 再帰SQLステップ状態
  const [recStep, setRecStep] = useState<number>(2);

  // 排他制御・デッドロック・2PC vs Saga 状態
  const [txScenario, setTxScenario] = useState<'deadlock' | 'ordered' | '2pc-vs-saga'>('deadlock');
  const [txStep, setTxStep] = useState<number>(4);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const containerW = useCanvasContainerWidth(containerRef, 360);

  const isCompact = containerW < 420;
  const minWidthForTab =
    subTab === 'window' ? 540 : subTab === 'recursive' ? 620 : 580;
  const drawWidth = Math.max(containerW, isCompact ? minWidthForTab : 320);

  // ウィンドウ関数のフレーム対象行インデックスを計算
  const computeFrameIndices = (targetIdx: number): number[] => {
    const target = WINDOW_VISUALIZER_ROWS[targetIdx];
    const partRows = WINDOW_VISUALIZER_ROWS.filter(
      (r) => !usePartition || r.partition === target.partition
    );
    const posInPart = partRows.findIndex((r) => r.rowIdx === targetIdx);

    if (frameMode === 'ROWS') {
      const startPos = preceding < 0 ? 0 : Math.max(0, posInPart - preceding);
      const endPos =
        following >= 99
          ? partRows.length - 1
          : Math.min(partRows.length - 1, posInPart + following);
      return partRows.slice(startPos, endPos + 1).map((r) => r.rowIdx);
    }
    const minVal = preceding < 0 ? -Infinity : target.orderVal - preceding;
    const maxVal = following >= 99 ? Infinity : target.orderVal + following;
    return partRows
      .filter((r) => r.orderVal >= minVal && r.orderVal <= maxVal)
      .map((r) => r.rowIdx);
  };

  // 各行に対するウィンドウ関数の評価値を算出
  const computeWinValue = (idx: number): string => {
    const target = WINDOW_VISUALIZER_ROWS[idx];
    const partRows = WINDOW_VISUALIZER_ROWS.filter(
      (r) => !usePartition || r.partition === target.partition
    );
    const posInPart = partRows.findIndex((r) => r.rowIdx === idx);

    if (winFunc === 'ROW_NUMBER') return String(posInPart + 1);
    if (winFunc === 'RANK') {
      const firstSame = partRows.findIndex((r) => r.orderVal === target.orderVal);
      return String(firstSame + 1);
    }
    if (winFunc === 'DENSE_RANK') {
      const distinctBefore = new Set(
        partRows.filter((r) => r.orderVal < target.orderVal).map((r) => r.orderVal)
      ).size;
      return String(distinctBefore + 1);
    }
    if (winFunc === 'LAG') {
      if (posInPart === 0) return 'NULL';
      return String(partRows[posInPart - 1].amount);
    }
    const frameIdxs = computeFrameIndices(idx);
    const vals = frameIdxs.map((fi) => WINDOW_VISUALIZER_ROWS[fi].amount);
    const sum = vals.reduce((a, b) => a + b, 0);
    if (winFunc === 'SUM') return String(sum);
    return (sum / vals.length).toFixed(1);
  };

  // HTML5 Canvas 統合描画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = drawWidth;

    if (subTab === 'window') {
      const height = isCompact ? 372 : 390;
      const ctx = setupHiDpiCanvas(canvas, width, height);
      if (!ctx) return;
      drawCanvasGrid(ctx, width, height, 24);

      const frameSet = new Set(computeFrameIndices(currentRowIdx));
      const curRow = WINDOW_VISUALIZER_ROWS[currentRowIdx];

      ctx.fillStyle = CANVAS_COLORS.textMain;
      ctx.font = `700 ${isCompact ? 11 : 13}px ${CANVAS_FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      drawFittedText(
        ctx,
        `ウィンドウ関数フレーム可視化 — 現在行 #${currentRowIdx + 1} (${curRow.partition} / ${curRow.orderLabel})`,
        12,
        21,
        width - 24
      );

      const startY = 44;
      const rowH = isCompact ? 34 : 36;
      const colWidths = [
        width * 0.1,
        width * 0.18,
        width * 0.22,
        width * 0.16,
        width * 0.17,
        width * 0.17,
      ];
      const headers = ['行#', '部門', '売上日(ORDER)', '売上額', 'フレーム状態', `${winFunc}結果`];

      let cx = 10;
      drawRoundedRect(ctx, 10, startY, width - 20, 26, 6, CANVAS_COLORS.bgPanel, CANVAS_COLORS.border, 1);
      ctx.font = `700 ${isCompact ? 10 : 11}px ${CANVAS_FONT_FAMILY}`;
      ctx.fillStyle = CANVAS_COLORS.textSub;
      ctx.textAlign = 'center';
      headers.forEach((h, i) => {
        const w = (colWidths[i] / width) * (width - 20);
        drawFittedText(ctx, h, cx + w / 2, startY + 13, w - 6);
        cx += w;
      });

      WINDOW_VISUALIZER_ROWS.forEach((row, i) => {
        const y = startY + 32 + i * rowH;
        const inSamePart = !usePartition || row.partition === curRow.partition;
        const inFrame = frameSet.has(i);
        const isCurrent = i === currentRowIdx;

        let bg: string = CANVAS_COLORS.bgDarker;
        let stroke: string = CANVAS_COLORS.border;
        if (isCurrent) {
          bg = '#451a03';
          stroke = CANVAS_COLORS.amber;
        } else if (inFrame) {
          bg = '#064e3b';
          stroke = CANVAS_COLORS.emerald;
        } else if (inSamePart) {
          bg = '#0c4a6e';
          stroke = '#0369a1';
        }

        drawRoundedRect(ctx, 10, y, width - 20, rowH - 5, 7, bg, stroke, isCurrent ? 2 : 1.2);

        const cells = [
          `#${i + 1}`,
          row.partition,
          row.orderLabel,
          `${row.amount}`,
          isCurrent ? '現在行★' : inFrame ? 'フレーム内' : inSamePart ? '同パーティション' : '別パーティション',
          computeWinValue(i),
        ];

        let rx = 10;
        cells.forEach((val, ci) => {
          const w = (colWidths[ci] / width) * (width - 20);
          ctx.font =
            ci === 5 || isCurrent
              ? `700 ${isCompact ? 11 : 12}px ${CANVAS_MONO_FAMILY}`
              : `500 ${isCompact ? 10 : 11}px ${CANVAS_FONT_FAMILY}`;
          ctx.fillStyle =
            ci === 5
              ? isCurrent
                ? CANVAS_COLORS.amber
                : CANVAS_COLORS.cyan
              : isCurrent
                ? CANVAS_COLORS.textMain
                : inFrame
                  ? '#a7f3d0'
                  : inSamePart
                    ? CANVAS_COLORS.textSub
                    : CANVAS_COLORS.textMuted;
          drawFittedText(ctx, val, rx + w / 2, y + (rowH - 5) / 2, w - 6);
          rx += w;
        });
      });

      const frameAmounts = Array.from(frameSet).map((i) => WINDOW_VISUALIZER_ROWS[i].amount);
      const formulaY = startY + 32 + WINDOW_VISUALIZER_ROWS.length * rowH + 14;
      ctx.textAlign = 'left';
      ctx.font = `700 ${isCompact ? 11 : 12}px ${CANVAS_MONO_FAMILY}`;
      ctx.fillStyle = CANVAS_COLORS.emerald;
      const formulaText =
        winFunc === 'SUM' || winFunc === 'AVG'
          ? `現在フレーム(${frameMode}): [${frameAmounts.join(' + ')}] → ${winFunc} = ${computeWinValue(currentRowIdx)}`
          : `順位/参照関数 ${winFunc} (現在行 #${currentRowIdx + 1}) → ${computeWinValue(currentRowIdx)}`;
      drawFittedText(ctx, formulaText, 12, formulaY, width - 24);
      return;
    }

    if (subTab === 'recursive') {
      const height = 360;
      const ctx = setupHiDpiCanvas(canvas, width, height);
      if (!ctx) return;
      drawCanvasGrid(ctx, width, height, 24);

      const stepInfo = BOM_STEPS[recStep];
      ctx.fillStyle = CANVAS_COLORS.textMain;
      ctx.font = `700 ${isCompact ? 11 : 13}px ${CANVAS_FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      drawFittedText(ctx, `WITH RECURSIVE 部品表(BOM)展開 — ${stepInfo.title}`, 12, 21, width - 24);

      const splitX = width * 0.5;
      const nodes: Record<string, { x: number; y: number; step: number }> = {
        P100: { x: splitX * 0.5, y: 74, step: 0 },
        A10: { x: splitX * 0.27, y: 150, step: 1 },
        B20: { x: splitX * 0.73, y: 150, step: 1 },
        C01: { x: splitX * 0.55, y: 234, step: 2 },
        C02: { x: splitX * 0.22, y: 234, step: 2 },
        D99: { x: splitX * 0.22, y: 316, step: 3 },
      };

      BOM_EDGES.forEach((e) => {
        const p = nodes[e.parent];
        const c = nodes[e.child];
        const active = e.step <= recStep;
        const isCurrentStep = e.step === recStep;
        const color = isCurrentStep
          ? CANVAS_COLORS.amber
          : active
            ? CANVAS_COLORS.emerald
            : CANVAS_COLORS.borderLight;
        drawArrow(ctx, p.x, p.y + 18, c.x, c.y - 20, color, isCurrentStep ? 2.6 : 1.7, !active, 8);
        drawPillBadge(
          ctx,
          `×${e.qty}`,
          (p.x + c.x) / 2,
          (p.y + c.y) / 2,
          CANVAS_COLORS.bgDarker,
          color,
          color,
          10
        );
      });

      Object.entries(nodes).forEach(([id, pos]) => {
        const active = pos.step <= recStep;
        const isNew = pos.step === recStep;
        const bg =
          id === 'P100'
            ? CANVAS_COLORS.cyanSoft
            : isNew
              ? CANVAS_COLORS.amberSoft
              : active
                ? CANVAS_COLORS.emeraldSoft
                : CANVAS_COLORS.bgPanel;
        const stroke =
          id === 'P100'
            ? CANVAS_COLORS.cyan
            : isNew
              ? CANVAS_COLORS.amber
              : active
                ? CANVAS_COLORS.emerald
                : CANVAS_COLORS.border;
        drawRoundedRect(ctx, pos.x - 34, pos.y - 17, 68, 34, 8, bg, stroke, isNew ? 2.2 : 1.5);
        ctx.fillStyle = CANVAS_COLORS.textMain;
        ctx.font = `700 ${isCompact ? 11 : 12}px ${CANVAS_MONO_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(id, pos.x, pos.y);
      });

      // 右側：累積結果テーブル（横スクロール確保により小画面でも常時描画）
      const panelX = splitX + 10;
      const panelW = width - panelX - 12;
      drawRoundedRect(ctx, panelX, 46, panelW, 294, 8, CANVAS_COLORS.bgPanel, CANVAS_COLORS.border, 1.4);
      ctx.fillStyle = CANVAS_COLORS.cyan;
      ctx.font = `700 ${isCompact ? 11 : 12}px ${CANVAS_FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.fillText(`累積結果テーブル (${stepInfo.accumulated.length}行)`, panelX + 12, 66);

      stepInfo.accumulated.forEach((row, idx) => {
        const ry = 88 + idx * 36;
        const isLatest = row.lvl === recStep;
        drawRoundedRect(
          ctx,
          panelX + 10,
          ry,
          panelW - 20,
          30,
          6,
          isLatest ? CANVAS_COLORS.amberSoft : CANVAS_COLORS.bgDarker,
          isLatest ? CANVAS_COLORS.amber : CANVAS_COLORS.border,
          1.2
        );
        ctx.fillStyle = isLatest ? '#fde68a' : CANVAS_COLORS.textMain;
        ctx.font = `600 ${isCompact ? 10 : 11}px ${CANVAS_MONO_FAMILY}`;
        drawFittedText(
          ctx,
          `lvl=${row.lvl} | ${row.part} | 計=${row.qty} (${row.path})`,
          panelX + 16,
          ry + 15,
          panelW - 32
        );
      });
      return;
    }

    // サブタブ3：排他制御・デッドロック・2相コミット(2PC) vs 補償TX(Saga)
    const height = txScenario === '2pc-vs-saga' ? 400 : 380;
    const ctx = setupHiDpiCanvas(canvas, width, height);
    if (!ctx) return;
    drawCanvasGrid(ctx, width, height, 24);

    if (txScenario === 'deadlock' || txScenario === 'ordered') {
      const isDeadlock = txScenario === 'deadlock';
      ctx.fillStyle = CANVAS_COLORS.textMain;
      ctx.font = `700 ${isCompact ? 11 : 13}px ${CANVAS_FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      drawFittedText(
        ctx,
        isDeadlock
          ? 'R5秋 再現：逆順排他ロックによるデッドロック ＆ 待ちグラフ循環検出'
          : 'R5秋 対策：倉庫コード昇順（A→B統一）ロック獲得によるデッドロック完全回避',
        12,
        21,
        width - 24
      );

      const laneX = 82;
      const laneW = width - laneX - 18;
      const stepW = laneW / 5;

      for (let t = 1; t <= 5; t++) {
        const tx = laneX + (t - 0.5) * stepW;
        ctx.fillStyle = t <= txStep ? CANVAS_COLORS.cyan : CANVAS_COLORS.textMuted;
        ctx.font = `700 11px ${CANVAS_MONO_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.fillText(`t${t}`, tx, 48);
        ctx.strokeStyle = t === txStep ? CANVAS_COLORS.amber : CANVAS_COLORS.border;
        ctx.lineWidth = t === txStep ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(tx, 58);
        ctx.lineTo(tx, 198);
        ctx.stroke();
      }

      const drawLane = (
        label: string,
        y: number,
        events: Array<{ t: number; text: string; color: string; bg: string }>
      ) => {
        ctx.fillStyle = CANVAS_COLORS.textMain;
        ctx.font = `700 ${isCompact ? 11 : 12}px ${CANVAS_FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.fillText(label, 12, y + 20);
        drawRoundedRect(ctx, laneX, y, laneW, 42, 8, CANVAS_COLORS.bgPanel, CANVAS_COLORS.border, 1);

        events.forEach((ev) => {
          if (ev.t > txStep) return;
          const bx = laneX + (ev.t - 1) * stepW + 4;
          const bw = stepW - 8;
          drawRoundedRect(ctx, bx, y + 5, bw, 32, 6, ev.bg, ev.color, 1.5);
          ctx.fillStyle = CANVAS_COLORS.textMain;
          ctx.font = `700 10px ${CANVAS_FONT_FAMILY}`;
          ctx.textAlign = 'center';
          drawFittedText(ctx, ev.text, bx + bw / 2, y + 21, bw - 6);
        });
      };

      if (isDeadlock) {
        drawLane('T1 (A→B)', 68, [
          { t: 1, text: 'Xロック(倉庫A)', color: CANVAS_COLORS.cyan, bg: CANVAS_COLORS.cyanSoft },
          { t: 2, text: '在庫A -10', color: CANVAS_COLORS.cyan, bg: CANVAS_COLORS.bgDarker },
          { t: 3, text: '倉庫B X要求→待', color: CANVAS_COLORS.amber, bg: CANVAS_COLORS.amberSoft },
          { t: 4, text: 'デッドロック!', color: CANVAS_COLORS.rose, bg: CANVAS_COLORS.roseSoft },
          { t: 5, text: '強制UNDO', color: CANVAS_COLORS.rose, bg: CANVAS_COLORS.roseSoft },
        ]);
        drawLane('T2 (B→A)', 132, [
          { t: 1, text: 'Xロック(倉庫B)', color: CANVAS_COLORS.emerald, bg: CANVAS_COLORS.emeraldSoft },
          { t: 2, text: '在庫B -5', color: CANVAS_COLORS.emerald, bg: CANVAS_COLORS.bgDarker },
          { t: 3, text: '倉庫A X要求→待', color: CANVAS_COLORS.amber, bg: CANVAS_COLORS.amberSoft },
          { t: 4, text: '循環待ち検出!', color: CANVAS_COLORS.rose, bg: CANVAS_COLORS.roseSoft },
          { t: 5, text: 'A獲得→COMMIT', color: CANVAS_COLORS.emerald, bg: CANVAS_COLORS.emeraldSoft },
        ]);
      } else {
        drawLane('T1 (A→B)', 68, [
          { t: 1, text: 'Xロック(倉庫A)', color: CANVAS_COLORS.cyan, bg: CANVAS_COLORS.cyanSoft },
          { t: 2, text: 'Xロック(倉庫B)', color: CANVAS_COLORS.cyan, bg: CANVAS_COLORS.cyanSoft },
          { t: 3, text: '更新→COMMIT', color: CANVAS_COLORS.emerald, bg: CANVAS_COLORS.emeraldSoft },
        ]);
        drawLane('T2 (A→B)', 132, [
          { t: 1, text: '倉庫A X待機', color: CANVAS_COLORS.amber, bg: CANVAS_COLORS.amberSoft },
          { t: 2, text: '待機継続', color: CANVAS_COLORS.amber, bg: CANVAS_COLORS.amberSoft },
          { t: 3, text: 'A解放待ち終了', color: CANVAS_COLORS.cyan, bg: CANVAS_COLORS.cyanSoft },
          { t: 4, text: 'X(A)&X(B)獲得', color: CANVAS_COLORS.emerald, bg: CANVAS_COLORS.emeraldSoft },
          { t: 5, text: '更新→COMMIT', color: CANVAS_COLORS.emerald, bg: CANVAS_COLORS.emeraldSoft },
        ]);
      }

      const wgY = 216;
      drawRoundedRect(ctx, 12, wgY, width - 24, 146, 10, CANVAS_COLORS.bgPanel, CANVAS_COLORS.border, 1.4);
      ctx.fillStyle = CANVAS_COLORS.textMain;
      ctx.font = `700 ${isCompact ? 11 : 12}px ${CANVAS_FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.fillText('待ちグラフ（Wait-For Graph）リアルタイム状態', 24, wgY + 22);

      const t1x = width * 0.3;
      const t2x = width * 0.7;
      const ny = wgY + 86;

      const cycleDetected = isDeadlock && txStep >= 4;
      drawRoundedRect(
        ctx,
        t1x - 40,
        ny - 20,
        80,
        40,
        20,
        cycleDetected ? CANVAS_COLORS.roseSoft : CANVAS_COLORS.cyanSoft,
        cycleDetected ? CANVAS_COLORS.rose : CANVAS_COLORS.cyan,
        2
      );
      drawRoundedRect(
        ctx,
        t2x - 40,
        ny - 20,
        80,
        40,
        20,
        cycleDetected ? CANVAS_COLORS.roseSoft : CANVAS_COLORS.emeraldSoft,
        cycleDetected ? CANVAS_COLORS.rose : CANVAS_COLORS.emerald,
        2
      );

      ctx.fillStyle = CANVAS_COLORS.textMain;
      ctx.font = `700 12px ${CANVAS_MONO_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillText('TX1', t1x, ny);
      ctx.fillText('TX2', t2x, ny);

      if (isDeadlock && txStep >= 3) {
        const edgeCol = cycleDetected ? CANVAS_COLORS.rose : CANVAS_COLORS.amber;
        drawCurvedArrow(ctx, t1x + 40, ny - 10, width * 0.5, ny - 46, t2x - 40, ny - 10, edgeCol, 2.3);
        drawCurvedArrow(ctx, t2x - 40, ny + 10, width * 0.5, ny + 46, t1x + 40, ny + 10, edgeCol, 2.3);
        drawPillBadge(ctx, 'B解放待ち', width * 0.5, ny - 36, CANVAS_COLORS.bgDarker, edgeCol, edgeCol, 10);
        drawPillBadge(ctx, 'A解放待ち', width * 0.5, ny + 36, CANVAS_COLORS.bgDarker, edgeCol, edgeCol, 10);
        if (cycleDetected) {
          drawPillBadge(
            ctx,
            '閉路(サイクル)検出＝デッドロック！',
            width * 0.5,
            ny,
            CANVAS_COLORS.roseSoft,
            CANVAS_COLORS.rose,
            CANVAS_COLORS.rose,
            10
          );
        }
      } else if (!isDeadlock && txStep >= 1 && txStep <= 3) {
        drawArrow(ctx, t2x - 42, ny, t1x + 42, ny, CANVAS_COLORS.amber, 2.3);
        drawPillBadge(
          ctx,
          'T2→T1 (片方向のみ・閉路なし)',
          width * 0.5,
          ny - 20,
          CANVAS_COLORS.bgDarker,
          CANVAS_COLORS.emerald,
          CANVAS_COLORS.emerald,
          10
        );
      } else {
        drawPillBadge(
          ctx,
          '循環待ちなし（正常進行中）',
          width * 0.5,
          ny,
          CANVAS_COLORS.emeraldSoft,
          CANVAS_COLORS.emerald,
          CANVAS_COLORS.emerald,
          10
        );
      }
      return;
    }

    // 2相コミット(2PC) vs 補償トランザクション(Saga)
    ctx.fillStyle = CANVAS_COLORS.textMain;
    ctx.font = `700 ${isCompact ? 11 : 13}px ${CANVAS_FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    drawFittedText(
      ctx,
      'R3秋 比較：2相コミット（2PC ブロッキング） vs 補償トランザクション（Saga 逆順取消）',
      12,
      21,
      width - 24
    );

    const drawCompareBand = (
      title: string,
      topY: number,
      accent: string,
      stages: Array<{ label: string; sub: string; color: string; bg: string }>
    ) => {
      drawRoundedRect(ctx, 12, topY, width - 24, 158, 10, CANVAS_COLORS.bgPanel, accent, 1.4);
      ctx.fillStyle = accent;
      ctx.font = `700 ${isCompact ? 11 : 12}px ${CANVAS_FONT_FAMILY}`;
      ctx.textAlign = 'left';
      drawFittedText(ctx, title, 22, topY + 21, width - 48);

      const count = stages.length;
      const gap = 8;
      const totalW = width - 48;
      const cardW = (totalW - gap * (count - 1)) / count;

      stages.forEach((st, idx) => {
        const active = idx + 1 <= txStep;
        const x = 24 + idx * (cardW + gap);
        const y = topY + 42;
        drawRoundedRect(
          ctx,
          x,
          y,
          cardW,
          94,
          7,
          active ? st.bg : CANVAS_COLORS.bgDarker,
          active ? st.color : CANVAS_COLORS.border,
          active ? 1.8 : 1
        );
        ctx.fillStyle = active ? CANVAS_COLORS.textMain : CANVAS_COLORS.textMuted;
        ctx.font = `700 ${isCompact ? 10 : 11}px ${CANVAS_FONT_FAMILY}`;
        ctx.textAlign = 'center';
        drawFittedText(ctx, st.label, x + cardW / 2, y + 32, cardW - 8);
        ctx.font = `500 10px ${CANVAS_FONT_FAMILY}`;
        ctx.fillStyle = active ? CANVAS_COLORS.textSub : '#64748b';
        drawFittedText(ctx, st.sub, x + cardW / 2, y + 60, cardW - 8);

        if (idx < count - 1) {
          drawArrow(
            ctx,
            x + cardW + 1,
            y + 47,
            x + cardW + gap - 1,
            y + 47,
            active ? st.color : CANVAS_COLORS.border,
            1.8,
            false,
            5
          );
        }
      });
    };

    drawCompareBand('① 2相コミット（2PC：強一貫性・ブロッキングあり）', 44, CANVAS_COLORS.rose, [
      { label: 'Phase1 Prepare', sub: '全DBへ準備要求', color: CANVAS_COLORS.cyan, bg: CANVAS_COLORS.cyanSoft },
      { label: 'Vote OK & ロック', sub: '航空/ホテルX保持', color: CANVAS_COLORS.amber, bg: CANVAS_COLORS.amberSoft },
      { label: '調停者ダウン!', sub: 'ネットワーク分断', color: CANVAS_COLORS.rose, bg: CANVAS_COLORS.roseSoft },
      { label: 'ブロッキング', sub: 'ロック解放不可!', color: CANVAS_COLORS.rose, bg: CANVAS_COLORS.roseSoft },
      { label: '可用性低下', sub: '手動回復まで停止', color: CANVAS_COLORS.rose, bg: CANVAS_COLORS.roseSoft },
    ]);

    drawCompareBand('② 補償トランザクション（Saga：結果整合性・ロック即解放）', 220, CANVAS_COLORS.emerald, [
      { label: 'TX1 航空仮予約', sub: '即COMMIT(解放)', color: CANVAS_COLORS.emerald, bg: CANVAS_COLORS.emeraldSoft },
      { label: 'TX2 ホテル予約', sub: '即COMMIT(解放)', color: CANVAS_COLORS.emerald, bg: CANVAS_COLORS.emeraldSoft },
      { label: 'TX3 決済失敗!', sub: 'カード与信NG', color: CANVAS_COLORS.rose, bg: CANVAS_COLORS.roseSoft },
      { label: '補償C2 ホテル取消', sub: '逆順で補償実行', color: CANVAS_COLORS.amber, bg: CANVAS_COLORS.amberSoft },
      { label: '補償C1 航空取消', sub: '結果整合性達成', color: CANVAS_COLORS.cyan, bg: CANVAS_COLORS.cyanSoft },
    ]);
  }, [subTab, usePartition, frameMode, preceding, following, winFunc, currentRowIdx, recStep, txScenario, txStep, drawWidth, isCompact]);

  return (
    <div className="space-y-4">
      {/* サブタブ */}
      <div className="inline-flex flex-wrap rounded-[8px] bg-black/[0.06] p-[2px]">
        <button
          type="button"
          onClick={() => setSubTab('window')}
          className={`rounded-[6.5px] px-3 py-1.5 text-xs font-semibold transition ${
            subTab === 'window'
              ? 'bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
              : 'text-[#6E6E73]'
          }`}
        >
          ウィンドウ関数スライサー
        </button>
        <button
          type="button"
          onClick={() => setSubTab('recursive')}
          className={`rounded-[6.5px] px-3 py-1.5 text-xs font-semibold transition ${
            subTab === 'recursive'
              ? 'bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
              : 'text-[#6E6E73]'
          }`}
        >
          再帰SQL (WITH RECURSIVE)
        </button>
        <button
          type="button"
          onClick={() => setSubTab('tx')}
          className={`rounded-[6.5px] px-3 py-1.5 text-xs font-semibold transition ${
            subTab === 'tx'
              ? 'bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
              : 'text-[#6E6E73]'
          }`}
        >
          排他制御・デッドロック・2PC vs 補償TX
        </button>
      </div>

      {/* コントロールパネル */}
      <div className="ios-group p-4 space-y-4">
        {subTab === 'window' && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#6E6E73]">関数選択</label>
              <select
                value={winFunc}
                onChange={(e) => setWinFunc(e.target.value as WinFunc)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-base md:text-sm text-[#1D1D1F]"
              >
                <option value="SUM">SUM（合計/累計）</option>
                <option value="AVG">AVG（移動平均）</option>
                <option value="RANK">RANK（飛び番順位）</option>
                <option value="DENSE_RANK">DENSE_RANK（詰順位）</option>
                <option value="ROW_NUMBER">ROW_NUMBER（連番）</option>
                <option value="LAG">LAG（直前行参照）</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#6E6E73]">
                フレーム単位（10/02同日行を比較）
              </label>
              <div className="flex gap-1.5">
                {(['ROWS', 'RANGE'] as FrameMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setFrameMode(m)}
                    className={`flex-1 rounded-lg py-1.5 font-mono text-xs font-semibold transition ${
                      frameMode === m
                        ? 'bg-[#007AFF] text-white'
                        : 'border border-slate-200 bg-[#F5F5F7] text-[#6E6E73]'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#6E6E73]">フレーム範囲</label>
              <div className="flex gap-1.5">
                <select
                  value={preceding}
                  onChange={(e) => setPreceding(Number(e.target.value))}
                  className="w-1/2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-base md:text-sm text-[#1D1D1F]"
                >
                  <option value={-1}>UNBOUNDED前</option>
                  <option value={2}>2 PRECEDING</option>
                  <option value={1}>1 PRECEDING</option>
                  <option value={0}>CURRENT ROW</option>
                </select>
                <select
                  value={following}
                  onChange={(e) => setFollowing(Number(e.target.value))}
                  className="w-1/2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-base md:text-sm text-[#1D1D1F]"
                >
                  <option value={0}>CURRENT ROW</option>
                  <option value={1}>1 FOLLOWING</option>
                  <option value={99}>UNBOUNDED後</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#6E6E73]">
                現在評価行：
                <span className="font-mono tabular-nums text-[#1D1D1F]">
                  #{currentRowIdx + 1} / {WINDOW_VISUALIZER_ROWS.length}
                </span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={WINDOW_VISUALIZER_ROWS.length - 1}
                  value={currentRowIdx}
                  onChange={(e) => setCurrentRowIdx(Number(e.target.value))}
                  className="w-full accent-[#007AFF]"
                />
                <label className="flex shrink-0 items-center gap-1 text-xs text-[#6E6E73]">
                  <input
                    type="checkbox"
                    checked={usePartition}
                    onChange={(e) => setUsePartition(e.target.checked)}
                    className="accent-[#007AFF]"
                  />
                  部門別
                </label>
              </div>
            </div>
          </div>
        )}

        {subTab === 'recursive' && (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {BOM_STEPS.map((s) => (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => setRecStep(s.step)}
                    className={`rounded-lg px-3 py-1.5 font-mono text-xs font-semibold tabular-nums ${
                      recStep === s.step
                        ? 'bg-[#007AFF] text-white'
                        : 'border border-slate-200 bg-[#F5F5F7] text-[#6E6E73]'
                    }`}
                  >
                    Step {s.step}
                  </button>
                ))}
              </div>
              <span className="text-xs font-semibold text-[#1D1D1F]">
                要点：部品C01が別経路で2回展開されるため UNION ALL が必須
              </span>
            </div>
            <p className="text-xs text-[#6E6E73]">{BOM_STEPS[recStep].desc}</p>
          </div>
        )}

        {subTab === 'tx' && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setTxScenario('deadlock');
                  setTxStep(4);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  txScenario === 'deadlock'
                    ? 'bg-[#007AFF] text-white'
                    : 'border border-slate-200 bg-[#F5F5F7] text-[#6E6E73]'
                }`}
              >
                デッドロック発生（R5秋）
              </button>
              <button
                type="button"
                onClick={() => {
                  setTxScenario('ordered');
                  setTxStep(5);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  txScenario === 'ordered'
                    ? 'bg-[#007AFF] text-white'
                    : 'border border-slate-200 bg-[#F5F5F7] text-[#6E6E73]'
                }`}
              >
                昇順ロック回避策（R5秋）
              </button>
              <button
                type="button"
                onClick={() => {
                  setTxScenario('2pc-vs-saga');
                  setTxStep(5);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  txScenario === '2pc-vs-saga'
                    ? 'bg-[#007AFF] text-white'
                    : 'border border-slate-200 bg-[#F5F5F7] text-[#6E6E73]'
                }`}
              >
                2PC vs 補償TX(Saga)（R3秋）
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold tabular-nums text-[#6E6E73]">
                時刻: t{txStep}
              </span>
              <input
                type="range"
                min={1}
                max={5}
                value={txStep}
                onChange={(e) => setTxStep(Number(e.target.value))}
                className="w-32 accent-[#007AFF]"
              />
            </div>
          </div>
        )}

        {/* HTML5 Canvas 図板（小画面時は横スクロール対応） */}
        <div className="space-y-1">
          <div
            ref={containerRef}
            className="w-full overflow-x-auto rounded-lg border border-slate-800 bg-[#0f172a]"
          >
            <canvas ref={canvasRef} className="block" />
          </div>
          {drawWidth > containerW && (
            <div className="text-right text-[11px] text-[#6E6E73]">
              左右にスワイプして全体を表示できます
            </div>
          )}
        </div>

        {/* 試験頻出ポイント要約 */}
        <div className="rounded-lg border border-slate-200 bg-[#F5F5F7] p-3.5 text-xs text-[#1D1D1F]/90 leading-relaxed">
          {subTab === 'window' && (
            <>
              <span className="font-bold text-[#1D1D1F]">試験ひっかけ注意：</span>
              行#2と行#3はどちらも「10/02」の同値タイ行です。現在行を{' '}
              <strong className="font-mono text-[#1D1D1F]">#2</strong> に合わせて
              <strong className="font-mono text-[#007AFF]"> ROWS </strong>と
              <strong className="font-mono text-[#007AFF]"> RANGE </strong>
              を切り替えると、RANGEでは同値の#3もフレームに巻き込まれる差が確認できます（ORDER BYのみ指定時のデフォルト挙動）。
            </>
          )}
          {subTab === 'recursive' && (
            <>
              <span className="font-bold text-[#1D1D1F]">再帰SQLの鉄則：</span>
              BOM展開で部品ごとの総必要数を出すには外側のSELECTで{' '}
              <code className="font-mono text-[#007AFF]">GROUP BY part_id</code> し{' '}
              <code className="font-mono text-[#007AFF]">SUM(total_qty)</code> を取ります（例：C01は 8 + 2 = 10個）。無限ループ防止には経路文字列比較や最大階層制限を併用します。
            </>
          )}
          {subTab === 'tx' && (
            <>
              <span className="font-bold text-[#1D1D1F]">記述キーワード：</span>
              デッドロック防止は「ロック獲得順序の統一（主キー昇順等）」、2PCの弱点は「Prepare後のロック長期保持と調停者障害時のブロッキング」、Sagaの弱点は「分離性（Isolation）低下による中間状態可視化→仮状態（セマンティックロック）＋冪等性で対処」。
            </>
          )}
        </div>
      </div>
    </div>
  );
};
