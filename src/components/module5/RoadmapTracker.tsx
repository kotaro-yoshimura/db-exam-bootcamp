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
} from '../../utils/canvasHelpers';

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

const CATEGORY_STYLE: Record<
  NonNullable<RoadmapTask['category']>,
  { label: string; cls: string }
> = {
  textbook: {
    label: 'テキスト',
    cls: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  },
  app: {
    label: '演習',
    cls: 'border-[#e4e4e0] bg-[#f6f6f4] text-[#3f3f46]',
  },
  cbt: {
    label: 'CBT',
    cls: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]',
  },
  review: {
    label: '復習',
    cls: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]',
  },
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
  const [tick, setTick] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const completedSet = useMemo(
    () => new Set(store.state.completedRoadmapTasks),
    [store.state.completedRoadmapTasks]
  );

  // 全体進捗とテキスト通読進捗を分離集計
  const allTasks = ROADMAP_WEEKS.flatMap((w) => w.tasks);
  const textbookTasks = allTasks.filter((t) => t.category === 'textbook');
  const practiceTasks = allTasks.filter((t) => t.category !== 'textbook');

  const doneTotal = allTasks.filter((t) => completedSet.has(t.id)).length;
  const doneTextbook = textbookTasks.filter((t) => completedSet.has(t.id)).length;
  const donePractice = practiceTasks.filter((t) => completedSet.has(t.id)).length;
  const overallPct = Math.round((doneTotal / Math.max(1, allTasks.length)) * 100);
  const textbookPct = Math.round((doneTextbook / Math.max(1, textbookTasks.length)) * 100);

  const activeMonth = TARGET_MONTHS[monthIdx];
  const calendarRows = useMemo(
    () => buildMonthCalendarRows(activeMonth.year, activeMonth.month),
    [activeMonth.year, activeMonth.month]
  );

  const selectedWeek =
    ROADMAP_WEEKS.find((w) => w.weekNumber === selectedWeekNum) || currentWeekObj;

  useEffect(() => {
    const onResize = () => setTick((t) => t + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // HTML5 Canvas：18週間ロードマップ週別進捗チャート（展開時または一覧ビュー時）
  useEffect(() => {
    if (!showChart && viewMode !== 'list') return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = Math.max(320, container.clientWidth);
    const height = 220;
    const ctx = setupHiDpiCanvas(canvas, width, height);
    if (!ctx) return;

    drawCanvasGrid(ctx, width, height, 24);

    ctx.fillStyle = CANVAS_COLORS.textMain;
    ctx.font = `700 12px ${CANVAS_FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `18週間（2026/11/23–2027/03/28）週別達成率 — 全体 ${doneTotal}/${allTasks.length} (${overallPct}%)`,
      14,
      20
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
    const barW = Math.max(8, (chartW - barGap * 17) / 18);

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

      ctx.fillStyle = w.weekNumber === currentWeekObj.weekNumber ? CANVAS_COLORS.cyan : CANVAS_COLORS.textMuted;
      ctx.font = `700 9px ${CANVAS_MONO_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillText(`W${w.weekNumber}`, bx + barW / 2, chartY + chartH + 14);
    });
  }, [completedSet, doneTotal, allTasks.length, overallPct, currentWeekObj.weekNumber, showChart, viewMode, tick]);

  const filterTasks = (tasks: RoadmapTask[]) => {
    if (taskTypeFilter === 'textbook') return tasks.filter((t) => t.category === 'textbook');
    if (taskTypeFilter === 'practice') return tasks.filter((t) => t.category !== 'textbook');
    return tasks;
  };

  const phases = Array.from(new Set(ROADMAP_WEEKS.map((w) => w.phase)));
  const visibleWeeks =
    phaseFilter === 'ALL'
      ? ROADMAP_WEEKS
      : ROADMAP_WEEKS.filter((w) => w.phase === phaseFilter);

  const handleSelectMonth = (idx: number) => {
    setMonthIdx(idx);
    // 選んだ月に含まれる最初のロードマップ週を自動選択して詳細パネルを同期
    const m = TARGET_MONTHS[idx];
    const rows = buildMonthCalendarRows(m.year, m.month);
    const firstWithWeek = rows.find((r) => r.roadmapWeek !== null);
    if (firstWithWeek?.roadmapWeek) {
      setSelectedWeekNum(firstWithWeek.roadmapWeek.weekNumber);
    }
  };

  const renderTaskRow = (t: RoadmapTask) => {
    const checked = completedSet.has(t.id);
    const cat = CATEGORY_STYLE[t.category || 'app'];
    return (
      <div
        key={t.id}
        className="flex items-start justify-between gap-2.5 px-3 py-2.5 bg-white"
      >
        <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed">
          <input
            type="checkbox"
            checked={checked}
            onChange={() => store.toggleRoadmapTask(t.id)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#18181b]"
          />
          <div className="space-y-1">
            <span
              className={`mr-1.5 inline-block rounded border px-1.5 py-0.2 text-[10px] font-semibold ${cat.cls}`}
            >
              {cat.label}
            </span>
            <span className={checked ? 'line-through text-[#a1a1aa]' : 'text-[#18181b]'}>
              {t.label}
            </span>
          </div>
        </label>
        {t.targetModule && t.targetModule !== 'roadmap' && (
          <button
            type="button"
            onClick={() => onNavigateModule(t.targetModule!)}
            className="shrink-0 text-[11px] font-semibold text-[#1d4ed8] hover:underline pt-0.5"
          >
            開く →
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 進捗サマリーバー（全体 / テキスト通読 / 演習） */}
      <div className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-y-0 sm:divide-x divide-[#e4e4e0] rounded-lg border border-[#e4e4e0] bg-white">
        <div className="p-3.5">
          <div className="flex items-center justify-between text-[11px] text-[#71717a]">
            <span>全18週間 総合進捗</span>
            <span className="font-mono font-bold text-[#18181b]">
              {doneTotal}/{allTasks.length}（{overallPct}%）
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#e4e4e0]">
            <div className="h-full bg-[#18181b]" style={{ width: `${overallPct}%` }} />
          </div>
        </div>

        <div className="p-3.5">
          <div className="flex items-center justify-between text-[11px] text-[#92400e]">
            <span className="font-semibold">テキスト通読・精読（全9章）</span>
            <span className="font-mono font-bold">
              {doneTextbook}/{textbookTasks.length}週（{textbookPct}%）
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#fef3c7]">
            <div className="h-full bg-[#b45309]" style={{ width: `${textbookPct}%` }} />
          </div>
        </div>

        <div className="p-3.5">
          <div className="flex items-center justify-between text-[11px] text-[#52525b]">
            <span>アプリ・SQL・CBT演習</span>
            <span className="font-mono font-bold text-[#18181b]">
              {donePractice}/{practiceTasks.length}件
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#e4e4e0]">
            <div
              className="h-full bg-[#15803d]"
              style={{
                width: `${Math.round((donePractice / Math.max(1, practiceTasks.length)) * 100)}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* コントロール行：表示切替・タスク種別フィルタ・グラフ表示 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-[#d4d4d0] bg-[#f1f1ee] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`rounded px-3 py-1.5 text-xs font-semibold ${
                viewMode === 'calendar' ? 'bg-white text-[#18181b] shadow-xs' : 'text-[#52525b]'
              }`}
            >
              月間カレンダー
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`rounded px-3 py-1.5 text-xs font-semibold ${
                viewMode === 'list' ? 'bg-white text-[#18181b] shadow-xs' : 'text-[#52525b]'
              }`}
            >
              全18週一覧
            </button>
          </div>

          <div className="inline-flex rounded-md border border-[#d4d4d0] bg-[#f1f1ee] p-0.5">
            {(
              [
                { id: 'all', label: 'すべて' },
                { id: 'textbook', label: 'テキストのみ' },
                { id: 'practice', label: '演習のみ' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTaskTypeFilter(f.id)}
                className={`rounded px-2.5 py-1 text-xs font-semibold ${
                  taskTypeFilter === f.id ? 'bg-white text-[#18181b] shadow-xs' : 'text-[#52525b]'
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
            className="rounded-md border border-[#d4d4d0] bg-white px-3 py-1.5 text-xs font-semibold text-[#52525b] hover:bg-[#f1f1ee]"
          >
            {showChart ? '週別棒グラフを隠す' : '週別棒グラフを表示'}
          </button>
        )}
      </div>

      {/* ================= モードA：月間カレンダー表示 ================= */}
      {viewMode === 'calendar' ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-start">
          {/* 左：月間カレンダーグリッド（7/12） */}
          <div className="lg:col-span-7 rounded-lg border border-[#e4e4e0] bg-white overflow-hidden">
            {/* 月切替ヘッダ */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e4e4e0] bg-[#fafafa] px-4 py-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={monthIdx === 0}
                  onClick={() => handleSelectMonth(Math.max(0, monthIdx - 1))}
                  className="rounded border border-[#d4d4d0] bg-white px-2 py-1 text-xs font-semibold text-[#18181b] hover:bg-[#f1f1ee] disabled:opacity-35"
                >
                  ←
                </button>
                <h3 className="font-mono text-base font-bold text-[#18181b] min-w-[105px] text-center">
                  {activeMonth.label}
                </h3>
                <button
                  type="button"
                  disabled={monthIdx === TARGET_MONTHS.length - 1}
                  onClick={() =>
                    handleSelectMonth(Math.min(TARGET_MONTHS.length - 1, monthIdx + 1))
                  }
                  className="rounded border border-[#d4d4d0] bg-white px-2 py-1 text-xs font-semibold text-[#18181b] hover:bg-[#f1f1ee] disabled:opacity-35"
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
                    className={`rounded px-2 py-1 font-mono text-[11px] font-semibold transition ${
                      idx === monthIdx
                        ? 'bg-[#18181b] text-white'
                        : 'text-[#52525b] hover:bg-[#e4e4e0]'
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
                  className="ml-1 rounded border border-[#d4d4d0] bg-white px-2 py-1 text-[11px] font-semibold text-[#1d4ed8] hover:bg-[#eff6ff]"
                >
                  今日
                </button>
              </div>
            </div>

            {/* 曜日見出し（月曜始まり） */}
            <div className="grid grid-cols-7 border-b border-[#e4e4e0] bg-[#f6f6f4] text-center text-[11px] font-semibold">
              {WEEKDAY_LABELS.map((wday, i) => (
                <div
                  key={wday}
                  className={`py-2 ${
                    i === 5
                      ? 'text-[#1d4ed8]'
                      : i === 6
                        ? 'text-[#be123c]'
                        : 'text-[#52525b]'
                  }`}
                >
                  {wday}
                </div>
              ))}
            </div>

            {/* 週ごとのカレンダー行（上段：7日間の日付マス / 下段：週テーマ＋テキスト章の予定帯） */}
            <div className="divide-y divide-[#e4e4e0]">
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
                    className={`transition ${
                      w ? 'cursor-pointer' : 'opacity-50'
                    } ${
                      isSelected
                        ? 'bg-[#f6f6f4] ring-2 ring-inset ring-[#18181b]'
                        : w
                          ? 'hover:bg-[#fafafa]'
                          : 'bg-[#fafafa]'
                    }`}
                  >
                    {/* 7日間の日付マス */}
                    <div className="grid grid-cols-7 divide-x divide-[#f1f1ee]">
                      {row.days.map((d) => {
                        const isToday = d.dateStr === todayStr;
                        const isExamGoal = d.dateStr === '2027-03-28';
                        return (
                          <div
                            key={d.dateStr}
                            className="flex flex-col items-center justify-start px-1 pt-2 pb-1.5 min-h-[42px]"
                          >
                            <span
                              className={`flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs ${
                                isToday
                                  ? 'bg-[#18181b] font-bold text-white'
                                  : !d.inMonth
                                    ? 'text-[#c4c4be]'
                                    : d.dow === 5
                                      ? 'font-semibold text-[#1d4ed8]'
                                      : d.dow === 6
                                        ? 'font-semibold text-[#be123c]'
                                        : 'font-medium text-[#18181b]'
                              }`}
                            >
                              {d.dayNum}
                            </span>
                            {isExamGoal && (
                              <span className="mt-0.5 rounded bg-[#be123c] px-1 text-[9px] font-bold text-white">
                                目標日
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* 週の予定帯（終日イベント風：週番号・テキスト章・テーマ・完了率） */}
                    {w && (
                      <div className="px-2 pb-2">
                        <div
                          className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded border px-2.5 py-1.5 text-[11px] ${
                            wAllDone
                              ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]'
                              : isSelected
                                ? 'border-[#18181b] bg-white text-[#18181b]'
                                : 'border-[#e4e4e0] bg-[#fafafa] text-[#3f3f46]'
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                            <span className="font-mono font-bold text-[#18181b]">
                              W{String(w.weekNumber).padStart(2, '0')}
                            </span>
                            {isCurrentWeek && (
                              <span className="rounded bg-[#eff6ff] border border-[#bfdbfe] px-1 text-[9px] font-bold text-[#1d4ed8]">
                                今週
                              </span>
                            )}
                            <span
                              className={`rounded border px-1.5 py-0.2 text-[10px] font-semibold ${
                                tbDone
                                  ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d] line-through'
                                  : 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]'
                              }`}
                            >
                              テキスト：{w.textbookRange}
                            </span>
                            <span className="truncate font-medium max-w-[230px] sm:max-w-[280px]">
                              {w.theme}
                            </span>
                          </div>
                          <span className="shrink-0 font-mono text-[11px] font-bold">
                            {wDone}/{wTotal}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 右：選択した週のタスク詳細パネル（5/12） */}
          <div className="lg:col-span-5 rounded-lg border border-[#e4e4e0] bg-white overflow-hidden">
            <div className="border-b border-[#e4e4e0] bg-[#fafafa] px-4 py-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-[#18181b] px-2 py-0.5 font-mono text-xs font-bold text-white">
                    Week {String(selectedWeek.weekNumber).padStart(2, '0')}
                  </span>
                  <span className="font-mono text-xs text-[#52525b]">
                    {selectedWeek.startDate} – {selectedWeek.endDate}
                  </span>
                </div>
                <span className="font-mono text-xs font-bold text-[#15803d]">
                  {selectedWeek.tasks.filter((t) => completedSet.has(t.id)).length}/
                  {selectedWeek.tasks.length} 完了
                </span>
              </div>
              <div className="text-[11px] font-semibold text-[#71717a]">{selectedWeek.phase}</div>
              <h4 className="text-sm font-bold text-[#18181b]">{selectedWeek.theme}</h4>
            </div>

            <div className="p-4 space-y-3">
              {/* テキスト担当範囲ボックス */}
              <div className="rounded-md border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-xs text-[#78350f]">
                <span className="font-bold">今週のテキスト範囲：</span>
                {selectedWeek.textbookRange}
              </div>

              <p className="text-xs text-[#52525b] leading-relaxed">
                <strong className="text-[#18181b]">到達目標：</strong>
                {selectedWeek.goal}
              </p>

              <div className="divide-y divide-[#f1f1ee] rounded-md border border-[#e4e4e0] overflow-hidden">
                {filterTasks(selectedWeek.tasks).map(renderTaskRow)}
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px] text-[#71717a]">
                <span>推奨過去問：{selectedWeek.recommendedYears.join(' / ')}</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={selectedWeek.weekNumber <= 1}
                    onClick={() => setSelectedWeekNum((n) => Math.max(1, n - 1))}
                    className="rounded border border-[#d4d4d0] bg-white px-2 py-0.5 text-[#18181b] disabled:opacity-35"
                  >
                    前週
                  </button>
                  <button
                    type="button"
                    disabled={selectedWeek.weekNumber >= 18}
                    onClick={() => setSelectedWeekNum((n) => Math.min(18, n + 1))}
                    className="rounded border border-[#d4d4d0] bg-white px-2 py-0.5 text-[#18181b] disabled:opacity-35"
                  >
                    次週
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ================= モードB：全18週一覧表示 ================= */
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setPhaseFilter('ALL')}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                phaseFilter === 'ALL'
                  ? 'bg-[#18181b] text-white'
                  : 'border border-[#d4d4d0] bg-white text-[#52525b]'
              }`}
            >
              全18週間
            </button>
            {phases.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPhaseFilter(p)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                  phaseFilter === p
                    ? 'bg-[#18181b] text-white'
                    : 'border border-[#d4d4d0] bg-white text-[#52525b]'
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
                  className={`rounded-lg border p-4 space-y-3 bg-white ${
                    isCurrent
                      ? 'border-[#18181b] ring-1 ring-[#18181b]'
                      : allDone
                        ? 'border-[#bbf7d0] bg-[#f0fdf4]/40'
                        : 'border-[#e4e4e0]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-[#18181b] px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                        W{String(w.weekNumber).padStart(2, '0')}
                      </span>
                      <span className="font-mono text-xs text-[#71717a]">
                        {w.startDate} – {w.endDate}
                      </span>
                      <span className="rounded border border-[#fde68a] bg-[#fffbeb] px-1.5 py-0.5 text-[10px] font-semibold text-[#92400e]">
                        {w.textbookRange}
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold text-[#15803d]">
                      {done}/{w.tasks.length}
                    </span>
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold text-[#71717a]">{w.phase}</div>
                    <h4 className="mt-0.5 text-sm font-bold text-[#18181b]">{w.theme}</h4>
                    <p className="mt-0.5 text-xs text-[#52525b]">到達目標：{w.goal}</p>
                  </div>

                  <div className="divide-y divide-[#f1f1ee] rounded-md border border-[#e4e4e0] overflow-hidden">
                    {filterTasks(w.tasks).map(renderTaskRow)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 週別棒グラフ（一覧モードまたはカレンダーのトグルON時に表示） */}
      {(showChart || viewMode === 'list') && (
        <div className="rounded-lg border border-[#e4e4e0] bg-white p-4 space-y-2">
          <div className="text-xs font-bold text-[#18181b]">18週間 週別達成率グラフ</div>
          <div
            ref={containerRef}
            className="w-full overflow-hidden rounded-md border border-[#1e293b] bg-[#0f172a]"
          >
            <canvas ref={canvasRef} className="block w-full" />
          </div>
        </div>
      )}
    </div>
  );
};
