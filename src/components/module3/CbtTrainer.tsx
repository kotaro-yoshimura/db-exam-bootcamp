// モジュール3：CBT本番スプリット画面トレーナー ＆ 3大CBT特化機能統合（Apple HIG 準拠）
// iPad/Mac(md以上): 左右2ペイン ／ iPhone(md未満): スティッキー3セグメント切替（問題・図表｜解答・エディタ｜解説）
import React, { useState, useEffect, useRef } from 'react';
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

type MobileCbtPane = 'problem' | 'editor' | 'explanation';

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

export const CbtTrainer: React.FC<Props> = ({ store }) => {
  const [examIdx, setExamIdx] = useState(0);
  const exam = CBT_PAST_EXAMS[examIdx];

  const [splitRatio, setSplitRatio] = useState<'50-50' | '60-40' | '40-60'>('50-50');
  const [rightTab, setRightTab] = useState<'essay' | 'schema' | 'signal'>('essay');

  // iPhone用3セグメント切替（スクロール位置をタブごとに記憶・復元）
  const [mobilePane, setMobilePane] = useState<MobileCbtPane>('problem');
  const paneScrollRef = useRef<Record<MobileCbtPane, number>>({
    problem: 0,
    editor: 0,
    explanation: 0,
  });

  const handleSwitchMobilePane = (next: MobileCbtPane) => {
    if (next === mobilePane) return;
    paneScrollRef.current[mobilePane] = window.scrollY;
    setMobilePane(next);
    const savedY = paneScrollRef.current[next] ?? 0;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: savedY, behavior: 'auto' });
    });
  };

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
    paneScrollRef.current = { problem: 0, editor: 0, explanation: 0 };
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
      ? 'md:col-span-7'
      : splitRatio === '40-60'
        ? 'md:col-span-5'
        : 'md:col-span-6';
  const rightColClass =
    splitRatio === '60-40'
      ? 'md:col-span-5'
      : splitRatio === '40-60'
        ? 'md:col-span-7'
        : 'md:col-span-6';

  const trueSignals = exam.signalDrill.segments.filter((s) => s.isSignal);

  return (
    <section className="space-y-4">
      {/* ヘッダ ＆ CBTタイマー ＆ 分割比率（枠ノイズ排除） */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-1">
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-[20px] font-bold tracking-tight text-[#1D1D1F]">CBT演習</h2>
          <span className="font-mono text-xs tabular-nums text-[#8E8E93]">R7秋–H28春</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="ios-group flex items-center gap-2.5 px-3 py-1.5">
            <span className="text-[11px] font-medium text-[#8E8E93]">残時間</span>
            <span
              className={`font-mono text-sm font-bold tabular-nums ${
                remainingSec < 300 ? 'text-red-600' : 'text-[#1D1D1F]'
              }`}
            >
              {formatTimer(remainingSec)}
            </span>
            <button
              type="button"
              onClick={() => setTimerRunning((r) => !r)}
              className="rounded-[6px] bg-[#007AFF] px-2.5 py-0.5 text-[11px] font-semibold text-white active:opacity-80"
            >
              {timerRunning ? '停止' : '開始'}
            </button>
            <button
              type="button"
              onClick={() => {
                setTimerRunning(false);
                setRemainingSec(exam.timeLimitMin * 60);
              }}
              className="text-[11px] font-medium text-[#6E6E73] hover:text-[#1D1D1F] active:opacity-50"
            >
              リセット
            </button>
          </div>

          <div className="hidden md:inline-flex items-center rounded-[8px] bg-black/[0.06] p-[2px] text-[11px]">
            {(['50-50', '60-40', '40-60'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setSplitRatio(r)}
                className={`rounded-[6.5px] px-2 py-1 font-mono font-semibold tabular-nums transition ${
                  splitRatio === r
                    ? 'bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
                    : 'text-[#6E6E73]'
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
            className={`shrink-0 rounded-[10px] px-3 py-2 text-left transition active:opacity-75 ${
              idx === examIdx
                ? 'bg-[#007AFF] text-white'
                : 'ios-group text-[#1D1D1F] hover:bg-white/90'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`font-mono text-[11px] font-bold tabular-nums ${
                  idx === examIdx ? 'text-white' : 'text-[#007AFF]'
                }`}
              >
                {ex.year}
              </span>
              <span className={`text-[10px] ${idx === examIdx ? 'text-white/80' : 'text-[#8E8E93]'}`}>
                {ex.category}
              </span>
            </div>
            <div className="mt-0.5 max-w-[190px] truncate text-xs font-semibold">{ex.title}</div>
          </button>
        ))}
      </div>

      {toastMsg && (
        <div className="rounded-[10px] bg-[#007AFF]/10 px-3.5 py-2 text-xs font-semibold text-[#007AFF]">
          {toastMsg}
        </div>
      )}

      {/* iPhone用スティッキー・セグメントコントロール（本物iOS質感） */}
      <div className="sticky top-12 z-20 -mx-4 border-b border-black/[0.06] bg-[#F2F2F7]/95 px-4 py-2 backdrop-blur-md md:hidden">
        <div
          role="tablist"
          aria-label="CBT演習ペイン切替"
          className="grid grid-cols-3 gap-0.5 rounded-[8px] bg-black/[0.07] p-[2px]"
        >
          {(
            [
              { id: 'problem', label: '問題・図表' },
              { id: 'editor', label: '解答・エディタ' },
              { id: 'explanation', label: '解説' },
            ] as const
          ).map((seg) => {
            const active = mobilePane === seg.id;
            return (
              <button
                key={seg.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleSwitchMobilePane(seg.id)}
                className={`rounded-[6.5px] py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
                    : 'text-[#6E6E73] active:text-[#1D1D1F]'
                }`}
              >
                {seg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 左右2ペイン */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12 items-start">
        {/* 左ペイン：問題文・業務ルール・手書きオーバーレイ */}
        <div
          className={`${leftColClass} space-y-4 ${
            mobilePane === 'problem' ? 'block' : 'hidden md:block'
          }`}
        >
          <div className="ios-group p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#8E8E93]">
              <span className="font-semibold text-[#007AFF]">
                <span className="font-mono tabular-nums">{exam.year}</span> · {exam.section}
              </span>
              <span className="font-mono tabular-nums">目安 {exam.timeLimitMin}分</span>
            </div>
            <h3 className="text-base font-bold text-[#1D1D1F]">{exam.title}</h3>
            <p className="text-sm text-[#1D1D1F]/90 leading-relaxed">{exam.backgroundText}</p>

            <div className="rounded-[8px] bg-[#F2F2F7] p-3.5 space-y-2">
              <div className="text-xs font-semibold text-[#6E6E73]">業務ルール・前提条件</div>
              <ul className="space-y-1.5 text-xs sm:text-sm text-[#1D1D1F]/90 list-disc pl-5 leading-relaxed">
                {exam.businessRules.map((rule, i) => (
                  <li key={i}>{rule}</li>
                ))}
              </ul>
            </div>
          </div>

          <FreehandOverlayCanvas exam={exam} />
        </div>

        {/* 右ペイン：記述・スキーマ下線・シグナル発掘 */}
        <div
          className={`${rightColClass} space-y-4 ${
            mobilePane === 'editor' ? 'block' : 'hidden md:block'
          }`}
        >
          <div className="inline-flex w-full sm:w-auto rounded-[8px] bg-black/[0.06] p-[2px]">
            <button
              type="button"
              onClick={() => setRightTab('essay')}
              className={`flex-1 sm:flex-none rounded-[6.5px] px-3 py-1.5 text-xs font-semibold transition ${
                rightTab === 'essay'
                  ? 'bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
                  : 'text-[#6E6E73]'
              }`}
            >
              記述 (<span className="font-mono tabular-nums">{exam.essayQuestions.length}</span>)
            </button>
            <button
              type="button"
              onClick={() => setRightTab('schema')}
              className={`flex-1 sm:flex-none rounded-[6.5px] px-3 py-1.5 text-xs font-semibold transition ${
                rightTab === 'schema'
                  ? 'bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
                  : 'text-[#6E6E73]'
              }`}
            >
              スキーマ下線
            </button>
            <button
              type="button"
              onClick={() => setRightTab('signal')}
              className={`flex-1 sm:flex-none rounded-[6.5px] px-3 py-1.5 text-xs font-semibold transition ${
                rightTab === 'signal'
                  ? 'bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
                  : 'text-[#6E6E73]'
              }`}
            >
              シグナル発掘
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
                  <div key={q.id} className="ios-group p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold tabular-nums text-[#1D1D1F]">
                        {q.label}
                      </span>
                      <span
                        className={`rounded-md border px-2 py-0.5 font-mono text-xs font-semibold tabular-nums ${
                          over
                            ? 'border-red-200 bg-red-50 text-red-700'
                            : 'border-slate-200 bg-[#F5F5F7] text-[#6E6E73]'
                        }`}
                      >
                        {len} / {q.maxChars} 字{over ? '（超過）' : ''}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-[#1D1D1F] leading-relaxed">{q.prompt}</p>

                    {/* CBT記述解答欄（iPhone自動ズーム防止のため text-base md:text-sm） */}
                    <textarea
                      value={draft}
                      onChange={(e) => store.saveCbtDraft(q.id, e.target.value)}
                      rows={3}
                      placeholder={`記述解答を入力（${q.maxChars}字以内・自動保存）`}
                      className={`w-full rounded-lg border bg-[#F5F5F7]/60 p-3 text-base md:text-sm text-[#1D1D1F] leading-relaxed focus:bg-white focus:outline-none ${
                        over
                          ? 'border-red-500 focus:border-red-600'
                          : 'border-slate-200 focus:border-[#007AFF]'
                      }`}
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyGeminiPrompt(q.id)}
                        className="rounded-lg bg-[#007AFF] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0066D6] transition"
                      >
                        Gemini添削プロンプトをコピー
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setRevealedEssays((prev) => ({ ...prev, [q.id]: !prev[q.id] }))
                        }
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
                      >
                        {revealed ? '公式解答を隠す' : '公式解答・採点基準'}
                      </button>
                    </div>

                    {revealed && (
                      <div className="rounded-lg border border-slate-200 bg-[#F5F5F7] p-3.5 space-y-2.5 text-xs">
                        <div>
                          <span className="font-bold text-[#007AFF]">公式解答例：</span>
                          <span className="text-[#1D1D1F] font-medium">{q.officialAnswer}</span>
                          <span className="ml-2 font-mono tabular-nums text-[#6E6E73]">
                            （{q.officialAnswer.length}字）
                          </span>
                        </div>
                        <ul className="list-disc pl-4 space-y-1 text-[#1D1D1F]/85">
                          {q.gradingPoints.map((pt, i) => (
                            <li key={i}>{pt}</li>
                          ))}
                        </ul>
                        <div className="text-[#6E6E73]">ヒント：{q.hint}</div>

                        <div className="flex flex-wrap gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleEssaySelfGrade(q.id, true)}
                            className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-[#007AFF]"
                          >
                            自己採点：合格レベル
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEssaySelfGrade(q.id, false)}
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700"
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
                <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1D1D1F]">
                      生成済み添削依頼プロンプト（@db-afternoon-kakomon-review）
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewPrompt(null)}
                      className="text-xs text-[#6E6E73] hover:text-[#1D1D1F]"
                    >
                      閉じる
                    </button>
                  </div>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-[#F5F5F7] p-3 font-mono text-[11px] text-[#1D1D1F]">
                    {previewPrompt}
                  </pre>
                </div>
              )}
            </div>
          )}

          {rightTab === 'schema' && (
            <div className="ios-group p-4 space-y-4">
              <div>
                <div className="text-xs font-bold text-[#6E6E73]">関係スキーマ下線エディタ</div>
                <p className="mt-1 text-sm font-medium text-[#1D1D1F]">
                  {exam.schemaQuestion.prompt}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-[#F5F5F7] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-[#1D1D1F]">
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
                        className={`flex flex-col items-center rounded-lg border border-b-2 px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.05)] active:scale-95 transition ${
                          ok
                            ? 'border-emerald-600 bg-emerald-50'
                            : ng
                              ? 'border-red-500 bg-red-50'
                              : chosen !== 'none'
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
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleGradeCbtSchema}
                  className="rounded-lg bg-[#007AFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0066D6]"
                >
                  スキーマ下線を採点する
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSchemaRoles(exam.schemaQuestion.schema.attributes.map(() => 'none'));
                    setSchemaResult(null);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs text-[#6E6E73] hover:bg-[#F5F5F7]"
                >
                  リセット
                </button>
              </div>

              {schemaResult && (
                <div className="space-y-2">
                  <div
                    className={`rounded-lg border px-3 py-2 font-mono text-xs font-semibold tabular-nums ${
                      schemaResult.perfect
                        ? 'border-sky-200 bg-sky-50 text-[#007AFF]'
                        : 'border-red-200 bg-red-50 text-red-700'
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

        {/* モバイル用「解説」セグメント専用パネル（md未満かつ解説選択時のみ表示） */}
        <div className={mobilePane === 'explanation' ? 'block space-y-4 md:hidden' : 'hidden'}>
          {/* 1. 記述設問の公式解答・採点ポイント */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
            <h3 className="text-sm font-bold text-[#1D1D1F]">
              記述設問の公式解答・採点ポイント
            </h3>
            {exam.essayQuestions.map((q) => (
              <div
                key={q.id}
                className="rounded-lg border border-slate-200 bg-[#F5F5F7] p-3.5 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold tabular-nums text-[#1D1D1F]">{q.label}</span>
                  <span className="font-mono text-[11px] tabular-nums text-[#6E6E73]">
                    {q.officialAnswer.length} / {q.maxChars}字
                  </span>
                </div>
                <p className="font-medium text-[#1D1D1F] leading-relaxed">{q.officialAnswer}</p>
                <ul className="list-disc pl-4 space-y-1 text-[#6E6E73]">
                  {q.gradingPoints.map((pt, i) => (
                    <li key={i}>{pt}</li>
                  ))}
                </ul>
                <div className="text-[#6E6E73]">ヒント：{q.hint}</div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleEssaySelfGrade(q.id, true)}
                    className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-[#007AFF]"
                  >
                    合格レベル
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEssaySelfGrade(q.id, false)}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700"
                  >
                    弱点キューへ登録
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 2. スキーマ下線 正解 */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2.5">
            <h3 className="text-sm font-bold text-[#1D1D1F]">スキーマ下線の正解</h3>
            <SchemaLineDisplay schema={exam.schemaQuestion.schema} />
          </div>

          {/* 3. 本文シグナル決定打一覧 */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2.5">
            <h3 className="text-sm font-bold text-[#1D1D1F]">
              本文シグナル決定打（<span className="font-mono tabular-nums">{trueSignals.length}</span>箇所）
            </h3>
            <div className="space-y-2">
              {trueSignals.map((sig) => (
                <div
                  key={sig.id}
                  className="rounded-lg border border-slate-200 bg-[#F5F5F7] p-3 text-xs space-y-1"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[11px] font-semibold text-[#007AFF]">
                      [{sig.signalKind}]
                    </span>
                    <span className="font-bold text-[#1D1D1F]">「{sig.text}」</span>
                  </div>
                  <p className="text-[#6E6E73] leading-relaxed">{sig.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
