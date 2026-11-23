// DBスペシャリスト学習ノート ルートコンポーネント
import React, { useState, useEffect } from 'react';
import type { ModuleId } from './types/exam';
import { useStudyStore } from './state/useStudyStore';
import { applyPwaUpdate, getPwaStatus, subscribePwaStatus, type PwaStatus } from './utils/pwa';
import { HeaderBar } from './components/common/HeaderBar';
import { BottomNav } from './components/common/BottomNav';
import { SyncModal } from './components/common/SyncModal';
import { HomeDashboard } from './components/home/HomeDashboard';
import { SimulatorLab } from './components/module1/SimulatorLab';
import { SqlDojo } from './components/module2/SqlDojo';
import { CbtTrainer } from './components/module3/CbtTrainer';
import { ReviewQueueView } from './components/module4/ReviewQueueView';
import { RoadmapFlashcardsView } from './components/module5/RoadmapFlashcardsView';

export const App: React.FC = () => {
  const store = useStudyStore();
  const [activeModule, setActiveModule] = useState<ModuleId>(store.state.lastModule || 'home');
  const [syncOpen, setSyncOpen] = useState(false);
  const [pwaStatus, setPwaStatus] = useState<PwaStatus>(() => getPwaStatus());
  const [dismissUpdateBanner, setDismissUpdateBanner] = useState(false);

  const handleSelectModule = (id: ModuleId) => {
    setActiveModule(id);
    store.setLastModule(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    document.title = 'DBスペシャリスト学習ノート — 令和8年度後期・CBT対策';
  }, []);

  useEffect(() => {
    return subscribePwaStatus(setPwaStatus);
  }, []);

  const activeWeakCount = store.state.reviewQueue.filter((q) => !q.graduated).length;

  return (
    <div className="min-h-screen bg-[#f6f6f4] text-[#18181b]">
      <HeaderBar
        activeModule={activeModule}
        onSelectModule={handleSelectModule}
        onOpenSync={() => setSyncOpen(true)}
        store={store}
      />

      {/* メインコンテナ：下部固定ナビと重ならないよう pb-36 (144px) を厳守 */}
      <main className="mx-auto w-full max-w-7xl px-4 pt-6 pb-36">
        {activeModule === 'home' && (
          <HomeDashboard
            store={store}
            onNavigateModule={handleSelectModule}
            onOpenSync={() => setSyncOpen(true)}
          />
        )}
        {activeModule === 'lab' && <SimulatorLab store={store} />}
        {activeModule === 'sql' && <SqlDojo store={store} />}
        {activeModule === 'cbt' && <CbtTrainer store={store} />}
        {activeModule === 'review' && (
          <ReviewQueueView store={store} onOpenSync={() => setSyncOpen(true)} />
        )}
        {activeModule === 'roadmap' && (
          <RoadmapFlashcardsView store={store} onNavigateModule={handleSelectModule} />
        )}
      </main>

      {/* PWA 新バージョン更新通知バナー（下部ナビと重ならない位置に控えめに表示） */}
      {pwaStatus.swState === 'update-available' && !dismissUpdateBanner && (
        <div className="fixed bottom-20 left-1/2 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-lg border border-[#18181b] bg-[#18181b] px-3.5 py-2.5 text-xs text-white shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">新しいバージョンの学習アプリがあります</span>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={applyPwaUpdate}
                className="rounded bg-white px-2.5 py-1 text-[11px] font-bold text-[#18181b] hover:bg-[#f1f1ee]"
              >
                更新する
              </button>
              <button
                type="button"
                onClick={() => setDismissUpdateBanner(true)}
                className="rounded border border-white/25 px-2 py-1 text-[11px] text-white/80 hover:bg-white/10"
              >
                後で
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav
        activeModule={activeModule}
        onSelectModule={handleSelectModule}
        activeWeakCount={activeWeakCount}
      />

      <SyncModal
        open={syncOpen}
        onClose={() => setSyncOpen(false)}
        store={store}
        pwaStatus={pwaStatus}
      />
    </div>
  );
};

export default App;
