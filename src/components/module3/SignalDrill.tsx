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
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <div className="text-xs font-bold text-[#1D1D1F]">本文シグナル発掘ドリル</div>
          <p className="mt-0.5 text-xs text-[#6E6E73]">{exam.signalDrill.instruction}</p>
        </div>
        <span className="font-mono text-xs tabular-nums text-[#6E6E73]">
          対象：{trueSignals.length}箇所 ／ 選択中：{selectedIds.length}箇所
        </span>
      </div>

      {/* タップ可能な本文エリア */}
      <div className="rounded-lg border border-slate-200 bg-[#F5F5F7] p-4 leading-8 text-sm">
        {segments.map((seg) => {
          const picked = selectedIds.includes(seg.id);
          let style = 'text-[#1D1D1F] hover:bg-slate-200/70 border-transparent';

          if (!checked && picked) {
            style = 'bg-sky-50 text-[#007AFF] border-[#007AFF] font-bold';
          } else if (checked) {
            if (seg.isSignal && picked) {
              style = 'bg-emerald-50 text-emerald-700 border-emerald-600 font-bold';
            } else if (seg.isSignal && !picked) {
              style = 'bg-amber-50 text-amber-800 border-amber-500 font-bold';
            } else if (!seg.isSignal && picked) {
              style = 'bg-red-50 text-red-700 border-red-500 line-through';
            }
          }

          return (
            <button
              key={seg.id}
              type="button"
              onClick={() => toggleSegment(seg.id)}
              className={`mr-1 mb-1 inline rounded-md border px-1.5 py-0.5 text-left transition ${style}`}
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
          className="rounded-lg bg-[#007AFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0066D6] disabled:opacity-50 transition"
        >
          発掘結果を採点する
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedIds([]);
            setChecked(false);
          }}
          className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
        >
          やり直す
        </button>
      </div>

      {checked && (
        <div className="space-y-2.5">
          <div
            className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
              perfect
                ? 'border-sky-200 bg-sky-50 text-[#007AFF]'
                : 'border-red-200 bg-red-50 text-red-700'
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
                  className="rounded-lg border border-slate-200 bg-[#F5F5F7] p-3 text-xs space-y-1"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${
                        found
                          ? 'border-sky-200 bg-sky-50 text-[#007AFF]'
                          : 'border-amber-200 bg-amber-50 text-amber-800'
                      }`}
                    >
                      {found ? '発掘済' : '見逃し'}
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-[#6E6E73]">
                      [{sig.signalKind}]
                    </span>
                    <span className="font-bold text-[#1D1D1F]">「{sig.text}」</span>
                  </div>
                  <p className="text-[#1D1D1F]/85 leading-relaxed">{sig.explanation}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
