// 共通ヘッダーバー（落ち着いたドキュメント・設計ツール調）
import React from 'react';
import type { ModuleId } from '../../types/exam';
import type { StudyStore } from '../../state/useStudyStore';
import { FLASHCARDS_200 } from '../../data/flashcards200';
import { ROADMAP_WEEKS } from '../../data/roadmap';

interface Props {
  activeModule: ModuleId;
  onSelectModule: (id: ModuleId) => void;
  onOpenSync: () => void;
  store: StudyStore;
}

const DESKTOP_NAV: Array<{ id: ModuleId; label: string }> = [
  { id: 'home', label: 'ホーム' },
  { id: 'lab', label: '図解ラボ' },
  { id: 'sql', label: 'SQL道場' },
  { id: 'cbt', label: 'CBT演習' },
  { id: 'review', label: '弱点復習' },
  { id: 'roadmap', label: '行程・200語' },
];

export const HeaderBar: React.FC<Props> = ({
  activeModule,
  onSelectModule,
  onOpenSync,
  store,
}) => {
  const activeWeak = store.state.reviewQueue.filter((q) => !q.graduated).length;
  const totalTasks = ROADMAP_WEEKS.reduce((s, w) => s + w.tasks.length, 0);
  const roadmapPct = Math.round(
    (store.state.completedRoadmapTasks.length / Math.max(1, totalTasks)) * 100
  );
  const mastered = Object.values(store.state.flashcardStatus).filter((s) => s === 'mastered').length;

  return (
    <header className="sticky top-0 z-30 border-b border-[#e4e4e0] bg-white/95 backdrop-blur-sm pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5">
        {/* ブランドタイトル（タップでホームへ戻る） */}
        <button
          type="button"
          onClick={() => onSelectModule('home')}
          className="text-left min-w-0 group"
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold tracking-tight text-[#18181b] border border-[#18181b] px-1.5 py-0.5 rounded-sm">
              DB
            </span>
            <h1 className="truncate text-sm sm:text-base font-bold tracking-tight text-[#18181b] group-hover:text-[#1d4ed8] transition">
              DBスペシャリスト学習ノート
            </h1>
          </div>
          <p className="mt-0.5 truncate font-mono text-[11px] text-[#71717a]">
            R8後期CBT ｜ 行程 {roadmapPct}% ｜ 語句 {mastered}/{FLASHCARDS_200.length}
          </p>
        </button>

        {/* デスクトップ用テキストタブナビ */}
        <nav className="hidden lg:flex items-center gap-1">
          {DESKTOP_NAV.map((item) => {
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectModule(item.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-[#18181b] text-white'
                    : 'text-[#52525b] hover:bg-[#f1f1ee] hover:text-[#18181b]'
                }`}
              >
                {item.label}
                {item.id === 'review' && activeWeak > 0 && (
                  <span
                    className={`ml-1.5 inline-flex items-center justify-center rounded px-1 font-mono text-[10px] font-bold ${
                      active ? 'bg-white/20 text-white' : 'bg-[#fff1f2] text-[#be123c] border border-[#fecdd3]'
                    }`}
                  >
                    {activeWeak}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* データ同期ボタン */}
        <button
          type="button"
          onClick={onOpenSync}
          className="shrink-0 rounded-md border border-[#d4d4d0] bg-white px-3 py-1.5 text-xs font-semibold text-[#18181b] hover:bg-[#f1f1ee] transition"
        >
          データ同期
        </button>
      </div>
    </header>
  );
};
