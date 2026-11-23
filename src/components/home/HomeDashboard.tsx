// ホーム画面：1秒で勉強に入れる即アクションダッシュボード（Apple HIG 準拠）
// 構成：1行ステータスバー → 今週やるべきチェックリスト → クイック再開 → 折りたたみ式コンパクト週切替カレンダー
import React, { useState, useMemo } from 'react';
import type { ModuleId, RoadmapTask } from '../../types/exam';
import type { StudyStore } from '../../state/useStudyStore';
import { ROADMAP_WEEKS } from '../../data/roadmap';
import { FLASHCARDS_200 } from '../../data/flashcards200';
import { SQL_DRILLS } from '../../data/sqlDrills';
import { formatLocalYmd } from '../../utils/examDate';
import { buildMonthCalendarRows } from '../module5/RoadmapTracker';
import { ChevronDownIcon, ChevronRightIcon, ModuleNavIcon } from '../common/NavIcons';

interface Props {
  store: StudyStore;
  daysLeft: number;
  lastPracticeModule: 'lab' | 'sql' | 'cbt';
  onNavigateModule: (id: ModuleId, options?: { roadmapSubTab?: 'roadmap' | 'cards' }) => void;
}

const CAT_LABEL: Record<NonNullable<RoadmapTask['category']>, string> = {
  textbook: 'テキスト',
  app: '演習',
  cbt: 'CBT',
  review: '復習',
};

const MODULE_ACTION_LABEL: Record<ModuleId, string> = {
  home: 'ホーム',
  lab: '図解ラボ',
  sql: 'SQL道場',
  cbt: 'CBT演習',
  review: '弱点復習',
  roadmap: '200語',
};

const PRACTICE_INFO: Record<'lab' | 'sql' | 'cbt', { title: string; subtitle: string }> = {
  lab: { title: '図解ラボ', subtitle: '正規化・E-R図・物理I/O' },
  sql: { title: 'SQL道場', subtitle: '過去問クエリ実機演習' },
  cbt: { title: 'CBT演習', subtitle: '2ペイン本番・記述添削' },
};

const WEEKDAY_SHORT = ['月', '火', '水', '木', '金', '土', '日'];

export const HomeDashboard: React.FC<Props> = ({
  store,
  daysLeft,
  lastPracticeModule,
  onNavigateModule,
}) => {
  const todayStr = formatLocalYmd();
  const detectedWeekIdx = Math.max(
    0,
    ROADMAP_WEEKS.findIndex((w) => todayStr >= w.startDate && todayStr <= w.endDate)
  );
  const [selectedWeekIdx, setSelectedWeekIdx] = useState(detectedWeekIdx);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const activeWeek = ROADMAP_WEEKS[selectedWeekIdx] || ROADMAP_WEEKS[0];

  // 選択中の週が属する月のミニカレンダーを生成
  const activeYear = Number(activeWeek.startDate.slice(0, 4));
  const activeMonthNum = Number(activeWeek.startDate.slice(5, 7));
  const miniCalRows = useMemo(
    () => buildMonthCalendarRows(activeYear, activeMonthNum),
    [activeYear, activeMonthNum]
  );

  // 進捗メトリクス集計
  const completedSet = useMemo(
    () => new Set(store.state.completedRoadmapTasks),
    [store.state.completedRoadmapTasks]
  );
  const allTasks = useMemo(() => ROADMAP_WEEKS.flatMap((w) => w.tasks), []);
  const doneTasks = allTasks.filter((t) => completedSet.has(t.id)).length;
  const roadmapPct = Math.round((doneTasks / Math.max(1, allTasks.length)) * 100);

  const masteredCards = Object.values(store.state.flashcardStatus).filter((s) => s === 'mastered').length;
  const reviewCards = Object.values(store.state.flashcardStatus).filter((s) => s === 'review').length;
  const activeWeak = store.state.reviewQueue.filter((q) => !q.graduated);
  const weekDoneCount = activeWeek.tasks.filter((t) => completedSet.has(t.id)).length;
  const cbtDraftCount = Object.values(store.state.cbtDrafts).filter((v) => v.trim().length > 0).length;

  const practiceMeta = PRACTICE_INFO[lastPracticeModule];

  const handleTaskNavigate = (task: RoadmapTask) => {
    if (!task.targetModule) return;
    if (task.targetModule === 'roadmap') {
      const isCardTask =
        task.label.includes('語') || task.label.includes('カード') || task.label.includes('フラッシュ');
      onNavigateModule('roadmap', { roadmapSubTab: isCardTask ? 'cards' : 'roadmap' });
      return;
    }
    onNavigateModule(task.targetModule);
  };

  return (
    <section className="space-y-4">
      {/* 1行コンパクトステータスバー（iPhone: 2×2極小チップ / iPad・Mac: 1行4チップ） */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
          <span className="text-xs text-[#6E6E73]">試験まで</span>
          <span className="font-mono text-sm font-bold tabular-nums text-[#1D1D1F]">
            残り{daysLeft}日
          </span>
        </div>

        <button
          type="button"
          onClick={() => onNavigateModule('roadmap', { roadmapSubTab: 'roadmap' })}
          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left hover:border-slate-300 transition"
        >
          <span className="text-xs text-[#6E6E73]">進捗</span>
          <span className="font-mono text-sm font-bold tabular-nums text-[#1D1D1F]">
            {doneTasks}/{allTasks.length}
            <span className="ml-1 text-[11px] font-normal text-[#6E6E73]">({roadmapPct}%)</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigateModule('roadmap', { roadmapSubTab: 'cards' })}
          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left hover:border-slate-300 transition"
        >
          <span className="text-xs text-[#6E6E73]">語句</span>
          <span className="font-mono text-sm font-bold tabular-nums text-[#1D1D1F]">
            {masteredCards}/{FLASHCARDS_200.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigateModule('review')}
          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left hover:border-slate-300 transition"
        >
          <span className="text-xs text-[#6E6E73]">弱点</span>
          <span className="font-mono text-sm font-bold tabular-nums text-[#1D1D1F]">
            {activeWeak.length}件
          </span>
        </button>
      </div>

      {/* ① 今週（Week XX）やるべきチェックリスト */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-[#007AFF] px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-white">
                Week {String(activeWeek.weekNumber).padStart(2, '0')}
              </span>
              <span className="font-mono text-xs tabular-nums text-[#6E6E73]">
                {activeWeek.startDate} – {activeWeek.endDate}
              </span>
              {selectedWeekIdx === detectedWeekIdx && (
                <span className="rounded-md border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-[#007AFF]">
                  今週
                </span>
              )}
              <span className="font-mono text-xs font-semibold tabular-nums text-[#1D1D1F]">
                {weekDoneCount}/{activeWeek.tasks.length}
              </span>
            </div>
            <h2 className="mt-1 text-[15px] font-bold tracking-tight text-[#1D1D1F]">
              {activeWeek.theme}
            </h2>
          </div>

          {/* 前週 / 今週 / 次週 */}
          <div className="inline-flex shrink-0 items-center rounded-lg border border-slate-200 bg-[#F5F5F7] p-0.5">
            <button
              type="button"
              disabled={selectedWeekIdx === 0}
              onClick={() => setSelectedWeekIdx((i) => Math.max(0, i - 1))}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-[#1D1D1F] hover:bg-white disabled:opacity-35 transition"
            >
              前週
            </button>
            <button
              type="button"
              onClick={() => setSelectedWeekIdx(detectedWeekIdx)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                selectedWeekIdx === detectedWeekIdx
                  ? 'bg-white text-[#007AFF] shadow-xs'
                  : 'text-[#6E6E73] hover:bg-white'
              }`}
            >
              今週
            </button>
            <button
              type="button"
              disabled={selectedWeekIdx === ROADMAP_WEEKS.length - 1}
              onClick={() =>
                setSelectedWeekIdx((i) => Math.min(ROADMAP_WEEKS.length - 1, i + 1))
              }
              className="rounded-md px-2.5 py-1 text-xs font-medium text-[#1D1D1F] hover:bg-white disabled:opacity-35 transition"
            >
              次週
            </button>
          </div>
        </div>

        {/* テキスト担当範囲＆到達目標（コンパクト1帯） */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-[#F5F5F7]/70 px-4 py-2 text-xs">
          <div className="text-[#1D1D1F]">
            <span className="font-semibold text-[#6E6E73]">テキスト範囲：</span>
            <span className="font-medium">{activeWeek.textbookRange}</span>
          </div>
          <div className="font-mono text-[11px] tabular-nums text-[#6E6E73]">
            過去問：{activeWeek.recommendedYears.join(' / ')}
          </div>
        </div>

        {/* チェックリスト本体 */}
        <div className="divide-y divide-slate-100">
          {activeWeek.tasks.map((task) => {
            const checked = completedSet.has(task.id);
            const catLabel = CAT_LABEL[task.category || 'app'];
            return (
              <div
                key={task.id}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50/70 transition"
              >
                <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-sm leading-snug">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => store.toggleRoadmapTask(task.id)}
                    className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded accent-[#007AFF]"
                  />
                  <span className="min-w-0">
                    <span className="mr-1.5 inline-block rounded border border-slate-200 bg-[#F5F5F7] px-1.5 py-0.5 align-middle text-[10px] font-semibold text-[#6E6E73]">
                      {catLabel}
                    </span>
                    <span
                      className={`text-[13px] sm:text-sm ${
                        checked ? 'line-through text-[#6E6E73]/60' : 'text-[#1D1D1F]'
                      }`}
                    >
                      {task.label}
                    </span>
                  </span>
                </label>

                {task.targetModule && (
                  <button
                    type="button"
                    onClick={() => handleTaskNavigate(task)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#007AFF] hover:border-[#007AFF]/40 hover:bg-sky-50/60 transition"
                  >
                    <span>{MODULE_ACTION_LABEL[task.targetModule]}</span>
                    <ChevronRightIcon className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-slate-100 px-4 py-2 text-xs text-[#6E6E73]">
          到達目標：{activeWeek.goal}
        </div>
      </div>

      {/* ② クイック再開（弱点復習キュー ／ 直近の演習 ／ 200語カード） */}
      <div className="space-y-2">
        <h3 className="px-0.5 text-xs font-semibold text-[#6E6E73]">クイック再開</h3>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {/* 弱点復習キュー */}
          <button
            type="button"
            onClick={() => onNavigateModule('review')}
            className="group flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3.5 text-left hover:border-[#007AFF]/50 transition"
          >
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F5F5F7] text-[#007AFF]">
                <ModuleNavIcon id="review" className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#1D1D1F]">弱点復習キュー</span>
                  <span className="font-mono text-xs font-semibold tabular-nums text-[#6E6E73]">
                    {activeWeak.length}件
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-[#6E6E73]">
                  {activeWeak.length > 0 ? activeWeak[0].title : '未卒業なし・典型3問を追加可'}
                </p>
              </div>
            </div>
            <ChevronRightIcon className="h-4 w-4 shrink-0 text-[#6E6E73] group-hover:text-[#007AFF]" />
          </button>

          {/* 直近の演習（前回開いた演習へ1タップ直行） */}
          <div className="flex flex-col justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3.5">
            <button
              type="button"
              onClick={() => onNavigateModule(lastPracticeModule)}
              className="group flex items-center justify-between gap-3 text-left"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F5F5F7] text-[#007AFF]">
                  <ModuleNavIcon id={lastPracticeModule} className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-[#1D1D1F]">
                      直近：{practiceMeta.title}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[#6E6E73]">
                    {lastPracticeModule === 'sql'
                      ? `SQLクリア ${store.state.solvedSqlDrills.length}/${SQL_DRILLS.length}問`
                      : lastPracticeModule === 'cbt'
                        ? `記述下書き ${cbtDraftCount}問保存済`
                        : practiceMeta.subtitle}
                  </p>
                </div>
              </div>
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-[#6E6E73] group-hover:text-[#007AFF]" />
            </button>

            {/* 図解 / SQL / CBT への1タップ切替チップ */}
            <div className="flex items-center gap-1.5 border-t border-slate-100 pt-2">
              {(['lab', 'sql', 'cbt'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onNavigateModule(m)}
                  className={`flex-1 rounded-md py-1 text-[11px] font-semibold transition ${
                    m === lastPracticeModule
                      ? 'bg-[#007AFF]/10 text-[#007AFF]'
                      : 'bg-[#F5F5F7] text-[#6E6E73] hover:text-[#1D1D1F]'
                  }`}
                >
                  {PRACTICE_INFO[m].title}
                </button>
              ))}
            </div>
          </div>

          {/* 200語フラッシュカード */}
          <button
            type="button"
            onClick={() => onNavigateModule('roadmap', { roadmapSubTab: 'cards' })}
            className="group flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3.5 text-left hover:border-[#007AFF]/50 transition"
          >
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F5F5F7] text-[#007AFF]">
                <ModuleNavIcon id="roadmap" className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#1D1D1F]">200語カード</span>
                  <span className="font-mono text-xs font-semibold tabular-nums text-[#6E6E73]">
                    {masteredCards}/{FLASHCARDS_200.length}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-[#6E6E73]">
                  要復習{' '}
                  <span className="font-mono tabular-nums">{reviewCards}</span>語 ／ 隙間時間に1周
                </p>
              </div>
            </div>
            <ChevronRightIcon className="h-4 w-4 shrink-0 text-[#6E6E73] group-hover:text-[#007AFF]" />
          </button>
        </div>
      </div>

      {/* ③ コンパクトな週切替カレンダー（折りたたみ式・省スペース） */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-2 px-4 py-2.5">
          <button
            type="button"
            onClick={() => setCalendarOpen((v) => !v)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <ChevronDownIcon
              className={`h-4 w-4 shrink-0 text-[#6E6E73] transition-transform ${
                calendarOpen ? 'rotate-180' : ''
              }`}
            />
            <span className="font-mono text-xs font-bold tabular-nums text-[#1D1D1F]">
              {activeYear}年{activeMonthNum}月 カレンダー
            </span>
            <span className="truncate text-xs text-[#6E6E73]">
              （週をタップして切替）
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateModule('roadmap', { roadmapSubTab: 'roadmap' })}
            className="shrink-0 text-xs font-semibold text-[#007AFF] hover:underline"
          >
            全5ヶ月を開く →
          </button>
        </div>

        {calendarOpen && (
          <div className="border-t border-slate-200 p-3">
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="grid grid-cols-8 border-b border-slate-200 bg-[#F5F5F7] py-1.5 text-center text-[10px] font-semibold text-[#6E6E73]">
                <div>週</div>
                {WEEKDAY_SHORT.map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="divide-y divide-slate-100">
                {miniCalRows.map((row) => {
                  const rw = row.roadmapWeek;
                  const isSel = rw !== null && rw.weekNumber === activeWeek.weekNumber;
                  return (
                    <div
                      key={row.mondayStr}
                      onClick={() => {
                        if (!rw) return;
                        const idx = ROADMAP_WEEKS.findIndex(
                          (x) => x.weekNumber === rw.weekNumber
                        );
                        if (idx >= 0) setSelectedWeekIdx(idx);
                      }}
                      className={`grid grid-cols-8 items-center py-1.5 text-center font-mono text-[11px] tabular-nums transition ${
                        rw ? 'cursor-pointer' : 'opacity-35'
                      } ${
                        isSel
                          ? 'bg-[#007AFF] font-bold text-white'
                          : 'text-[#1D1D1F] hover:bg-[#F5F5F7]'
                      }`}
                    >
                      <div className={`text-[10px] ${isSel ? 'text-white/85' : 'text-[#6E6E73]'}`}>
                        {rw ? `W${String(rw.weekNumber).padStart(2, '0')}` : '—'}
                      </div>
                      {row.days.map((d) => {
                        const isToday = d.dateStr === todayStr;
                        return (
                          <div key={d.dateStr} className="flex justify-center">
                            <span
                              className={`flex h-5 w-5 items-center justify-center rounded-full ${
                                isToday
                                  ? isSel
                                    ? 'bg-white font-bold text-[#007AFF]'
                                    : 'bg-[#007AFF] font-bold text-white'
                                  : !d.inMonth && !isSel
                                    ? 'text-slate-300'
                                    : ''
                              }`}
                            >
                              {d.dayNum}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
