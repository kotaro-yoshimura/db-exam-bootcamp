// iPhone幅（md未満）専用の極薄コンパクトヘッダー（高さ48px・iOSネイティブUINavigationBar調）
// 枠付きボタンを排し、ボーダーレスなテキスト＆アイコンアクションで構成
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
    <header className="sticky top-0 z-30 border-b border-black/[0.08] bg-[#F2F2F7]/90 backdrop-blur-md pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:hidden">
      <div className="flex h-12 items-center justify-between gap-2 px-4">
        {/* 左：アプリ名と控えめな残り日数テキスト（枠なし） */}
        <button
          type="button"
          onClick={() => onSelectModule('home')}
          className="flex min-w-0 items-baseline gap-2 text-left active:opacity-60"
        >
          <span className="truncate text-[16px] font-bold tracking-tight text-[#1D1D1F]">
            DB学習ノート
          </span>
          <span className="shrink-0 font-mono text-[11px] font-medium tabular-nums text-[#6E6E73]">
            あと{daysLeft}日
          </span>
        </button>

        {/* 右端：iOS標準ナビバー風の枠なしシステムブルー操作ボタン */}
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenSync}
            title={cloudSync.message}
            className="inline-flex h-9 items-center gap-1 text-[13px] font-medium text-[#007AFF] active:opacity-50"
          >
            {syncDotClass ? (
              <span className={`h-1.5 w-1.5 rounded-full ${syncDotClass}`} />
            ) : (
              <SyncIcon className="h-[15px] w-[15px]" />
            )}
            <span>同期</span>
          </button>

          <button
            type="button"
            onClick={onOpenHelp}
            aria-label="使い方・運用マニュアル"
            className="inline-flex h-9 w-7 items-center justify-center text-[#007AFF] active:opacity-50"
          >
            <HelpIcon className="h-[19px] w-[19px]" />
          </button>
        </div>
      </div>
    </header>
  );
};
