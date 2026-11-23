// モジュール2：実機SQL道場（sql.js WASM ＋ オフライン自動フォールバック ＋ ウィンドウ関数可視化）
// iPad/Mac(md以上): 左右2分割(md:grid-cols-2) ／ iPhone(md未満): スティッキー3セグメント切替
import React, { useState, useEffect, useRef } from 'react';
import { SQL_DRILLS } from '../../data/sqlDrills';
import type { SqlQueryResult } from '../../types/exam';
import type { StudyStore } from '../../state/useStudyStore';
import { initSqlEngine, runDrillQuery, type SqlEngineMode } from '../../utils/sqlEngine';
import { WindowFrameCanvas } from './WindowFrameCanvas';

interface Props {
  store: StudyStore;
}

type MobileSqlPane = 'problem' | 'editor' | 'explanation';

export const SqlDojo: React.FC<Props> = ({ store }) => {
  const [drillIdx, setDrillIdx] = useState(0);
  const problem = SQL_DRILLS[drillIdx];

  const [sqlText, setSqlText] = useState(problem.starterSql);
  const [engineMode, setEngineMode] = useState<SqlEngineMode>('initializing');
  const [engineReason, setEngineReason] = useState('SQLエンジンを初期化中...');
  const [forceOffline, setForceOffline] = useState(false);

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SqlQueryResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  // iPhone用セグメント切替（タブごとのスクロール位置を記憶して復元）
  const [mobilePane, setMobilePane] = useState<MobileSqlPane>('problem');
  const paneScrollRef = useRef<Record<MobileSqlPane, number>>({
    problem: 0,
    editor: 0,
    explanation: 0,
  });

  const handleSwitchMobilePane = (next: MobileSqlPane) => {
    if (next === mobilePane) return;
    paneScrollRef.current[mobilePane] = window.scrollY;
    setMobilePane(next);
    const savedY = paneScrollRef.current[next] ?? 0;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: savedY, behavior: 'auto' });
    });
  };

  useEffect(() => {
    let active = true;
    initSqlEngine(forceOffline).then((info) => {
      if (!active) return;
      setEngineMode(info.mode);
      setEngineReason(info.reason);
    });
    return () => {
      active = false;
    };
  }, [forceOffline]);

  const handleSelectProblem = (idx: number) => {
    setDrillIdx(idx);
    setSqlText(SQL_DRILLS[idx].starterSql);
    setResult(null);
    setErrorMsg(null);
    setIsCorrect(null);
    setShowAnswer(false);
    paneScrollRef.current = { problem: 0, editor: 0, explanation: 0 };
  };

  const handleExecute = async () => {
    setRunning(true);
    setErrorMsg(null);
    try {
      const res = await runDrillQuery(problem, sqlText, forceOffline);
      if (res.error) {
        setErrorMsg(res.error);
        setResult(null);
        setIsCorrect(false);
      } else if (res.result) {
        setResult(res.result);
        setIsCorrect(res.isCorrect);
        if (res.isCorrect) {
          store.markSqlDrillSolved(problem.id);
        } else {
          store.incrementAttempts();
        }
      }
      const updated = await initSqlEngine(forceOffline);
      setEngineMode(updated.mode);
      setEngineReason(updated.reason);
    } finally {
      setRunning(false);
    }
  };

  const solvedCount = store.state.solvedSqlDrills.length;

  return (
    <section className="space-y-4">
      {/* ヘッダ ＆ エンジン状態 */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-200 pb-3">
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#1D1D1F]">
            SQL道場
          </h2>
          <span className="font-mono text-xs font-semibold tabular-nums text-[#6E6E73]">
            {solvedCount}/{SQL_DRILLS.length} 問クリア
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-mono text-[11px] font-medium text-[#1D1D1F]"
            title={engineReason}
          >
            {engineMode === 'wasm'
              ? 'SQLite WASM 稼働中'
              : engineMode === 'offline-fallback'
                ? 'オフライン評価モード'
                : '初期化中...'}
          </span>
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-[#6E6E73]">
            <input
              type="checkbox"
              checked={forceOffline}
              onChange={(e) => setForceOffline(e.target.checked)}
              className="accent-[#007AFF]"
            />
            <span>オフラインテスト</span>
          </label>
        </div>
      </div>

      {/* 問題セレクタ（モバイルは横スクロールチップ、md以上はグリッド） */}
      <div className="flex gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-3 md:overflow-visible md:pb-0">
        {SQL_DRILLS.map((d, idx) => {
          const solved = store.state.solvedSqlDrills.includes(d.id);
          const active = idx === drillIdx;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => handleSelectProblem(idx)}
              className={`min-w-[210px] shrink-0 rounded-lg border p-3 text-left transition md:min-w-0 ${
                active
                  ? 'border-[#007AFF] bg-white ring-1 ring-[#007AFF]/20'
                  : 'border-slate-200 bg-white/80 hover:border-slate-300 hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-semibold tabular-nums text-[#6E6E73]">
                  {d.year} ・ {d.difficulty}
                </span>
                {solved && (
                  <span className="rounded-md border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-[#007AFF]">
                    合格済
                  </span>
                )}
              </div>
              <div className="mt-1 text-[13px] font-bold text-[#1D1D1F]">{d.title}</div>
              <div className="mt-0.5 text-[11px] text-[#6E6E73]">{d.examSection}</div>
            </button>
          );
        })}
      </div>

      {/* iPhone用スティッキー・セグメントコントロール（md未満のみ） */}
      <div className="sticky top-12 z-20 -mx-4 border-b border-slate-200/80 bg-[#F5F5F7]/95 px-4 py-2 backdrop-blur-md md:hidden">
        <div
          role="tablist"
          aria-label="SQL道場ペイン切替"
          className="grid grid-cols-3 gap-1 rounded-lg bg-[#E5E5EA]/90 p-1"
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
                className={`rounded-md py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-white text-[#1D1D1F] shadow-xs'
                    : 'text-[#6E6E73] active:text-[#1D1D1F]'
                }`}
              >
                {seg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* メイン2ペイン：md以上は md:grid-cols-2、md未満はセグメント表示 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 items-start">
        {/* 左ペイン：設問＆サンプル表 */}
        <div className={mobilePane === 'problem' ? 'block space-y-4' : 'hidden md:block space-y-4'}>
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-[#6E6E73]">
              <span className="font-semibold text-[#1D1D1F]">{problem.examSection}</span>
              <span className="font-mono tabular-nums">{problem.year}</span>
            </div>
            <h3 className="text-base font-bold text-[#1D1D1F]">{problem.title}</h3>
            <p className="text-[13px] sm:text-sm text-[#1D1D1F]/90 leading-relaxed">
              {problem.description}
            </p>

            <div className="space-y-2.5 pt-2">
              <div className="text-xs font-semibold text-[#6E6E73]">初期サンプルテーブル</div>
              {Object.entries(problem.offlineTables).map(([tName, tRows]) => (
                <div
                  key={tName}
                  className="overflow-x-auto rounded-lg border border-slate-200 bg-white"
                >
                  <div className="border-b border-slate-200 bg-[#F5F5F7] px-3 py-1.5 font-mono text-xs font-bold tabular-nums text-[#1D1D1F]">
                    {tName}（{tRows.length}行）
                  </div>
                  <table className="w-full text-left font-mono text-xs tabular-nums">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-[#6E6E73]">
                        {Object.keys(tRows[0] || {}).map((col) => (
                          <th key={col} className="whitespace-nowrap px-2.5 py-1.5 font-semibold">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tRows.map((r, ri) => (
                        <tr
                          key={ri}
                          className="border-b border-slate-100 last:border-0 text-[#1D1D1F]"
                        >
                          {Object.values(r).map((v, ci) => (
                            <td key={ci} className="whitespace-nowrap px-2.5 py-1">
                              {v === null ? <span className="text-[#6E6E73]">NULL</span> : String(v)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右ペイン：SQLエディタ＆実行結果 */}
        <div className={mobilePane === 'editor' ? 'block space-y-4' : 'hidden md:block space-y-4'}>
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#1D1D1F]">
                SQLエディタ（Cmd / Ctrl + Enter で実行）
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSqlText(problem.starterSql)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
                >
                  初期文に戻す
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSqlText(problem.answerSql);
                    setShowAnswer(true);
                  }}
                  className="rounded-lg border border-slate-200 bg-[#F5F5F7] px-2.5 py-1 text-xs font-semibold text-[#1D1D1F] hover:bg-slate-200/70"
                >
                  模範SQLを貼付
                </button>
              </div>
            </div>

            {/* コードエディタ（iPhone自動ズーム防止のため text-base md:text-sm） */}
            <textarea
              value={sqlText}
              onChange={(e) => setSqlText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleExecute();
                }
              }}
              rows={10}
              spellCheck={false}
              className="w-full rounded-lg border border-slate-800 bg-[#0f172a] p-3.5 font-mono text-base md:text-sm leading-relaxed text-[#e2e8f0] focus:border-[#007AFF] focus:outline-none"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                disabled={running}
                onClick={handleExecute}
                className="rounded-lg bg-[#007AFF] px-5 py-2 text-xs font-semibold text-white hover:bg-[#0066D6] disabled:opacity-50 transition"
              >
                {running ? '実行中...' : 'SQLを実行・採点'}
              </button>

              <button
                type="button"
                onClick={() => setShowAnswer((s) => !s)}
                className="hidden md:inline-flex rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
              >
                {showAnswer ? '解説を閉じる' : '解説・期待結果を表示'}
              </button>
            </div>

            {errorMsg && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 font-mono text-xs text-red-700">
                {errorMsg}
              </div>
            )}

            {result && (
              <div className="space-y-2.5">
                <div
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
                    isCorrect
                      ? 'border-sky-200 bg-sky-50 text-[#007AFF]'
                      : 'border-amber-200 bg-amber-50 text-amber-800'
                  }`}
                >
                  <span>
                    {isCorrect
                      ? '期待結果と完全一致（合格）'
                      : '実行完了（期待結果と差分あり：列数・並び順・計算式を確認）'}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums opacity-85">
                    [{result.engine}] {result.executionMs}ms / {result.rows.length}行
                  </span>
                </div>

                {result.note && <p className="text-[11px] text-[#6E6E73]">{result.note}</p>}

                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full text-left font-mono text-xs tabular-nums">
                    <thead>
                      <tr className="border-b border-slate-200 bg-[#F5F5F7] text-[#1D1D1F]">
                        {result.columns.map((c, idx) => (
                          <th key={`${c}-${idx}`} className="whitespace-nowrap px-3 py-2 font-bold">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, ri) => (
                        <tr
                          key={ri}
                          className="border-b border-slate-100 last:border-0 text-[#1D1D1F]"
                        >
                          {row.map((cell, ci) => (
                            <td key={ci} className="whitespace-nowrap px-3 py-1.5">
                              {cell === null ? (
                                <span className="text-[#6E6E73]">NULL</span>
                              ) : (
                                String(cell)
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* デスクトップ用トグル解説 */}
            {showAnswer && (
              <div className="hidden md:block rounded-lg border border-slate-200 bg-[#F5F5F7] p-3.5 space-y-2.5 text-xs">
                <div className="font-bold text-[#1D1D1F]">午後試験の重要ポイント解説</div>
                <p className="text-[#1D1D1F]/90 leading-relaxed">{problem.explanation}</p>
                <div className="pt-1 font-bold text-[#6E6E73]">
                  期待出力（<span className="font-mono tabular-nums">{problem.expectedResult.rows.length}</span>行）
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full text-left font-mono text-[11px] tabular-nums">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[#6E6E73]">
                        {problem.expectedResult.columns.map((c) => (
                          <th key={c} className="whitespace-nowrap px-2.5 py-1.5">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {problem.expectedResult.rows.map((r, ri) => (
                        <tr key={ri} className="border-b border-slate-100 last:border-0 text-[#1D1D1F]">
                          {r.map((v, ci) => (
                            <td key={ci} className="whitespace-nowrap px-2.5 py-1">
                              {v === null ? 'NULL' : String(v)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* モバイル用「解説」セグメント専用パネル（md未満かつ解説選択時のみ表示） */}
        <div className={mobilePane === 'explanation' ? 'block md:hidden' : 'hidden'}>
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[#1D1D1F]">午後試験の重要ポイント解説</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-[#1D1D1F]/90">
                {problem.explanation}
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#6E6E73]">模範SQL</span>
                <button
                  type="button"
                  onClick={() => {
                    setSqlText(problem.answerSql);
                    handleSwitchMobilePane('editor');
                  }}
                  className="text-xs font-semibold text-[#007AFF]"
                >
                  エディタへ貼り付けて実行 →
                </button>
              </div>
              <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-[#0f172a] p-3 font-mono text-xs leading-relaxed text-[#e2e8f0]">
                {problem.answerSql}
              </pre>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-bold text-[#6E6E73]">
                期待出力（<span className="font-mono tabular-nums">{problem.expectedResult.rows.length}</span>行）
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-left font-mono text-xs tabular-nums">
                  <thead>
                    <tr className="border-b border-slate-200 bg-[#F5F5F7] text-[#6E6E73]">
                      {problem.expectedResult.columns.map((c) => (
                        <th key={c} className="whitespace-nowrap px-2.5 py-1.5">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {problem.expectedResult.rows.map((r, ri) => (
                      <tr key={ri} className="border-b border-slate-100 last:border-0 text-[#1D1D1F]">
                        {r.map((v, ci) => (
                          <td key={ci} className="whitespace-nowrap px-2.5 py-1">
                            {v === null ? 'NULL' : String(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ウィンドウ関数フレーム可視化Canvas（モバイルでは「問題・図表」と「解説」で表示、md以上は常時表示） */}
      <div className={mobilePane === 'editor' ? 'hidden md:block' : 'block'}>
        <WindowFrameCanvas
          preset={problem.windowPresetId === 'rank-compare' ? 'rank-compare' : 'moving-avg'}
        />
      </div>
    </section>
  );
};
