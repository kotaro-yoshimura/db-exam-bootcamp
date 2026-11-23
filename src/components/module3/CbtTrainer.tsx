// モジュール3：CBT本番スプリット画面トレーナー ＆ 3大CBT特化機能統合（白地・墨黒の試験本番調UI）
import React, { useState, useEffect } from 'react';
import { CBT_PAST_EXAMS } from '../../data/pastExams';
import type { KeyRole } from '../../types/exam';
import type { StudyStore } from '../../state/useStudyStore';
import { copyTextReliable } from '../../utils/syncCodec';
import { FreehandOverlayCanvas } from './FreehandOverlayCanvas';
import { SignalDrill } from './SignalDrill';
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
  none: 'key-none text-[#18181b]',
  pk: 'key-pk text-[#1d4ed8] font-bold',
  fk: 'key-fk text-[#15803d] font-semibold',
  pkfk: 'key-pkfk text-[#b45309] font-bold',
};

export const CbtTrainer: React.FC<Props> = ({ store }) => {
  const [examIdx, setExamIdx] = useState(0);
  const exam = CBT_PAST_EXAMS[examIdx];

  const [splitRatio, setSplitRatio] = useState<'50-50' | '60-40' | '40-60'>('50-50');
  const [rightTab, setRightTab] = useState<'essay' | 'schema' | 'signal'>('essay');

  const [remainingSec, setRemainingSec] = useState(exam.timeLimitMin * 60);
  const [timerRunning, setTimerRunning] = useState(false);

  const [schemaRoles, setSchemaRoles] = useState<KeyRole[]>(() =>
    exam.schemaQuestion.schema.attributes.map(() => 'none')
  );
  const [schemaResult, setSchemaResult] = useState<{
    checked: boolean;
    perfect: boolean;
    score: number;
    total: number;
  } | null>(null);

  const [revealedEssays, setRevealedEssays] = useState<Record<string, boolean>>({});
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [previewPrompt, setPreviewPrompt] = useState<string | null>(null);

  useEffect(() => {
    setRemainingSec(exam.timeLimitMin * 60);
    setTimerRunning(false);
    setSchemaRoles(exam.schemaQuestion.schema.attributes.map(() => 'none'));
    setSchemaResult(null);
    setRevealedEssays({});
    setPreviewPrompt(null);
  }, [exam.id, exam.timeLimitMin, exam.schemaQuestion.schema.attributes]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setRemainingSec((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(null), 3200);
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const buildGeminiReviewPrompt = (qId: string): string => {
    const q = exam.essayQuestions.find((item) => item.id === qId);
    if (!q) return '';
    const userText = (store.state.cbtDrafts[q.id] || '').trim();
    const charCount = userText.length;

    return [
      `@db-afternoon-kakomon-review`,
      ``,
      `以下のデータベーススペシャリスト午後記述問題の解答を厳密に添削し、採点（10点満点）・不足キーワード・字数制限内での改善案を提示してください。`,
      ``,
      `### 出典`,
      `- 年度・区分: ${exam.year} ${exam.section}`,
      `- テーマ: ${exam.title}`,
      `- 設問番号: ${q.label}`,
      ``,
      `### 問題背景・業務ルール要約`,
      `${exam.backgroundText}`,
      ...exam.businessRules.map((r) => `- ${r}`),
      ``,
      `### 設問（制限字数：${q.maxChars}字以内）`,
      `${q.prompt}`,
      ``,
      `### 公式解答例 ＆ 採点ポイント`,
      `- 公式解答例: ${q.officialAnswer}`,
      ...q.gradingPoints.map((p) => `- 採点ポイント: ${p}`),
      ``,
      `### 自分の解答（${charCount}字 / 上限${q.maxChars}字）`,
      userText ? userText : '（未入力：解答方針のヒントを教えてください）',
    ].join('\n');
  };

  const handleCopyGeminiPrompt = async (qId: string) => {
    const prompt = buildGeminiReviewPrompt(qId);
    const ok = await copyTextReliable(prompt);
    setPreviewPrompt(prompt);
    showToast(
      ok
        ? '@db-afternoon-kakomon-review 添削依頼プロンプトをクリップボードにコピーしました。'
        : '自動コピー不可のため、下のプレビュー欄から手動コピーしてください。'
    );
  };

  const handleEssaySelfGrade = (qId: string, passed: boolean) => {
    const q = exam.essayQuestions.find((item) => item.id === qId);
    if (!q) return;
    if (passed) {
      store.incrementAttempts();
      showToast(`${q.label} を合格レベルとして記録しました。`);
    } else {
      store.recordReviewMiss({
        id: `review-essay-${q.id}`,
        kind: 'essay',
        year: exam.year,
        title: `${exam.year} ${q.label} 記述解答（${q.maxChars}字）`,
        prompt: q.prompt,
        lastUserAnswer: store.state.cbtDrafts[q.id] || '',
        payload: {
          officialAnswer: q.officialAnswer,
          gradingPoints: q.gradingPoints,
          maxChars: q.maxChars,
          explanation: q.hint,
        },
      });
      showToast(`${q.label} を弱点復習キューへ登録しました（2回連続満点で卒業）。`);
    }
  };

  const handleToggleSchemaRole = (idx: number) => {
    setSchemaResult(null);
    setSchemaRoles((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        return KEY_ROLE_CYCLE[(KEY_ROLE_CYCLE.indexOf(r) + 1) % KEY_ROLE_CYCLE.length];
      })
    );
  };

  const handleGradeCbtSchema = () => {
    const attrs = exam.schemaQuestion.schema.attributes;
    let score = 0;
    attrs.forEach((a, i) => {
      if (schemaRoles[i] === a.role) score++;
    });
    const perfect = score === attrs.length;
    setSchemaResult({ checked: true, perfect, score, total: attrs.length });
    if (perfect) {
      store.markSchemaQuizSolved(exam.schemaQuestion.id);
    } else {
      store.recordReviewMiss({
        id: `review-schema-${exam.schemaQuestion.id}`,
        kind: 'schema',
        year: exam.year,
        title: `${exam.year} ${exam.schemaQuestion.schema.tableName} スキーマ下線`,
        prompt: exam.schemaQuestion.prompt,
        payload: {
          schema: exam.schemaQuestion.schema,
          explanation: exam.schemaQuestion.schema.explanation,
        },
      });
    }
  };

  const leftColClass =
    splitRatio === '60-40'
      ? 'lg:col-span-7'
      : splitRatio === '40-60'
        ? 'lg:col-span-5'
        : 'lg:col-span-6';
  const rightColClass =
    splitRatio === '60-40'
      ? 'lg:col-span-5'
      : splitRatio === '40-60'
        ? 'lg:col-span-7'
        : 'lg:col-span-6';

  return (
    <section className="space-y-4">
      {/* ヘッダ＆CBTタイマー＆分割比率 */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#e4e4e0] pb-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-wider text-[#71717a]">
            03 / CBT SPLIT TRAINER
          </div>
          <h2 className="mt-0.5 text-xl font-bold tracking-tight text-[#18181b]">
            CBT本番スプリット演習（R7秋–H28春）
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-md border border-[#d4d4d0] bg-white px-3 py-1.5">
            <span className="text-[11px] font-medium text-[#71717a]">残時間</span>
            <span
              className={`font-mono text-sm font-bold ${
                remainingSec < 300 ? 'text-[#be123c]' : 'text-[#18181b]'
              }`}
            >
              {formatTimer(remainingSec)}
            </span>
            <button
              type="button"
              onClick={() => setTimerRunning((r) => !r)}
              className="rounded bg-[#18181b] px-2 py-0.5 text-[11px] font-semibold text-white"
            >
              {timerRunning ? '停止' : '開始'}
            </button>
            <button
              type="button"
              onClick={() => {
                setTimerRunning(false);
                setRemainingSec(exam.timeLimitMin * 60);
              }}
              className="rounded border border-[#d4d4d0] bg-[#f6f6f4] px-2 py-0.5 text-[11px] text-[#52525b]"
            >
              リセット
            </button>
          </div>

          <div className="hidden lg:inline-flex items-center rounded-md border border-[#d4d4d0] bg-[#f1f1ee] p-0.5 text-[11px]">
            {(['50-50', '60-40', '40-60'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setSplitRatio(r)}
                className={`rounded px-2 py-1 font-mono font-semibold ${
                  splitRatio === r ? 'bg-white text-[#18181b] shadow-xs' : 'text-[#71717a]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 過去問6年度セレクタ */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CBT_PAST_EXAMS.map((ex, idx) => (
          <button
            key={ex.id}
            type="button"
            onClick={() => setExamIdx(idx)}
            className={`shrink-0 rounded-md border px-3 py-2 text-left transition ${
              idx === examIdx
                ? 'border-[#18181b] bg-[#18181b] text-white'
                : 'border-[#e4e4e0] bg-white text-[#18181b] hover:border-[#a1a1aa]'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`font-mono text-[11px] font-bold ${
                  idx === examIdx ? 'text-[#e4e4e7]' : 'text-[#1d4ed8]'
                }`}
              >
                {ex.year}
              </span>
              <span className={`text-[10px] ${idx === examIdx ? 'text-[#a1a1aa]' : 'text-[#71717a]'}`}>
                {ex.category}
              </span>
            </div>
            <div className="mt-0.5 text-xs font-semibold max-w-[190px] truncate">{ex.title}</div>
          </button>
        ))}
      </div>

      {toastMsg && (
        <div className="rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-3.5 py-2 text-xs font-semibold text-[#15803d]">
          {toastMsg}
        </div>
      )}

      {/* 左右2ペイン */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-start">
        {/* 左ペイン：問題文・業務ルール・手書きオーバーレイ */}
        <div className={`${leftColClass} space-y-4`}>
          <div className="rounded-lg border border-[#e4e4e0] bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#71717a]">
              <span className="font-semibold text-[#1d4ed8]">
                {exam.year} ・ {exam.section}
              </span>
              <span className="font-mono">目安 {exam.timeLimitMin}分</span>
            </div>
            <h3 className="text-base font-bold text-[#18181b]">{exam.title}</h3>
            <p className="text-sm text-[#3f3f46] leading-relaxed">{exam.backgroundText}</p>

            <div className="rounded-md border border-[#e4e4e0] bg-[#f6f6f4] p-3.5 space-y-2">
              <div className="text-xs font-bold text-[#18181b]">業務ルール・前提条件</div>
              <ul className="space-y-1.5 text-xs sm:text-sm text-[#27272a] list-disc pl-5 leading-relaxed">
                {exam.businessRules.map((rule, i) => (
                  <li key={i}>{rule}</li>
                ))}
              </ul>
            </div>
          </div>

          <FreehandOverlayCanvas exam={exam} />
        </div>

        {/* 右ペイン：記述・スキーマ下線・シグナル発掘 */}
        <div className={`${rightColClass} space-y-4`}>
          <div className="inline-flex flex-wrap rounded-md border border-[#d4d4d0] bg-[#f1f1ee] p-0.5">
            <button
              type="button"
              onClick={() => setRightTab('essay')}
              className={`rounded px-3 py-1.5 text-xs font-semibold transition ${
                rightTab === 'essay' ? 'bg-white text-[#18181b] shadow-xs' : 'text-[#52525b]'
              }`}
            >
              記述解答・添削連携 ({exam.essayQuestions.length})
            </button>
            <button
              type="button"
              onClick={() => setRightTab('schema')}
              className={`rounded px-3 py-1.5 text-xs font-semibold transition ${
                rightTab === 'schema' ? 'bg-white text-[#18181b] shadow-xs' : 'text-[#52525b]'
              }`}
            >
              スキーマ下線エディタ
            </button>
            <button
              type="button"
              onClick={() => setRightTab('signal')}
              className={`rounded px-3 py-1.5 text-xs font-semibold transition ${
                rightTab === 'signal' ? 'bg-white text-[#18181b] shadow-xs' : 'text-[#52525b]'
              }`}
            >
              本文シグナル発掘
            </button>
          </div>

          {rightTab === 'essay' && (
            <div className="space-y-4">
              {exam.essayQuestions.map((q) => {
                const draft = store.state.cbtDrafts[q.id] || '';
                const len = draft.length;
                const over = len > q.maxChars;
                const revealed = !!revealedEssays[q.id];

                return (
                  <div
                    key={q.id}
                    className="rounded-lg border border-[#e4e4e0] bg-white p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-[#18181b]">{q.label}</span>
                      <span
                        className={`rounded border px-2 py-0.5 font-mono text-xs font-semibold ${
                          over
                            ? 'border-[#fecdd3] bg-[#fff1f2] text-[#be123c]'
                            : 'border-[#e4e4e0] bg-[#f6f6f4] text-[#52525b]'
                        }`}
                      >
                        {len} / {q.maxChars} 字{over ? '（超過）' : ''}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-[#18181b] leading-relaxed">{q.prompt}</p>

                    <textarea
                      value={draft}
                      onChange={(e) => store.saveCbtDraft(q.id, e.target.value)}
                      rows={3}
                      placeholder={`記述解答を入力（${q.maxChars}字以内・自動保存）`}
                      className={`w-full rounded-md border bg-[#fafafa] p-3 text-sm text-[#18181b] leading-relaxed focus:bg-white focus:outline-none ${
                        over
                          ? 'border-[#be123c] focus:border-[#be123c]'
                          : 'border-[#d4d4d0] focus:border-[#18181b]'
                      }`}
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyGeminiPrompt(q.id)}
                        className="rounded-md bg-[#18181b] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#27272a] transition"
                      >
                        Gemini添削プロンプトをコピー (@db-afternoon-kakomon-review)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setRevealedEssays((prev) => ({ ...prev, [q.id]: !prev[q.id] }))
                        }
                        className="rounded-md border border-[#d4d4d0] bg-white px-3 py-2 text-xs font-semibold text-[#52525b] hover:bg-[#f1f1ee]"
                      >
                        {revealed ? '公式解答を隠す' : '公式解答・採点基準'}
                      </button>
                    </div>

                    {revealed && (
                      <div className="rounded-md border border-[#e4e4e0] bg-[#f6f6f4] p-3.5 space-y-2.5 text-xs">
                        <div>
                          <span className="font-bold text-[#15803d]">公式解答例：</span>
                          <span className="text-[#18181b] font-medium">{q.officialAnswer}</span>
                          <span className="ml-2 font-mono text-[#71717a]">
                            （{q.officialAnswer.length}字）
                          </span>
                        </div>
                        <ul className="list-disc pl-4 space-y-1 text-[#3f3f46]">
                          {q.gradingPoints.map((pt, i) => (
                            <li key={i}>{pt}</li>
                          ))}
                        </ul>
                        <div className="text-[#71717a]">ヒント：{q.hint}</div>

                        <div className="flex flex-wrap gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleEssaySelfGrade(q.id, true)}
                            className="rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-1.5 text-xs font-semibold text-[#15803d]"
                          >
                            自己採点：合格レベル
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEssaySelfGrade(q.id, false)}
                            className="rounded-md border border-[#fecdd3] bg-[#fff1f2] px-3 py-1.5 text-xs font-semibold text-[#be123c]"
                          >
                            不十分 → 弱点復習キューへ登録
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {previewPrompt && (
                <div className="rounded-lg border border-[#e4e4e0] bg-white p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#18181b]">
                      生成済み添削依頼プロンプト（@db-afternoon-kakomon-review）
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewPrompt(null)}
                      className="text-xs text-[#71717a] hover:text-[#18181b]"
                    >
                      閉じる
                    </button>
                  </div>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-[#e4e4e0] bg-[#f6f6f4] p-3 font-mono text-[11px] text-[#3f3f46]">
                    {previewPrompt}
                  </pre>
                </div>
              )}
            </div>
          )}

          {rightTab === 'schema' && (
            <div className="rounded-lg border border-[#e4e4e0] bg-white p-4 space-y-4">
              <div>
                <div className="text-xs font-bold text-[#52525b]">関係スキーマ下線エディタ</div>
                <p className="mt-1 text-sm font-medium text-[#18181b]">
                  {exam.schemaQuestion.prompt}
                </p>
              </div>

              <div className="rounded-md border border-[#e4e4e0] bg-[#f6f6f4] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-[#18181b]">
                    {exam.schemaQuestion.schema.tableName} (
                  </span>
                  {exam.schemaQuestion.schema.attributes.map((attr, idx) => {
                    const chosen = schemaRoles[idx] || 'none';
                    const ok = schemaResult?.checked && chosen === attr.role;
                    const ng = schemaResult?.checked && chosen !== attr.role;
                    return (
                      <button
                        key={attr.name}
                        type="button"
                        onClick={() => handleToggleSchemaRole(idx)}
                        className={`flex flex-col items-center rounded-md border px-3 py-2 transition ${
                          ok
                            ? 'border-[#15803d] bg-[#f0fdf4]'
                            : ng
                              ? 'border-[#be123c] bg-[#fff1f2]'
                              : 'border-[#d4d4d0] bg-white hover:border-[#18181b]'
                        }`}
                      >
                        <span className={`text-sm ${KEY_ROLE_CLASS[chosen]}`}>{attr.name}</span>
                        <span className="mt-1 text-[10px] text-[#71717a]">
                          {KEY_ROLE_LABEL[chosen]}
                        </span>
                      </button>
                    );
                  })}
                  <span className="text-sm font-bold text-[#18181b]">)</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleGradeCbtSchema}
                  className="rounded-md bg-[#18181b] px-4 py-2 text-xs font-semibold text-white hover:bg-[#27272a]"
                >
                  スキーマ下線を採点する
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSchemaRoles(exam.schemaQuestion.schema.attributes.map(() => 'none'));
                    setSchemaResult(null);
                  }}
                  className="rounded-md border border-[#d4d4d0] bg-white px-3.5 py-2 text-xs text-[#52525b] hover:bg-[#f1f1ee]"
                >
                  リセット
                </button>
              </div>

              {schemaResult && (
                <div className="space-y-2">
                  <div
                    className={`rounded-md border px-3 py-2 text-xs font-semibold ${
                      schemaResult.perfect
                        ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]'
                        : 'border-[#fecdd3] bg-[#fff1f2] text-[#9f1239]'
                    }`}
                  >
                    {schemaResult.perfect
                      ? `満点正解（${schemaResult.score}/${schemaResult.total}）`
                      : `${schemaResult.score}/${schemaResult.total} 正解 — 弱点復習キューへ自動追加しました`}
                  </div>
                  <SchemaLineDisplay schema={exam.schemaQuestion.schema} />
                </div>
              )}
            </div>
          )}

          {rightTab === 'signal' && <SignalDrill exam={exam} store={store} />}
        </div>
      </div>
    </section>
  );
};
