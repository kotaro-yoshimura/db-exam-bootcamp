// 画面下部固定ナビゲーションバー（絵文字なし・フラットな設計ツール風タブ）
// メインコンテナ側で必ず pb-36 を確保して重なりを100%防止する
import React from 'react';
import type { ModuleId } from '../../types/exam';

interface Props {
  activeModule: ModuleId;
  onSelectModule: (id: ModuleId) => void;
  activeWeakCount: number;
}

const NAV_ITEMS: Array<{ id: ModuleId; code: string; label: string }> = [
  { id: 'home', code: 'TOP', label: 'ホーム' },
  { id: 'lab', code: '01', label: '図解ラボ' },
  { id: 'sql', code: '02', label: 'SQL道場' },
  { id: 'cbt', code: '03', label: 'CBT演習' },
  { id: 'review', code: '04', label: '弱点復習' },
  { id: 'roadmap', code: '05', label: '行程200' },
];

export const BottomNav: React.FC<Props> = ({
  activeModule,
  onSelectModule,
  activeWeakCount,
}) => {
  return (
    <nav
      aria-label="メインナビゲーション"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#e4e4e0] bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
    >
      <div className="mx-auto grid max-w-4xl grid-cols-6 gap-1 px-2 py-1.5">
        {NAV_ITEMS.map((item) => {
          const active = activeModule === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectModule(item.id)}
              className={`relative flex flex-col items-center justify-center rounded-md py-1.5 px-1 transition ${
                active
                  ? 'bg-[#18181b] text-white'
                  : 'text-[#52525b] hover:bg-[#f1f1ee] hover:text-[#18181b]'
              }`}
            >
              <span
                className={`font-mono text-[10px] leading-none ${
                  active ? 'text-[#a1a1aa]' : 'text-[#a1a1aa]'
                }`}
              >
                {item.code}
              </span>
              <span className="mt-1 text-[11px] font-semibold leading-tight truncate max-w-full">
                {item.label}
              </span>
              {item.id === 'review' && activeWeakCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#be123c] px-1 font-mono text-[9px] font-bold text-white">
                  {activeWeakCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
