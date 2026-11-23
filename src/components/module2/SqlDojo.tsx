// モジュール2：実機SQL道場（sql.js WASM ＋ オフライン自動フォールバック ＋ ウィンドウ関数可視化）
import React, { useState, useEffect } from 'react';
import { SQL_DRILLS } from '../../data/sqlDrills';
import type { SqlQueryResult } from '../../types/exam';
import type { StudyStore } from '../../state/useStudyStore';
import { initSqlEngine, runDrillQuery, type SqlEngineMode } from '../../utils/sqlEngine';
import { WindowFrameCanvas } from './WindowFrameCanvas';

interface Props {
  store: StudyStore;
}

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
    <section className="space-y-5">
      {/* ヘッダ ＆ エンジン状態 */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#e4e4e0] pb-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-wider text-[#71717a]">
            02 / SQL WORKBENCH
          </div>
          <h2 className="mt-0.5 text-xl font-bold tracking-tight text-[#18181b]">
            実機SQL道場（{solvedCount}/{SQL_DRILLS.length} 問クリア）
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-md border px-2.5 py-1 font-mono text-[11px] font-semibold ${
              engineMode === 'wasm'
                ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]'
                : engineMode === 'offline-fallback'
                  ? 'border-[#fde68a] bg-[#fffbeb] text-[#b45309]'
                  : 'border-[#e4e4e0] bg-white text-[#71717a]'
            }`}
            title={engineReason}
          >
            {engineMode === 'wasm'
              ? 'SQLite WASM 稼働中'
              : engineMode === 'offline-fallback'
                ? 'オフライン評価モード'
                : '初期化中...'}
          </span>
          <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-[#d4d4d0] bg-white px-2.5 py-1 text-xs text-[#52525b]">
            <input
              type="checkbox"
              checked={forceOffline}
              onChange={(e) => setForceOffline(e.target.checked)}
              className="accent-[#18181b]"
            />
            <span>オフライン強制テスト</span>
          </label>
        </div>
      </div>

      {/* 問題セレクタ */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {SQL_DRILLS.map((d, idx) => {
          const solved = store.state.solvedSqlDrills.includes(d.id);
          const active = idx === drillIdx;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => handleSelectProblem(idx)}
              className={`rounded-lg border p-3 text-left transition ${
                active
                  ? 'border-[#18181b] bg-white'
                  : 'border-[#e4e4e0] bg-white/60 hover:border-[#a1a1aa] hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-semibold text-[#1d4ed8]">
                  {d.year} ・ {d.difficulty}
                </span>
                {solved && (
                  <span className="rounded border border-[#bbf7d0] bg-[#f0fdf4] px-1.5 py-0.5 text-[10px] font-semibold text-[#15803d]">
                    合格済
                  </span>
                )}
              </div>
              <div className="mt-1 text-sm font-bold text-[#18181b]">{d.title}</div>
              <div className="mt-0.5 text-[11px] text-[#71717a]">{d.examSection}</div>
            </button>
          );
        })}
      </div>

      {/* 設問・データ表 ＋ エディタ・実行結果 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* 左ペイン：設問＆サンプル表 */}
        <div className="lg:col-span-5">
          <div className="rounded-lg border border-[#e4e4e0] bg-white p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-[#71717a]">
              <span className="font-semibold text-[#18181b]">{problem.examSection}</span>
              <span className="font-mono">{problem.year}</span>
            </div>
            <h3 className="text-base font-bold text-[#18181b]">{problem.title}</h3>
            <p className="text-xs sm:text-sm text-[#3f3f46] leading-relaxed">{problem.description}</p>

            <div className="space-y-2.5 pt-2">
              <div className="text-xs font-bold text-[#52525b]">初期サンプルテーブル</div>
              {Object.entries(problem.offlineTables).map(([tName, tRows]) => (
                <div key={tName} className="overflow-x-auto rounded-md border border-[#e4e4e0] bg-white">
                  <div className="border-b border-[#e4e4e0] bg-[#f6f6f4] px-3 py-1.5 font-mono text-xs font-bold text-[#18181b]">
                    {tName}（{tRows.length}行）
                  </div>
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#e4e4e0] text-[#71717a] bg-[#fafafa]">
                        {Object.keys(tRows[0] || {}).map((col) => (
                          <th key={col} className="px-2.5 py-1.5 font-semibold">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tRows.map((r, ri) => (
                        <tr key={ri} className="border-b border-[#f1f1ee] last:border-0 text-[#18181b]">
                          {Object.values(r).map((v, ci) => (
                            <td key={ci} className="px-2.5 py-1">
                              {v === null ? 'NULL' : String(v)}
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

        {/* 右ペイン：SQLエディタ＆結果 */}
        <div className="lg:col-span-7">
          <div className="rounded-lg border border-[#e4e4e0] bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#18181b]">
                SQLエディタ（Cmd / Ctrl + Enter で実行）
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSqlText(problem.starterSql)}
                  className="rounded-md border border-[#d4d4d0] bg-white px-2.5 py-1 text-xs text-[#52525b] hover:bg-[#f1f1ee]"
                >
                  初期文に戻す
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSqlText(problem.answerSql);
                    setShowAnswer(true);
                  }}
                  className="rounded-md border border-[#d4d4d0] bg-[#f6f6f4] px-2.5 py-1 text-xs font-semibold text-[#18181b] hover:bg-[#e4e4e0]"
                >
                  模範SQLを貼付
                </button>
              </div>
            </div>

            {/* コードエディタ（開発ツール枠としてダーク維持） */}
            <textarea
              value={sqlText}
              onChange={(e) => setSqlText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleExecute();
                }
              }}
              rows={11}
              spellCheck={false}
              className="w-full rounded-md border border-[#1e293b] bg-[#0f172a] p-3.5 font-mono text-xs sm:text-sm leading-relaxed text-[#e2e8f0] focus:border-[#38bdf8] focus:outline-none"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                disabled={running}
                onClick={handleExecute}
                className="rounded-md bg-[#18181b] px-5 py-2 text-xs font-semibold text-white hover:bg-[#27272a] disabled:opacity-50 transition"
              >
                {running ? '実行中...' : 'SQLを実行・採点'}
              </button>

              <button
                type="button"
                onClick={() => setShowAnswer((s) => !s)}
                className="rounded-md border border-[#d4d4d0] bg-white px-3 py-2 text-xs font-semibold text-[#52525b] hover:bg-[#f1f1ee]"
              >
                {showAnswer ? '解説を閉じる' : '解説・期待結果を表示'}
              </button>
            </div>

            {errorMsg && (
              <div className="rounded-md border border-[#fecdd3] bg-[#fff1f2] p-3 text-xs font-mono text-[#9f1239]">
                {errorMsg}
              </div>
            )}

            {result && (
              <div className="space-y-2.5">
                <div
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${
                    isCorrect
                      ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]'
                      : 'border-[#fde68a] bg-[#fffbeb] text-[#b45309]'
                  }`}
                >
                  <span>
                    {isCorrect
                      ? '期待結果と完全一致（合格）'
                      : '実行完了（期待結果と差分あり：列数・並び順・計算式を確認）'}
                  </span>
                  <span className="font-mono text-[11px] opacity-80">
                    [{result.engine}] {result.executionMs}ms / {result.rows.length}行
                  </span>
                </div>

                {result.note && <p className="text-[11px] text-[#71717a]">{result.note}</p>}

                <div className="overflow-x-auto rounded-md border border-[#e4e4e0] bg-white">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#e4e4e0] bg-[#f6f6f4] text-[#18181b]">
                        {result.columns.map((c, idx) => (
                          <th key={`${c}-${idx}`} className="px-3 py-2 font-bold">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, ri) => (
                        <tr key={ri} className="border-b border-[#f1f1ee] last:border-0 text-[#18181b]">
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-3 py-1.5">
                              {cell === null ? <span className="text-[#a1a1aa]">NULL</span> : String(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {showAnswer && (
              <div className="rounded-md border border-[#e4e4e0] bg-[#f6f6f4] p-3.5 space-y-2 text-xs">
                <div className="font-bold text-[#18181b]">午後試験の重要ポイント解説</div>
                <p className="text-[#3f3f46] leading-relaxed">{problem.explanation}</p>
                <div className="pt-1 font-bold text-[#52525b]">
                  期待出力（{problem.expectedResult.rows.length}行）
                </div>
                <div className="overflow-x-auto rounded border border-[#e4e4e0] bg-white">
                  <table className="w-full text-left text-[11px] font-mono">
                    <thead>
                      <tr className="border-b border-[#e4e4e0] bg-[#fafafa] text-[#52525b]">
                        {problem.expectedResult.columns.map((c) => (
                          <th key={c} className="px-2.5 py-1">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {problem.expectedResult.rows.map((r, ri) => (
                        <tr key={ri} className="border-b border-[#f1f1ee] last:border-0 text-[#18181b]">
                          {r.map((v, ci) => (
                            <td key={ci} className="px-2.5 py-1">
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
      </div>

      <WindowFrameCanvas
        preset={problem.windowPresetId === 'rank-compare' ? 'rank-compare' : 'moving-avg'}
      />
    </section>
  );
};
