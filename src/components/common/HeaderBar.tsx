// iPhone幅（md未満）専用の極薄コンパクトヘッダー（高さ48px）
// 左：アプリ名＋残り日数バッジ ／ 右端：「同期」と「?」の小さなボタンのみ
import React from 'react';
import type { ModuleId } from '../../types/exam';
import type { StudyStore } from '../../state/useStudyStore';
import { HelpIcon, SyncIcon } from './NavIcons';

interface Props {
  onSelectModule: (id: ModuleId) => void;
  onOpenSync: () => void;
  onOpenHelp: () => void;
  daysLeft: number;
  store: StudyStore;
}

export const HeaderBar: React.FC<Props> = ({
  onSelectModule,
  onOpenSync,
  onOpenHelp,
  daysLeft,
  store,
}) => {
  const { cloudSync } = store;

  const syncDotClass = !cloudSync.configured
    ? null
    : cloudSync.phase === 'syncing'
      ? 'bg-[#007AFF] animate-pulse'
      : cloudSync.phase === 'error'
        ? 'bg-red-500'
        : cloudSync.phase === 'offline' || cloudSync.pendingLocalChanges
          ? 'bg-amber-500'
          : 'bg-emerald-500';

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:hidden">
      <div className="flex h-12 items-center justify-between gap-2 px-3.5">
        {/* 左：アプリ名と残り日数バッジ */}
        <button
          type="button"
          onClick={() => onSelectModule('home')}
          className="flex min-w-0 items-center gap-2 text-left"
        >
          <span className="truncate text-[15px] font-bold tracking-tight text-[#1D1D1F]">
            DB学習ノート
          </span>
          <span className="shrink-0 rounded-md border border-slate-200 bg-[#F5F5F7] px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-[#6E6E73]">
            残り{daysLeft}日
          </span>
        </button>

        {/* 右端：「同期」と「?」の小さなボタンのみ */}
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenSync}
            title={cloudSync.message}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-medium text-[#1D1D1F] active:bg-slate-100"
          >
            {syncDotClass ? (
              <span className={`h-1.5 w-1.5 rounded-full ${syncDotClass}`} />
            ) : (
              <SyncIcon className="h-3.5 w-3.5 text-[#6E6E73]" />
            )}
            <span>同期</span>
          </button>

          <button
            type="button"
            onClick={onOpenHelp}
            aria-label="使い方・運用マニュアル"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#6E6E73] active:bg-slate-100"
          >
            <HelpIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
