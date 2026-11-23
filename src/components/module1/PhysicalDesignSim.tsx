// シミュレーター③：高/低クラスタ索引I/Oページ計算 ＆ チェックポイント障害回復・ワークテーブル再定義判定 ＆ 4096B PCTFREE容量計算
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

interface Props {
  store: StudyStore;
}

type PhysTab = 'cluster' | 'checkpoint' | 'capacity';

interface TxSpec {
  id: string;
  label: string;
  start: number; // 0..100
  end: number;   // 0..100 (100 = 障害発生時未コミット)
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
  const [canvasTick, setCanvasTick] = useState(0);

  // ===== ① 高/低クラスタ索引I/O パラメータ =====
  const [totalRows, setTotalRows] = useState(1000000);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [btreeHeight, setBtreeHeight] = useState(3);
  const [selectivityPct, setSelectivityPct] = useState(2.5); // 抽出率 %

  const totalPages = Math.ceil(totalRows / Math.max(1, rowsPerPage));
  const targetRows = Math.max(1, Math.round((totalRows * selectivityPct) / 100));
  const highClusterIo = btreeHeight + Math.ceil(targetRows / Math.max(1, rowsPerPage));
  const lowClusterIo = btreeHeight + targetRows; // 低クラスタ最悪ケース：行数そのまま
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
  const [cpPos, setCpPos] = useState(48); // 20..80
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

  useEffect(() => {
    const onResize = () => setCanvasTick((t) => t + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // チェックポイント確認クイズ採点
  const handleCheckCpQuiz = () => {
    const expected = hasCheckpoint ? 'T2,T4' : 'T1,T2,T4';
    const norm = cpQuizAnswer.replace(/\s+/g, '').toUpperCase();
    if (norm === expected) {
      setCpQuizFeedback(`正解！チェックポイント${hasCheckpoint ? 'あり' : 'なし'}時のREDO対象は ${expected} です（未コミットのT3, T5はUNDO）。`);
      store.incrementAttempts();
    } else {
      setCpQuizFeedback(`不正解（正解：${expected}）。弱点復習キューに登録しました！`);
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
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = Math.max(320, container.clientWidth);

    // =========================================================================
    // Canvas A：高/低クラスタ索引I/Oアクセスパターン＆損益分岐点チャート
    // =========================================================================
    if (tab === 'cluster') {
      const height = 420;
      const ctx = setupHiDpiCanvas(canvas, width, height);
      if (!ctx) return;
      drawCanvasGrid(ctx, width, height, 24);

      ctx.fillStyle = CANVAS_COLORS.textMain;
      ctx.font = `700 13px ${CANVAS_FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('物理I/Oアクセスパターン比較（高クラスタ連続読込 vs 低クラスタ散乱読込）', 14, 20);

      // 上段：左に高クラスタ、右に低クラスタのディスクページアクセス図
      const halfW = (width - 36) / 2;
      const drawAccessBox = (x0: number, title: string, isHigh: boolean) => {
        const accent = isHigh ? CANVAS_COLORS.emerald : CANVAS_COLORS.rose;
        drawRoundedRect(ctx, x0, 38, halfW, 156, 10, CANVAS_COLORS.bgPanel, accent, 1.5);
        ctx.fillStyle = accent;
        ctx.font = `700 11px ${CANVAS_FONT_FAMILY}`;
        ctx.textAlign = 'left';
        drawFittedText(ctx, title, x0 + 10, 54, halfW - 20);

        // リーフノード（索引側）
        const leafY = 74;
        const leafW = Math.min(28, (halfW - 44) / 6);
        const startLeafX = x0 + (halfW - leafW * 6 - 20) / 2;
        const pageY = 148;
        const pageCount = 8;
        const pageW = Math.min(24, (halfW - 32) / pageCount - 3);
        const startPageX = x0 + (halfW - (pageW + 3) * pageCount) / 2;

        // データページ8個を描画
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
            1.4
          );
          ctx.fillStyle = isHit ? CANVAS_COLORS.textMain : CANVAS_COLORS.textMuted;
          ctx.font = `700 9px ${CANVAS_MONO_FAMILY}`;
          ctx.textAlign = 'center';
          ctx.fillText(`P${p + 1}`, px + pageW / 2, pageY + 15);
        }

        // リーフ6キーからデータページへ矢印
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
          drawArrow(ctx, kx + leafW / 2, leafY + 20, tx, pageY - 2, accent, 1.5, !isHigh, 6);
        }
      };

      drawAccessBox(12, `高クラスタ: ${highClusterIo.toLocaleString()} P（連続）`, true);
      drawAccessBox(width / 2 + 6, `低クラスタ: ${lowClusterIo.toLocaleString()} P（散乱）`, false);

      // 下段：抽出率(%) vs I/Oページ数の損益分岐点折れ線チャート
      const chartX = 58;
      const chartY = 228;
      const chartW = width - chartX - 24;
      const chartH = 152;
      drawRoundedRect(ctx, 12, 204, width - 24, 206, 10, CANVAS_COLORS.bgPanel, CANVAS_COLORS.border, 1.4);

      ctx.fillStyle = CANVAS_COLORS.textMain;
      ctx.font = `700 11px ${CANVAS_FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.fillText(
        `抽出率(%) vs ディスクI/Oページ数（低クラスタ逆転分岐点 ≒ ${breakEvenPct.toFixed(2)}%）`,
        24,
        218
      );

      // 軸
      ctx.strokeStyle = CANVAS_COLORS.borderLight;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(chartX, chartY);
      ctx.lineTo(chartX, chartY + chartH);
      ctx.lineTo(chartX + chartW, chartY + chartH);
      ctx.stroke();

      const maxPct = 10; // 0%..10%
      const maxIo = fullScanIo * 2.2;
      const toX = (pct: number) => chartX + (Math.min(maxPct, pct) / maxPct) * chartW;
      const toY = (io: number) => chartY + chartH - (Math.min(maxIo, io) / maxIo) * chartH;

      // Y軸目盛
      ctx.fillStyle = CANVAS_COLORS.textMuted;
      ctx.font = `600 9px ${CANVAS_MONO_FAMILY}`;
      ctx.textAlign = 'right';
      ctx.fillText(`${fullScanIo.toLocaleString()}`, chartX - 6, toY(fullScanIo));
      ctx.fillText('0', chartX - 6, chartY + chartH);

      // X軸目盛
      ctx.textAlign = 'center';
      [0, 2, 4, 6, 8, 10].forEach((p) => {
        ctx.fillText(`${p}%`, toX(p), chartY + chartH + 14);
      });

      // 1. 表探索ライン（水平・アンバー）
      ctx.strokeStyle = CANVAS_COLORS.amber;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(fullScanIo));
      ctx.lineTo(toX(maxPct), toY(fullScanIo));
      ctx.stroke();
      ctx.setLineDash([]);

      // 2. 低クラスタ索引ライン（急上昇・ローズ）
      ctx.strokeStyle = CANVAS_COLORS.rose;
      ctx.lineWidth = 2.4;
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

      // 3. 高クラスタ索引ライン（緩やか・エメラルド）
      ctx.strokeStyle = CANVAS_COLORS.emerald;
      ctx.lineWidth = 2.4;
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

      // 現在の抽出率マーカー
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

      // 凡例（右上）
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

    // =========================================================================
    // Canvas B：チェックポイント障害回復＆REDO/UNDO判定タイムライン
    // =========================================================================
    if (tab === 'checkpoint') {
      const height = 365;
      const ctx = setupHiDpiCanvas(canvas, width, height);
      if (!ctx) return;
      drawCanvasGrid(ctx, width, height, 24);

      ctx.fillStyle = CANVAS_COLORS.textMain;
      ctx.font = `700 13px ${CANVAS_FONT_FAMILY}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `障害回復タイムライン（チェックポイント: ${hasCheckpoint ? `取得あり @ t=${cpPos}` : '取得なし → 全ログREDO！'}）`,
        14,
        22
      );

      const leftM = 128;
      const rightM = 84;
      const trackW = Math.max(120, width - leftM - rightM);
      const toTxX = (pct: number) => leftM + (pct / 100) * trackW;
      const crashX = toTxX(94);
      const cpX = toTxX(cpPos);

      // ログスキャン範囲の帯（REDO走査区間）
      const scanStartX = hasCheckpoint ? cpX : toTxX(0);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.fillRect(scanStartX, 46, crashX - scanStartX, 248);

      // チェックポイント縦線
      if (hasCheckpoint) {
        ctx.save();
        ctx.strokeStyle = CANVAS_COLORS.amber;
        ctx.lineWidth = 2.4;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(cpX, 44);
        ctx.lineTo(cpX, 302);
        ctx.stroke();
        ctx.restore();
        drawPillBadge(ctx, 'チェックポイント(CP)', cpX, 54, CANVAS_COLORS.amberSoft, CANVAS_COLORS.amber, CANVAS_COLORS.amber, 10);
      }

      // システム障害縦線
      ctx.strokeStyle = CANVAS_COLORS.rose;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(crashX, 44);
      ctx.lineTo(crashX, 302);
      ctx.stroke();
      drawPillBadge(ctx, 'システム障害!', crashX - 10, 54, CANVAS_COLORS.roseSoft, CANVAS_COLORS.rose, CANVAS_COLORS.rose, 10);

      // T1〜T5 描画
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
        ctx.font = `700 11px ${CANVAS_FONT_FAMILY}`;
        ctx.textAlign = 'left';
        drawFittedText(ctx, tx.label, 12, y + 12, leftM - 16);

        const x1 = toTxX(tx.start);
        const x2 = toTxX(tx.end);
        drawRoundedRect(ctx, x1, y, Math.max(16, x2 - x1), 24, 6, bg, col, 1.8);

        // COMMIT丸またはCRASH×印
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

        // 右端の判定バッジ
        const badgeText =
          action === 'REDO' ? 'REDO' : action === 'UNDO' ? 'UNDO' : '回復不要';
        drawPillBadge(ctx, badgeText, width - 42, y + 12, bg, col, col, 10);
      });

      // 下部：RDBMS再開始時のREDOスキャン長表示
      drawArrow(ctx, scanStartX, 322, crashX, 322, CANVAS_COLORS.cyan, 2.5, false, 8);
      ctx.fillStyle = CANVAS_COLORS.cyan;
      ctx.font = `700 11px ${CANVAS_FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillText(
        hasCheckpoint
          ? `RDBMS再開始時 REDOログ読込範囲（CP〜障害：全体の約${Math.round(94 - cpPos)}%）`
          : 'チェックポイントなし → ログ先頭から全量REDO（再開始時間が大幅増大！）',
        (scanStartX + crashX) / 2,
        344
      );
      return;
    }

    // =========================================================================
    // Canvas C：4096B 空き領域率（PCTFREE）1ページ内部バイトマップ
    // =========================================================================
    const height = 340;
    const ctx = setupHiDpiCanvas(canvas, width, height);
    if (!ctx) return;
    drawCanvasGrid(ctx, width, height, 24);

    ctx.fillStyle = CANVAS_COLORS.textMain;
    ctx.font = `700 13px ${CANVAS_FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `1データページ（${pageSize.toLocaleString()}B）内部レイアウト可視化 — 最大 ${maxRowsPerPage} 行/ページ（floor切捨て）`,
      14,
      22
    );

    // 比例バー（上段）
    const barX = 16;
    const barY = 52;
    const barW = width - 32;
    const barH = 66;

    const wHeader = (headerBytes / pageSize) * barW;
    const wData = (usedDataBytes / pageSize) * barW;
    const wWaste = (wasteBytes / pageSize) * barW;
    const wFree = Math.max(0, barW - wHeader - wData - wWaste);

    // 1. ヘッダ領域
    drawRoundedRect(ctx, barX, barY, Math.max(6, wHeader), barH, 4, CANVAS_COLORS.amberSoft, CANVAS_COLORS.amber, 1.5);
    // 2. データ行格納領域
    drawRoundedRect(ctx, barX + wHeader, barY, Math.max(6, wData), barH, 4, CANVAS_COLORS.cyanSoft, CANVAS_COLORS.cyan, 1.5);
    // 3. 端数バイト（行が収まらない余り）
    if (wWaste > 2) {
      drawRoundedRect(ctx, barX + wHeader + wData, barY, wWaste, barH, 2, CANVAS_COLORS.bgPanel, CANVAS_COLORS.textMuted, 1.2);
    }
    // 4. PCTFREE 空き領域
    if (wFree > 2) {
      drawRoundedRect(ctx, barX + wHeader + wData + wWaste, barY, wFree, barH, 4, CANVAS_COLORS.emeraldSoft, CANVAS_COLORS.emerald, 1.5);
    }

    // 比例バーラベル
    ctx.font = `700 11px ${CANVAS_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    if (wData > 70) {
      ctx.fillStyle = CANVAS_COLORS.textMain;
      ctx.fillText(`データ行 (${maxRowsPerPage}行 = ${usedDataBytes}B)`, barX + wHeader + wData / 2, barY + barH / 2);
    }
    if (wFree > 64) {
      ctx.fillStyle = '#a7f3d0';
      ctx.fillText(`PCTFREE (${pctFreeBytes}B)`, barX + wHeader + wData + wWaste + wFree / 2, barY + barH / 2);
    }

    // 凡例 4項目
    const caps = [
      { name: `ヘッダ: ${headerBytes}B`, color: CANVAS_COLORS.amber },
      { name: `データ行: ${usedDataBytes}B (${maxRowsPerPage}行)`, color: CANVAS_COLORS.cyan },
      { name: `端数(floor余り): ${wasteBytes}B`, color: CANVAS_COLORS.textMuted },
      { name: `PCTFREE予備: ${pctFreeBytes}B`, color: CANVAS_COLORS.emerald },
    ];
    let lx = 16;
    ctx.font = `600 11px ${CANVAS_FONT_FAMILY}`;
    ctx.textAlign = 'left';
    caps.forEach((c, idx) => {
      const rowY = idx < 2 ? 138 : 158;
      if (idx === 2) lx = 16;
      ctx.fillStyle = c.color;
      ctx.fillRect(lx, rowY - 5, 10, 10);
      ctx.fillStyle = CANVAS_COLORS.textSub;
      ctx.fillText(c.name, lx + 14, rowY);
      lx += Math.max(150, ctx.measureText(c.name).width + 28);
    });

    // 中段：個別行スロットのグリッド視覚化（最大40スロットまで表示）
    const slotPanelY = 180;
    drawRoundedRect(ctx, 16, slotPanelY, barW, 140, 10, CANVAS_COLORS.bgPanel, CANVAS_COLORS.border, 1.4);
    ctx.fillStyle = CANVAS_COLORS.textMain;
    ctx.font = `700 11px ${CANVAS_FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.fillText(
      `行スロット格納イメージ ＆ UPDATE行長+${updateGrowthBytes}B 時の行移行（Row Migration）判定`,
      28,
      slotPanelY + 20
    );

    const displaySlots = Math.min(24, maxRowsPerPage);
    const cols = Math.min(12, Math.max(4, Math.floor((barW - 24) / 56)));
    const slotW = (barW - 28 - (cols - 1) * 5) / cols;
    for (let i = 0; i < displaySlots; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const sx = 28 + c * (slotW + 5);
      const sy = slotPanelY + 38 + r * 26;
      if (sy + 20 > slotPanelY + 100) break;
      drawRoundedRect(ctx, sx, sy, slotW, 20, 4, CANVAS_COLORS.cyanSoft, CANVAS_COLORS.cyan, 1.1);
      ctx.fillStyle = CANVAS_COLORS.textMain;
      ctx.font = `600 9px ${CANVAS_MONO_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillText(`R${i + 1}`, sx + slotW / 2, sy + 10);
    }

    // 行移行判定バナー
    const migColor = causesRowMigration ? CANVAS_COLORS.rose : CANVAS_COLORS.emerald;
    const migBg = causesRowMigration ? CANVAS_COLORS.roseSoft : CANVAS_COLORS.emeraldSoft;
    drawRoundedRect(ctx, 28, slotPanelY + 102, barW - 24, 28, 6, migBg, migColor, 1.5);
    ctx.fillStyle = CANVAS_COLORS.textMain;
    ctx.font = `700 11px ${CANVAS_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    drawFittedText(
      ctx,
      causesRowMigration
        ? `警告：全行+${updateGrowthBytes}B増で必要増分 ${totalGrowthPerPage}B > 予備 ${(pctFreeBytes + wasteBytes)}B → 行移行（Row Migration）発生！`
        : `安全：全行+${updateGrowthBytes}B増（計${totalGrowthPerPage}B）を予備領域 ${(pctFreeBytes + wasteBytes)}B 内で吸収可能（行移行なし）`,
      width / 2,
      slotPanelY + 116,
      barW - 36
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
    canvasTick,
  ]);

  return (
    <div className="space-y-4">
      {/* サブタブ */}
      <div className="inline-flex flex-wrap rounded-md border border-[#d4d4d0] bg-[#f1f1ee] p-0.5">
        <button
          type="button"
          onClick={() => setTab('cluster')}
          className={`rounded px-3 py-1.5 text-xs font-semibold transition ${
            tab === 'cluster' ? 'bg-white text-[#18181b] shadow-xs' : 'text-[#52525b]'
          }`}
        >
          高/低クラスタ索引 I/O計算
        </button>
        <button
          type="button"
          onClick={() => setTab('checkpoint')}
          className={`rounded px-3 py-1.5 text-xs font-semibold transition ${
            tab === 'checkpoint' ? 'bg-white text-[#18181b] shadow-xs' : 'text-[#52525b]'
          }`}
        >
          チェックポイント回復・ワークテーブル
        </button>
        <button
          type="button"
          onClick={() => setTab('capacity')}
          className={`rounded px-3 py-1.5 text-xs font-semibold transition ${
            tab === 'capacity' ? 'bg-white text-[#18181b] shadow-xs' : 'text-[#52525b]'
          }`}
        >
          4096B PCTFREE 容量計算
        </button>
      </div>

      <div className="rounded-lg border border-[#e4e4e0] bg-white p-4 space-y-4">
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
                className="rounded-md border border-[#d4d4d0] bg-[#f6f6f4] px-3 py-1.5 text-xs font-semibold text-[#18181b] hover:bg-[#e4e4e0]"
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
                className="rounded-md border border-[#d4d4d0] bg-[#f6f6f4] px-3 py-1.5 text-xs font-semibold text-[#18181b] hover:bg-[#e4e4e0]"
              >
                H31春プリセット（100万行・抽出1%）
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-md border border-[#e4e4e0] bg-[#f6f6f4] p-2.5">
                <label className="text-[11px] font-semibold text-[#52525b]">総行数</label>
                <input
                  type="number"
                  min={1000}
                  step={100000}
                  value={totalRows}
                  onChange={(e) => setTotalRows(Math.max(1000, Number(e.target.value) || 1000))}
                  className="mt-1 w-full rounded border border-[#d4d4d0] bg-white px-2 py-1 text-sm font-mono text-[#18181b]"
                />
              </div>
              <div className="rounded-md border border-[#e4e4e0] bg-[#f6f6f4] p-2.5">
                <label className="text-[11px] font-semibold text-[#52525b]">1ページあたり行数</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={rowsPerPage}
                  onChange={(e) => setRowsPerPage(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-1 w-full rounded border border-[#d4d4d0] bg-white px-2 py-1 text-sm font-mono text-[#18181b]"
                />
              </div>
              <div className="rounded-md border border-[#e4e4e0] bg-[#f6f6f4] p-2.5">
                <label className="text-[11px] font-semibold text-[#52525b]">B+木索引の高さ</label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={btreeHeight}
                  onChange={(e) => setBtreeHeight(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-1 w-full rounded border border-[#d4d4d0] bg-white px-2 py-1 text-sm font-mono text-[#18181b]"
                />
              </div>
              <div className="rounded-md border border-[#e4e4e0] bg-[#f6f6f4] p-2.5">
                <label className="text-[11px] font-semibold text-[#18181b]">
                  抽出率: {selectivityPct.toFixed(1)}% ({targetRows.toLocaleString()}行)
                </label>
                <input
                  type="range"
                  min={0.1}
                  max={10}
                  step={0.1}
                  value={selectivityPct}
                  onChange={(e) => setSelectivityPct(Number(e.target.value))}
                  className="mt-2 w-full accent-[#18181b]"
                />
              </div>
            </div>

            {/* 3方式 I/O サマリー */}
            <div className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-y-0 sm:divide-x divide-[#e4e4e0] rounded-md border border-[#e4e4e0] bg-[#f6f6f4]">
              <div className="p-3">
                <div className="text-xs font-semibold text-[#15803d]">高クラスタ索引 I/O</div>
                <div className="mt-1 text-xl font-bold font-mono text-[#18181b]">
                  {highClusterIo.toLocaleString()} <span className="text-xs font-normal text-[#71717a]">ページ</span>
                </div>
                <div className="mt-0.5 text-[11px] font-mono text-[#52525b]">
                  {btreeHeight} + ceil({targetRows.toLocaleString()} / {rowsPerPage})
                </div>
              </div>
              <div className="p-3">
                <div className="text-xs font-semibold text-[#be123c]">低クラスタ索引 I/O（最悪）</div>
                <div className="mt-1 text-xl font-bold font-mono text-[#18181b]">
                  {lowClusterIo.toLocaleString()} <span className="text-xs font-normal text-[#71717a]">ページ</span>
                </div>
                <div className="mt-0.5 text-[11px] font-mono text-[#52525b]">
                  {btreeHeight} + {targetRows.toLocaleString()}（抽出行数そのまま）
                </div>
              </div>
              <div className="p-3">
                <div className="text-xs font-semibold text-[#b45309]">表探索（フルスキャン）</div>
                <div className="mt-1 text-xl font-bold font-mono text-[#18181b]">
                  {fullScanIo.toLocaleString()} <span className="text-xs font-normal text-[#71717a]">ページ</span>
                </div>
                <div className="mt-0.5 text-[11px] text-[#52525b]">
                  最速方式：<strong className="text-[#18181b]">{fastestMethod}</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ② チェックポイント＆ワークテーブル再定義判定 */}
        {tab === 'checkpoint' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="flex cursor-pointer items-center justify-between rounded-md border border-[#e4e4e0] bg-[#f6f6f4] p-3">
                <span className="text-xs font-semibold text-[#18181b]">チェックポイント取得</span>
                <input
                  type="checkbox"
                  checked={hasCheckpoint}
                  onChange={(e) => {
                    setHasCheckpoint(e.target.checked);
                    setCpQuizFeedback(null);
                  }}
                  className="h-4 w-4 accent-[#18181b]"
                />
              </label>

              <div className="rounded-md border border-[#e4e4e0] bg-[#f6f6f4] p-3">
                <label className="text-xs font-semibold text-[#52525b]">
                  チェックポイント時刻: t = {cpPos}
                </label>
                <input
                  type="range"
                  disabled={!hasCheckpoint}
                  min={20}
                  max={80}
                  value={cpPos}
                  onChange={(e) => setCpPos(Number(e.target.value))}
                  className="mt-1.5 w-full accent-[#18181b] disabled:opacity-40"
                />
              </div>

              <div className="rounded-md border border-[#e4e4e0] bg-[#f6f6f4] p-3">
                <label className="text-xs font-semibold text-[#52525b]">障害時利用テーブル種別</label>
                <select
                  value={worktableType}
                  onChange={(e) =>
                    setWorktableType(e.target.value as 'session-temp' | 'global-temp' | 'permanent')
                  }
                  className="mt-1 w-full rounded border border-[#d4d4d0] bg-white px-2 py-1 text-xs text-[#18181b]"
                >
                  <option value="session-temp">セッションローカル一時表（ワークテーブル）</option>
                  <option value="global-temp">グローバル一時表（定義は永続・データは一時）</option>
                  <option value="permanent">通常の永続表（WALログ取得対象）</option>
                </select>
              </div>
            </div>

            <div className="rounded-md border border-[#e4e4e0] bg-[#f6f6f4] p-3.5 space-y-1 text-xs">
              <div className="font-bold text-[#18181b]">
                RDBMS再開始時のワークテーブル再定義・データ回復判定
              </div>
              {worktableType === 'session-temp' && (
                <p className="text-[#3f3f46] leading-relaxed">
                  <strong className="text-[#be123c]">【再定義＆データ再生成が必要】</strong>
                  セッション固有の一時ワークテーブルはWALログを取得せず、障害発生→RDBMS再開始時に定義・データともに消滅します。バッチ再実行（リラン）時は必ず <code>CREATE TEMP TABLE</code> から再定義して中間データを再作成する設計が必要です。
                </p>
              )}
              {worktableType === 'global-temp' && (
                <p className="text-[#3f3f46] leading-relaxed">
                  <strong className="text-[#b45309]">【表定義は残存・行データは消滅（再投入が必要）】</strong>
                  グローバル一時表（GLOBAL TEMPORARY TABLE）のスキーマ定義自体はシステムカタログに永続化されるため再定義不要ですが、セッション内の中間データは障害時に揮発するためリラン時の再計算が必要です。
                </p>
              )}
              {worktableType === 'permanent' && (
                <p className="text-[#3f3f46] leading-relaxed">
                  <strong className="text-[#15803d]">【再定義不要・WALログから自動回復】</strong>
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
              <div className="rounded-md border border-[#e4e4e0] bg-[#f6f6f4] p-2.5">
                <label className="text-[11px] font-semibold text-[#52525b]">ページサイズ (B)</label>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="mt-1 w-full rounded border border-[#d4d4d0] bg-white px-2 py-1 text-sm font-mono text-[#18181b]"
                >
                  <option value={4096}>4,096 B</option>
                  <option value={8192}>8,192 B</option>
                  <option value={16384}>16,384 B</option>
                </select>
              </div>
              <div className="rounded-md border border-[#e4e4e0] bg-[#f6f6f4] p-2.5">
                <label className="text-[11px] font-semibold text-[#52525b]">制御ヘッダ (B)</label>
                <input
                  type="number"
                  min={0}
                  max={1024}
                  value={headerBytes}
                  onChange={(e) => setHeaderBytes(Math.max(0, Number(e.target.value) || 0))}
                  className="mt-1 w-full rounded border border-[#d4d4d0] bg-white px-2 py-1 text-sm font-mono text-[#18181b]"
                />
              </div>
              <div className="rounded-md border border-[#e4e4e0] bg-[#f6f6f4] p-2.5">
                <label className="text-[11px] font-semibold text-[#15803d]">空き領域率 PCTFREE (%)</label>
                <input
                  type="number"
                  min={0}
                  max={80}
                  value={pctFree}
                  onChange={(e) => setPctFree(Math.min(80, Math.max(0, Number(e.target.value) || 0)))}
                  className="mt-1 w-full rounded border border-[#d4d4d0] bg-white px-2 py-1 text-sm font-mono text-[#18181b]"
                />
              </div>
              <div className="rounded-md border border-[#e4e4e0] bg-[#f6f6f4] p-2.5">
                <label className="text-[11px] font-semibold text-[#52525b]">1行サイズ (B)</label>
                <input
                  type="number"
                  min={10}
                  max={3000}
                  value={rowBytes}
                  onChange={(e) => setRowBytes(Math.max(10, Number(e.target.value) || 10))}
                  className="mt-1 w-full rounded border border-[#d4d4d0] bg-white px-2 py-1 text-sm font-mono text-[#18181b]"
                />
              </div>
              <div className="rounded-md border border-[#e4e4e0] bg-[#f6f6f4] p-2.5">
                <label className="text-[11px] font-semibold text-[#52525b]">格納総行数</label>
                <input
                  type="number"
                  min={1}
                  step={10000}
                  value={capTotalRows}
                  onChange={(e) => setCapTotalRows(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-1 w-full rounded border border-[#d4d4d0] bg-white px-2 py-1 text-sm font-mono text-[#18181b]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setFormulaMode('after-header')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                    formulaMode === 'after-header'
                      ? 'bg-[#18181b] text-white'
                      : 'border border-[#d4d4d0] bg-[#f6f6f4] text-[#52525b]'
                  }`}
                >
                  A式: (ページ-ヘッダ)×(1-PCTFREE)
                </button>
                <button
                  type="button"
                  onClick={() => setFormulaMode('whole-page')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                    formulaMode === 'whole-page'
                      ? 'bg-[#18181b] text-white'
                      : 'border border-[#d4d4d0] bg-[#f6f6f4] text-[#52525b]'
                  }`}
                >
                  B式: ページ×(1-PCTFREE) - ヘッダ
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#52525b]">
                <span>UPDATE時1行増分: +{updateGrowthBytes}B</span>
                <input
                  type="range"
                  min={0}
                  max={120}
                  value={updateGrowthBytes}
                  onChange={(e) => setUpdateGrowthBytes(Number(e.target.value))}
                  className="w-28 accent-[#18181b]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-y-0 sm:divide-x divide-[#e4e4e0] rounded-md border border-[#e4e4e0] bg-[#f6f6f4]">
              <div className="p-3">
                <div className="text-[11px] font-semibold text-[#1d4ed8]">① 1ページ最大行数（切捨て floor）</div>
                <div className="mt-1 text-xl font-bold font-mono text-[#18181b]">
                  {maxRowsPerPage} <span className="text-xs font-normal text-[#71717a]">行/ページ</span>
                </div>
                <div className="mt-0.5 text-[11px] font-mono text-[#52525b]">
                  floor({usableBytes}B ÷ {rowBytes}B) = {(usableBytes / rowBytes).toFixed(2)} → {maxRowsPerPage}
                </div>
              </div>
              <div className="p-3">
                <div className="text-[11px] font-semibold text-[#15803d]">② 必要ページ数（切上げ ceil）</div>
                <div className="mt-1 text-xl font-bold font-mono text-[#18181b]">
                  {requiredPages.toLocaleString()} <span className="text-xs font-normal text-[#71717a]">ページ</span>
                </div>
                <div className="mt-0.5 text-[11px] font-mono text-[#52525b]">
                  ceil({capTotalRows.toLocaleString()} ÷ {maxRowsPerPage}) = {(capTotalRows / maxRowsPerPage).toFixed(2)} → {requiredPages.toLocaleString()}
                </div>
              </div>
              <div className="p-3">
                <div className="text-[11px] font-semibold text-[#b45309]">③ 合計ディスク容量</div>
                <div className="mt-1 text-xl font-bold font-mono text-[#18181b]">
                  {totalSizeMb} <span className="text-xs font-normal text-[#71717a]">MB</span>
                </div>
                <div className="mt-0.5 text-[11px] font-mono text-[#52525b]">
                  {requiredPages.toLocaleString()} × {pageSize.toLocaleString()}B
                </div>
              </div>
            </div>
          </div>
        )}

        {/* HTML5 Canvas 図板 */}
        <div
          ref={containerRef}
          className="w-full overflow-hidden rounded-md border border-[#1e293b] bg-[#0f172a]"
        >
          <canvas ref={canvasRef} className="block w-full" />
        </div>

        {/* チェックポイント確認クイズ */}
        {tab === 'checkpoint' && (
          <div className="rounded-md border border-[#e4e4e0] bg-[#f6f6f4] p-3.5 space-y-2">
            <div className="text-xs font-semibold text-[#18181b]">
              確認クイズ：現在の設定（チェックポイント{hasCheckpoint ? 'あり' : 'なし'}）で REDO（ロールフォワード）対象になるTXをカンマ区切りで入力（例：T2,T4）
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={cpQuizAnswer}
                onChange={(e) => setCpQuizAnswer(e.target.value)}
                placeholder="例: T2,T4"
                className="w-48 rounded-md border border-[#d4d4d0] bg-white px-3 py-1.5 text-sm font-mono text-[#18181b]"
              />
              <button
                type="button"
                onClick={handleCheckCpQuiz}
                className="rounded-md bg-[#18181b] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#27272a]"
              >
                判定する
              </button>
            </div>
            {cpQuizFeedback && (
              <div className="text-xs font-medium text-[#3f3f46]">{cpQuizFeedback}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
