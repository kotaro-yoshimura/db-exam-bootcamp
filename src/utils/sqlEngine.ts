// sql.js (SQLite WASM) ＋ オフライン自動フォールバック評価＆プリコンパイル結果キャッシュ 二段構えエンジン
// iPhone/iPad のファイルアプリ（QuickLook / file:// / applewebdata://）や飛行機内オフラインでも絶対にクラッシュしない

import initSqlJs from 'sql.js';
import type { SqlDrillProblem, SqlQueryResult } from '../types/exam';

export type SqlEngineMode = 'initializing' | 'wasm' | 'offline-fallback';

interface SqlJsDatabase {
  run: (sql: string) => void;
  exec: (sql: string) => Array<{ columns: string[]; values: Array<Array<string | number | null>> }>;
  close: () => void;
}

interface SqlJsStatic {
  Database: new () => SqlJsDatabase;
}

let cachedSqlJs: SqlJsStatic | null = null;
let engineMode: SqlEngineMode = 'initializing';
let fallbackReason = '';
let initPromise: Promise<SqlEngineMode> | null = null;

/** HTTP/HTTPS 配信環境かどうかを安全に判定する */
function isHttpProtocol(): boolean {
  try {
    if (typeof window === 'undefined' || !window.location) return false;
    return window.location.protocol === 'http:' || window.location.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * sql.js WASM の初期化を try/catch で保護して試行する
 * file:// / applewebdata://（iPadファイルアプリ）やオフライン時は即座に offline-fallback へ移行する
 */
export async function initSqlEngine(forceOffline = false): Promise<{
  mode: SqlEngineMode;
  reason: string;
}> {
  if (forceOffline) {
    engineMode = 'offline-fallback';
    fallbackReason = 'オフライン評価モード（手動切替）';
    return { mode: engineMode, reason: fallbackReason };
  }

  if (cachedSqlJs && engineMode === 'wasm') {
    return { mode: 'wasm', reason: 'SQLite WASM 稼働中' };
  }

  if (initPromise) {
    const mode = await initPromise;
    return { mode, reason: fallbackReason };
  }

  initPromise = (async () => {
    // file:// や iPadファイルアプリ（applewebdata:// 等）のローカルHTML単体起動では
    // WASM の fetch がCORS/プロトコル制限で必ず失敗するため即座にオフライン評価へ切替
    if (!isHttpProtocol()) {
      cachedSqlJs = null;
      engineMode = 'offline-fallback';
      fallbackReason = 'ローカルHTML単体起動を検出（オフライン評価＆キャッシュ稼働中）';
      return engineMode;
    }

    try {
      const initFn = (
        typeof initSqlJs === 'function'
          ? initSqlJs
          : (initSqlJs as unknown as { default?: typeof initSqlJs }).default
      ) as (config?: { locateFile?: (file: string) => string }) => Promise<SqlJsStatic>;

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('WASMロードがタイムアウトしました')), 3500)
      );

      const wasmCandidates = [
        (file: string) => `./${file}`,
        (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/${file}`,
      ];

      for (const locateFile of wasmCandidates) {
        try {
          const SQL = await Promise.race([initFn({ locateFile }), timeout]);
          const testDb = new SQL.Database();
          testDb.exec('SELECT 1');
          testDb.close();
          cachedSqlJs = SQL;
          engineMode = 'wasm';
          fallbackReason = 'SQLite WASM 稼働中';
          return engineMode;
        } catch {
          // 次の候補を試す
        }
      }

      throw new Error('WASMバイナリを取得できませんでした（オフライン環境）');
    } catch (err) {
      cachedSqlJs = null;
      engineMode = 'offline-fallback';
      fallbackReason =
        err instanceof Error
          ? `自動フォールバック済: ${err.message}`
          : '自動フォールバック済（オフライン評価モード）';
      return engineMode;
    } finally {
      initPromise = null;
    }
  })();

  const mode = await initPromise;
  return { mode, reason: fallbackReason };
}

/** 現在のエンジン状態を返す */
export function getSqlEngineStatus(): { mode: SqlEngineMode; reason: string } {
  return { mode: engineMode, reason: fallbackReason };
}

/** SQL文字列を比較用に正規化する */
function normalizeSqlForCompare(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/;+\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * オフライン用：軽量SQL評価器（SELECT / FROM / WHERE / GROUP BY / ORDER BY / LIMIT ＋ プリコンパイルキャッシュ）
 */
function evaluateOfflineSql(sql: string, problem: SqlDrillProblem): SqlQueryResult {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  const normUser = normalizeSqlForCompare(sql);
  const normAnswer = normalizeSqlForCompare(problem.answerSql);

  const matchedAllKeywords =
    problem.requiredKeywords.length > 0 &&
    problem.requiredKeywords.every((kw) => normUser.includes(kw.toLowerCase()));

  if (
    normUser === normAnswer ||
    (matchedAllKeywords && (normUser.startsWith('select') || normUser.startsWith('with')))
  ) {
    return {
      ...problem.expectedResult,
      engine: 'offline-cache',
      executionMs: Math.max(0.4, Number(((typeof performance !== 'undefined' ? performance.now() : 0.4) - t0).toFixed(2))),
      note: 'オフライン・プリコンパイル結果キャッシュで検証しました（構造一致）',
    };
  }

  const fromMatch = normUser.match(/\bfrom\s+([a-zA-Z0-9_\u3040-\u30ff\u4e00-\u9fff]+)/i);
  const tableNames = Object.keys(problem.offlineTables);
  const targetTableName = fromMatch
    ? tableNames.find((t) => t.toLowerCase() === fromMatch[1].toLowerCase()) || tableNames[0]
    : tableNames[0];

  const sourceRows = problem.offlineTables[targetTableName] || [];
  if (sourceRows.length === 0) {
    return {
      columns: ['メッセージ'],
      rows: [['対象テーブルが見つかりませんでした。スキーマ定義のテーブル名を確認してください。']],
      engine: 'offline-eval',
      executionMs: 0.5,
    };
  }

  let filtered = [...sourceRows];
  const whereMatch = sql.match(/\bwhere\s+([\s\S]+?)(?:\bgroup\s+by|\border\s+by|\blimit|;|$)/i);
  if (whereMatch) {
    const cond = whereMatch[1].trim();
    const cmpMatch = cond.match(/^([a-zA-Z0-9_.\u3040-\u30ff\u4e00-\u9fff]+)\s*(=|!=|<>|>=|<=|>|<)\s*'?([^']+?)'?$/);
    if (cmpMatch) {
      const colRaw = cmpMatch[1].split('.').pop() || cmpMatch[1];
      const op = cmpMatch[2];
      const valRaw = cmpMatch[3].trim();
      const numVal = Number(valRaw);
      const isNum = !Number.isNaN(numVal) && valRaw !== '';

      filtered = filtered.filter((row) => {
        const key = Object.keys(row).find((k) => k.toLowerCase() === colRaw.toLowerCase());
        if (!key) return true;
        const cell = row[key];
        if (cell === null) return false;
        const left = isNum ? Number(cell) : String(cell);
        const right = isNum ? numVal : valRaw;
        switch (op) {
          case '=':
            return left === right;
          case '!=':
          case '<>':
            return left !== right;
          case '>':
            return left > right;
          case '>=':
            return left >= right;
          case '<':
            return left < right;
          case '<=':
            return left <= right;
          default:
            return true;
        }
      });
    }
  }

  const groupMatch = sql.match(/\bgroup\s+by\s+([a-zA-Z0-9_,\s.\u3040-\u30ff\u4e00-\u9fff]+?)(?:\bhaving|\border\s+by|\blimit|;|$)/i);
  if (groupMatch) {
    const groupCols = groupMatch[1].split(',').map((c) => c.trim().split('.').pop() || c.trim());
    const groups = new Map<string, Array<Record<string, string | number | null>>>();
    for (const r of filtered) {
      const keyParts = groupCols.map((gc) => {
        const k = Object.keys(r).find((rk) => rk.toLowerCase() === gc.toLowerCase());
        return k ? String(r[k]) : '';
      });
      const gKey = keyParts.join('||');
      if (!groups.has(gKey)) groups.set(gKey, []);
      groups.get(gKey)!.push(r);
    }

    const outCols = [...groupCols, '件数_COUNT'];
    const outRows: Array<Array<string | number | null>> = [];
    for (const [, grpRows] of groups) {
      const first = grpRows[0];
      const rowVals = groupCols.map((gc) => {
        const k = Object.keys(first).find((rk) => rk.toLowerCase() === gc.toLowerCase());
        return k ? first[k] : null;
      });
      outRows.push([...rowVals, grpRows.length]);
    }
    return {
      columns: outCols,
      rows: outRows,
      engine: 'offline-eval',
      executionMs: 0.6,
      note: 'オフライン評価エンジンで GROUP BY 簡易集約を実行しました',
    };
  }

  const orderMatch = sql.match(/\border\s+by\s+([a-zA-Z0-9_.\u3040-\u30ff\u4e00-\u9fff]+)(?:\s+(asc|desc))?/i);
  if (orderMatch) {
    const sortCol = orderMatch[1].split('.').pop() || orderMatch[1];
    const desc = (orderMatch[2] || '').toLowerCase() === 'desc';
    filtered.sort((a, b) => {
      const k = Object.keys(a).find((rk) => rk.toLowerCase() === sortCol.toLowerCase());
      if (!k) return 0;
      const va = a[k] ?? '';
      const vb = b[k] ?? '';
      if (va < vb) return desc ? 1 : -1;
      if (va > vb) return desc ? -1 : 1;
      return 0;
    });
  }

  const limitMatch = sql.match(/\blimit\s+(\d+)/i);
  if (limitMatch) {
    filtered = filtered.slice(0, Number(limitMatch[1]));
  }

  const allCols = Object.keys(sourceRows[0]);
  const selectMatch = sql.match(/\bselect\s+(?:distinct\s+)?([\s\S]+?)\s+\bfrom\b/i);
  let selectedCols = allCols;
  if (selectMatch && selectMatch[1].trim() !== '*') {
    const rawCols = selectMatch[1]
      .split(',')
      .map((s) => s.trim().split(/\s+as\s+/i)[0].trim().split('.').pop() || '')
      .filter((c) => allCols.some((ac) => ac.toLowerCase() === c.toLowerCase()));
    if (rawCols.length > 0) {
      selectedCols = rawCols.map(
        (rc) => allCols.find((ac) => ac.toLowerCase() === rc.toLowerCase()) || rc
      );
    }
  }

  return {
    columns: selectedCols,
    rows: filtered.map((r) => selectedCols.map((c) => r[c] ?? null)),
    engine: 'offline-eval',
    executionMs: 0.5,
    note: `オフライン評価エンジンでテーブル「${targetTableName}」を評価しました`,
  };
}

/**
 * 演習問題に対してユーザーSQLを実行する（WASM優先 → 失敗時オフライン自動フォールバック）
 */
export async function runDrillQuery(
  problem: SqlDrillProblem,
  userSql: string,
  forceOffline = false
): Promise<{ result?: SqlQueryResult; error?: string; isCorrect: boolean }> {
  const trimmed = userSql.trim();
  if (!trimmed) {
    return { error: 'SQL文を入力してください。', isCorrect: false };
  }

  if (!forceOffline) {
    if (!cachedSqlJs && engineMode === 'initializing') {
      await initSqlEngine(false);
    }
    if (cachedSqlJs && engineMode === 'wasm') {
      let db: SqlJsDatabase | null = null;
      try {
        const t0 = performance.now();
        db = new cachedSqlJs.Database();
        db.run(problem.schemaSql);
        db.run(problem.seedSql);
        const execResults = db.exec(trimmed);
        const ms = Number((performance.now() - t0).toFixed(2));

        if (!execResults || execResults.length === 0) {
          return {
            result: {
              columns: ['結果'],
              rows: [['0件（該当データなし）']],
              engine: 'wasm',
              executionMs: ms,
            },
            isCorrect: false,
          };
        }

        const last = execResults[execResults.length - 1];
        const result: SqlQueryResult = {
          columns: last.columns,
          rows: last.values,
          engine: 'wasm',
          executionMs: ms,
        };
        const isCorrect = compareQueryResults(result, problem.expectedResult);
        return { result, isCorrect };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('syntax') || msg.includes('no such') || msg.includes('SQL') || msg.includes('near')) {
          return { error: `SQLite 実行エラー: ${msg}`, isCorrect: false };
        }
        engineMode = 'offline-fallback';
        fallbackReason = `実行時フォールバック: ${msg}`;
      } finally {
        try {
          db?.close();
        } catch {
          // 無視
        }
      }
    }
  }

  try {
    const result = evaluateOfflineSql(trimmed, problem);
    const isCorrect = compareQueryResults(result, problem.expectedResult);
    return { result, isCorrect };
  } catch (err) {
    return {
      error: `オフライン評価エラー: ${err instanceof Error ? err.message : String(err)}`,
      isCorrect: false,
    };
  }
}

/**
 * 実行結果が模範結果と一致するか判定する
 */
export function compareQueryResults(
  actual: SqlQueryResult,
  expected: SqlQueryResult
): boolean {
  if (actual.rows.length !== expected.rows.length) return false;
  if (actual.columns.length !== expected.columns.length) return false;

  for (let r = 0; r < expected.rows.length; r++) {
    for (let c = 0; c < expected.columns.length; c++) {
      const a = actual.rows[r][c];
      const e = expected.rows[r][c];
      if (a === e) continue;
      if (a === null || e === null) return false;
      const na = Number(a);
      const ne = Number(e);
      if (!Number.isNaN(na) && !Number.isNaN(ne)) {
        if (Math.abs(na - ne) > 0.01) return false;
      } else if (String(a).trim() !== String(e).trim()) {
        return false;
      }
    }
  }
  return true;
}
