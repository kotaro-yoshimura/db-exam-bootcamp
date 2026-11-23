// Apple SF Symbols 風のシンプルな極細線画アイコン群
// iOS/iPadOS Safari の黒塗りバグを防ぐため、全要素に fill="none" と stroke="currentColor" を明示する
import React from 'react';
import type { ModuleId } from '../../types/exam';

interface IconProps {
  className?: string;
}

const baseProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
};

export const HomeIcon: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => (
  <svg {...baseProps} className={className}>
    <path fill="none" d="M3 10.5L12 3l9 7.5" />
    <path fill="none" d="M5.5 9.5V20a1 1 0 0 0 1 1h4v-6h3v6h4a1 1 0 0 0 1-1V9.5" />
  </svg>
);

export const LabIcon: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => (
  <svg {...baseProps} className={className}>
    <rect fill="none" x="3" y="4" width="7" height="6" rx="1.5" />
    <rect fill="none" x="14" y="4" width="7" height="6" rx="1.5" />
    <rect fill="none" x="8.5" y="14" width="7" height="6" rx="1.5" />
    <path fill="none" d="M10 7h4M6.5 10v2.5a1.5 1.5 0 0 0 1.5 1.5h1M17.5 10v2.5a1.5 1.5 0 0 1-1.5 1.5h-1" />
  </svg>
);

export const SqlIcon: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => (
  <svg {...baseProps} className={className}>
    <ellipse fill="none" cx="12" cy="6" rx="7.5" ry="2.8" />
    <path fill="none" d="M4.5 6v6c0 1.55 3.36 2.8 7.5 2.8s7.5-1.25 7.5-2.8V6" />
    <path fill="none" d="M4.5 12v6c0 1.55 3.36 2.8 7.5 2.8s7.5-1.25 7.5-2.8v-6" />
  </svg>
);

export const CbtIcon: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => (
  <svg {...baseProps} className={className}>
    <rect fill="none" x="3" y="4.5" width="18" height="15" rx="2" />
    <path fill="none" d="M12 4.5v15M6.5 9h2.5M6.5 12.5h2.5M15 9h2.5M15 12.5h2.5" />
  </svg>
);

export const ReviewIcon: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => (
  <svg {...baseProps} className={className}>
    <path fill="none" d="M4.5 12a7.5 7.5 0 1 1 2.2 5.3" />
    <path fill="none" d="M4.5 17.5v-4.2h4.2" />
    <path fill="none" d="M12 8.5v4l2.5 1.5" />
  </svg>
);

export const CardsIcon: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => (
  <svg {...baseProps} className={className}>
    <rect fill="none" x="4" y="7" width="16" height="12.5" rx="2" />
    <path fill="none" d="M7 4.5h10M8 11.5h8M8 15h5" />
  </svg>
);

export const SyncIcon: React.FC<IconProps> = ({ className = 'w-4 h-4' }) => (
  <svg {...baseProps} className={className}>
    <path fill="none" d="M20 11a8 8 0 0 0-14.2-4.8L4 8" />
    <path fill="none" d="M4 4v4h4" />
    <path fill="none" d="M4 13a8 8 0 0 0 14.2 4.8L20 16" />
    <path fill="none" d="M20 20v-4h-4" />
  </svg>
);

export const HelpIcon: React.FC<IconProps> = ({ className = 'w-4 h-4' }) => (
  <svg {...baseProps} className={className}>
    <circle fill="none" cx="12" cy="12" r="9" />
    <path fill="none" d="M9.6 9.5a2.4 2.4 0 0 1 4.6.8c0 1.5-2.2 2-2.2 3.2" />
    <circle fill="currentColor" stroke="none" cx="12" cy="16.8" r="0.9" />
  </svg>
);

export const ChevronRightIcon: React.FC<IconProps> = ({ className = 'w-4 h-4' }) => (
  <svg {...baseProps} className={className}>
    <path fill="none" d="M9 6l6 6-6 6" />
  </svg>
);

export const ChevronDownIcon: React.FC<IconProps> = ({ className = 'w-4 h-4' }) => (
  <svg {...baseProps} className={className}>
    <path fill="none" d="M6 9l6 6 6-6" />
  </svg>
);

export const ModuleNavIcon: React.FC<{ id: ModuleId; className?: string }> = ({
  id,
  className = 'w-5 h-5',
}) => {
  switch (id) {
    case 'home':
      return <HomeIcon className={className} />;
    case 'lab':
      return <LabIcon className={className} />;
    case 'sql':
      return <SqlIcon className={className} />;
    case 'cbt':
      return <CbtIcon className={className} />;
    case 'review':
      return <ReviewIcon className={className} />;
    case 'roadmap':
      return <CardsIcon className={className} />;
  }
};
