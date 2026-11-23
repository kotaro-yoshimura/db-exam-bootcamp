// モジュール1：3大HTML5 Canvasシミュレーター統合ラボ（Apple HIG 準拠）
import React, { useState } from 'react';
import type { StudyStore } from '../../state/useStudyStore';
import { NormalizationErSim } from './NormalizationErSim';
import { SqlTxSim } from './SqlTxSim';
import { PhysicalDesignSim } from './PhysicalDesignSim';

interface Props {
  store: StudyStore;
}

type LabId = 'sim1' | 'sim2' | 'sim3';

const LAB_TABS: Array<{
  id: LabId;
  shortTitle: string;
  title: string;
  desc: string;
}> = [
  {
    id: 'sim1',
    shortTitle: '正規化・E-R図',
    title: '正規化・FD分解 ＆ E-R図5大パターン',
    desc: 'UNF→BCNF分解・下線タップ採点・冗長属性 [ ] 連動スキーマ',
  },
  {
    id: 'sim2',
    shortTitle: 'SQL・排他/分散TX',
    title: 'ウィンドウ関数・再帰SQL・排他/分散TX',
    desc: 'ROWS/RANGE可視化・BOM再帰展開・待ちグラフ・2PC vs 補償TX',
  },
  {
    id: 'sim3',
    shortTitle: '物理I/O・回復・容量',
    title: 'クラスタ索引I/O・障害回復・4096B容量',
    desc: '高/低クラスタ分岐点・チェックポイント回復・PCTFREE計算',
  },
];

export const SimulatorLab: React.FC<Props> = ({ store }) => {
  const [activeLab, setActiveLab] = useState<LabId>('sim1');
  const currentMeta = LAB_TABS.find((t) => t.id === activeLab) || LAB_TABS[0];

  return (
    <section className="space-y-4">
      <div className="border-b border-slate-200 pb-3">
        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#1D1D1F]">
          図解ラボ
        </h2>
        <p className="mt-0.5 text-xs text-[#6E6E73]">{currentMeta.desc}</p>
      </div>

      {/* 3大シミュレーター切替（iOS風セグメントバー） */}
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-[#E5E5EA]/90 p-1">
        {LAB_TABS.map((tab) => {
          const isActive = activeLab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveLab(tab.id)}
              className={`rounded-md px-2 py-2 text-center text-xs font-semibold transition ${
                isActive
                  ? 'bg-white text-[#1D1D1F] shadow-xs'
                  : 'text-[#6E6E73] hover:text-[#1D1D1F]'
              }`}
            >
              <span className="md:hidden">{tab.shortTitle}</span>
              <span className="hidden md:inline">{tab.title}</span>
            </button>
          );
        })}
      </div>

      {activeLab === 'sim1' && <NormalizationErSim store={store} />}
      {activeLab === 'sim2' && <SqlTxSim />}
      {activeLab === 'sim3' && <PhysicalDesignSim store={store} />}
    </section>
  );
};
