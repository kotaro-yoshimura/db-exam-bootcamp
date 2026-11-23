// モジュール5統合：2026/11/23〜2027/03/28 18週間ロードマップ ＆ 合格教本9章・重要語句200フラッシュカード
import React, { useState } from 'react';
import type { ModuleId } from '../../types/exam';
import type { StudyStore } from '../../state/useStudyStore';
import { RoadmapTracker } from './RoadmapTracker';
import { FlashcardDeck } from './FlashcardDeck';

interface Props {
  store: StudyStore;
  onNavigateModule: (moduleId: ModuleId) => void;
}

export const RoadmapFlashcardsView: React.FC<Props> = ({ store, onNavigateModule }) => {
  const [subTab, setSubTab] = useState<'roadmap' | 'cards'>('roadmap');

  return (
    <section className="space-y-5">
      <div className="border-b border-[#e4e4e0] pb-3">
        <div className="font-mono text-[11px] uppercase tracking-wider text-[#71717a]">
          05 / ROADMAP &amp; GLOSSARY 200
        </div>
        <h2 className="mt-0.5 text-xl font-bold tracking-tight text-[#18181b]">
          18週間行程表 ＆ 合格教本9章・重要語句200
        </h2>
      </div>

      <div className="inline-flex rounded-md border border-[#d4d4d0] bg-[#f1f1ee] p-0.5">
        <button
          type="button"
          onClick={() => setSubTab('roadmap')}
          className={`rounded px-3.5 py-1.5 text-xs font-semibold transition ${
            subTab === 'roadmap' ? 'bg-white text-[#18181b] shadow-xs' : 'text-[#52525b]'
          }`}
        >
          月間カレンダー・18週間行程（2026/11 – 2027/03）
        </button>
        <button
          type="button"
          onClick={() => setSubTab('cards')}
          className={`rounded px-3.5 py-1.5 text-xs font-semibold transition ${
            subTab === 'cards' ? 'bg-white text-[#18181b] shadow-xs' : 'text-[#52525b]'
          }`}
        >
          重要語句200フラッシュカード
        </button>
      </div>

      {subTab === 'roadmap' ? (
        <RoadmapTracker store={store} onNavigateModule={onNavigateModule} />
      ) : (
        <FlashcardDeck store={store} />
      )}
    </section>
  );
};
