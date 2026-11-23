// シミュレーター③：高/低クラスタ索引I/Oページ計算 ＆ チェックポイント障害回復・ワークテーブル再定義判定 ＆ 4096B PCTFREE容量計算
// iPhone小画面（420px未満）では横スクロールコンテナ内でフォント・パディングを最適化し潰れを防止
import React, { useState, useEffect, useRef } from 'react';
import type { StudyStore } from '../../state/useStudyStore';
import {
  CANVAS_COLORS,
  CANVAS_FONT_FAMILY,
  CANVAS_MONO_FAMILY,
  setupHiDpiCanvas,
  drawRoundedRect,
  drawArrow,
  drawPillBadge,
  drawCanvasGrid,
  drawFittedText,
} from '../../utils/canvasHelpers';
import { useCanvasContainerWidth } from '../../utils/useCanvasWidth';

interface Props {
  store: StudyStore;
}

type PhysTab = 'cluster' | 'checkpoint' | 'capacity';

interface TxSpec {
  id: string;
  label: string;
  start: number;
  end: number;
  committed: boolean;
  usesWorktable: boolean;
}

const TX_LIST: TxSpec[] = [
  { id: 'T1', label: 'T1（マスタ更新）', start: 6, end: 36, committed: true, usesWorktable: false },
  { id: 'T2', label: 'T2（受注確定）', start: 22, end: 72, committed: true, usesWorktable: false },
  { id: 'T3', label: 'T3（大量集計バッチ）', start: 30, end: 94, committed: false, usesWorktable: true },
  { id: 'T4', label: 'T4（在庫引当）', start: 60, end: 84, committed: true, usesWorktable: false },
  { id: 'T5', label: 'T5（一括出荷登録）', start: 70, end: 94, committed: false, usesWorktable: true },
];

export const PhysicalDesignSim: React.FC<Props> = ({ store }) => {
  const [tab, setTab] = useState<PhysTab>('cluster');

  // ===== ① 高/低クラスタ索引I/O パラメータ =====
  const [totalRows, setTotalRows] = useState(1000000);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [btreeHeight, setBtreeHeight] = useState(3);
  const [selectivityPct, setSelectivityPct] = useState(2.5);

  const totalPages = Math.ceil(totalRows / Math.max(1, rowsPerPage));
  const targetRows = Math.max(1, Math.round((totalRows * selectivityPct) / 100));
  const highClusterIo = btreeHeight + Math.ceil(targetRows / Math.max(1, rowsPerPage));
  const lowClusterIo = btreeHeight + targetRows;
  const fullScanIo = totalPages;
  const breakEvenPct = Math.min(100, ((totalPages - btreeHeight) / Math.max(1, totalRows)) * 100);

  const fastestMethod =
    highClusterIo <= fullScanIo && highClusterIo <= lowClusterIo
      ? '高クラスタ索引'
      : lowClusterIo <= fullScanIo
        ? '低クラスタ索引'
        : '表探索（フルスキャン）';

  // ===== ② チェックポイント障害回復＆ワークテーブル再定義判定 =====
  const [hasCheckpoint, setHasCheckpoint] = useState(true);
  const [cpPos, setCpPos] = useState(48);
  const [worktableType, setWorktableType] = useState<'session-temp' | 'global-temp' | 'permanent'>('session-temp');
  const [cpQuizAnswer, setCpQuizAnswer] = useState<string>('');
  const [cpQuizFeedback, setCpQuizFeedback] = useState<string | null>(null);

  const judgeTxAction = (tx: TxSpec): 'NONE' | 'REDO' | 'UNDO' => {
    if (!tx.committed) return 'UNDO';
    if (!hasCheckpoint) return 'REDO';
    return tx.end <= cpPos ? 'NONE' : 'REDO';
  };

  // ===== ③ 4096B 空き領域率（PCTFREE）容量計算 =====
  const [pageSize, setPageSize] = useState(4096);
  const [headerBytes, setHeaderBytes] = useState(96);
  const [pctFree, setPctFree] = useState(20);
  const [rowBytes, setRowBytes] = useState(200);
  const [capTotalRows, setCapTotalRows] = useState(100000);
  const [formulaMode, setFormulaMode] = useState<'after-header' | 'whole-page'>('after-header');
  const [updateGrowthBytes, setUpdateGrowthBytes] = useState(35);

  const usableBytes =
    formulaMode === 'after-header'
      ? Math.floor((pageSize - headerBytes) * (1 - pctFree / 100))
      : Math.floor(pageSize * (1 - pctFree / 100)) - headerBytes;
  const maxRowsPerPage = Math.max(1, Math.floor(Math.max(0, usableBytes) / Math.max(1, rowBytes)));
  const requiredPages = Math.ceil(capTotalRows / maxRowsPerPage);
  const usedDataBytes = maxRowsPerPage * rowBytes;
  const pctFreeBytes = Math.max(0, pageSize - headerBytes - usableBytes);
  const wasteBytes = Math.max(0, usableBytes - usedDataBytes);
  const totalGrowthPerPage = maxRowsPerPage * updateGrowthBytes;
  const causesRowMigration = totalGrowthPerPage > pctFreeBytes + wasteBytes;
  const totalSizeMb = ((requiredPages * pageSize) / (1024 * 1024)).toFixed(2);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const containerW = useCanvasContainerWidth(containerRef, 360);

  const isCompact = containerW < 420;
  const minW = tab === 'cluster' ? 560 : tab === 'checkpoint' ? 580 : 500;
  const drawWidth = Math.max(containerW, isCompact ? minW : 320);

  // チェックポイント確認クイズ採点
  const handleCheckCpQuiz = () => {
    const expected = hasCheckpoint ? 'T2,T4' : 'T1,T2,T4';
    const norm = cpQuizAnswer.replace(/\s+/g, '').toUpperCase();
    if (norm === expected) {
      setCpQuizFeedback(
        `正解！チェックポイント${hasCheckpoint ? 'あり' : 'なし'}時のREDO対象は ${expected} です（未コミットのT3, T5はUNDO）。`
      );
      store.incrementAttempts();
    } else {
      setCpQuizFeedback(`不正解（正解：${expected}）。弱点復習キューに登録しました。`);
      store.recordReviewMiss({
        id: `review-phys-cp-${hasCheckpoint ? 'on' : 'off'}`,
        kind: 'physical',
        year: 'R5秋',
        title: `チェックポイント（${hasCheckpoint ? 'あり' : 'なし'}）REDO対象判定`,
        prompt: `チェックポイント${hasCheckpoint ? `あり(位置${cpPos})` : 'なし'}の状態で、T1(CP前COMMIT), T2(CP跨ぎCOMMIT), T3(未COMMIT), T4(CP後COMMIT), T5(未COMMIT)のうちロールフォワード(REDO)対象となるトランザクションをカンマ区切りで答えよ。`,
        payload: {
          physicalExpected: expected,
          physicalFormula: 'CP前完了＝回復不要 / CP後完了＝REDO / 障害時未完了＝UNDO',
          explanation: hasCheckpoint
            ? 'T1はチェックポイント前にコミット済みでディスク反映済のためREDO不要。T2とT4のみREDO対象。'
            : 'チェックポイントがない場合、過去のコミット済みT1・T2・T4すべてをログ先頭からREDOする必要がある！',
        },
      });
    }
  };

  // HTML5 Canvas 統合描画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = drawWidth;

    // Canvas A：高/低クラスタ索引I/Oアクセスパターン＆損益分岐点チャート
    if (tab === 'cluster') {
      const height = 420;
      const ctx = setupHiDpiCanvas(canvas, width, height);
      if (!ctx) return;
      drawCanvasGrid(ctx, width, height, 24);

      ctx.fillStyle = CANVAS_COLORS.textMain;
      ctx.font = `700 ${isCompact ? 11 : 13}px ${CANVAS_FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      drawFittedText(
        ctx,
        '物理I/Oアクセスパターン比較（高クラスタ連続読込 vs 低クラスタ散乱読込）',
        12,
        20,
        width - 24
      );

      const halfW = (width - 36) / 2;
      const drawAccessBox = (x0: number, title: string, isHigh: boolean) => {
        const accent = isHigh ? CANVAS_COLORS.emerald : CANVAS_COLORS.rose;
        drawRoundedRect(ctx, x0, 38, halfW, 156, 8, CANVAS_COLORS.bgPanel, accent, 1.4);
        ctx.fillStyle = accent;
        ctx.font = `700 ${isCompact ? 10 : 11}px ${CANVAS_FONT_FAMILY}`;
        ctx.textAlign = 'left';
        drawFittedText(ctx, title, x0 + 10, 54, halfW - 20);

        const leafY = 74;
        const leafW = Math.min(28, (halfW - 44) / 6);
        const startLeafX = x0 + (halfW - leafW * 6 - 20) / 2;
        const pageY = 148;
        const pageCount = 8;
        const pageW = Math.min(24, (halfW - 32) / pageCount - 3);
        const startPageX = x0 + (halfW - (pageW + 3) * pageCount) / 2;

        const hitPages = isHigh ? [1, 2] : [0, 2, 4, 5, 6, 7];
        for (let p = 0; p < pageCount; p++) {
          const px = startPageX + p * (pageW + 3);
          const isHit = hitPages.includes(p);
          drawRoundedRect(
            ctx,
            px,
            pageY,
            pageW,
            30,
            4,
            isHit ? (isHigh ? CANVAS_COLORS.emeraldSoft : CANVAS_COLORS.roseSoft) : CANVAS_COLORS.bgDarker,
            isHit ? accent : CANVAS_COLORS.border,
            1.3
          );
          ctx.fillStyle = isHit ? CANVAS_COLORS.textMain : CANVAS_COLORS.textMuted;
          ctx.font = `700 9px ${CANVAS_MONO_FAMILY}`;
          ctx.textAlign = 'center';
          ctx.fillText(`P${p + 1}`, px + pageW / 2, pageY + 15);
        }

        const targets = isHigh ? [1, 1, 1, 2, 2, 2] : [6, 0, 5, 2, 7, 4];
        for (let k = 0; k < 6; k++) {
          const kx = startLeafX + k * (leafW + 4);
          drawRoundedRect(ctx, kx, leafY, leafW, 20, 4, CANVAS_COLORS.cyanSoft, CANVAS_COLORS.cyan, 1.2);
          ctx.fillStyle = CANVAS_COLORS.textMain;
          ctx.font = `700 9px ${CANVAS_MONO_FAMILY}`;
          ctx.textAlign = 'center';
          ctx.fillText(`K${k + 1}`, kx + leafW / 2, leafY + 10);

          const targetP = targets[k];
          const tx = startPageX + targetP * (pageW + 3) + pageW / 2;
          drawArrow(ctx, kx + leafW / 2, leafY + 20, tx, pageY - 2, accent, 1.4, !isHigh, 6);
        }
      };

      drawAccessBox(12, `高クラスタ: ${highClusterIo.toLocaleString()} P（連続）`, true);
      drawAccessBox(width / 2 + 6, `低クラスタ: ${lowClusterIo.toLocaleString()} P（散乱）`, false);

      const chartX = 58;
      const chartY = 228;
      const chartW = width - chartX - 24;
      const chartH = 152;
      drawRoundedRect(ctx, 12, 204, width - 24, 206, 8, CANVAS_COLORS.bgPanel, CANVAS_COLORS.border, 1.4);

      ctx.fillStyle = CANVAS_COLORS.textMain;
      ctx.font = `700 ${isCompact ? 10 : 11}px ${CANVAS_FONT_FAMILY}`;
      ctx.textAlign = 'left';
      drawFittedText(
        ctx,
        `抽出率(%) vs ディスクI/Oページ数（低クラスタ逆転分岐点 ≒ ${breakEvenPct.toFixed(2)}%）`,
        22,
        218,
        width - 44
      );

      ctx.strokeStyle = CANVAS_COLORS.borderLight;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(chartX, chartY);
      ctx.lineTo(chartX, chartY + chartH);
      ctx.lineTo(chartX + chartW, chartY + chartH);
      ctx.stroke();

      const maxPct = 10;
      const maxIo = fullScanIo * 2.2;
      const toX = (pct: number) => chartX + (Math.min(maxPct, pct) / maxPct) * chartW;
      const toY = (io: number) => chartY + chartH - (Math.min(maxIo, io) / maxIo) * chartH;

      ctx.fillStyle = CANVAS_COLORS.textMuted;
      ctx.font = `600 9px ${CANVAS_MONO_FAMILY}`;
      ctx.textAlign = 'right';
      ctx.fillText(`${fullScanIo.toLocaleString()}`, chartX - 6, toY(fullScanIo));
      ctx.fillText('0', chartX - 6, chartY + chartH);

      ctx.textAlign = 'center';
      [0, 2, 4, 6, 8, 10].forEach((p) => {
        ctx.fillText(`${p}%`, toX(p), chartY + chartH + 14);
      });

      ctx.strokeStyle = CANVAS_COLORS.amber;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(fullScanIo));
      ctx.lineTo(toX(maxPct), toY(fullScanIo));
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = CANVAS_COLORS.rose;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let i = 0; i <= 50; i++) {
        const pct = (maxPct * i) / 50;
        const io = btreeHeight + (totalRows * pct) / 100;
        const px = toX(pct);
        const py = toY(io);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      ctx.strokeStyle = CANVAS_COLORS.emerald;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let i = 0; i <= 50; i++) {
        const pct = (maxPct * i) / 50;
        const io = btreeHeight + Math.ceil(((totalRows * pct) / 100) / Math.max(1, rowsPerPage));
        const px = toX(pct);
        const py = toY(io);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      const curX = toX(Math.min(maxPct, selectivityPct));
      ctx.strokeStyle = CANVAS_COLORS.cyan;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(curX, chartY);
      ctx.lineTo(curX, chartY + chartH);
      ctx.stroke();

      drawPillBadge(
        ctx,
        `現在 ${selectivityPct.toFixed(1)}%`,
        Math.min(chartX + chartW - 44, Math.max(chartX + 44, curX)),
        chartY + 14,
        CANVAS_COLORS.cyanSoft,
        CANVAS_COLORS.cyan,
        CANVAS_COLORS.cyan,
        10
      );

      ctx.font = `700 10px ${CANVAS_FONT_FAMILY}`;
      ctx.textAlign = 'right';
      ctx.fillStyle = CANVAS_COLORS.rose;
      ctx.fillText('━ 低クラスタ索引', chartX + chartW, chartY + 12);
      ctx.fillStyle = CANVAS_COLORS.amber;
      ctx.fillText('┅ 表探索(フルスキャン)', chartX + chartW, chartY + 26);
      ctx.fillStyle = CANVAS_COLORS.emerald;
      ctx.fillText('━ 高クラスタ索引', chartX + chartW, chartY + 40);
      return;
    }

    // Canvas B：チェックポイント障害回復＆REDO/UNDO判定タイムライン
    if (tab === 'checkpoint') {
      const height = 365;
      const ctx = setupHiDpiCanvas(canvas, width, height);
      if (!ctx) return;
      drawCanvasGrid(ctx, width, height, 24);

      ctx.fillStyle = CANVAS_COLORS.textMain;
      ctx.font = `700 ${isCompact ? 11 : 13}px ${CANVAS_FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      drawFittedText(
        ctx,
        `障害回復タイムライン（チェックポイント: ${hasCheckpoint ? `取得あり @ t=${cpPos}` : '取得なし → 全ログREDO！'}）`,
        12,
        21,
        width - 24
      );

      const leftM = 122;
      const rightM = 82;
      const trackW = Math.max(120, width - leftM - rightM);
      const toTxX = (pct: number) => leftM + (pct / 100) * trackW;
      const crashX = toTxX(94);
      const cpX = toTxX(cpPos);

      const scanStartX = hasCheckpoint ? cpX : toTxX(0);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.fillRect(scanStartX, 46, crashX - scanStartX, 248);

      if (hasCheckpoint) {
        ctx.save();
        ctx.strokeStyle = CANVAS_COLORS.amber;
        ctx.lineWidth = 2.2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(cpX, 44);
        ctx.lineTo(cpX, 302);
        ctx.stroke();
        ctx.restore();
        drawPillBadge(ctx, 'チェックポイント(CP)', cpX, 54, CANVAS_COLORS.amberSoft, CANVAS_COLORS.amber, CANVAS_COLORS.amber, 10);
      }

      ctx.strokeStyle = CANVAS_COLORS.rose;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(crashX, 44);
      ctx.lineTo(crashX, 302);
      ctx.stroke();
      drawPillBadge(ctx, 'システム障害!', crashX - 10, 54, CANVAS_COLORS.roseSoft, CANVAS_COLORS.rose, CANVAS_COLORS.rose, 10);

      TX_LIST.forEach((tx, idx) => {
        const y = 84 + idx * 44;
        const action = judgeTxAction(tx);
        const col =
          action === 'REDO'
            ? CANVAS_COLORS.emerald
            : action === 'UNDO'
              ? CANVAS_COLORS.rose
              : CANVAS_COLORS.textMuted;
        const bg =
          action === 'REDO'
            ? CANVAS_COLORS.emeraldSoft
            : action === 'UNDO'
              ? CANVAS_COLORS.roseSoft
              : CANVAS_COLORS.bgPanel;

        ctx.fillStyle = CANVAS_COLORS.textMain;
        ctx.font = `700 ${isCompact ? 10 : 11}px ${CANVAS_FONT_FAMILY}`;
        ctx.textAlign = 'left';
        drawFittedText(ctx, tx.label, 10, y + 12, leftM - 14);

        const x1 = toTxX(tx.start);
        const x2 = toTxX(tx.end);
        drawRoundedRect(ctx, x1, y, Math.max(16, x2 - x1), 24, 6, bg, col, 1.6);

        ctx.fillStyle = CANVAS_COLORS.textMain;
        ctx.font = `700 10px ${CANVAS_MONO_FAMILY}`;
        ctx.textAlign = 'center';
        drawFittedText(
          ctx,
          tx.committed ? 'COMMIT' : '実行中(未完了)',
          (x1 + x2) / 2,
          y + 12,
          Math.max(20, x2 - x1 - 6)
        );

        const badgeText = action === 'REDO' ? 'REDO' : action === 'UNDO' ? 'UNDO' : '回復不要';
        drawPillBadge(ctx, badgeText, width - 40, y + 12, bg, col, col, 10);
      });

      drawArrow(ctx, scanStartX, 322, crashX, 322, CANVAS_COLORS.cyan, 2.3, false, 8);
      ctx.fillStyle = CANVAS_COLORS.cyan;
      ctx.font = `700 ${isCompact ? 10 : 11}px ${CANVAS_FONT_FAMILY}`;
      ctx.textAlign = 'center';
      drawFittedText(
        ctx,
        hasCheckpoint
          ? `RDBMS再開始時 REDOログ読込範囲（CP〜障害：全体の約${Math.round(94 - cpPos)}%）`
          : 'チェックポイントなし → ログ先頭から全量REDO（再開始時間が大幅増大！）',
        width / 2,
        344,
        width - 24
      );
      return;
    }

    // Canvas C：4096B 空き領域率（PCTFREE）1ページ内部バイトマップ
    const height = 340;
    const ctx = setupHiDpiCanvas(canvas, width, height);
    if (!ctx) return;
    drawCanvasGrid(ctx, width, height, 24);

    ctx.fillStyle = CANVAS_COLORS.textMain;
    ctx.font = `700 ${isCompact ? 11 : 13}px ${CANVAS_FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    drawFittedText(
      ctx,
      `1データページ（${pageSize.toLocaleString()}B）内部レイアウト — 最大 ${maxRowsPerPage} 行/ページ（floor切捨て）`,
      12,
      21,
      width - 24
    );

    const barX = 14;
    const barY = 52;
    const barW = width - 28;
    const barH = 64;

    const wHeader = (headerBytes / pageSize) * barW;
    const wData = (usedDataBytes / pageSize) * barW;
    const wWaste = (wasteBytes / pageSize) * barW;
    const wFree = Math.max(0, barW - wHeader - wData - wWaste);

    drawRoundedRect(ctx, barX, barY, Math.max(6, wHeader), barH, 4, CANVAS_COLORS.amberSoft, CANVAS_COLORS.amber, 1.4);
    drawRoundedRect(ctx, barX + wHeader, barY, Math.max(6, wData), barH, 4, CANVAS_COLORS.cyanSoft, CANVAS_COLORS.cyan, 1.4);
    if (wWaste > 2) {
      drawRoundedRect(ctx, barX + wHeader + wData, barY, wWaste, barH, 2, CANVAS_COLORS.bgPanel, CANVAS_COLORS.textMuted, 1.1);
    }
    if (wFree > 2) {
      drawRoundedRect(ctx, barX + wHeader + wData + wWaste, barY, wFree, barH, 4, CANVAS_COLORS.emeraldSoft, CANVAS_COLORS.emerald, 1.4);
    }

    ctx.font = `700 ${isCompact ? 10 : 11}px ${CANVAS_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    if (wData > 68) {
      ctx.fillStyle = CANVAS_COLORS.textMain;
      ctx.fillText(`データ行 (${maxRowsPerPage}行 = ${usedDataBytes}B)`, barX + wHeader + wData / 2, barY + barH / 2);
    }
    if (wFree > 62) {
      ctx.fillStyle = '#a7f3d0';
      ctx.fillText(`PCTFREE (${pctFreeBytes}B)`, barX + wHeader + wData + wWaste + wFree / 2, barY + barH / 2);
    }

    const caps = [
      { name: `ヘッダ: ${headerBytes}B`, color: CANVAS_COLORS.amber },
      { name: `データ行: ${usedDataBytes}B (${maxRowsPerPage}行)`, color: CANVAS_COLORS.cyan },
      { name: `端数(floor余り): ${wasteBytes}B`, color: CANVAS_COLORS.textMuted },
      { name: `PCTFREE予備: ${pctFreeBytes}B`, color: CANVAS_COLORS.emerald },
    ];
    let lx = 14;
    ctx.font = `600 ${isCompact ? 10 : 11}px ${CANVAS_FONT_FAMILY}`;
    ctx.textAlign = 'left';
    caps.forEach((c, idx) => {
      const rowY = idx < 2 ? 136 : 156;
      if (idx === 2) lx = 14;
      ctx.fillStyle = c.color;
      ctx.fillRect(lx, rowY - 5, 10, 10);
      ctx.fillStyle = CANVAS_COLORS.textSub;
      ctx.fillText(c.name, lx + 14, rowY);
      lx += Math.max(150, ctx.measureText(c.name).width + 26);
    });

    const slotPanelY = 178;
    drawRoundedRect(ctx, 14, slotPanelY, barW, 142, 8, CANVAS_COLORS.bgPanel, CANVAS_COLORS.border, 1.3);
    ctx.fillStyle = CANVAS_COLORS.textMain;
    ctx.font = `700 ${isCompact ? 10 : 11}px ${CANVAS_FONT_FAMILY}`;
    ctx.textAlign = 'left';
    drawFittedText(
      ctx,
      `行スロット格納イメージ ＆ UPDATE行長+${updateGrowthBytes}B 時の行移行（Row Migration）判定`,
      24,
      slotPanelY + 19,
      barW - 20
    );

    const displaySlots = Math.min(24, maxRowsPerPage);
    const cols = Math.min(12, Math.max(4, Math.floor((barW - 24) / 52)));
    const slotW = (barW - 24 - (cols - 1) * 5) / cols;
    for (let i = 0; i < displaySlots; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const sx = 24 + c * (slotW + 5);
      const sy = slotPanelY + 36 + r * 26;
      if (sy + 20 > slotPanelY + 100) break;
      drawRoundedRect(ctx, sx, sy, slotW, 20, 4, CANVAS_COLORS.cyanSoft, CANVAS_COLORS.cyan, 1.1);
      ctx.fillStyle = CANVAS_COLORS.textMain;
      ctx.font = `600 9px ${CANVAS_MONO_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillText(`R${i + 1}`, sx + slotW / 2, sy + 10);
    }

    const migColor = causesRowMigration ? CANVAS_COLORS.rose : CANVAS_COLORS.emerald;
    const migBg = causesRowMigration ? CANVAS_COLORS.roseSoft : CANVAS_COLORS.emeraldSoft;
    drawRoundedRect(ctx, 24, slotPanelY + 102, barW - 20, 28, 6, migBg, migColor, 1.4);
    ctx.fillStyle = CANVAS_COLORS.textMain;
    ctx.font = `700 ${isCompact ? 10 : 11}px ${CANVAS_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    drawFittedText(
      ctx,
      causesRowMigration
        ? `警告：全行+${updateGrowthBytes}B増で必要増分 ${totalGrowthPerPage}B > 予備 ${pctFreeBytes + wasteBytes}B → 行移行発生！`
        : `安全：全行+${updateGrowthBytes}B増（計${totalGrowthPerPage}B）を予備領域 ${pctFreeBytes + wasteBytes}B 内で吸収可能`,
      width / 2,
      slotPanelY + 116,
      barW - 32
    );
  }, [
    tab,
    totalRows,
    rowsPerPage,
    btreeHeight,
    selectivityPct,
    highClusterIo,
    lowClusterIo,
    fullScanIo,
    breakEvenPct,
    hasCheckpoint,
    cpPos,
    pageSize,
    headerBytes,
    pctFree,
    rowBytes,
    maxRowsPerPage,
    usedDataBytes,
    pctFreeBytes,
    wasteBytes,
    updateGrowthBytes,
    totalGrowthPerPage,
    causesRowMigration,
    drawWidth,
    isCompact,
  ]);

  return (
    <div className="space-y-4">
      {/* サブタブ */}
      <div className="inline-flex flex-wrap rounded-[8px] bg-black/[0.06] p-[2px]">
        <button
          type="button"
          onClick={() => setTab('cluster')}
          className={`rounded-[6.5px] px-3 py-1.5 text-xs font-semibold transition ${
            tab === 'cluster'
              ? 'bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
              : 'text-[#6E6E73]'
          }`}
        >
          高/低クラスタ索引 I/O計算
        </button>
        <button
          type="button"
          onClick={() => setTab('checkpoint')}
          className={`rounded-[6.5px] px-3 py-1.5 text-xs font-semibold transition ${
            tab === 'checkpoint'
              ? 'bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
              : 'text-[#6E6E73]'
          }`}
        >
          チェックポイント回復・ワークテーブル
        </button>
        <button
          type="button"
          onClick={() => setTab('capacity')}
          className={`rounded-[6.5px] px-3 py-1.5 text-xs font-semibold transition ${
            tab === 'capacity'
              ? 'bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
              : 'text-[#6E6E73]'
          }`}
        >
          4096B PCTFREE 容量計算
        </button>
      </div>

      <div className="ios-group p-4 space-y-4">
        {/* ① クラスタ索引 I/O パラメータ */}
        {tab === 'cluster' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setTotalRows(10000000);
                  setRowsPerPage(40);
                  setBtreeHeight(4);
                  setSelectivityPct(5.0);
                }}
                className="rounded-lg border border-slate-200 bg-[#F5F5F7] px-3 py-1.5 text-xs font-semibold text-[#1D1D1F] hover:bg-slate-200/70"
              >
                R6秋プリセット（1000万行・抽出5%）
              </button>
              <button
                type="button"
                onClick={() => {
                  setTotalRows(1000000);
                  setRowsPerPage(50);
                  setBtreeHeight(3);
                  setSelectivityPct(1.0);
                }}
                className="rounded-lg border border-slate-200 bg-[#F5F5F7] px-3 py-1.5 text-xs font-semibold text-[#1D1D1F] hover:bg-slate-200/70"
              >
                H31春プリセット（100万行・抽出1%）
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-[#F5F5F7] p-2.5">
                <label className="text-[11px] font-semibold text-[#6E6E73]">総行数</label>
                <input
                  type="number"
                  min={1000}
                  step={100000}
                  value={totalRows}
                  onChange={(e) => setTotalRows(Math.max(1000, Number(e.target.value) || 1000))}
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-base md:text-sm tabular-nums text-[#1D1D1F]"
                />
              </div>
              <div className="rounded-lg border border-slate-200 bg-[#F5F5F7] p-2.5">
                <label className="text-[11px] font-semibold text-[#6E6E73]">1ページあたり行数</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={rowsPerPage}
                  onChange={(e) => setRowsPerPage(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-base md:text-sm tabular-nums text-[#1D1D1F]"
                />
              </div>
              <div className="rounded-lg border border-slate-200 bg-[#F5F5F7] p-2.5">
                <label className="text-[11px] font-semibold text-[#6E6E73]">B+木索引の高さ</label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={btreeHeight}
                  onChange={(e) => setBtreeHeight(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-base md:text-sm tabular-nums text-[#1D1D1F]"
                />
              </div>
              <div className="rounded-lg border border-slate-200 bg-[#F5F5F7] p-2.5">
                <label className="text-[11px] font-semibold text-[#1D1D1F]">
                  抽出率:{' '}
                  <span className="font-mono tabular-nums">
                    {selectivityPct.toFixed(1)}% ({targetRows.toLocaleString()}行)
                  </span>
                </label>
                <input
                  type="range"
                  min={0.1}
                  max={10}
                  step={0.1}
                  value={selectivityPct}
                  onChange={(e) => setSelectivityPct(Number(e.target.value))}
                  className="mt-2 w-full accent-[#007AFF]"
                />
              </div>
            </div>

            {/* 3方式 I/O サマリー（ニュートラル・等幅桁揃え） */}
            <div className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-y-0 sm:divide-x divide-slate-200 rounded-lg border border-slate-200 bg-[#F5F5F7]">
              <div className="p-3">
                <div className="text-xs font-semibold text-[#6E6E73]">高クラスタ索引 I/O</div>
                <div className="mt-1 font-mono text-xl font-bold tabular-nums text-[#1D1D1F]">
                  {highClusterIo.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-[#6E6E73]">ページ</span>
                </div>
                <div className="mt-0.5 font-mono text-[11px] tabular-nums text-[#6E6E73]">
                  {btreeHeight} + ceil({targetRows.toLocaleString()} / {rowsPerPage})
                </div>
              </div>
              <div className="p-3">
                <div className="text-xs font-semibold text-[#6E6E73]">低クラスタ索引 I/O（最悪）</div>
                <div className="mt-1 font-mono text-xl font-bold tabular-nums text-[#1D1D1F]">
                  {lowClusterIo.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-[#6E6E73]">ページ</span>
                </div>
                <div className="mt-0.5 font-mono text-[11px] tabular-nums text-[#6E6E73]">
                  {btreeHeight} + {targetRows.toLocaleString()}（抽出行数そのまま）
                </div>
              </div>
              <div className="p-3">
                <div className="text-xs font-semibold text-[#6E6E73]">表探索（フルスキャン）</div>
                <div className="mt-1 font-mono text-xl font-bold tabular-nums text-[#1D1D1F]">
                  {fullScanIo.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-[#6E6E73]">ページ</span>
                </div>
                <div className="mt-0.5 text-[11px] text-[#6E6E73]">
                  最速方式：<strong className="text-[#007AFF]">{fastestMethod}</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ② チェックポイント＆ワークテーブル再定義判定 */}
        {tab === 'checkpoint' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-[#F5F5F7] p-3">
                <span className="text-xs font-semibold text-[#1D1D1F]">チェックポイント取得</span>
                <input
                  type="checkbox"
                  checked={hasCheckpoint}
                  onChange={(e) => {
                    setHasCheckpoint(e.target.checked);
                    setCpQuizFeedback(null);
                  }}
                  className="h-4 w-4 accent-[#007AFF]"
                />
              </label>

              <div className="rounded-lg border border-slate-200 bg-[#F5F5F7] p-3">
                <label className="text-xs font-semibold text-[#6E6E73]">
                  チェックポイント時刻:{' '}
                  <span className="font-mono tabular-nums text-[#1D1D1F]">t = {cpPos}</span>
                </label>
                <input
                  type="range"
                  disabled={!hasCheckpoint}
                  min={20}
                  max={80}
                  value={cpPos}
                  onChange={(e) => setCpPos(Number(e.target.value))}
                  className="mt-1.5 w-full accent-[#007AFF] disabled:opacity-40"
                />
              </div>

              <div className="rounded-lg border border-slate-200 bg-[#F5F5F7] p-3">
                <label className="text-xs font-semibold text-[#6E6E73]">障害時利用テーブル種別</label>
                <select
                  value={worktableType}
                  onChange={(e) =>
                    setWorktableType(e.target.value as 'session-temp' | 'global-temp' | 'permanent')
                  }
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-base md:text-sm text-[#1D1D1F]"
                >
                  <option value="session-temp">セッションローカル一時表（ワークテーブル）</option>
                  <option value="global-temp">グローバル一時表（定義は永続・データは一時）</option>
                  <option value="permanent">通常の永続表（WALログ取得対象）</option>
                </select>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-[#F5F5F7] p-3.5 space-y-1 text-xs">
              <div className="font-bold text-[#1D1D1F]">
                RDBMS再開始時のワークテーブル再定義・データ回復判定
              </div>
              {worktableType === 'session-temp' && (
                <p className="text-[#1D1D1F]/85 leading-relaxed">
                  <strong className="text-red-700">【再定義＆データ再生成が必要】</strong>
                  セッション固有の一時ワークテーブルはWALログを取得せず、障害発生→RDBMS再開始時に定義・データともに消滅します。バッチ再実行（リラン）時は必ず{' '}
                  <code className="font-mono text-[#007AFF]">CREATE TEMP TABLE</code> から再定義して中間データを再作成する設計が必要です。
                </p>
              )}
              {worktableType === 'global-temp' && (
                <p className="text-[#1D1D1F]/85 leading-relaxed">
                  <strong className="text-[#1D1D1F]">【表定義は残存・行データは消滅（再投入が必要）】</strong>
                  グローバル一時表（GLOBAL TEMPORARY TABLE）のスキーマ定義自体はシステムカタログに永続化されるため再定義不要ですが、セッション内の中間データは障害時に揮発するためリラン時の再計算が必要です。
                </p>
              )}
              {worktableType === 'permanent' && (
                <p className="text-[#1D1D1F]/85 leading-relaxed">
                  <strong className="text-[#007AFF]">【再定義不要・WALログから自動回復】</strong>
                  永続表は先行書込みログ（WAL）の保護対象のため、RDBMS再開始時にコミット済はREDO、未コミットはUNDOで整合状態へ自動回復されます。
                </p>
              )}
            </div>
          </div>
        )}

        {/* ③ 4096B 空き領域率（PCTFREE）容量計算 */}
        {tab === 'capacity' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <div className="rounded-lg border border-slate-200 bg-[#F5F5F7] p-2.5">
                <label className="text-[11px] font-semibold text-[#6E6E73]">ページサイズ (B)</label>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 font-mono text-base md:text-sm tabular-nums text-[#1D1D1F]"
                >
                  <option value={4096}>4,096 B</option>
                  <option value={8192}>8,192 B</option>
                  <option value={16384}>16,384 B</option>
                </select>
              </div>
              <div className="rounded-lg border border-slate-200 bg-[#F5F5F7] p-2.5">
                <label className="text-[11px] font-semibold text-[#6E6E73]">制御ヘッダ (B)</label>
                <input
                  type="number"
                  min={0}
                  max={1024}
                  value={headerBytes}
                  onChange={(e) => setHeaderBytes(Math.max(0, Number(e.target.value) || 0))}
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-base md:text-sm tabular-nums text-[#1D1D1F]"
                />
              </div>
              <div className="rounded-lg border border-slate-200 bg-[#F5F5F7] p-2.5">
                <label className="text-[11px] font-semibold text-[#6E6E73]">空き領域率 PCTFREE (%)</label>
                <input
                  type="number"
                  min={0}
                  max={80}
                  value={pctFree}
                  onChange={(e) => setPctFree(Math.min(80, Math.max(0, Number(e.target.value) || 0)))}
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-base md:text-sm tabular-nums text-[#1D1D1F]"
                />
              </div>
              <div className="rounded-lg border border-slate-200 bg-[#F5F5F7] p-2.5">
                <label className="text-[11px] font-semibold text-[#6E6E73]">1行サイズ (B)</label>
                <input
                  type="number"
                  min={10}
                  max={3000}
                  value={rowBytes}
                  onChange={(e) => setRowBytes(Math.max(10, Number(e.target.value) || 10))}
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-base md:text-sm tabular-nums text-[#1D1D1F]"
                />
              </div>
              <div className="rounded-lg border border-slate-200 bg-[#F5F5F7] p-2.5">
                <label className="text-[11px] font-semibold text-[#6E6E73]">格納総行数</label>
                <input
                  type="number"
                  min={1}
                  step={10000}
                  value={capTotalRows}
                  onChange={(e) => setCapTotalRows(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-base md:text-sm tabular-nums text-[#1D1D1F]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setFormulaMode('after-header')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    formulaMode === 'after-header'
                      ? 'bg-[#007AFF] text-white'
                      : 'border border-slate-200 bg-[#F5F5F7] text-[#6E6E73]'
                  }`}
                >
                  A式: (ページ-ヘッダ)×(1-PCTFREE)
                </button>
                <button
                  type="button"
                  onClick={() => setFormulaMode('whole-page')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    formulaMode === 'whole-page'
                      ? 'bg-[#007AFF] text-white'
                      : 'border border-slate-200 bg-[#F5F5F7] text-[#6E6E73]'
                  }`}
                >
                  B式: ページ×(1-PCTFREE) - ヘッダ
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#6E6E73]">
                <span>
                  UPDATE時1行増分:{' '}
                  <span className="font-mono tabular-nums text-[#1D1D1F]">+{updateGrowthBytes}B</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={120}
                  value={updateGrowthBytes}
                  onChange={(e) => setUpdateGrowthBytes(Number(e.target.value))}
                  className="w-28 accent-[#007AFF]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-y-0 sm:divide-x divide-slate-200 rounded-lg border border-slate-200 bg-[#F5F5F7]">
              <div className="p-3">
                <div className="text-[11px] font-semibold text-[#6E6E73]">
                  ① 1ページ最大行数（切捨て floor）
                </div>
                <div className="mt-1 font-mono text-xl font-bold tabular-nums text-[#1D1D1F]">
                  {maxRowsPerPage}{' '}
                  <span className="text-xs font-normal text-[#6E6E73]">行/ページ</span>
                </div>
                <div className="mt-0.5 font-mono text-[11px] tabular-nums text-[#6E6E73]">
                  floor({usableBytes}B ÷ {rowBytes}B) = {(usableBytes / rowBytes).toFixed(2)} →{' '}
                  {maxRowsPerPage}
                </div>
              </div>
              <div className="p-3">
                <div className="text-[11px] font-semibold text-[#6E6E73]">
                  ② 必要ページ数（切上げ ceil）
                </div>
                <div className="mt-1 font-mono text-xl font-bold tabular-nums text-[#1D1D1F]">
                  {requiredPages.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-[#6E6E73]">ページ</span>
                </div>
                <div className="mt-0.5 font-mono text-[11px] tabular-nums text-[#6E6E73]">
                  ceil({capTotalRows.toLocaleString()} ÷ {maxRowsPerPage}) ={' '}
                  {(capTotalRows / maxRowsPerPage).toFixed(2)} → {requiredPages.toLocaleString()}
                </div>
              </div>
              <div className="p-3">
                <div className="text-[11px] font-semibold text-[#6E6E73]">③ 合計ディスク容量</div>
                <div className="mt-1 font-mono text-xl font-bold tabular-nums text-[#1D1D1F]">
                  {totalSizeMb} <span className="text-xs font-normal text-[#6E6E73]">MB</span>
                </div>
                <div className="mt-0.5 font-mono text-[11px] tabular-nums text-[#6E6E73]">
                  {requiredPages.toLocaleString()} × {pageSize.toLocaleString()}B
                </div>
              </div>
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

        {/* チェックポイント確認クイズ */}
        {tab === 'checkpoint' && (
          <div className="rounded-lg border border-slate-200 bg-[#F5F5F7] p-3.5 space-y-2">
            <div className="text-xs font-semibold text-[#1D1D1F]">
              確認クイズ：現在の設定（チェックポイント{hasCheckpoint ? 'あり' : 'なし'}）で REDO（ロールフォワード）対象になるTXをカンマ区切りで入力（例：T2,T4）
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={cpQuizAnswer}
                onChange={(e) => setCpQuizAnswer(e.target.value)}
                placeholder="例: T2,T4"
                className="w-48 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-base md:text-sm text-[#1D1D1F] focus:border-[#007AFF] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCheckCpQuiz}
                className="rounded-lg bg-[#007AFF] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#0066D6]"
              >
                判定する
              </button>
            </div>
            {cpQuizFeedback && (
              <div className="text-xs font-medium text-[#1D1D1F]">{cpQuizFeedback}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
