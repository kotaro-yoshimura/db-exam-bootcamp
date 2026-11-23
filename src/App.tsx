// DBスペシャリスト学習ノート ルートコンポーネント
// iPad/Mac(md以上): 左固定サイドバー(210px)＋広い作業領域 ／ iPhone(md未満): 極薄48pxヘッダー＋すりガラス下部タブバー
import React, { useState, useEffect } from 'react';
import type { ModuleId } from './types/exam';
import { useStudyStore } from './state/useStudyStore';
import { applyPwaUpdate, getPwaStatus, subscribePwaStatus, type PwaStatus } from './utils/pwa';
import { getDaysLeftToExam } from './utils/examDate';
import { SidebarNav } from './components/common/SidebarNav';
import { HeaderBar } from './components/common/HeaderBar';
import { BottomNav } from './components/common/BottomNav';
import { SyncModal } from './components/common/SyncModal';
import { HelpModal } from './components/common/HelpModal';
import { HomeDashboard } from './components/home/HomeDashboard';
import { SimulatorLab } from './components/module1/SimulatorLab';
import { SqlDojo } from './components/module2/SqlDojo';
import { CbtTrainer } from './components/module3/CbtTrainer';
import { ReviewQueueView } from './components/module4/ReviewQueueView';
import { RoadmapFlashcardsView } from './components/module5/RoadmapFlashcardsView';

const LAST_PRACTICE_STORAGE_KEY = 'db_spec_last_practice_module_v1';

function loadLastPracticeModule(): 'lab' | 'sql' | 'cbt' {
  try {
    const val = window.localStorage.getItem(LAST_PRACTICE_STORAGE_KEY);
    if (val === 'lab' || val === 'sql' || val === 'cbt') return val;
  } catch {
    // ストレージ不可時はデフォルト値
  }
  return 'cbt';
}

export const App: React.FC = () => {
  const store = useStudyStore();
  const [activeModule, setActiveModule] = useState<ModuleId>(store.state.lastModule || 'home');
  const [lastPracticeModule, setLastPracticeModule] = useState<'lab' | 'sql' | 'cbt'>(() =>
    loadLastPracticeModule()
  );
  const [roadmapTab, setRoadmapTab] = useState<'roadmap' | 'cards'>('roadmap');
  const [syncOpen, setSyncOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [pwaStatus, setPwaStatus] = useState<PwaStatus>(() => getPwaStatus());
  const [dismissUpdateBanner, setDismissUpdateBanner] = useState(false);

  const handleSelectModule = (id: ModuleId, options?: { roadmapSubTab?: 'roadmap' | 'cards' }) => {
    if (options?.roadmapSubTab) {
      setRoadmapTab(options.roadmapSubTab);
    }
    if (id === 'lab' || id === 'sql' || id === 'cbt') {
      setLastPracticeModule(id);
      try {
        window.localStorage.setItem(LAST_PRACTICE_STORAGE_KEY, id);
      } catch {
        // 保存不可でも継続
      }
    }
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
  const daysLeft = getDaysLeftToExam();

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F]">
      {/* iPad / Mac幅（md以上）：左固定サイドバーのみ */}
      <SidebarNav
        activeModule={activeModule}
        onSelectModule={(id) => handleSelectModule(id)}
        onOpenSync={() => setSyncOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
        daysLeft={daysLeft}
        activeWeakCount={activeWeakCount}
        store={store}
      />

      {/* 右側ワークスペース（md以上はサイドバー幅210px分の左余白を確保） */}
      <div className="flex min-h-screen flex-col md:pl-[210px]">
        {/* iPhone幅（md未満）：極薄48pxコンパクトヘッダー */}
        <HeaderBar
          onSelectModule={(id) => handleSelectModule(id)}
          onOpenSync={() => setSyncOpen(true)}
          onOpenHelp={() => setHelpOpen(true)}
          daysLeft={daysLeft}
          store={store}
        />

        {/* メイン領域：モバイルは下部タブバーと重ならないよう pb-24、md以上は pb-8 */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-24 md:px-6 md:pt-6 md:pb-8">
          {activeModule === 'home' && (
            <HomeDashboard
              store={store}
              daysLeft={daysLeft}
              lastPracticeModule={lastPracticeModule}
              onNavigateModule={handleSelectModule}
            />
          )}
          {activeModule === 'lab' && <SimulatorLab store={store} />}
          {activeModule === 'sql' && <SqlDojo store={store} />}
          {activeModule === 'cbt' && <CbtTrainer store={store} />}
          {activeModule === 'review' && <ReviewQueueView store={store} />}
          {activeModule === 'roadmap' && (
            <RoadmapFlashcardsView
              store={store}
              activeSubTab={roadmapTab}
              onChangeSubTab={setRoadmapTab}
              onNavigateModule={(id) => handleSelectModule(id)}
            />
          )}
        </main>
      </div>

      {/* PWA 新バージョン更新通知バナー */}
      {pwaStatus.swState === 'update-available' && !dismissUpdateBanner && (
        <div className="fixed bottom-20 left-1/2 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-lg border border-slate-200 bg-[#1D1D1F] px-3.5 py-2.5 text-xs text-white shadow-lg md:bottom-6 md:left-auto md:right-6 md:translate-x-0">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">新しいバージョンの学習アプリがあります</span>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={applyPwaUpdate}
                className="rounded-md bg-[#007AFF] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#0066D6]"
              >
                更新する
              </button>
              <button
                type="button"
                onClick={() => setDismissUpdateBanner(true)}
                className="rounded-md border border-white/25 px-2 py-1 text-[11px] text-white/80 hover:bg-white/10"
              >
                後で
              </button>
            </div>
          </div>
        </div>
      )}

      {/* iPhone幅（md未満）：すりガラス下部タブバー */}
      <BottomNav
        activeModule={activeModule}
        onSelectModule={(id) => handleSelectModule(id)}
        activeWeakCount={activeWeakCount}
      />

      {/* データ同期 ＆ バックアップモーダル */}
      <SyncModal
        open={syncOpen}
        onClose={() => setSyncOpen(false)}
        store={store}
        pwaStatus={pwaStatus}
      />

      {/* 使い方・運用マニュアルモーダル */}
      <HelpModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        onOpenSync={() => setSyncOpen(true)}
      />
    </div>
  );
};

export default App;
