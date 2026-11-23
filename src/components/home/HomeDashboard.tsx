// トップページ：全体進捗管理・今月ミニカレンダー・今週タスク直接チェック（テキスト通読込）・簡易運用マニュアル
import React, { useState, useMemo } from 'react';
import type { ModuleId, RoadmapTask } from '../../types/exam';
import type { StudyStore } from '../../state/useStudyStore';
import { ROADMAP_WEEKS } from '../../data/roadmap';
import { FLASHCARDS_200 } from '../../data/flashcards200';
import { SQL_DRILLS } from '../../data/sqlDrills';
import { buildMonthCalendarRows } from '../module5/RoadmapTracker';

interface Props {
  store: StudyStore;
  onNavigateModule: (id: ModuleId) => void;
  onOpenSync: () => void;
}

const MODULE_INDEX: Array<{
  id: ModuleId;
  num: string;
  name: string;
  summary: string;
}> = [
  {
    id: 'lab',
    num: '01',
    name: '図解シミュレーター',
    summary: '正規化FD分解・下線クイズ・E-R図5大パターン・ウィンドウ/再帰/2PC vs Saga・物理I/O・CP回復・4096B容量計算',
  },
  {
    id: 'sql',
    num: '02',
    name: 'SQL道場',
    summary: '過去問6問のSQL実行＆自動採点（sql.js WASM / オフライン自動切替）・ウィンドウ関数フレーム可視化',
  },
  {
    id: 'cbt',
    num: '03',
    name: 'CBT本番演習',
    summary: '左右2ペイン演習・A4メモ略記＆手書きオーバーレイ・本文シグナル発掘・Gemini添削プロンプト生成',
  },
  {
    id: 'review',
    num: '04',
    name: '弱点復習キュー',
    summary: '誤答したスキーマ下線・記述・シグナル・物理問題を自動収集し、2回連続満点で卒業する反復ドリル',
  },
  {
    id: 'roadmap',
    num: '05',
    name: 'カレンダー行程・重要語句200',
    summary: '2026年11月〜2027年3月の月間カレンダー（テキスト通読込）＆ 合格教本9章・重要語句200フラッシュカード',
  },
];

const CAT_BADGE: Record<NonNullable<RoadmapTask['category']>, { label: string; cls: string }> = {
  textbook: { label: 'テキスト', cls: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]' },
  app: { label: '演習', cls: 'border-[#e4e4e0] bg-[#f6f6f4] text-[#3f3f46]' },
  cbt: { label: 'CBT', cls: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]' },
  review: { label: '復習', cls: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]' },
};

const WEEKDAY_SHORT = ['月', '火', '水', '木', '金', '土', '日'];

export const HomeDashboard: React.FC<Props> = ({
  store,
  onNavigateModule,
  onOpenSync,
}) => {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const examEnd = new Date('2027-03-28T00:00:00+09:00');
  const daysLeft = Math.max(0, Math.ceil((examEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

  const detectedWeekIdx = Math.max(
    0,
    ROADMAP_WEEKS.findIndex((w) => todayStr >= w.startDate && todayStr <= w.endDate)
  );
  const [selectedWeekIdx, setSelectedWeekIdx] = useState(detectedWeekIdx);
  const activeWeek = ROADMAP_WEEKS[selectedWeekIdx] || ROADMAP_WEEKS[0];

  // 選択中の週が属する月のミニカレンダーを生成
  const activeYear = Number(activeWeek.startDate.slice(0, 4));
  const activeMonthNum = Number(activeWeek.startDate.slice(5, 7));
  const miniCalRows = useMemo(
    () => buildMonthCalendarRows(activeYear, activeMonthNum),
    [activeYear, activeMonthNum]
  );

  // 進捗メトリクス集計
  const completedSet = new Set(store.state.completedRoadmapTasks);
  const allTasks = ROADMAP_WEEKS.flatMap((w) => w.tasks);
  const textbookTasks = allTasks.filter((t) => t.category === 'textbook');
  const doneTasks = allTasks.filter((t) => completedSet.has(t.id)).length;
  const doneTextbook = textbookTasks.filter((t) => completedSet.has(t.id)).length;
  const roadmapPct = Math.round((doneTasks / Math.max(1, allTasks.length)) * 100);
  const textbookPct = Math.round((doneTextbook / Math.max(1, textbookTasks.length)) * 100);

  const masteredCards = Object.values(store.state.flashcardStatus).filter((s) => s === 'mastered').length;
  const reviewCards = Object.values(store.state.flashcardStatus).filter((s) => s === 'review').length;

  const activeWeak = store.state.reviewQueue.filter((q) => !q.graduated);
  const graduatedWeak = store.state.reviewQueue.filter((q) => q.graduated);
  const weekDoneCount = activeWeek.tasks.filter((t) => completedSet.has(t.id)).length;

  return (
    <section className="space-y-6">
      {/* ページヘッダ */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#e4e4e0] pb-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-wider text-[#71717a]">
            OVERVIEW / PROGRESS &amp; MANUAL
          </div>
          <h2 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-[#18181b]">
            学習進捗と利用マニュアル
          </h2>
          <p className="mt-1 text-xs text-[#52525b]">
            対象期間：2026/11/23 – 2027/03/28（18週間） ／ 目標日まで残り{' '}
            <span className="font-mono font-semibold text-[#18181b]">{daysLeft}</span> 日
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenSync}
            className="rounded-md border border-[#d4d4d0] bg-white px-3.5 py-2 text-xs font-semibold text-[#18181b] hover:bg-[#f1f1ee] transition"
          >
            データ同期（Base64 / JSON）
          </button>
          <button
            type="button"
            onClick={() => onNavigateModule('roadmap')}
            className="rounded-md bg-[#18181b] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#27272a] transition"
          >
            月間カレンダーを開く
          </button>
        </div>
      </div>

      {/* 全体進捗サマリー（4列の罫線グリッド：テキスト通読進捗を独立表示） */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#e4e4e0] rounded-lg border border-[#e4e4e0] bg-white">
        <div className="p-4">
          <div className="text-[11px] font-medium text-[#71717a]">全体スケジュール</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-[#18181b]">{roadmapPct}%</span>
            <span className="font-mono text-xs text-[#71717a]">
              {doneTasks}/{allTasks.length}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#e4e4e0]">
            <div className="h-full bg-[#18181b]" style={{ width: `${roadmapPct}%` }} />
          </div>
        </div>

        <div className="p-4">
          <div className="text-[11px] font-semibold text-[#92400e]">テキスト通読（全9章）</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-[#18181b]">{doneTextbook}</span>
            <span className="font-mono text-xs text-[#71717a]">/ {textbookTasks.length} 週完了</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#fef3c7]">
            <div className="h-full bg-[#b45309]" style={{ width: `${textbookPct}%` }} />
          </div>
        </div>

        <div className="p-4">
          <div className="text-[11px] font-medium text-[#71717a]">重要語句・SQL道場</div>
          <div className="mt-1 flex items-baseline gap-2.5">
            <span className="font-mono text-xl font-bold text-[#18181b]">
              {masteredCards}
              <span className="text-xs font-normal text-[#71717a]">/200語</span>
            </span>
            <span className="font-mono text-xs font-semibold text-[#52525b]">
              SQL {store.state.solvedSqlDrills.length}/{SQL_DRILLS.length}
            </span>
          </div>
          <div className="mt-1.5 text-[11px] text-[#71717a]">要復習カード：{reviewCards}語</div>
        </div>

        <div className="p-4">
          <div className="text-[11px] font-medium text-[#71717a]">弱点復習キュー</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={`font-mono text-2xl font-bold ${
                activeWeak.length > 0 ? 'text-[#be123c]' : 'text-[#15803d]'
              }`}
            >
              {activeWeak.length}
            </span>
            <span className="text-xs text-[#71717a]">件 未卒業</span>
          </div>
          <div className="mt-1.5 text-[11px] text-[#52525b]">
            2回連続満点・卒業済：{graduatedWeak.length}件
          </div>
        </div>
      </div>

      {/* メイン2カラム：左＝今月ミニカレンダー＋今週タスク＋目次 / 右＝簡易マニュアル */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* ================= 左カラム（7/12） ================= */}
        <div className="lg:col-span-7 space-y-6">
          {/* 今月のミニカレンダー ＆ 今週タスク（テキスト通読＋演習を直接チェック） */}
          <div className="rounded-lg border border-[#e4e4e0] bg-white overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e4e4e0] bg-[#fafafa] px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-[#18181b] px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                    Week {String(activeWeek.weekNumber).padStart(2, '0')}
                  </span>
                  <span className="font-mono text-xs text-[#52525b]">
                    {activeWeek.startDate} – {activeWeek.endDate}
                  </span>
                  {selectedWeekIdx === detectedWeekIdx && (
                    <span className="rounded border border-[#bfdbfe] bg-[#eff6ff] px-1.5 py-0.5 text-[10px] font-semibold text-[#1d4ed8]">
                      今週
                    </span>
                  )}
                </div>
                <h3 className="mt-1 text-sm font-bold text-[#18181b]">{activeWeek.theme}</h3>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={selectedWeekIdx === 0}
                  onClick={() => setSelectedWeekIdx((i) => Math.max(0, i - 1))}
                  className="rounded border border-[#d4d4d0] bg-white px-2 py-1 text-xs text-[#18181b] hover:bg-[#f1f1ee] disabled:opacity-40"
                >
                  前週
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedWeekIdx(detectedWeekIdx)}
                  className="rounded border border-[#d4d4d0] bg-white px-2 py-1 text-xs text-[#52525b] hover:bg-[#f1f1ee]"
                >
                  今週
                </button>
                <button
                  type="button"
                  disabled={selectedWeekIdx === ROADMAP_WEEKS.length - 1}
                  onClick={() =>
                    setSelectedWeekIdx((i) => Math.min(ROADMAP_WEEKS.length - 1, i + 1))
                  }
                  className="rounded border border-[#d4d4d0] bg-white px-2 py-1 text-xs text-[#18181b] hover:bg-[#f1f1ee] disabled:opacity-40"
                >
                  次週
                </button>
              </div>
            </div>

            {/* コンパクト月間カレンダー（週をタップで切替可能） */}
            <div className="border-b border-[#e4e4e0] bg-[#fafafa] px-4 py-3">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-mono font-bold text-[#18181b]">
                  {activeYear}年{activeMonthNum}月 カレンダー（週をタップで切替）
                </span>
                <button
                  type="button"
                  onClick={() => onNavigateModule('roadmap')}
                  className="font-semibold text-[#1d4ed8] hover:underline"
                >
                  全5ヶ月カレンダーを見る →
                </button>
              </div>
              <div className="rounded-md border border-[#e4e4e0] bg-white overflow-hidden">
                <div className="grid grid-cols-8 border-b border-[#e4e4e0] bg-[#f6f6f4] py-1 text-center text-[10px] font-semibold text-[#71717a]">
                  <div>週</div>
                  {WEEKDAY_SHORT.map((d, i) => (
                    <div
                      key={d}
                      className={i === 5 ? 'text-[#1d4ed8]' : i === 6 ? 'text-[#be123c]' : ''}
                    >
                      {d}
                    </div>
                  ))}
                </div>
                <div className="divide-y divide-[#f1f1ee]">
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
                        className={`grid grid-cols-8 items-center py-1.5 text-center font-mono text-[11px] ${
                          rw ? 'cursor-pointer' : 'opacity-40'
                        } ${isSel ? 'bg-[#18181b] text-white font-bold' : 'hover:bg-[#f6f6f4]'}`}
                      >
                        <div className={`text-[10px] ${isSel ? 'text-[#d4d4d8]' : 'text-[#71717a]'}`}>
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
                                      ? 'bg-white text-[#18181b] font-bold'
                                      : 'bg-[#18181b] text-white font-bold'
                                    : !d.inMonth && !isSel
                                      ? 'text-[#c4c4be]'
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

            {/* 選択週のテキスト範囲とタスクチェックリスト */}
            <div className="px-4 py-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="rounded border border-[#fde68a] bg-[#fffbeb] px-2 py-0.5 font-semibold text-[#92400e]">
                  今週のテキスト：{activeWeek.textbookRange}
                </span>
                <span className="font-mono font-semibold text-[#18181b]">
                  完了 {weekDoneCount}/{activeWeek.tasks.length}
                </span>
              </div>

              <div className="divide-y divide-[#f1f1ee] rounded-md border border-[#e4e4e0] overflow-hidden">
                {activeWeek.tasks.map((task) => {
                  const checked = completedSet.has(task.id);
                  const badge = CAT_BADGE[task.category || 'app'];
                  return (
                    <div
                      key={task.id}
                      className="flex items-start justify-between gap-3 px-3 py-2.5 bg-white"
                    >
                      <label className="flex cursor-pointer items-start gap-2.5 text-xs sm:text-sm leading-relaxed">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => store.toggleRoadmapTask(task.id)}
                          className="mt-1 h-4 w-4 shrink-0 accent-[#18181b]"
                        />
                        <span>
                          <span
                            className={`mr-1.5 inline-block rounded border px-1.5 py-0.2 text-[10px] font-semibold align-middle ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                          <span className={checked ? 'line-through text-[#a1a1aa]' : 'text-[#18181b]'}>
                            {task.label}
                          </span>
                        </span>
                      </label>
                      {task.targetModule && (
                        <button
                          type="button"
                          onClick={() => onNavigateModule(task.targetModule!)}
                          className="shrink-0 text-xs font-semibold text-[#1d4ed8] hover:underline pt-0.5"
                        >
                          開く →
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="text-xs text-[#71717a]">
                到達目標：{activeWeek.goal} ／ 推奨過去問：{activeWeek.recommendedYears.join(' / ')}
              </div>
            </div>
          </div>

          {/* 優先して潰す弱点 */}
          <div className="rounded-lg border border-[#e4e4e0] bg-white">
            <div className="flex items-center justify-between border-b border-[#e4e4e0] px-4 py-3">
              <h3 className="text-sm font-bold text-[#18181b]">
                優先して潰す弱点（未卒業 {activeWeak.length}件）
              </h3>
              <button
                type="button"
                onClick={() => onNavigateModule('review')}
                className="text-xs font-semibold text-[#1d4ed8] hover:underline"
              >
                弱点復習を開く →
              </button>
            </div>

            {activeWeak.length === 0 ? (
              <div className="px-4 py-5 text-xs text-[#71717a]">
                未卒業の弱点はありません。図解ラボの下線クイズやCBT演習で間違えた問題が自動的にここへ記録されます。
              </div>
            ) : (
              <div className="divide-y divide-[#f1f1ee]">
                {activeWeak.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="mr-2 font-mono text-[11px] text-[#71717a]">{item.year}</span>
                      <span className="font-medium text-[#18181b]">{item.title}</span>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-[#b45309]">
                      連続 {item.consecutivePerfect}/2
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 機能一覧 */}
          <div className="rounded-lg border border-[#e4e4e0] bg-white">
            <div className="border-b border-[#e4e4e0] px-4 py-3">
              <h3 className="text-sm font-bold text-[#18181b]">機能一覧（各画面へ移動）</h3>
            </div>
            <div className="divide-y divide-[#f1f1ee]">
              {MODULE_INDEX.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onNavigateModule(m.id)}
                  className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-[#f6f6f4] transition"
                >
                  <div className="flex items-start gap-3">
                    <span className="font-mono text-xs font-semibold text-[#71717a] pt-0.5">
                      {m.num}
                    </span>
                    <div>
                      <div className="text-sm font-bold text-[#18181b]">{m.name}</div>
                      <p className="mt-0.5 text-xs text-[#52525b] leading-relaxed">{m.summary}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-[#71717a] pt-0.5">→</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ================= 右カラム：簡易マニュアル（5/12） ================= */}
        <div className="lg:col-span-5">
          <div className="rounded-lg border border-[#e4e4e0] bg-white p-4 sm:p-5 space-y-5">
            <div className="border-b border-[#e4e4e0] pb-3">
              <div className="font-mono text-[11px] uppercase tracking-wider text-[#71717a]">
                QUICK MANUAL
              </div>
              <h3 className="mt-0.5 text-base font-bold text-[#18181b]">使い方・運用マニュアル</h3>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-[#18181b]">1. テキスト通読 × アプリ演習の進め方</h4>
              <ol className="space-y-2 text-xs text-[#52525b] leading-relaxed list-decimal pl-4">
                <li>
                  <strong className="text-[#18181b]">まずテキストを通読：</strong>
                  毎週先頭の「テキスト」タスクに沿って、合格教本の該当章をシンプルに読み進めます（Week 13で全9章1周完了）。
                </li>
                <li>
                  <strong className="text-[#18181b]">図解ラボ＆SQL道場で定着：</strong>
                  読んだ直後に該当するシミュレーターやSQL道場を触り、計算式やクエリの動きを視覚で確認します。
                </li>
                <li>
                  <strong className="text-[#18181b]">CBT演習 ＆ Gemini添削：</strong>
                  「CBT演習」で時間計測し、手書きメモ・本文シグナル発掘・記述解答を実施。添削用プロンプトコピーからレビューを受けます。
                </li>
                <li>
                  <strong className="text-[#18181b]">弱点キューの消化：</strong>
                  間違えた問題は「弱点復習」へ自動登録されます。2回連続満点で卒業させ、本番前の取りこぼしを無くします。
                </li>
              </ol>
            </div>

            <div className="space-y-2 border-t border-[#f1f1ee] pt-4">
              <h4 className="text-xs font-bold text-[#18181b]">2. 端末同期とiPadオフライン運用</h4>
              <div className="rounded-md border border-[#fde68a] bg-[#fffbeb] p-3 text-xs text-[#78350f] leading-relaxed">
                <strong>iPadショートカット（data: URL）起動時の注意：</strong>
                Safariの仕様上、タブを閉じるとブラウザ内の自動保存が初期化されます。学習を終える前に必ず右上の「データ同期」から同期コードをコピーし、メモアプリやMacBookへ控えてください。
              </div>
              <ul className="space-y-1.5 text-xs text-[#52525b] leading-relaxed list-disc pl-4">
                <li>
                  <strong className="text-[#18181b]">3秒同期：</strong>
                  送信側で「Base64同期コードをコピー」→ 受信側で「データ同期」を開きペーストして復元します。
                </li>
                <li>
                  <strong className="text-[#18181b]">定期バックアップ：</strong>
                  週に1度「JSONエクスポート保存」でファイル控えを取ると安心です。
                </li>
              </ul>
            </div>

            <div className="space-y-2 border-t border-[#f1f1ee] pt-4">
              <h4 className="text-xs font-bold text-[#18181b]">3. 関係スキーマ下線表記の凡例</h4>
              <div className="grid grid-cols-1 gap-2 rounded-md border border-[#e4e4e0] bg-[#f6f6f4] p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="key-pk font-bold text-[#1d4ed8]">受注番号</span>
                  <span className="text-[#52525b]">実線 ＝ 主キー（PK）</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="key-fk font-semibold text-[#15803d]">顧客コード</span>
                  <span className="text-[#52525b]">破線 ＝ 外部キー（FK）</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="key-pkfk font-bold text-[#b45309]">商品コード</span>
                  <span className="text-[#52525b]">二重線 ＝ 主キー兼外部キー</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="rounded bg-[#fffbeb] px-1 font-semibold text-[#b45309] border border-[#fde68a]">
                    [会員区分]
                  </span>
                  <span className="text-[#52525b]">角括弧 ＝ サブタイプ冗長属性</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
