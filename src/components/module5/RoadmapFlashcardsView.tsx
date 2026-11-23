// モジュール5統合：2026/11/23〜2027/03/28 18週間ロードマップ ＆ 合格教本9章・重要語句200フラッシュカード
import React from 'react';
import type { ModuleId } from '../../types/exam';
import type { StudyStore } from '../../state/useStudyStore';
import { RoadmapTracker } from './RoadmapTracker';
import { FlashcardDeck } from './FlashcardDeck';

interface Props {
  store: StudyStore;
  activeSubTab: 'roadmap' | 'cards';
  onChangeSubTab: (tab: 'roadmap' | 'cards') => void;
  onNavigateModule: (moduleId: ModuleId) => void;
}

export const RoadmapFlashcardsView: React.FC<Props> = ({
  store,
  activeSubTab,
  onChangeSubTab,
  onNavigateModule,
}) => {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#1D1D1F]">
          行程カレンダー ＆ 重要語句200
        </h2>

        <div className="inline-flex w-full sm:w-auto rounded-lg bg-[#E5E5EA]/80 p-0.5">
          <button
            type="button"
            onClick={() => onChangeSubTab('roadmap')}
            className={`flex-1 sm:flex-none rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
              activeSubTab === 'roadmap' ? 'bg-white text-[#1D1D1F] shadow-xs' : 'text-[#6E6E73]'
            }`}
          >
            18週間カレンダー
          </button>
          <button
            type="button"
            onClick={() => onChangeSubTab('cards')}
            className={`flex-1 sm:flex-none rounded-md px-3.5 py-1.5 text-xs font-semibold transition ${
              activeSubTab === 'cards' ? 'bg-white text-[#1D1D1F] shadow-xs' : 'text-[#6E6E73]'
            }`}
          >
            重要語句200カード
          </button>
        </div>
      </div>

      {activeSubTab === 'roadmap' ? (
        <RoadmapTracker store={store} onNavigateModule={onNavigateModule} />
      ) : (
        <FlashcardDeck store={store} />
      )}
    </section>
  );
};
