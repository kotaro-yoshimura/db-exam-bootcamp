// ホーム画面：iOS純正（リマインダー・設定）風のボーダーレス Inset Grouped 構成
// 囲み枠・入れ子カードを排し、余白・極細ヘアライン・丸型チェックで「押せる場所」と「次の一手」を明確化
import React, { useState, useMemo } from 'react';
import type { ModuleId, RoadmapTask } from '../../types/exam';
import type { StudyStore } from '../../state/useStudyStore';
import { ROADMAP_WEEKS } from '../../data/roadmap';
import { FLASHCARDS_200 } from '../../data/flashcards200';
import { SQL_DRILLS } from '../../data/sqlDrills';
import { formatLocalYmd } from '../../utils/examDate';
import { computeNextStudyAction } from '../../utils/nextStudyAction';
import { buildMonthCalendarRows } from '../module5/RoadmapTracker';
import { ChevronDownIcon, ChevronRightIcon, ModuleNavIcon } from '../common/NavIcons';

interface Props {
  store: StudyStore;
  daysLeft: number;
  lastPracticeModule: 'lab' | 'sql' | 'cbt';
  onNavigateModule: (id: ModuleId) => void;
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
  roadmap: '行程',
  cards: '200語',
};

const PRACTICE_INFO: Record<'lab' | 'sql' | 'cbt', { title: string; subtitle: string }> = {
  lab: { title: '図解ラボ', subtitle: '正規化・E-R図・物理I/O' },
  sql: { title: 'SQL道場', subtitle: '過去問クエリ実機演習' },
  cbt: { title: 'CBT演習', subtitle: '2ペイン本番・記述添削' },
};

const WEEKDAY_SHORT = ['月', '火', '水', '木', '金', '土', '日'];

/** iOSリマインダー風の丸型チェックマーク（SVG fill明示でiOS黒塗り防止） */
const CircleCheck: React.FC<{ checked: boolean }> = ({ checked }) => (
  <span
    aria-hidden="true"
    className={`mt-0.5 inline-flex h-[21px] w-[21px] shrink-0 items-center justify-center rounded-full transition ${
      checked
        ? 'bg-[#007AFF] text-white'
        : 'border-[1.5px] border-[#C7C7CC] bg-white'
    }`}
  >
    {checked && (
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3 w-3"
      >
        <path fill="none" d="M3.5 8.2L6.6 11.2L12.5 4.8" />
      </svg>
    )}
  </span>
);

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

  const activeYear = Number(activeWeek.startDate.slice(0, 4));
  const activeMonthNum = Number(activeWeek.startDate.slice(5, 7));
  const miniCalRows = useMemo(
    () => buildMonthCalendarRows(activeYear, activeMonthNum),
    [activeYear, activeMonthNum]
  );

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

  const nextAction = useMemo(
    () => computeNextStudyAction(store.state, selectedWeekIdx),
    [store.state, selectedWeekIdx]
  );

  const handlePrimaryNextAction = () => {
    if (nextAction.isTextbookTask && nextAction.roadmapTaskId) {
      if (nextAction.weekIdx !== undefined && nextAction.weekIdx !== selectedWeekIdx) {
        setSelectedWeekIdx(nextAction.weekIdx);
      }
      store.toggleRoadmapTask(nextAction.roadmapTaskId);
      return;
    }
    if (nextAction.targetModule) {
      onNavigateModule(nextAction.targetModule);
    }
  };

  const shortStart = activeWeek.startDate.slice(5).replace('-', '/');
  const shortEnd = activeWeek.endDate.slice(5).replace('-', '/');

  return (
    <section className="space-y-5">
      {/* 1枚のボーダーレス白ストリップ（4つの浮いた枠付き小カードを廃止し極細縦線で区切る） */}
      <div className="ios-group grid grid-cols-4 divide-x divide-black/[0.07] overflow-hidden">
        <div className="px-2 py-2.5 text-center">
          <div className="text-[10px] font-medium text-[#8E8E93]">残り日数</div>
          <div className="mt-0.5 font-mono text-[14px] font-bold tabular-nums text-[#1D1D1F]">
            {daysLeft}
            <span className="ml-0.5 font-sans text-[10px] font-normal text-[#6E6E73]">日</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigateModule('roadmap')}
          className="px-2 py-2.5 text-center transition active:bg-black/[0.04] hover:bg-black/[0.02]"
        >
          <div className="text-[10px] font-medium text-[#007AFF]">進捗 ›</div>
          <div className="mt-0.5 font-mono text-[14px] font-bold tabular-nums text-[#1D1D1F]">
            {doneTasks}
            <span className="text-[11px] font-normal text-[#8E8E93]">/{allTasks.length}</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateModule('cards')}
          className="px-2 py-2.5 text-center transition active:bg-black/[0.04] hover:bg-black/[0.02]"
        >
          <div className="text-[10px] font-medium text-[#007AFF]">200語 ›</div>
          <div className="mt-0.5 font-mono text-[14px] font-bold tabular-nums text-[#1D1D1F]">
            {masteredCards}
            <span className="text-[11px] font-normal text-[#8E8E93]">/{FLASHCARDS_200.length}</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateModule('review')}
          className="px-2 py-2.5 text-center transition active:bg-black/[0.04] hover:bg-black/[0.02]"
        >
          <div className="text-[10px] font-medium text-[#007AFF]">弱点 ›</div>
          <div className="mt-0.5 font-mono text-[14px] font-bold tabular-nums text-[#1D1D1F]">
            {activeWeak.length}
            <span className="ml-0.5 font-sans text-[10px] font-normal text-[#6E6E73]">件</span>
          </div>
        </button>
      </div>

      {/* ★ 次にやること（シート外見出し＋ボーダーレス白シート＋1本だけの主ボタン） */}
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="ios-section-label">次にやること</h2>
          <span className="font-mono text-[11px] tabular-nums text-[#8E8E93]">
            {nextAction.badge}
          </span>
        </div>

        <div className="ios-group p-4 space-y-3">
          <div className="space-y-1">
            <div className="text-[15px] font-bold leading-snug text-[#1D1D1F]">
              {nextAction.title}
            </div>
            <p className="text-xs leading-relaxed text-[#6E6E73]">{nextAction.reason}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handlePrimaryNextAction}
              className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1 rounded-[8px] bg-[#007AFF] px-4 py-2.5 text-[13px] font-semibold text-white active:opacity-80 hover:bg-[#0066D6] transition"
            >
              <span>{nextAction.ctaLabel}</span>
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>

            {!nextAction.isTextbookTask && nextAction.roadmapTaskId && (
              <button
                type="button"
                onClick={() => store.toggleRoadmapTask(nextAction.roadmapTaskId!)}
                className="text-xs font-medium text-[#007AFF] active:opacity-60 hover:underline"
              >
                完了チェックする
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ① 今週（Week XX）のチェックリスト（iOSリマインダー風・枠バッジを全廃） */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-baseline gap-2 min-w-0">
            <h2 className="ios-section-label shrink-0">
              <span className="font-mono tabular-nums">
                Week {String(activeWeek.weekNumber).padStart(2, '0')}
              </span>
              {selectedWeekIdx === detectedWeekIdx ? '（今週）' : ''}
            </h2>
            <span className="truncate font-mono text-[11px] tabular-nums text-[#8E8E93]">
              {shortStart}–{shortEnd} · {weekDoneCount}/{activeWeek.tasks.length}
            </span>
          </div>

          {/* 枠なしのシンプルな週切替テキスト操作 */}
          <div className="flex shrink-0 items-center gap-3 text-xs font-medium">
            <button
              type="button"
              disabled={selectedWeekIdx === 0}
              onClick={() => setSelectedWeekIdx((i) => Math.max(0, i - 1))}
              className="text-[#007AFF] disabled:text-[#C7C7CC] active:opacity-50"
            >
              ‹ 前週
            </button>
            {selectedWeekIdx !== detectedWeekIdx && (
              <button
                type="button"
                onClick={() => setSelectedWeekIdx(detectedWeekIdx)}
                className="text-[#007AFF] active:opacity-50"
              >
                今週
              </button>
            )}
            <button
              type="button"
              disabled={selectedWeekIdx === ROADMAP_WEEKS.length - 1}
              onClick={() =>
                setSelectedWeekIdx((i) => Math.min(ROADMAP_WEEKS.length - 1, i + 1))
              }
              className="text-[#007AFF] disabled:text-[#C7C7CC] active:opacity-50"
            >
              次週 ›
            </button>
          </div>
        </div>

        <div className="ios-group overflow-hidden">
          {/* 週テーマ＆テキスト範囲（帯や枠なしのすっきりした上部行） */}
          <div className="border-b border-black/[0.07] px-4 py-3">
            <div className="text-[14px] font-semibold text-[#1D1D1F]">{activeWeek.theme}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[#6E6E73]">
              <span>テキスト：{activeWeek.textbookRange}</span>
              <span className="font-mono tabular-nums">
                過去問：{activeWeek.recommendedYears.join(' / ')}
              </span>
              <span className="font-mono tabular-nums">全体 {roadmapPct}%</span>
            </div>
          </div>

          {/* リスト本体（iOSリマインダー風インデント付き極細ヘアライン） */}
          <div>
            {activeWeek.tasks.map((task, idx) => {
              const checked = completedSet.has(task.id);
              const isNext = !checked && nextAction.roadmapTaskId === task.id;
              const catLabel = CAT_LABEL[task.category || 'app'];

              return (
                <div
                  key={task.id}
                  className={`flex items-start gap-3 pl-4 pr-3.5 transition ${
                    isNext ? 'bg-[#007AFF]/[0.035]' : ''
                  }`}
                >
                  {/* 丸型チェックボタン */}
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    aria-label={`${task.label}を${checked ? '未完了に戻す' : '完了にする'}`}
                    onClick={() => store.toggleRoadmapTask(task.id)}
                    className="py-3 active:scale-90 transition"
                  >
                    <CircleCheck checked={checked} />
                  </button>

                  {/* テキスト＋右アクション（左インデント付き下線） */}
                  <div
                    className={`flex min-w-0 flex-1 items-center justify-between gap-3 py-3 ${
                      idx < activeWeek.tasks.length - 1 ? 'border-b border-black/[0.07]' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => store.toggleRoadmapTask(task.id)}
                      className="min-w-0 flex-1 text-left active:opacity-60"
                    >
                      <div
                        className={`text-[13.5px] leading-snug ${
                          checked ? 'line-through text-[#8E8E93]' : 'text-[#1D1D1F]'
                        }`}
                      >
                        {task.label}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px]">
                        <span className="text-[#8E8E93]">{catLabel}</span>
                        {isNext && (
                          <span className="font-semibold text-[#007AFF]">· 次はこちら</span>
                        )}
                      </div>
                    </button>

                    {task.targetModule && (
                      <button
                        type="button"
                        onClick={() => onNavigateModule(task.targetModule!)}
                        className="inline-flex shrink-0 items-center gap-0.5 py-1 pl-2 text-[12px] font-medium text-[#007AFF] active:opacity-50"
                      >
                        <span>{MODULE_ACTION_LABEL[task.targetModule]}</span>
                        <ChevronRightIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-black/[0.07] px-4 py-2.5 text-[11px] leading-relaxed text-[#6E6E73]">
            到達目標：{activeWeek.goal}
          </div>
        </div>
      </div>

      {/* ② クイック再開（iOS「設定」アプリ風の1枚リスト／md以上は3列連結シート） */}
      <div className="space-y-1.5">
        <h3 className="ios-section-label px-1">クイック再開</h3>

        <div className="ios-group overflow-hidden divide-y divide-black/[0.07] md:grid md:grid-cols-3 md:divide-y-0 md:divide-x">
          {/* 弱点復習キュー */}
          <button
            type="button"
            onClick={() => onNavigateModule('review')}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-black/[0.02] active:bg-black/[0.05]"
          >
            <div className="flex min-w-0 items-center gap-3">
              <ModuleNavIcon id="review" className="h-[19px] w-[19px] shrink-0 text-[#007AFF]" />
              <div className="min-w-0">
                <div className="text-[13.5px] font-medium text-[#1D1D1F]">弱点復習キュー</div>
                <div className="truncate text-[11px] text-[#8E8E93]">
                  {activeWeak.length > 0 ? activeWeak[0].title : '未卒業なし'}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 text-[#8E8E93]">
              <span className="font-mono text-xs tabular-nums">{activeWeak.length}件</span>
              <ChevronRightIcon className="h-4 w-4 text-[#C7C7CC]" />
            </div>
          </button>

          {/* 直近の演習 */}
          <button
            type="button"
            onClick={() => onNavigateModule(lastPracticeModule)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-black/[0.02] active:bg-black/[0.05]"
          >
            <div className="flex min-w-0 items-center gap-3">
              <ModuleNavIcon
                id={lastPracticeModule}
                className="h-[19px] w-[19px] shrink-0 text-[#007AFF]"
              />
              <div className="min-w-0">
                <div className="text-[13.5px] font-medium text-[#1D1D1F]">
                  直近：{practiceMeta.title}
                </div>
                <div className="truncate text-[11px] text-[#8E8E93]">
                  {lastPracticeModule === 'sql'
                    ? `SQLクリア ${store.state.solvedSqlDrills.length}/${SQL_DRILLS.length}問`
                    : lastPracticeModule === 'cbt'
                      ? `記述下書き ${cbtDraftCount}問`
                      : practiceMeta.subtitle}
                </div>
              </div>
            </div>
            <ChevronRightIcon className="h-4 w-4 shrink-0 text-[#C7C7CC]" />
          </button>

          {/* 重要語句200 */}
          <button
            type="button"
            onClick={() => onNavigateModule('cards')}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-black/[0.02] active:bg-black/[0.05]"
          >
            <div className="flex min-w-0 items-center gap-3">
              <ModuleNavIcon id="cards" className="h-[19px] w-[19px] shrink-0 text-[#007AFF]" />
              <div className="min-w-0">
                <div className="text-[13.5px] font-medium text-[#1D1D1F]">重要語句200</div>
                <div className="truncate text-[11px] text-[#8E8E93]">
                  要復習 <span className="font-mono tabular-nums">{reviewCards}</span>語
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 text-[#8E8E93]">
              <span className="font-mono text-xs tabular-nums">
                {masteredCards}/{FLASHCARDS_200.length}
              </span>
              <ChevronRightIcon className="h-4 w-4 text-[#C7C7CC]" />
            </div>
          </button>
        </div>
      </div>

      {/* ③ コンパクト週切替カレンダー（枠なしリスト行＋開閉式） */}
      <div className="ios-group overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => setCalendarOpen((v) => !v)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left active:opacity-60"
          >
            <ChevronDownIcon
              className={`h-4 w-4 shrink-0 text-[#8E8E93] transition-transform ${
                calendarOpen ? 'rotate-180' : ''
              }`}
            />
            <span className="font-mono text-[13px] font-semibold tabular-nums text-[#1D1D1F]">
              {activeYear}年{activeMonthNum}月 カレンダー
            </span>
            <span className="text-[11px] text-[#8E8E93]">
              {calendarOpen ? '閉じる' : '週を切替'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateModule('roadmap')}
            className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-[#007AFF] active:opacity-50"
          >
            <span>全5ヶ月</span>
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        {calendarOpen && (
          <div className="border-t border-black/[0.07]">
            <div className="grid grid-cols-8 border-b border-black/[0.06] bg-[#F9F9FB] py-1.5 text-center text-[10px] font-semibold text-[#8E8E93]">
              <div>週</div>
              {WEEKDAY_SHORT.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="divide-y divide-black/[0.05]">
              {miniCalRows.map((row) => {
                const rw = row.roadmapWeek;
                const isSel = rw !== null && rw.weekNumber === activeWeek.weekNumber;
                return (
                  <button
                    key={row.mondayStr}
                    type="button"
                    disabled={!rw}
                    onClick={() => {
                      if (!rw) return;
                      const idx = ROADMAP_WEEKS.findIndex(
                        (x) => x.weekNumber === rw.weekNumber
                      );
                      if (idx >= 0) setSelectedWeekIdx(idx);
                    }}
                    className={`grid w-full grid-cols-8 items-center py-2 text-center font-mono text-[11px] tabular-nums transition ${
                      !rw ? 'opacity-35 cursor-default' : 'active:bg-black/[0.06]'
                    } ${
                      isSel
                        ? 'bg-[#007AFF] font-bold text-white'
                        : 'text-[#1D1D1F] hover:bg-black/[0.025]'
                    }`}
                  >
                    <div
                      className={`text-[10px] ${
                        isSel ? 'text-white' : 'font-semibold text-[#007AFF]'
                      }`}
                    >
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
                                  ? 'text-[#C7C7CC]'
                                  : ''
                            }`}
                          >
                            {d.dayNum}
                          </span>
                        </div>
                      );
                    })}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
