// CBT特化②：本文中の「主キー・多重度シグナル」をタップして見つけ出す「本文シグナル発掘ドリル」
import React, { useState, useEffect } from 'react';
import type { CbtPastExam } from '../../types/exam';
import type { StudyStore } from '../../state/useStudyStore';

interface Props {
  exam: CbtPastExam;
  store: StudyStore;
}

export const SignalDrill: React.FC<Props> = ({ exam, store }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setSelectedIds([]);
    setChecked(false);
  }, [exam.id]);

  const segments = exam.signalDrill.segments;
  const trueSignals = segments.filter((s) => s.isSignal);

  const toggleSegment = (id: string) => {
    if (checked) return;
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleGrade = () => {
    setChecked(true);
    const hits = trueSignals.filter((s) => selectedIds.includes(s.id)).length;
    const falsePositives = selectedIds.filter(
      (id) => !segments.find((s) => s.id === id)?.isSignal
    ).length;
    const isPerfect = hits === trueSignals.length && falsePositives === 0;

    if (isPerfect) {
      store.incrementAttempts();
    } else {
      store.recordReviewMiss({
        id: `review-signal-${exam.id}`,
        kind: 'signal',
        year: exam.year,
        title: `${exam.year} 本文シグナル発掘（${exam.title.slice(0, 14)}…）`,
        prompt: exam.signalDrill.instruction,
        payload: {
          signalSegments: segments,
          explanation: trueSignals
            .map((s) => `【${s.signalKind}】「${s.text}」→ ${s.explanation}`)
            .join('\n'),
        },
      });
    }
  };

  const hitCount = trueSignals.filter((s) => selectedIds.includes(s.id)).length;
  const wrongCount = selectedIds.filter(
    (id) => !segments.find((s) => s.id === id)?.isSignal
  ).length;
  const perfect = checked && hitCount === trueSignals.length && wrongCount === 0;

  return (
    <div className="rounded-lg border border-[#e4e4e0] bg-white p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f1f1ee] pb-3">
        <div>
          <div className="text-xs font-bold text-[#18181b]">本文シグナル発掘ドリル</div>
          <p className="mt-0.5 text-xs text-[#52525b]">{exam.signalDrill.instruction}</p>
        </div>
        <span className="font-mono text-xs text-[#71717a]">
          対象：{trueSignals.length}箇所 ／ 選択中：{selectedIds.length}箇所
        </span>
      </div>

      {/* タップ可能な本文エリア */}
      <div className="rounded-md border border-[#e4e4e0] bg-[#f6f6f4] p-4 leading-8 text-sm">
        {segments.map((seg) => {
          const picked = selectedIds.includes(seg.id);
          let style = 'text-[#18181b] hover:bg-[#e4e4e0] border-transparent';

          if (!checked && picked) {
            style = 'bg-[#eff6ff] text-[#1d4ed8] border-[#1d4ed8] font-bold';
          } else if (checked) {
            if (seg.isSignal && picked) {
              style = 'bg-[#f0fdf4] text-[#15803d] border-[#15803d] font-bold';
            } else if (seg.isSignal && !picked) {
              style = 'bg-[#fffbeb] text-[#b45309] border-[#b45309] font-bold';
            } else if (!seg.isSignal && picked) {
              style = 'bg-[#fff1f2] text-[#be123c] border-[#be123c] line-through';
            }
          }

          return (
            <button
              key={seg.id}
              type="button"
              onClick={() => toggleSegment(seg.id)}
              className={`mr-1 mb-1 inline rounded border px-1.5 py-0.5 text-left transition ${style}`}
            >
              {seg.text}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleGrade}
          disabled={checked}
          className="rounded-md bg-[#18181b] px-4 py-2 text-xs font-semibold text-white hover:bg-[#27272a] disabled:opacity-50"
        >
          発掘結果を採点する
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedIds([]);
            setChecked(false);
          }}
          className="rounded-md border border-[#d4d4d0] bg-white px-3.5 py-2 text-xs font-semibold text-[#52525b] hover:bg-[#f1f1ee]"
        >
          やり直す
        </button>
      </div>

      {checked && (
        <div className="space-y-2.5">
          <div
            className={`rounded-md border px-3 py-2 text-xs font-semibold ${
              perfect
                ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]'
                : 'border-[#fecdd3] bg-[#fff1f2] text-[#9f1239]'
            }`}
          >
            {perfect
              ? `全${trueSignals.length}箇所の決定打シグナルを完全発掘しました。`
              : `的中 ${hitCount}/${trueSignals.length}箇所・誤タップ ${wrongCount}箇所 — 弱点復習キューへ自動追加しました`}
          </div>

          <div className="space-y-2">
            {trueSignals.map((sig) => {
              const found = selectedIds.includes(sig.id);
              return (
                <div
                  key={sig.id}
                  className="rounded-md border border-[#e4e4e0] bg-[#f6f6f4] p-3 text-xs space-y-1"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 font-semibold ${
                        found
                          ? 'bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0]'
                          : 'bg-[#fffbeb] text-[#b45309] border border-[#fde68a]'
                      }`}
                    >
                      {found ? '発掘済' : '見逃し'}
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-[#1d4ed8]">
                      [{sig.signalKind}]
                    </span>
                    <span className="font-bold text-[#18181b]">「{sig.text}」</span>
                  </div>
                  <p className="text-[#3f3f46] leading-relaxed">{sig.explanation}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
