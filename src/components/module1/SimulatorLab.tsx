// モジュール1：3大HTML5 Canvasシミュレーター統合ラボ（技術ツール調UI）
import React, { useState } from 'react';
import type { StudyStore } from '../../state/useStudyStore';
import { NormalizationErSim } from './NormalizationErSim';
import { SqlTxSim } from './SqlTxSim';
import { PhysicalDesignSim } from './PhysicalDesignSim';

interface Props {
  store: StudyStore;
}

type LabId = 'sim1' | 'sim2' | 'sim3';

const LAB_CARDS: Array<{
  id: LabId;
  num: string;
  title: string;
  desc: string;
}> = [
  {
    id: 'sim1',
    num: '01',
    title: '正規化・FD分解 ＆ E-R図5大パターン',
    desc: 'UNF→BCNF分解・実線/破線/二重線タップ採点・冗長属性 [ ] 連動スキーマ',
  },
  {
    id: 'sim2',
    num: '02',
    title: 'ウィンドウ関数・再帰SQL・排他/分散TX',
    desc: 'ROWS/RANGE可視化・BOM再帰展開・待ちグラフ循環・2PC vs 補償TX',
  },
  {
    id: 'sim3',
    num: '03',
    title: 'クラスタ索引I/O・障害回復・4096B容量',
    desc: '高/低クラスタ分岐点・チェックポイントとワークテーブル・PCTFREE計算',
  },
];

export const SimulatorLab: React.FC<Props> = ({ store }) => {
  const [activeLab, setActiveLab] = useState<LabId>('sim1');

  return (
    <section className="space-y-5">
      <div className="border-b border-[#e4e4e0] pb-3">
        <div className="font-mono text-[11px] uppercase tracking-wider text-[#71717a]">
          01 / SIMULATOR LAB
        </div>
        <h2 className="mt-0.5 text-xl font-bold tracking-tight text-[#18181b]">
          図解シミュレーター
        </h2>
      </div>

      {/* 3大シミュレーター切替（罫線グリッド） */}
      <div className="grid grid-cols-1 divide-y md:grid-cols-3 md:divide-y-0 md:divide-x divide-[#e4e4e0] overflow-hidden rounded-lg border border-[#e4e4e0] bg-white">
        {LAB_CARDS.map((card) => {
          const isActive = activeLab === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setActiveLab(card.id)}
              className={`p-3.5 text-left transition ${
                isActive ? 'bg-[#18181b] text-white' : 'bg-white text-[#18181b] hover:bg-[#f6f6f4]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`font-mono text-[11px] font-semibold ${
                    isActive ? 'text-[#a1a1aa]' : 'text-[#71717a]'
                  }`}
                >
                  SIM {card.num}
                </span>
                {isActive && (
                  <span className="font-mono text-[10px] text-[#e4e4e7]">表示中</span>
                )}
              </div>
              <div className="mt-1 text-sm font-bold">{card.title}</div>
              <p
                className={`mt-1 text-xs leading-relaxed ${
                  isActive ? 'text-[#d4d4d8]' : 'text-[#52525b]'
                }`}
              >
                {card.desc}
              </p>
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
