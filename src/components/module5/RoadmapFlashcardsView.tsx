// 独立ビュー：18週間「行程カレンダー」ページ ＆ 合格教本9章「重要語句200」ページ
import React from 'react';
import type { ModuleId } from '../../types/exam';
import type { StudyStore } from '../../state/useStudyStore';
import { RoadmapTracker } from './RoadmapTracker';
import { FlashcardDeck } from './FlashcardDeck';

interface RoadmapPageProps {
  store: StudyStore;
  onNavigateModule: (moduleId: ModuleId) => void;
}

export const RoadmapCalendarView: React.FC<RoadmapPageProps> = ({
  store,
  onNavigateModule,
}) => (
  <section className="space-y-4">
    <div className="flex flex-wrap items-baseline justify-between gap-2 pb-1">
      <div className="flex flex-wrap items-baseline gap-2.5">
        <h2 className="text-[20px] font-bold tracking-tight text-[#1D1D1F]">行程カレンダー</h2>
        <span className="font-mono text-xs tabular-nums text-[#8E8E93]">
          2026/11/23 – 2027/03/28（18週間）
        </span>
      </div>
    </div>
    <RoadmapTracker store={store} onNavigateModule={onNavigateModule} />
  </section>
);

interface FlashcardsPageProps {
  store: StudyStore;
}

export const Flashcards200View: React.FC<FlashcardsPageProps> = ({ store }) => (
  <section className="space-y-4">
    <div className="flex flex-wrap items-baseline justify-between gap-2 pb-1">
      <div className="flex flex-wrap items-baseline gap-2.5">
        <h2 className="text-[20px] font-bold tracking-tight text-[#1D1D1F]">重要語句200</h2>
        <span className="text-xs text-[#8E8E93]">合格教本 全9章フラッシュカード</span>
      </div>
    </div>
    <FlashcardDeck store={store} />
  </section>
);
