// GitHub 非公開 Gist を使った無料・端末間自動同期クライアント
// トークンは各端末の localStorage 専用キーのみに保存し、学習JSONや公開サイトには一切含めない

import type { CardStatus, ReviewQueueItem, StudyState } from '../types/exam';
import { validateStudyState } from './syncCodec';

const CONFIG_STORAGE_KEY = 'db_spec_bootcamp_gist_sync_config_v1';
export const GIST_SYNC_FILENAME = 'db-exam-bootcamp-sync-v1.json';
const GIST_DESCRIPTION = 'DBスペシャリスト学習ノート 自動同期データ（非公開）';
const GITHUB_API_BASE = 'https://api.github.com';

export interface GistSyncConfig {
  /** GitHub Personal Access Token (gist スコープのみ) */
  token: string;
  /** 自動検出または作成された非公開GistのID */
  gistId: string;
  /** 自動同期の有効/無効 */
  autoSync: boolean;
  /** 接続確認済みのGitHubユーザー名（表示用） */
  username?: string;
  /** 最終同期成功時刻（ISO文字列） */
  lastSyncedAt?: string;
  /** 最後にクラウドと一致した StudyState.updatedAt */
  lastSyncedStateUpdatedAt?: string;
  /** 最後にクラウドから取得/送信した Gist.updated_at */
  lastRemoteGistUpdatedAt?: string;
}

export interface GistFilePayload {
  gistId: string;
  gistHtmlUrl: string;
  remoteGistUpdatedAt: string;
  state: StudyState | null;
}

/** 学習進捗が1件以上存在するかを判定（初期空データでクラウドを上書きしないためのガード） */
export function hasStudyProgress(state: StudyState): boolean {
  return (
    state.completedRoadmapTasks.length > 0 ||
    state.solvedSqlDrills.length > 0 ||
    state.solvedSchemaQuizzes.length > 0 ||
    state.reviewQueue.length > 0 ||
    Object.keys(state.cbtDrafts).length > 0 ||
    Object.keys(state.flashcardStatus).length > 0 ||
    state.totalAttempts > 0
  );
}

/**
 * ローカルとリモートの学習状態を非破壊でマージする（複数端末のオフライン同時編集向け）
 * 達成済み項目は和集合で保持し、個別更新項目はタイムスタンプが新しい方を優先する
 */
export function mergeStudyStates(local: StudyState, remote: StudyState): StudyState {
  const localTime = Date.parse(local.updatedAt) || 0;
  const remoteTime = Date.parse(remote.updatedAt) || 0;
  const newer = localTime >= remoteTime ? local : remote;
  const older = localTime >= remoteTime ? remote : local;

  // 完了タスク・演習IDは和集合（どちらも失わない）
  const completedRoadmapTasks = Array.from(
    new Set([...older.completedRoadmapTasks, ...newer.completedRoadmapTasks])
  );
  const solvedSqlDrills = Array.from(
    new Set([...older.solvedSqlDrills, ...newer.solvedSqlDrills])
  );
  const solvedSchemaQuizzes = Array.from(
    new Set([...older.solvedSchemaQuizzes, ...newer.solvedSchemaQuizzes])
  );

  // CBT下書き：片方のみ存在するものは残し、両方にある場合は新しい端末側を優先（空文字で非空を消さない）
  const cbtDrafts: Record<string, string> = { ...older.cbtDrafts };
  for (const [k, v] of Object.entries(newer.cbtDrafts)) {
    if (v.trim().length > 0 || !(k in cbtDrafts)) {
      cbtDrafts[k] = v;
    }
  }

  // 弱点復習キュー：アイテムごとに updatedAt が新しい方を採用
  const reviewMap = new Map<string, ReviewQueueItem>();
  for (const item of older.reviewQueue) {
    reviewMap.set(item.id, item);
  }
  for (const item of newer.reviewQueue) {
    const prev = reviewMap.get(item.id);
    if (!prev) {
      reviewMap.set(item.id, item);
    } else {
      const prevTs = Date.parse(prev.updatedAt) || 0;
      const nextTs = Date.parse(item.updatedAt) || 0;
      reviewMap.set(item.id, nextTs >= prevTs ? item : prev);
    }
  }
  const reviewQueue = Array.from(reviewMap.values()).sort(
    (a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0)
  );

  // フラッシュカード：unseen より学習済み（review/mastered）を保持しつつ、両方設定済みなら新しい端末側を採用
  const flashcardStatus: Record<string, CardStatus> = { ...older.flashcardStatus };
  for (const [cardId, status] of Object.entries(newer.flashcardStatus)) {
    const prev = flashcardStatus[cardId];
    if (!prev || prev === 'unseen' || status !== 'unseen') {
      flashcardStatus[cardId] = status;
    }
  }

  return {
    version: 1,
    updatedAt: new Date(Math.max(localTime, remoteTime, Date.now())).toISOString(),
    completedRoadmapTasks,
    solvedSqlDrills,
    solvedSchemaQuizzes,
    cbtDrafts,
    reviewQueue,
    flashcardStatus,
    totalAttempts: Math.max(local.totalAttempts, remote.totalAttempts),
    lastModule: newer.lastModule || older.lastModule || 'home',
  };
}

/** 同期設定を localStorage から安全に読み込む */
export function loadGistSyncConfig(): GistSyncConfig | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GistSyncConfig>;
    if (!parsed || typeof parsed.token !== 'string' || !parsed.token.trim()) return null;
    return {
      token: parsed.token.trim(),
      gistId: typeof parsed.gistId === 'string' ? parsed.gistId.trim() : '',
      autoSync: parsed.autoSync !== false,
      username: typeof parsed.username === 'string' ? parsed.username : undefined,
      lastSyncedAt: typeof parsed.lastSyncedAt === 'string' ? parsed.lastSyncedAt : undefined,
      lastSyncedStateUpdatedAt:
        typeof parsed.lastSyncedStateUpdatedAt === 'string'
          ? parsed.lastSyncedStateUpdatedAt
          : undefined,
      lastRemoteGistUpdatedAt:
        typeof parsed.lastRemoteGistUpdatedAt === 'string'
          ? parsed.lastRemoteGistUpdatedAt
          : undefined,
    };
  } catch {
    return null;
  }
}

/** 同期設定を localStorage へ保存（null で完全削除） */
export function saveGistSyncConfig(config: GistSyncConfig | null): void {
  try {
    if (typeof window === 'undefined') return;
    if (!config) {
      window.localStorage.removeItem(CONFIG_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ストレージ制限時は無視
  }
}

function buildHeaders(token: string): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token.trim()}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function githubFetch<T>(
  path: string,
  token: string,
  init: RequestInit = {}
): Promise<T> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 12000) : null;
  try {
    const res = await fetch(`${GITHUB_API_BASE}${path}`, {
      ...init,
      cache: 'no-store',
      signal: controller?.signal,
      headers: {
        ...buildHeaders(token),
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers as Record<string, string> | undefined),
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('トークンが無効または期限切れです（GitHub認証エラー 401）');
      }
      if (res.status === 403) {
        throw new Error('トークンに gist 権限がないか、API制限中です（403）');
      }
      if (res.status === 404) {
        throw new Error('対象の非公開Gistが見つかりませんでした（404）');
      }
      throw new Error(`GitHub API エラー（HTTP ${res.status}）`);
    }

    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('GitHubへの接続がタイムアウトしました（回線状況を確認してください）');
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

interface RawGistFile {
  filename?: string;
  content?: string;
  truncated?: boolean;
  raw_url?: string;
}

interface RawGistResponse {
  id: string;
  html_url: string;
  updated_at: string;
  files?: Record<string, RawGistFile>;
}

/** トークンの有効性とGitHubユーザー名を確認する（/user 権限が無いトークンでも /gists 可なら続行） */
export async function verifyGithubToken(token: string): Promise<{ username: string }> {
  try {
    const user = await githubFetch<{ login?: string }>('/user', token);
    return { username: user.login || 'GitHubアカウント' };
  } catch (err) {
    // 401（認証失敗）だけは即エラーとして返す
    if (err instanceof Error && err.message.includes('401')) {
      throw err;
    }
    return { username: 'GitHubアカウント' };
  }
}

/** 既存の同期用非公開Gistをファイル名で自動検索する（2台目以降の端末でID入力不要） */
export async function findExistingSyncGist(token: string): Promise<string | null> {
  const list = await githubFetch<RawGistResponse[]>('/gists?per_page=50', token);
  const matched = list.find(
    (g) => g.files && Object.prototype.hasOwnProperty.call(g.files, GIST_SYNC_FILENAME)
  );
  return matched ? matched.id : null;
}

/** 指定した非公開Gistから学習データを取得する */
export async function fetchGistStudyState(
  token: string,
  gistId: string
): Promise<GistFilePayload> {
  const gist = await githubFetch<RawGistResponse>(`/gists/${encodeURIComponent(gistId)}`, token);
  const file = gist.files?.[GIST_SYNC_FILENAME];
  let content = file?.content || '';

  if (file?.truncated && file.raw_url) {
    const rawRes = await fetch(file.raw_url, { cache: 'no-store' });
    if (rawRes.ok) {
      content = await rawRes.text();
    }
  }

  let parsedState: StudyState | null = null;
  if (content.trim()) {
    try {
      parsedState = validateStudyState(JSON.parse(content));
    } catch {
      parsedState = null;
    }
  }

  return {
    gistId: gist.id,
    gistHtmlUrl: gist.html_url,
    remoteGistUpdatedAt: gist.updated_at,
    state: parsedState,
  };
}

/** 新規の非公開（Secret）Gist を作成して現在の学習データを保存する */
export async function createSecretSyncGist(
  token: string,
  state: StudyState
): Promise<GistFilePayload> {
  const created = await githubFetch<RawGistResponse>('/gists', token, {
    method: 'POST',
    body: JSON.stringify({
      description: GIST_DESCRIPTION,
      public: false,
      files: {
        [GIST_SYNC_FILENAME]: {
          content: JSON.stringify(state, null, 2),
        },
      },
    }),
  });

  return {
    gistId: created.id,
    gistHtmlUrl: created.html_url,
    remoteGistUpdatedAt: created.updated_at,
    state,
  };
}

/** 既存の非公開Gistへ学習データを上書き保存する */
export async function updateSecretSyncGist(
  token: string,
  gistId: string,
  state: StudyState
): Promise<GistFilePayload> {
  const updated = await githubFetch<RawGistResponse>(
    `/gists/${encodeURIComponent(gistId)}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify({
        description: GIST_DESCRIPTION,
        files: {
          [GIST_SYNC_FILENAME]: {
            content: JSON.stringify(state, null, 2),
          },
        },
      }),
    }
  );

  return {
    gistId: updated.id,
    gistHtmlUrl: updated.html_url,
    remoteGistUpdatedAt: updated.updated_at,
    state,
  };
}
