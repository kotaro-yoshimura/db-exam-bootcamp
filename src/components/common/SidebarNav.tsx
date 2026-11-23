// iPad / Mac幅（md以上）専用の固定左サイドバー（幅210px、iPadOSネイティブアプリ風）
import React from 'react';
import type { ModuleId } from '../../types/exam';
import type { StudyStore } from '../../state/useStudyStore';
import { ModuleNavIcon, SyncIcon, HelpIcon } from './NavIcons';

interface Props {
  activeModule: ModuleId;
  onSelectModule: (id: ModuleId) => void;
  onOpenSync: () => void;
  onOpenHelp: () => void;
  daysLeft: number;
  activeWeakCount: number;
  store: StudyStore;
}

const SIDEBAR_ITEMS: Array<{ id: ModuleId; label: string }> = [
  { id: 'home', label: 'ホーム' },
  { id: 'lab', label: '図解ラボ' },
  { id: 'sql', label: 'SQL道場' },
  { id: 'cbt', label: 'CBT演習' },
  { id: 'review', label: '弱点復習' },
  { id: 'roadmap', label: '行程カレンダー' },
  { id: 'cards', label: '重要語句200' },
];

export const SidebarNav: React.FC<Props> = ({
  activeModule,
  onSelectModule,
  onOpenSync,
  onOpenHelp,
  daysLeft,
  activeWeakCount,
  store,
}) => {
  const { cloudSync } = store;

  const syncDotClass = !cloudSync.configured
    ? 'bg-slate-300'
    : cloudSync.phase === 'syncing'
      ? 'bg-[#007AFF] animate-pulse'
      : cloudSync.phase === 'error'
        ? 'bg-red-500'
        : cloudSync.phase === 'offline' || cloudSync.pendingLocalChanges
          ? 'bg-amber-500'
          : 'bg-emerald-500';

  const syncStatusLabel = !cloudSync.configured
    ? 'データ同期'
    : cloudSync.phase === 'syncing'
      ? '同期中...'
      : cloudSync.phase === 'error'
        ? '同期エラー'
        : cloudSync.phase === 'offline'
          ? 'オフライン'
          : cloudSync.pendingLocalChanges
            ? '同期待機中'
            : '自動同期済';

  return (
    <aside
      aria-label="サイドバーナビゲーション"
      className="fixed inset-y-0 left-0 z-30 hidden w-[210px] flex-col border-r border-slate-200 bg-[#F2F2F7] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] md:flex"
    >
      {/* アプリタイトル ＆ 残り日数バッジ */}
      <div className="px-4 pt-5 pb-4">
        <button
          type="button"
          onClick={() => onSelectModule('home')}
          className="group block w-full text-left"
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#007AFF] font-mono text-[11px] font-bold text-white">
              DB
            </span>
            <span className="truncate text-[14px] font-bold tracking-tight text-[#1D1D1F] group-hover:text-[#007AFF] transition">
              DB学習ノート
            </span>
          </div>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-slate-200/90 bg-white px-2 py-0.5 text-[11px] text-[#6E6E73]">
            <span>本番まで</span>
            <span className="font-mono tabular-nums font-semibold text-[#1D1D1F]">
              残り{daysLeft}日
            </span>
          </div>
        </button>
      </div>

      {/* メイン6メニュー */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5">
        {SIDEBAR_ITEMS.map((item) => {
          const active = activeModule === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectModule(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex w-full items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition ${
                active
                  ? 'bg-[#007AFF] font-semibold text-white'
                  : 'font-medium text-[#1D1D1F] hover:bg-black/[0.04]'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <ModuleNavIcon
                  id={item.id}
                  className={`h-[18px] w-[18px] shrink-0 ${
                    active ? 'text-white' : 'text-[#6E6E73]'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </span>
              {item.id === 'review' && activeWeakCount > 0 && (
                <span
                  className={`shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'bg-white text-[#1D1D1F] border border-slate-200'
                  }`}
                >
                  {activeWeakCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* 下部ユーティリティ集約（データ同期・使い方） */}
      <div className="space-y-1 border-t border-slate-200/90 p-2.5">
        <button
          type="button"
          onClick={onOpenSync}
          title={cloudSync.message}
          className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-[12px] font-medium text-[#1D1D1F] hover:bg-black/[0.04] transition"
        >
          <span className="flex min-w-0 items-center gap-2">
            <SyncIcon className="h-4 w-4 shrink-0 text-[#6E6E73]" />
            <span className="truncate">{syncStatusLabel}</span>
          </span>
          <span className={`h-2 w-2 shrink-0 rounded-full ${syncDotClass}`} />
        </button>

        <button
          type="button"
          onClick={onOpenHelp}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-medium text-[#6E6E73] hover:bg-black/[0.04] hover:text-[#1D1D1F] transition"
        >
          <HelpIcon className="h-4 w-4 shrink-0" />
          <span>使い方</span>
        </button>
      </div>
    </aside>
  );
};
