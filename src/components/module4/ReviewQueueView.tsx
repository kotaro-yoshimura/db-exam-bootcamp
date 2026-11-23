// モジュール4：弱点復習キュー（間違えたスキーマ下線・記述・シグナル・物理問題を2回連続満点で卒業）
import React, { useState } from 'react';
import type { KeyRole, ReviewQueueItem } from '../../types/exam';
import type { StudyStore } from '../../state/useStudyStore';
import { CBT_PAST_EXAMS } from '../../data/pastExams';
import { NORMALIZATION_CASES } from '../../data/erPatterns';
import { SchemaLineDisplay } from '../module1/NormalizationErSim';

interface Props {
  store: StudyStore;
}

const KEY_ROLE_CYCLE: KeyRole[] = ['none', 'pk', 'fk', 'pkfk'];
const KEY_ROLE_LABEL: Record<KeyRole, string> = {
  none: '通常',
  pk: '主キー(実線)',
  fk: '外部キー(破線)',
  pkfk: '主兼外(二重線)',
};
const KEY_ROLE_CLASS: Record<KeyRole, string> = {
  none: 'key-none text-[#1D1D1F]',
  pk: 'key-pk text-[#007AFF] font-bold',
  fk: 'key-fk text-[#15803d] font-semibold',
  pkfk: 'key-pkfk text-[#b45309] font-bold',
};

const KIND_LABEL: Record<ReviewQueueItem['kind'], string> = {
  schema: 'スキーマ下線',
  essay: 'CBT記述',
  signal: 'シグナル発掘',
  physical: '物理・回復',
};

export const ReviewQueueView: React.FC<Props> = ({ store }) => {
  const [filter, setFilter] = useState<'active' | 'graduated'>('active');
  const [drillingId, setDrillingId] = useState<string | null>(null);

  const [schemaRoles, setSchemaRoles] = useState<KeyRole[]>([]);
  const [selectedSignals, setSelectedSignals] = useState<string[]>([]);
  const [essayInput, setEssayInput] = useState('');
  const [essayReveal, setEssayReveal] = useState(false);
  const [physInput, setPhysInput] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const activeItems = store.state.reviewQueue.filter((q) => !q.graduated);
  const graduatedItems = store.state.reviewQueue.filter((q) => q.graduated);
  const displayItems = filter === 'active' ? activeItems : graduatedItems;
  const activeDrill = store.state.reviewQueue.find((q) => q.id === drillingId) || null;

  const startDrill = (item: ReviewQueueItem) => {
    setDrillingId(item.id);
    setFeedback(null);
    setEssayReveal(false);
    setEssayInput('');
    setPhysInput('');
    setSelectedSignals([]);
    if (item.payload.schema) {
      setSchemaRoles(item.payload.schema.attributes.map(() => 'none'));
    }
  };

  const seedTypicalWeakPoints = () => {
    const h31Case = NORMALIZATION_CASES[2];
    const r7Exam = CBT_PAST_EXAMS[0];
    store.recordReviewMiss({
      id: `review-schema-${h31Case.id}`,
      kind: 'schema',
      year: h31Case.year,
      title: `${h31Case.year} 部品消費実績（複合外部キー破線漏れ注意）`,
      prompt: '親「工程作業(製造指図番号, 工程順)」を参照する「部品消費実績」の下線を正確に指定せよ。',
      payload: {
        schema: h31Case.quizSchema,
        explanation: h31Case.quizSchema.explanation,
      },
    });
    store.recordReviewMiss({
      id: `review-signal-${r7Exam.id}`,
      kind: 'signal',
      year: r7Exam.year,
      title: `${r7Exam.year} 本文シグナル発掘（排他サブタイプ＆高々1つ）`,
      prompt: r7Exam.signalDrill.instruction,
      payload: {
        signalSegments: r7Exam.signalDrill.segments,
        explanation: '「いずれか一方」「一意に識別」「重複指定することはない」「高々1つ」の4箇所が決定打。',
      },
    });
    store.recordReviewMiss({
      id: `review-essay-${r7Exam.essayQuestions[0].id}`,
      kind: 'essay',
      year: r7Exam.year,
      title: `${r7Exam.year} 設問1(1) サブタイプ冗長属性の理由（45字）`,
      prompt: r7Exam.essayQuestions[0].prompt,
      payload: {
        officialAnswer: r7Exam.essayQuestions[0].officialAnswer,
        gradingPoints: r7Exam.essayQuestions[0].gradingPoints,
        maxChars: r7Exam.essayQuestions[0].maxChars,
        explanation: r7Exam.essayQuestions[0].hint,
      },
    });
  };

  const gradeActiveDrill = () => {
    if (!activeDrill) return;

    if (activeDrill.kind === 'schema' && activeDrill.payload.schema) {
      const attrs = activeDrill.payload.schema.attributes;
      const perfect = attrs.every((a, i) => schemaRoles[i] === a.role);
      if (perfect) {
        const res = store.recordReviewPerfect(activeDrill.id);
        setFeedback({
          ok: true,
          msg: res.graduatedNow
            ? '2回連続満点を達成し、この項目を卒業しました。'
            : `満点正解（連続満点 ${res.count}/2 — あと1回連続満点で卒業）`,
        });
      } else {
        store.recordReviewMiss({
          id: activeDrill.id,
          kind: activeDrill.kind,
          year: activeDrill.year,
          title: activeDrill.title,
          prompt: activeDrill.prompt,
          payload: activeDrill.payload,
        });
        setFeedback({
          ok: false,
          msg: '一部誤りあり（連続満点カウントを 0/2 にリセットしました）。下の正解スキーマを確認してください。',
        });
      }
      return;
    }

    if (activeDrill.kind === 'signal' && activeDrill.payload.signalSegments) {
      const segs = activeDrill.payload.signalSegments;
      const trueSigs = segs.filter((s) => s.isSignal);
      const hits = trueSigs.filter((s) => selectedSignals.includes(s.id)).length;
      const wrong = selectedSignals.filter((id) => !segs.find((s) => s.id === id)?.isSignal).length;
      const perfect = hits === trueSigs.length && wrong === 0;
      if (perfect) {
        const res = store.recordReviewPerfect(activeDrill.id);
        setFeedback({
          ok: true,
          msg: res.graduatedNow
            ? '2回連続満点を達成し、シグナル発掘項目を卒業しました。'
            : `全${trueSigs.length}箇所を完全発掘（連続満点 ${res.count}/2）`,
        });
      } else {
        store.recordReviewMiss({
          id: activeDrill.id,
          kind: activeDrill.kind,
          year: activeDrill.year,
          title: activeDrill.title,
          prompt: activeDrill.prompt,
          payload: activeDrill.payload,
        });
        setFeedback({
          ok: false,
          msg: `的中 ${hits}/${trueSigs.length}・誤タップ ${wrong}（連続満点を 0/2 にリセット）`,
        });
      }
      return;
    }

    if (activeDrill.kind === 'physical') {
      const expected = (activeDrill.payload.physicalExpected || '').replace(/\s+/g, '').toUpperCase();
      const actual = physInput.replace(/\s+/g, '').toUpperCase();
      if (actual === expected) {
        const res = store.recordReviewPerfect(activeDrill.id, physInput);
        setFeedback({
          ok: true,
          msg: res.graduatedNow
            ? '2回連続満点を達成し、物理・回復項目を卒業しました。'
            : `正解（連続満点 ${res.count}/2）`,
        });
      } else {
        store.recordReviewMiss({
          id: activeDrill.id,
          kind: activeDrill.kind,
          year: activeDrill.year,
          title: activeDrill.title,
          prompt: activeDrill.prompt,
          payload: activeDrill.payload,
        });
        setFeedback({
          ok: false,
          msg: `不正解（正解: ${expected}）。連続満点を 0/2 にリセットしました。`,
        });
      }
    }
  };

  return (
    <section className="space-y-4">
      <div className="pb-1">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <h2 className="text-[20px] font-bold tracking-tight text-[#1D1D1F]">弱点復習キュー</h2>
          <span className="font-mono text-xs font-medium tabular-nums text-[#8E8E93]">
            未卒業 {activeItems.length}件 · 卒業済 {graduatedItems.length}件
          </span>
        </div>
        <p className="mt-0.5 text-xs text-[#6E6E73]">
          同じ問題を2回連続で満点にすると卒業します。途中で1回間違えると連続回数は0に戻ります。
        </p>
      </div>

      {/* 次に復習する1問ガイド（未卒業あり＆演習未開始時） */}
      {!activeDrill && activeItems.length > 0 && (
        <div className="ios-group flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="font-semibold text-[#007AFF]">次に復習する1問</span>
              <span className="font-mono tabular-nums text-[#8E8E93]">
                {activeItems[0].year} · 連続 {activeItems[0].consecutivePerfect}/2
              </span>
            </div>
            <div className="mt-0.5 truncate text-sm font-bold text-[#1D1D1F]">
              {activeItems[0].title}
            </div>
          </div>
          <button
            type="button"
            onClick={() => startDrill(activeItems[0])}
            className="shrink-0 rounded-[8px] bg-[#007AFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0066D6] active:opacity-80 transition"
          >
            今すぐ復習を開始 →
          </button>
        </div>
      )}

      {/* フィルタ＆お試し投入 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-[8px] bg-black/[0.06] p-[2px]">
          <button
            type="button"
            onClick={() => setFilter('active')}
            className={`rounded-[6.5px] px-3.5 py-1.5 text-xs font-semibold transition ${
              filter === 'active'
                ? 'bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
                : 'text-[#6E6E73]'
            }`}
          >
            要復習 (<span className="font-mono tabular-nums">{activeItems.length}</span>)
          </button>
          <button
            type="button"
            onClick={() => setFilter('graduated')}
            className={`rounded-[6.5px] px-3.5 py-1.5 text-xs font-semibold transition ${
              filter === 'graduated'
                ? 'bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
                : 'text-[#6E6E73]'
            }`}
          >
            卒業済 (<span className="font-mono tabular-nums">{graduatedItems.length}</span>)
          </button>
        </div>

        <button
          type="button"
          onClick={seedTypicalWeakPoints}
          className="text-xs font-medium text-[#007AFF] active:opacity-50 hover:underline"
        >
          + 典型ひっかけ3問を投入
        </button>
      </div>

      {/* 反復ドリル実行パネル */}
      {activeDrill && (
        <div className="ios-group ring-2 ring-[#007AFF] p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-[#007AFF] px-2 py-0.5 text-[11px] font-semibold text-white">
                反復演習中
              </span>
              <span className="font-mono text-xs font-bold tabular-nums text-[#1D1D1F]">
                連続満点：{activeDrill.consecutivePerfect} / 2
              </span>
            </div>
            <button
              type="button"
              onClick={() => setDrillingId(null)}
              className="text-xs font-semibold text-[#6E6E73] hover:text-[#1D1D1F]"
            >
              閉じる
            </button>
          </div>

          <h3 className="text-base font-bold text-[#1D1D1F]">{activeDrill.title}</h3>
          <p className="text-sm text-[#1D1D1F]/90 leading-relaxed">{activeDrill.prompt}</p>

          {activeDrill.kind === 'schema' && activeDrill.payload.schema && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-[#F5F5F7] p-4">
                <span className="text-sm font-bold text-[#1D1D1F]">
                  {activeDrill.payload.schema.tableName} (
                </span>
                {activeDrill.payload.schema.attributes.map((attr, idx) => {
                  const chosen = schemaRoles[idx] || 'none';
                  return (
                    <button
                      key={attr.name}
                      type="button"
                      onClick={() =>
                        setSchemaRoles((prev) =>
                          prev.map((r, i) =>
                            i === idx
                              ? KEY_ROLE_CYCLE[(KEY_ROLE_CYCLE.indexOf(r) + 1) % KEY_ROLE_CYCLE.length]
                              : r
                          )
                        )
                      }
                      className={`flex flex-col items-center rounded-lg border border-b-2 px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.05)] active:scale-95 transition ${
                        chosen !== 'none'
                          ? 'border-[#007AFF]/60 bg-sky-50/40 hover:border-[#007AFF]'
                          : 'border-slate-300 bg-white hover:border-[#007AFF]'
                      }`}
                    >
                      <span className={`text-sm ${KEY_ROLE_CLASS[chosen]}`}>{attr.name}</span>
                      <span className="mt-1 text-[10px] font-medium text-[#6E6E73]">
                        {KEY_ROLE_LABEL[chosen]} ↻
                      </span>
                    </button>
                  );
                })}
                <span className="text-sm font-bold text-[#1D1D1F]">)</span>
              </div>
              <button
                type="button"
                onClick={gradeActiveDrill}
                className="rounded-lg bg-[#007AFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0066D6]"
              >
                採点する
              </button>
              {feedback && !feedback.ok && (
                <SchemaLineDisplay schema={activeDrill.payload.schema} />
              )}
            </div>
          )}

          {activeDrill.kind === 'signal' && activeDrill.payload.signalSegments && (
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-200 bg-[#F5F5F7] p-4 leading-8 text-sm">
                {activeDrill.payload.signalSegments.map((seg) => {
                  const picked = selectedSignals.includes(seg.id);
                  return (
                    <button
                      key={seg.id}
                      type="button"
                      onClick={() =>
                        setSelectedSignals((prev) =>
                          prev.includes(seg.id) ? prev.filter((x) => x !== seg.id) : [...prev, seg.id]
                        )
                      }
                      className={`mr-1.5 mb-1.5 inline rounded-md border px-2 py-0.5 text-left active:scale-95 transition ${
                        picked
                          ? 'border-solid border-[#007AFF] bg-sky-50 font-bold text-[#007AFF] shadow-xs'
                          : 'border-dashed border-slate-300 bg-white text-[#1D1D1F] shadow-[0_1px_1px_rgba(0,0,0,0.03)] hover:border-[#007AFF]'
                      }`}
                    >
                      {seg.text}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={gradeActiveDrill}
                className="rounded-lg bg-[#007AFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0066D6]"
              >
                シグナルを採点する
              </button>
            </div>
          )}

          {activeDrill.kind === 'essay' && (
            <div className="space-y-3">
              <div className="flex justify-end font-mono text-xs tabular-nums text-[#6E6E73]">
                {essayInput.length} / {activeDrill.payload.maxChars || 50} 字
              </div>
              <textarea
                value={essayInput}
                onChange={(e) => setEssayInput(e.target.value)}
                rows={3}
                placeholder="制限字数内で再解答を入力してください..."
                className="w-full rounded-lg border border-slate-200 bg-[#F5F5F7]/60 p-3 text-base md:text-sm text-[#1D1D1F] focus:border-[#007AFF] focus:bg-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setEssayReveal(true)}
                className="rounded-lg bg-[#007AFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0066D6]"
              >
                公式解答と突合する
              </button>
              {essayReveal && (
                <div className="rounded-lg border border-slate-200 bg-[#F5F5F7] p-3.5 space-y-2.5 text-xs">
                  <div>
                    <span className="font-bold text-[#007AFF]">公式解答例：</span>
                    <span className="text-[#1D1D1F]">{activeDrill.payload.officialAnswer}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const res = store.recordReviewPerfect(activeDrill.id, essayInput);
                        setFeedback({
                          ok: true,
                          msg: res.graduatedNow
                            ? '2回連続満点を達成し、記述項目を卒業しました。'
                            : `満点記録（連続 ${res.count}/2 — あと1回で卒業）`,
                        });
                      }}
                      className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-[#007AFF]"
                    >
                      満点レベル（連続+1）
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        store.recordReviewMiss({
                          id: activeDrill.id,
                          kind: activeDrill.kind,
                          year: activeDrill.year,
                          title: activeDrill.title,
                          prompt: activeDrill.prompt,
                          payload: activeDrill.payload,
                          lastUserAnswer: essayInput,
                        });
                        setFeedback({
                          ok: false,
                          msg: '要再復習（連続満点カウントを 0/2 にリセットしました）',
                        });
                      }}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700"
                    >
                      不十分（0へリセット）
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeDrill.kind === 'physical' && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={physInput}
                  onChange={(e) => setPhysInput(e.target.value)}
                  placeholder="解答を入力..."
                  className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-base md:text-sm text-[#1D1D1F] focus:border-[#007AFF] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={gradeActiveDrill}
                  className="rounded-lg bg-[#007AFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0066D6]"
                >
                  判定する
                </button>
              </div>
              {activeDrill.payload.physicalFormula && (
                <div className="text-xs text-[#6E6E73]">公式：{activeDrill.payload.physicalFormula}</div>
              )}
            </div>
          )}

          {feedback && (
            <div
              className={`rounded-lg border p-3 text-xs font-medium ${
                feedback.ok
                  ? 'border-sky-200 bg-sky-50 text-[#007AFF]'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              <div className="font-bold">{feedback.msg}</div>
              {activeDrill.payload.explanation && (
                <p className="mt-1.5 whitespace-pre-line text-[#1D1D1F]/85">
                  {activeDrill.payload.explanation}
                </p>
              )}
              {feedback.ok &&
                (() => {
                  const nextWeak = activeItems.find((x) => x.id !== activeDrill.id);
                  if (!nextWeak) return null;
                  return (
                    <div className="mt-2.5 flex justify-end">
                      <button
                        type="button"
                        onClick={() => startDrill(nextWeak)}
                        className="rounded-lg bg-[#007AFF] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0066D6] active:scale-95 transition"
                      >
                        次の弱点アイテムへ進む →
                      </button>
                    </div>
                  );
                })()}
            </div>
          )}
        </div>
      )}

      {/* キュー一覧 */}
      {displayItems.length === 0 ? (
        <div className="ios-group p-8 text-center space-y-1.5">
          <div className="text-sm font-bold text-[#1D1D1F]">
            {filter === 'active'
              ? '現在、未卒業の弱点アイテムはありません。'
              : '卒業済みの弱点アイテムはまだありません。'}
          </div>
          <p className="text-xs text-[#6E6E73]">
            図解ラボの下線クイズ・CBT記述・本文シグナル発掘で間違えた問題が自動的にここへ収集されます。
          </p>
        </div>
      ) : (
        <div className="ios-group divide-y divide-black/[0.07] overflow-hidden md:grid md:grid-cols-2 md:divide-y-0 md:gap-3 md:bg-transparent md:shadow-none">
          {displayItems.map((item) => (
            <div
              key={item.id}
              className="flex flex-col justify-between gap-3 bg-white p-4 md:rounded-[10px] md:shadow-[0_0.5px_0_rgba(0,0,0,0.04)]"
            >
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="rounded-md border border-slate-200 bg-[#F5F5F7] px-2 py-0.5 font-semibold text-[#1D1D1F]">
                      {KIND_LABEL[item.kind]}
                    </span>
                    <span className="font-mono font-semibold tabular-nums text-[#6E6E73]">
                      {item.year}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-semibold tabular-nums text-[#1D1D1F]">
                    連続 {item.consecutivePerfect}/2（誤答 {item.missCount}回）
                  </span>
                </div>

                <div className="flex items-center gap-1.5 pt-1">
                  {[1, 2].map((step) => (
                    <div
                      key={step}
                      className={`h-1.5 flex-1 rounded-full ${
                        item.consecutivePerfect >= step ? 'bg-[#007AFF]' : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>

                <h4 className="pt-1 text-sm font-bold text-[#1D1D1F]">{item.title}</h4>
                <p className="line-clamp-2 text-xs text-[#6E6E73]">{item.prompt}</p>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
                <span className="font-mono text-[10px] tabular-nums text-[#6E6E73]">
                  更新：{new Date(item.updatedAt).toLocaleDateString('ja-JP')}
                </span>
                {item.graduated ? (
                  <button
                    type="button"
                    onClick={() => store.requeueReviewItem(item.id)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
                  >
                    再復習に戻す
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => startDrill(item)}
                    className="rounded-lg bg-[#007AFF] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0066D6]"
                  >
                    復習を開始 →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
