// モジュール5前半：月間カレンダー形式スケジュール（2026年11月〜2027年3月）＆ 18週間進捗トラッカー
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ROADMAP_WEEKS } from '../../data/roadmap';
import type { ModuleId, RoadmapTask, RoadmapWeek } from '../../types/exam';
import type { StudyStore } from '../../state/useStudyStore';
import {
  CANVAS_COLORS,
  CANVAS_FONT_FAMILY,
  CANVAS_MONO_FAMILY,
  setupHiDpiCanvas,
  drawRoundedRect,
  drawCanvasGrid,
  drawPillBadge,
  drawFittedText,
} from '../../utils/canvasHelpers';
import { useCanvasContainerWidth } from '../../utils/useCanvasWidth';

interface Props {
  store: StudyStore;
  onNavigateModule: (moduleId: ModuleId) => void;
}

const TARGET_MONTHS = [
  { year: 2026, month: 11, label: '2026年11月', short: '11月' },
  { year: 2026, month: 12, label: '2026年12月', short: '12月' },
  { year: 2027, month: 1, label: '2027年1月', short: '1月' },
  { year: 2027, month: 2, label: '2027年2月', short: '2月' },
  { year: 2027, month: 3, label: '2027年3月', short: '3月' },
];

const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

const PHASE_COLORS: Record<string, string> = {
  'Phase 1: 基礎・正規化徹底': '#38bdf8',
  'Phase 2: 概念モデル・E-R図習得': '#34d399',
  'Phase 3: SQL・トランザクション実戦': '#a78bfa',
  'Phase 4: 物理設計・計算問題制覇': '#f59e0b',
  'Phase 5: CBT本番形式・弱点完全撲滅': '#fb7185',
};

const CATEGORY_LABEL: Record<NonNullable<RoadmapTask['category']>, string> = {
  textbook: 'テキスト',
  app: '演習',
  cbt: 'CBT',
  review: '復習',
};

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 指定年月の月曜始まりカレンダー週配列を生成する */
export function buildMonthCalendarRows(year: number, month: number): Array<{
  mondayStr: string;
  days: Array<{ dateStr: string; dayNum: number; inMonth: boolean; dow: number }>;
  roadmapWeek: RoadmapWeek | null;
}> {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startOffset = (firstDay.getDay() + 6) % 7; // 月曜=0 .. 日曜=6
  const cursor = new Date(year, month - 1, 1 - startOffset);

  const weekMap = new Map<string, RoadmapWeek>();
  ROADMAP_WEEKS.forEach((w) => weekMap.set(w.startDate, w));

  const rows: Array<{
    mondayStr: string;
    days: Array<{ dateStr: string; dayNum: number; inMonth: boolean; dow: number }>;
    roadmapWeek: RoadmapWeek | null;
  }> = [];

  while (cursor <= lastDay || rows.length === 0) {
    const mondayStr = formatYmd(cursor);
    const days: Array<{ dateStr: string; dayNum: number; inMonth: boolean; dow: number }> = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + i);
      days.push({
        dateStr: formatYmd(d),
        dayNum: d.getDate(),
        inMonth: d.getMonth() + 1 === month,
        dow: i,
      });
    }
    rows.push({
      mondayStr,
      days,
      roadmapWeek: weekMap.get(mondayStr) || null,
    });
    cursor.setDate(cursor.getDate() + 7);
    if (rows.length >= 6) break;
  }

  return rows;
}

export const RoadmapTracker: React.FC<Props> = ({ store, onNavigateModule }) => {
  const todayStr = formatYmd(new Date());
  const currentWeekObj =
    ROADMAP_WEEKS.find((w) => todayStr >= w.startDate && todayStr <= w.endDate) || ROADMAP_WEEKS[0];

  const initialMonthIdx = Math.max(
    0,
    TARGET_MONTHS.findIndex(
      (m) =>
        Number(currentWeekObj.startDate.slice(0, 4)) === m.year &&
        Number(currentWeekObj.startDate.slice(5, 7)) === m.month
    )
  );

  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [monthIdx, setMonthIdx] = useState(initialMonthIdx);
  const [selectedWeekNum, setSelectedWeekNum] = useState<number>(currentWeekObj.weekNumber);
  const [taskTypeFilter, setTaskTypeFilter] = useState<'all' | 'textbook' | 'practice'>('all');
  const [phaseFilter, setPhaseFilter] = useState<string>('ALL');
  const [showChart, setShowChart] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const containerW = useCanvasContainerWidth(containerRef, 360);
  const isCompact = containerW < 420;
  const drawWidth = Math.max(containerW, isCompact ? 520 : 320);

  const completedSet = useMemo(
    () => new Set(store.state.completedRoadmapTasks),
    [store.state.completedRoadmapTasks]
  );

  const allTasks = ROADMAP_WEEKS.flatMap((w) => w.tasks);
  const textbookTasks = allTasks.filter((t) => t.category === 'textbook');
  const practiceTasks = allTasks.filter((t) => t.category !== 'textbook');

  const doneTotal = allTasks.filter((t) => completedSet.has(t.id)).length;
  const doneTextbook = textbookTasks.filter((t) => completedSet.has(t.id)).length;
  const donePractice = practiceTasks.filter((t) => completedSet.has(t.id)).length;
  const overallPct = Math.round((doneTotal / Math.max(1, allTasks.length)) * 100);
  const textbookPct = Math.round((doneTextbook / Math.max(1, textbookTasks.length)) * 100);
  const practicePct = Math.round((donePractice / Math.max(1, practiceTasks.length)) * 100);

  const activeMonth = TARGET_MONTHS[monthIdx];
  const calendarRows = useMemo(
    () => buildMonthCalendarRows(activeMonth.year, activeMonth.month),
    [activeMonth.year, activeMonth.month]
  );

  const selectedWeek =
    ROADMAP_WEEKS.find((w) => w.weekNumber === selectedWeekNum) || currentWeekObj;

  // HTML5 Canvas：18週間ロードマップ週別進捗チャート
  useEffect(() => {
    if (!showChart && viewMode !== 'list') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = drawWidth;
    const height = 220;
    const ctx = setupHiDpiCanvas(canvas, width, height);
    if (!ctx) return;

    drawCanvasGrid(ctx, width, height, 24);

    ctx.fillStyle = CANVAS_COLORS.textMain;
    ctx.font = `700 ${isCompact ? 11 : 12}px ${CANVAS_FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    drawFittedText(
      ctx,
      `18週間（2026/11/23–2027/03/28）週別達成率 — 全体 ${doneTotal}/${allTasks.length} (${overallPct}%)`,
      12,
      20,
      width - 24
    );

    const chartX = 38;
    const chartY = 44;
    const chartW = width - chartX - 18;
    const chartH = 132;

    [0, 0.5, 1].forEach((ratio) => {
      const gy = chartY + chartH * (1 - ratio);
      ctx.strokeStyle = CANVAS_COLORS.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(chartX, gy);
      ctx.lineTo(chartX + chartW, gy);
      ctx.stroke();

      ctx.fillStyle = CANVAS_COLORS.textMuted;
      ctx.font = `600 9px ${CANVAS_MONO_FAMILY}`;
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(ratio * 100)}%`, chartX - 6, gy);
    });

    const barGap = 4;
    const barW = Math.max(10, (chartW - barGap * 17) / 18);

    ROADMAP_WEEKS.forEach((w, idx) => {
      const done = w.tasks.filter((t) => completedSet.has(t.id)).length;
      const ratio = done / Math.max(1, w.tasks.length);
      const bx = chartX + idx * (barW + barGap);
      const col = PHASE_COLORS[w.phase] || CANVAS_COLORS.cyan;

      drawRoundedRect(ctx, bx, chartY, barW, chartH, 4, CANVAS_COLORS.bgPanel, CANVAS_COLORS.border, 1);
      if (ratio > 0) {
        const bh = Math.max(6, chartH * ratio);
        drawRoundedRect(ctx, bx, chartY + chartH - bh, barW, bh, 4, col);
      }
      if (w.weekNumber === currentWeekObj.weekNumber) {
        drawRoundedRect(ctx, bx - 1.5, chartY - 1.5, barW + 3, chartH + 3, 5, undefined, '#f8fafc', 2);
        drawPillBadge(ctx, '今週', bx + barW / 2, chartY - 12, CANVAS_COLORS.cyanSoft, CANVAS_COLORS.cyan, CANVAS_COLORS.cyan, 9);
      }

      ctx.fillStyle =
        w.weekNumber === currentWeekObj.weekNumber ? CANVAS_COLORS.cyan : CANVAS_COLORS.textMuted;
      ctx.font = `700 9px ${CANVAS_MONO_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillText(`W${w.weekNumber}`, bx + barW / 2, chartY + chartH + 14);
    });
  }, [completedSet, doneTotal, allTasks.length, overallPct, currentWeekObj.weekNumber, showChart, viewMode, drawWidth, isCompact]);

  const filterTasks = (tasks: RoadmapTask[]) => {
    if (taskTypeFilter === 'textbook') return tasks.filter((t) => t.category === 'textbook');
    if (taskTypeFilter === 'practice') return tasks.filter((t) => t.category !== 'textbook');
    return tasks;
  };

  const phases = Array.from(new Set(ROADMAP_WEEKS.map((w) => w.phase)));
  const visibleWeeks =
    phaseFilter === 'ALL' ? ROADMAP_WEEKS : ROADMAP_WEEKS.filter((w) => w.phase === phaseFilter);

  const handleSelectMonth = (idx: number) => {
    setMonthIdx(idx);
    const m = TARGET_MONTHS[idx];
    const rows = buildMonthCalendarRows(m.year, m.month);
    const firstWithWeek = rows.find((r) => r.roadmapWeek !== null);
    if (firstWithWeek?.roadmapWeek) {
      setSelectedWeekNum(firstWithWeek.roadmapWeek.weekNumber);
    }
  };

  const renderTaskRow = (t: RoadmapTask) => {
    const checked = completedSet.has(t.id);
    const catLabel = CATEGORY_LABEL[t.category || 'app'];
    return (
      <div key={t.id} className="flex items-start justify-between gap-2.5 bg-white px-3 py-2.5">
        <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed">
          <input
            type="checkbox"
            checked={checked}
            onChange={() => store.toggleRoadmapTask(t.id)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#007AFF]"
          />
          <div>
            <span className="mr-1.5 inline-block rounded border border-slate-200 bg-[#F5F5F7] px-1.5 py-0.5 text-[10px] font-semibold text-[#6E6E73]">
              {catLabel}
            </span>
            <span className={checked ? 'line-through text-[#6E6E73]/60' : 'text-[#1D1D1F]'}>
              {t.label}
            </span>
          </div>
        </label>
        {t.targetModule && t.targetModule !== 'roadmap' && (
          <button
            type="button"
            onClick={() => onNavigateModule(t.targetModule!)}
            className="shrink-0 pt-0.5 text-[11px] font-semibold text-[#007AFF] hover:underline"
          >
            開く →
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 進捗サマリーバー（1枚のボーダーレス白シート） */}
      <div className="ios-group grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-y-0 sm:divide-x divide-black/[0.07] overflow-hidden">
        <div className="p-3.5">
          <div className="flex items-center justify-between text-[11px] text-[#6E6E73]">
            <span>全18週間 総合進捗</span>
            <span className="font-mono font-bold tabular-nums text-[#1D1D1F]">
              {doneTotal}/{allTasks.length}（{overallPct}%）
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-[#007AFF]" style={{ width: `${overallPct}%` }} />
          </div>
        </div>

        <div className="p-3.5">
          <div className="flex items-center justify-between text-[11px] text-[#6E6E73]">
            <span>テキスト通読・精読（全9章）</span>
            <span className="font-mono font-bold tabular-nums text-[#1D1D1F]">
              {doneTextbook}/{textbookTasks.length}週（{textbookPct}%）
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-[#007AFF]" style={{ width: `${textbookPct}%` }} />
          </div>
        </div>

        <div className="p-3.5">
          <div className="flex items-center justify-between text-[11px] text-[#6E6E73]">
            <span>アプリ・SQL・CBT演習</span>
            <span className="font-mono font-bold tabular-nums text-[#1D1D1F]">
              {donePractice}/{practiceTasks.length}件
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-[#007AFF]" style={{ width: `${practicePct}%` }} />
          </div>
        </div>
      </div>

      {/* コントロール行 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-[8px] bg-black/[0.06] p-[2px]">
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`rounded-[6.5px] px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === 'calendar'
                  ? 'bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
                  : 'text-[#6E6E73]'
              }`}
            >
              月間カレンダー
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`rounded-[6.5px] px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === 'list'
                  ? 'bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
                  : 'text-[#6E6E73]'
              }`}
            >
              全18週一覧
            </button>
          </div>

          <div className="inline-flex rounded-[8px] bg-black/[0.06] p-[2px]">
            {(
              [
                { id: 'all', label: 'すべて' },
                { id: 'textbook', label: 'テキスト' },
                { id: 'practice', label: '演習' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTaskTypeFilter(f.id)}
                className={`rounded-[6.5px] px-2.5 py-1 text-xs font-semibold transition ${
                  taskTypeFilter === f.id
                    ? 'bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
                    : 'text-[#6E6E73]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {viewMode === 'calendar' && (
          <button
            type="button"
            onClick={() => setShowChart((s) => !s)}
            className="text-xs font-medium text-[#007AFF] active:opacity-50 hover:underline"
          >
            {showChart ? '棒グラフを隠す' : '週別棒グラフ'}
          </button>
        )}
      </div>

      {/* モードA：月間カレンダー表示 */}
      {viewMode === 'calendar' ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-start">
          {/* 左：月間カレンダーグリッド */}
          <div className="ios-group overflow-hidden lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-[#F5F5F7]/70 px-4 py-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={monthIdx === 0}
                  onClick={() => handleSelectMonth(Math.max(0, monthIdx - 1))}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7] disabled:opacity-35"
                >
                  ←
                </button>
                <h3 className="min-w-[105px] text-center font-mono text-base font-bold tabular-nums text-[#1D1D1F]">
                  {activeMonth.label}
                </h3>
                <button
                  type="button"
                  disabled={monthIdx === TARGET_MONTHS.length - 1}
                  onClick={() =>
                    handleSelectMonth(Math.min(TARGET_MONTHS.length - 1, monthIdx + 1))
                  }
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7] disabled:opacity-35"
                >
                  →
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                {TARGET_MONTHS.map((m, idx) => (
                  <button
                    key={m.label}
                    type="button"
                    onClick={() => handleSelectMonth(idx)}
                    className={`rounded-md px-2 py-1 font-mono text-[11px] font-semibold tabular-nums transition ${
                      idx === monthIdx
                        ? 'bg-[#007AFF] text-white'
                        : 'text-[#6E6E73] hover:bg-slate-200/70'
                    }`}
                  >
                    {m.short}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setMonthIdx(initialMonthIdx);
                    setSelectedWeekNum(currentWeekObj.weekNumber);
                  }}
                  className="ml-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-[#007AFF] hover:bg-sky-50"
                >
                  今日
                </button>
              </div>
            </div>

            {/* 曜日見出し */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-[#F5F5F7] text-center text-[11px] font-semibold text-[#6E6E73]">
              {WEEKDAY_LABELS.map((wday) => (
                <div key={wday} className="py-2">
                  {wday}
                </div>
              ))}
            </div>

            {/* 週ごとのカレンダー行 */}
            <div className="divide-y divide-slate-200">
              {calendarRows.map((row) => {
                const w = row.roadmapWeek;
                const isSelected = w !== null && w.weekNumber === selectedWeek.weekNumber;
                const isCurrentWeek = w !== null && w.weekNumber === currentWeekObj.weekNumber;
                const wDone = w ? w.tasks.filter((t) => completedSet.has(t.id)).length : 0;
                const wTotal = w ? w.tasks.length : 0;
                const wAllDone = w !== null && wDone === wTotal;
                const tbTask = w?.tasks.find((t) => t.category === 'textbook');
                const tbDone = tbTask ? completedSet.has(tbTask.id) : false;

                return (
                  <div
                    key={row.mondayStr}
                    onClick={() => w && setSelectedWeekNum(w.weekNumber)}
                    className={`transition ${w ? 'cursor-pointer' : 'opacity-45'} ${
                      isSelected
                        ? 'bg-sky-50/50 ring-2 ring-inset ring-[#007AFF]'
                        : w
                          ? 'hover:bg-slate-50/70'
                          : 'bg-slate-50/50'
                    }`}
                  >
                    <div className="grid grid-cols-7 divide-x divide-slate-100">
                      {row.days.map((d) => {
                        const isToday = d.dateStr === todayStr;
                        const isExamGoal = d.dateStr === '2027-03-28';
                        return (
                          <div
                            key={d.dateStr}
                            className="flex min-h-[40px] flex-col items-center justify-start px-1 pt-2 pb-1.5"
                          >
                            <span
                              className={`flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs tabular-nums ${
                                isToday
                                  ? 'bg-[#007AFF] font-bold text-white'
                                  : !d.inMonth
                                    ? 'text-slate-300'
                                    : 'font-medium text-[#1D1D1F]'
                              }`}
                            >
                              {d.dayNum}
                            </span>
                            {isExamGoal && (
                              <span className="mt-0.5 rounded bg-[#007AFF] px-1 text-[9px] font-bold text-white">
                                目標日
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {w && (
                      <div className="px-2 pb-2">
                        <div
                          className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-md border px-2.5 py-1.5 text-[11px] ${
                            wAllDone
                              ? 'border-sky-200 bg-sky-50 text-[#1D1D1F]'
                              : isSelected
                                ? 'border-[#007AFF]/50 bg-white text-[#1D1D1F]'
                                : 'border-slate-200 bg-[#F5F5F7]/70 text-[#1D1D1F]'
                          }`}
                        >
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <span className="font-mono font-bold tabular-nums text-[#1D1D1F]">
                              W{String(w.weekNumber).padStart(2, '0')}
                            </span>
                            {isCurrentWeek && (
                              <span className="rounded border border-sky-200 bg-sky-50 px-1 text-[9px] font-bold text-[#007AFF]">
                                今週
                              </span>
                            )}
                            <span
                              className={`rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold ${
                                tbDone ? 'line-through text-[#6E6E73]/60' : 'text-[#6E6E73]'
                              }`}
                            >
                              {w.textbookRange}
                            </span>
                            <span className="max-w-[230px] truncate font-medium sm:max-w-[280px]">
                              {w.theme}
                            </span>
                          </div>
                          <span className="flex shrink-0 items-center gap-1.5 font-mono text-[11px] font-bold tabular-nums text-[#1D1D1F]">
                            <span>
                              {wDone}/{wTotal}
                            </span>
                            <span
                              className={`font-sans text-[10px] font-semibold ${
                                isSelected ? 'text-[#007AFF]' : 'text-[#6E6E73]'
                              }`}
                            >
                              {isSelected ? '表示中' : '詳細 ›'}
                            </span>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 右：選択週のタスク詳細パネル */}
          <div className="ios-group overflow-hidden lg:col-span-5">
            <div className="border-b border-slate-200 bg-[#F5F5F7]/70 px-4 py-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-[#007AFF] px-2 py-0.5 font-mono text-xs font-bold tabular-nums text-white">
                    Week {String(selectedWeek.weekNumber).padStart(2, '0')}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-[#6E6E73]">
                    {selectedWeek.startDate} – {selectedWeek.endDate}
                  </span>
                </div>
                <span className="font-mono text-xs font-bold tabular-nums text-[#1D1D1F]">
                  {selectedWeek.tasks.filter((t) => completedSet.has(t.id)).length}/
                  {selectedWeek.tasks.length} 完了
                </span>
              </div>
              <div className="text-[11px] font-semibold text-[#6E6E73]">{selectedWeek.phase}</div>
              <h4 className="text-sm font-bold text-[#1D1D1F]">{selectedWeek.theme}</h4>
            </div>

            <div className="p-4 space-y-3">
              <div className="rounded-lg border border-slate-200 bg-[#F5F5F7] px-3 py-2 text-xs text-[#1D1D1F]">
                <span className="font-semibold text-[#6E6E73]">テキスト範囲：</span>
                {selectedWeek.textbookRange}
              </div>

              <p className="text-xs leading-relaxed text-[#6E6E73]">
                <strong className="text-[#1D1D1F]">到達目標：</strong>
                {selectedWeek.goal}
              </p>

              <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
                {filterTasks(selectedWeek.tasks).map(renderTaskRow)}
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px] text-[#6E6E73]">
                <span className="font-mono tabular-nums">
                  過去問：{selectedWeek.recommendedYears.join(' / ')}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={selectedWeek.weekNumber <= 1}
                    onClick={() => setSelectedWeekNum((n) => Math.max(1, n - 1))}
                    className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[#1D1D1F] disabled:opacity-35"
                  >
                    前週
                  </button>
                  <button
                    type="button"
                    disabled={selectedWeek.weekNumber >= 18}
                    onClick={() => setSelectedWeekNum((n) => Math.min(18, n + 1))}
                    className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[#1D1D1F] disabled:opacity-35"
                  >
                    次週
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* モードB：全18週一覧表示 */
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setPhaseFilter('ALL')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                phaseFilter === 'ALL'
                  ? 'bg-[#007AFF] text-white'
                  : 'border border-slate-200 bg-white text-[#6E6E73]'
              }`}
            >
              全18週間
            </button>
            {phases.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPhaseFilter(p)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  phaseFilter === p
                    ? 'bg-[#007AFF] text-white'
                    : 'border border-slate-200 bg-white text-[#6E6E73]'
                }`}
              >
                {p.split(':')[0]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {visibleWeeks.map((w) => {
              const done = w.tasks.filter((t) => completedSet.has(t.id)).length;
              const allDone = done === w.tasks.length;
              const isCurrent = w.weekNumber === currentWeekObj.weekNumber;

              return (
                <div
                  key={w.weekNumber}
                  className={`rounded-lg border bg-white p-4 space-y-3 ${
                    isCurrent
                      ? 'border-[#007AFF] ring-1 ring-[#007AFF]/25'
                      : allDone
                        ? 'border-sky-200 bg-sky-50/30'
                        : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-[#007AFF] px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums text-white">
                        W{String(w.weekNumber).padStart(2, '0')}
                      </span>
                      <span className="font-mono text-xs tabular-nums text-[#6E6E73]">
                        {w.startDate} – {w.endDate}
                      </span>
                      <span className="rounded-md border border-slate-200 bg-[#F5F5F7] px-1.5 py-0.5 text-[10px] font-semibold text-[#6E6E73]">
                        {w.textbookRange}
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold tabular-nums text-[#1D1D1F]">
                      {done}/{w.tasks.length}
                    </span>
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold text-[#6E6E73]">{w.phase}</div>
                    <h4 className="mt-0.5 text-sm font-bold text-[#1D1D1F]">{w.theme}</h4>
                    <p className="mt-0.5 text-xs text-[#6E6E73]">到達目標：{w.goal}</p>
                  </div>

                  <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
                    {filterTasks(w.tasks).map(renderTaskRow)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 週別棒グラフ（小画面時は横スクロール対応） */}
      {(showChart || viewMode === 'list') && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
          <div className="text-xs font-bold text-[#1D1D1F]">18週間 週別達成率グラフ</div>
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
      )}
    </div>
  );
};
