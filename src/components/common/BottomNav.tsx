// iPhone幅（md未満）専用のiOS標準アプリ風すりガラス下部タブバー
import React from 'react';
import type { ModuleId } from '../../types/exam';
import { ModuleNavIcon } from './NavIcons';

interface Props {
  activeModule: ModuleId;
  onSelectModule: (id: ModuleId) => void;
  activeWeakCount: number;
}

const TAB_ITEMS: Array<{ id: ModuleId; label: string }> = [
  { id: 'home', label: 'ホーム' },
  { id: 'lab', label: '図解' },
  { id: 'sql', label: 'SQL' },
  { id: 'cbt', label: 'CBT' },
  { id: 'review', label: '弱点' },
  { id: 'roadmap', label: '行程' },
  { id: 'cards', label: '200語' },
];

export const BottomNav: React.FC<Props> = ({
  activeModule,
  onSelectModule,
  activeWeakCount,
}) => {
  return (
    <nav
      aria-label="メインタブバー"
      className="fixed bottom-0 inset-x-0 z-40 border-t border-black/[0.08] bg-[#F9F9FB]/90 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:hidden"
    >
      <div className="grid grid-cols-7 px-0.5 pt-1.5 pb-1">
        {TAB_ITEMS.map((item) => {
          const active = activeModule === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectModule(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-1 transition active:opacity-60 ${
                active ? 'text-[#007AFF]' : 'text-[#8E8E93]'
              }`}
            >
              <ModuleNavIcon id={item.id} className="h-[20px] w-[20px] shrink-0" />
              <span className="whitespace-nowrap text-[10px] font-medium leading-tight tracking-tight">
                {item.label}
              </span>
              {item.id === 'review' && activeWeakCount > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#FF3B30] px-1 font-mono text-[9px] font-bold tabular-nums text-white">
                  {activeWeakCount > 99 ? '99+' : activeWeakCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
