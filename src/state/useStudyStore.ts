// 学習履歴・進捗・弱点復習キュー・Base64クリップボード同期 ＆ GitHub非公開Gist自動同期ストア
import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  StudyState,
  ReviewQueueItem,
  CardStatus,
  ModuleId,
} from '../types/exam';
import {
  encodeSyncCode,
  decodeSyncCode,
  validateStudyState,
} from '../utils/syncCodec';
import {
  createSecretSyncGist,
  fetchGistStudyState,
  findExistingSyncGist,
  hasStudyProgress,
  loadGistSyncConfig,
  mergeStudyStates,
  saveGistSyncConfig,
  updateSecretSyncGist,
  verifyGithubToken,
  type GistSyncConfig,
} from '../utils/gistSync';

const STORAGE_KEY = 'db_spec_bootcamp_state_v1';
const INITIAL_EPOCH_ISO = '1970-01-01T00:00:00.000Z';

/** 初期学習状態（空状態が既存クラウドデータより新しいと誤認されないようエポック時刻を使用） */
export function createInitialStudyState(): StudyState {
  return {
    version: 1,
    updatedAt: INITIAL_EPOCH_ISO,
    completedRoadmapTasks: [],
    solvedSqlDrills: [],
    solvedSchemaQuizzes: [],
    cbtDrafts: {},
    reviewQueue: [],
    flashcardStatus: {},
    totalAttempts: 0,
    lastModule: 'home',
  };
}

/** localStorageから安全に復元する */
function loadFromStorage(): StudyState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialStudyState();
    return validateStudyState(JSON.parse(raw));
  } catch {
    return createInitialStudyState();
  }
}

/** localStorageへ安全に保存する */
function saveToStorage(state: StudyState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // プライベートブラウズ等で保存不可でもクラッシュさせない
  }
}

export type CloudSyncPhase = 'unconfigured' | 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export interface CloudSyncController {
  configured: boolean;
  autoSync: boolean;
  phase: CloudSyncPhase;
  username?: string;
  gistId?: string;
  lastSyncedAt?: string;
  pendingLocalChanges: boolean;
  message: string;
  /** GitHubトークンで非公開Gistへ接続・初回同期を行う */
  connect: (token: string, optionalGistId?: string) => Promise<{ ok: boolean; message: string }>;
  /** 今すぐ手動同期を実行する */
  syncNow: () => Promise<{ ok: boolean; message: string }>;
  /** 自動同期のON/OFFを切り替える */
  setAutoSync: (enabled: boolean) => void;
  /** 端末からトークンを削除して連携を解除する（クラウド側のGist自体は残る） */
  disconnect: () => void;
}

export interface StudyStore {
  state: StudyState;
  /** ロードマップタスクの完了トグル */
  toggleRoadmapTask: (taskId: string) => void;
  /** SQL道場の正解を記録 */
  markSqlDrillSolved: (drillId: string) => void;
  /** スキーマ・正規化クイズの正解を記録 */
  markSchemaQuizSolved: (quizId: string) => void;
  /** CBT記述下書きを保存 */
  saveCbtDraft: (questionId: string, text: string) => void;
  /** 弱点復習キューへ登録（誤答時：連続満点数を0へリセット） */
  recordReviewMiss: (
    item: Omit<ReviewQueueItem, 'consecutivePerfect' | 'missCount' | 'graduated' | 'updatedAt'>
  ) => void;
  /** 弱点復習キューで満点を記録（2回連続満点で卒業） */
  recordReviewPerfect: (id: string, userAnswer?: string) => { graduatedNow: boolean; count: number };
  /** 卒業済み弱点アイテムを復習キューへ復帰させる */
  requeueReviewItem: (id: string) => void;
  /** フラッシュカードの習得ステータス更新 */
  setFlashcardStatus: (cardId: string, status: CardStatus) => void;
  /** 最終アクセスモジュール記録 */
  setLastModule: (moduleId: ModuleId) => void;
  /** 累計演習回数の加算 */
  incrementAttempts: () => void;
  /** Base64圧縮同期コード生成 */
  generateSyncCode: () => string;
  /** Base64圧縮同期コードから復元 */
  restoreFromSyncCode: (code: string) => { ok: boolean; message: string };
  /** JSONエクスポート文字列生成 */
  exportJson: () => string;
  /** JSONから復元 */
  importJson: (jsonText: string) => { ok: boolean; message: string };
  /** 直前の状態へ戻す（誤同期時のロールバック） */
  canUndoSync: boolean;
  undoLastSync: () => void;
  /** GitHub非公開Gistによる自動同期コントローラ */
  cloudSync: CloudSyncController;
}

export function useStudyStore(): StudyStore {
  const [state, setState] = useState<StudyState>(() => loadFromStorage());
  const [backupBeforeSync, setBackupBeforeSync] = useState<StudyState | null>(null);

  // GitHub非公開Gist自動同期の状態管理
  const [gistConfig, setGistConfig] = useState<GistSyncConfig | null>(() => loadGistSyncConfig());
  const [syncPhase, setSyncPhase] = useState<CloudSyncPhase>(() =>
    loadGistSyncConfig() ? 'idle' : 'unconfigured'
  );
  const [syncMessage, setSyncMessage] = useState<string>(() =>
    loadGistSyncConfig() ? '自動同期が有効です' : '未設定（GitHub非公開Gistで無料自動同期できます）'
  );
  const [pendingLocalChanges, setPendingLocalChanges] = useState<boolean>(false);

  const stateRef = useRef<StudyState>(state);
  const configRef = useRef<GistSyncConfig | null>(gistConfig);
  const syncInFlightRef = useRef<boolean>(false);
  const lastSyncCheckMsRef = useRef<number>(0);
  const applyingRemoteUpdatedAtRef = useRef<string | null>(null);
  const prevStateUpdatedAtRef = useRef<string>(state.updatedAt);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    configRef.current = gistConfig;
  }, [gistConfig]);

  // 変更があるたびにlocalStorageへ自動保存
  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  const toggleRoadmapTask = useCallback((taskId: string) => {
    setState((prev) => {
      const exists = prev.completedRoadmapTasks.includes(taskId);
      const nextTasks = exists
        ? prev.completedRoadmapTasks.filter((id) => id !== taskId)
        : [...prev.completedRoadmapTasks, taskId];
      return {
        ...prev,
        completedRoadmapTasks: nextTasks,
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const markSqlDrillSolved = useCallback((drillId: string) => {
    setState((prev) => {
      const next = prev.solvedSqlDrills.includes(drillId)
        ? prev.solvedSqlDrills
        : [...prev.solvedSqlDrills, drillId];
      return {
        ...prev,
        solvedSqlDrills: next,
        totalAttempts: prev.totalAttempts + 1,
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const markSchemaQuizSolved = useCallback((quizId: string) => {
    setState((prev) => {
      const next = prev.solvedSchemaQuizzes.includes(quizId)
        ? prev.solvedSchemaQuizzes
        : [...prev.solvedSchemaQuizzes, quizId];
      return {
        ...prev,
        solvedSchemaQuizzes: next,
        totalAttempts: prev.totalAttempts + 1,
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const saveCbtDraft = useCallback((questionId: string, text: string) => {
    setState((prev) => ({
      ...prev,
      cbtDrafts: {
        ...prev.cbtDrafts,
        [questionId]: text,
      },
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const recordReviewMiss = useCallback(
    (
      item: Omit<ReviewQueueItem, 'consecutivePerfect' | 'missCount' | 'graduated' | 'updatedAt'>
    ) => {
      const now = new Date().toISOString();
      setState((prev) => {
        const idx = prev.reviewQueue.findIndex((q) => q.id === item.id);
        let nextQueue: ReviewQueueItem[];
        if (idx >= 0) {
          nextQueue = prev.reviewQueue.map((q, i) =>
            i === idx
              ? {
                  ...q,
                  ...item,
                  consecutivePerfect: 0,
                  missCount: q.missCount + 1,
                  graduated: false,
                  updatedAt: now,
                }
              : q
          );
        } else {
          nextQueue = [
            {
              ...item,
              consecutivePerfect: 0,
              missCount: 1,
              graduated: false,
              updatedAt: now,
            },
            ...prev.reviewQueue,
          ];
        }
        return {
          ...prev,
          reviewQueue: nextQueue,
          totalAttempts: prev.totalAttempts + 1,
          updatedAt: now,
        };
      });
    },
    []
  );

  const recordReviewPerfect = useCallback(
    (id: string, userAnswer?: string): { graduatedNow: boolean; count: number } => {
      let result = { graduatedNow: false, count: 1 };
      const now = new Date().toISOString();
      setState((prev) => {
        const nextQueue = prev.reviewQueue.map((q) => {
          if (q.id !== id) return q;
          const nextCount = q.consecutivePerfect + 1;
          const graduated = nextCount >= 2;
          result = { graduatedNow: graduated && !q.graduated, count: nextCount };
          return {
            ...q,
            consecutivePerfect: nextCount,
            graduated,
            lastUserAnswer: userAnswer ?? q.lastUserAnswer,
            updatedAt: now,
          };
        });
        return {
          ...prev,
          reviewQueue: nextQueue,
          totalAttempts: prev.totalAttempts + 1,
          updatedAt: now,
        };
      });
      return result;
    },
    []
  );

  const requeueReviewItem = useCallback((id: string) => {
    const now = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      reviewQueue: prev.reviewQueue.map((q) =>
        q.id === id ? { ...q, consecutivePerfect: 0, graduated: false, updatedAt: now } : q
      ),
      updatedAt: now,
    }));
  }, []);

  const setFlashcardStatus = useCallback((cardId: string, status: CardStatus) => {
    setState((prev) => ({
      ...prev,
      flashcardStatus: {
        ...prev.flashcardStatus,
        [cardId]: status,
      },
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const setLastModule = useCallback((moduleId: ModuleId) => {
    setState((prev) => {
      if (prev.lastModule === moduleId) return prev;
      return {
        ...prev,
        lastModule: moduleId,
      };
    });
  }, []);

  const incrementAttempts = useCallback(() => {
    setState((prev) => ({
      ...prev,
      totalAttempts: prev.totalAttempts + 1,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const generateSyncCode = useCallback(() => encodeSyncCode(state), [state]);

  const restoreFromSyncCode = useCallback(
    (code: string): { ok: boolean; message: string } => {
      try {
        const decoded = decodeSyncCode(code);
        setBackupBeforeSync(state);
        setState({
          ...decoded,
          updatedAt: new Date().toISOString(),
        });
        return {
          ok: true,
          message: `同期完了（弱点キュー ${decoded.reviewQueue.length}件・ロードマップ完了 ${decoded.completedRoadmapTasks.length}件・フラッシュカード ${Object.keys(decoded.flashcardStatus).length}件）`,
        };
      } catch (err) {
        return {
          ok: false,
          message: err instanceof Error ? err.message : '同期コードの復元に失敗しました',
        };
      }
    },
    [state]
  );

  const exportJson = useCallback(() => JSON.stringify(state, null, 2), [state]);

  const importJson = useCallback(
    (jsonText: string): { ok: boolean; message: string } => {
      try {
        const parsed = validateStudyState(JSON.parse(jsonText));
        const originalUpdatedAt = parsed.updatedAt;
        setBackupBeforeSync(state);
        setState({
          ...parsed,
          updatedAt: new Date().toISOString(),
        });
        return {
          ok: true,
          message: `JSON復元完了（バックアップ日時: ${new Date(originalUpdatedAt).toLocaleString('ja-JP')}）`,
        };
      } catch (err) {
        return {
          ok: false,
          message: err instanceof Error ? err.message : 'JSONファイルの読み込みに失敗しました',
        };
      }
    },
    [state]
  );

  const undoLastSync = useCallback(() => {
    if (!backupBeforeSync) return;
    setState({
      ...backupBeforeSync,
      updatedAt: new Date().toISOString(),
    });
    setBackupBeforeSync(null);
  }, [backupBeforeSync]);

  /** 設定を状態と localStorage の両方へ反映 */
  const persistGistConfig = useCallback((next: GistSyncConfig | null) => {
    configRef.current = next;
    setGistConfig(next);
    saveGistSyncConfig(next);
  }, []);

  /**
   * クラウド（非公開Gist）とローカルの安全同期サイクルを実行する
   * - 初期空データで既存クラウドデータを上書きしない
   * - 2端末でオフライン同時学習した場合は非破壊マージで両方の進捗を保持する
   */
  const executeCloudSync = useCallback(
    async (overrideConfig?: GistSyncConfig): Promise<{ ok: boolean; message: string }> => {
      const cfg = overrideConfig ?? configRef.current;
      if (!cfg || !cfg.token || !cfg.gistId) {
        return { ok: false, message: 'GitHub自動同期が未設定です。' };
      }

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setSyncPhase('offline');
        setSyncMessage('オフライン中（ネット復帰時に自動で同期します）');
        return { ok: false, message: 'オフラインのため待機中です（ローカルへ保存済）' };
      }

      if (syncInFlightRef.current) {
        return { ok: true, message: '同期を実行中です...' };
      }

      syncInFlightRef.current = true;
      lastSyncCheckMsRef.current = Date.now();
      setSyncPhase('syncing');
      setSyncMessage('GitHub 非公開Gist と同期中...');

      try {
        const remote = await fetchGistStudyState(cfg.token, cfg.gistId);
        const local = stateRef.current;
        const localHasData = hasStudyProgress(local);
        const remoteHasData = Boolean(remote.state && hasStudyProgress(remote.state));

        let finalState = local;
        let finalRemoteGistUpdatedAt = remote.remoteGistUpdatedAt;
        let resultMsg = '最新状態と同期済みです';

        if (!remote.state || !remoteHasData) {
          // リモートが空：ローカルに進捗があればアップロード
          if (localHasData) {
            const uploaded = await updateSecretSyncGist(cfg.token, cfg.gistId, local);
            finalRemoteGistUpdatedAt = uploaded.remoteGistUpdatedAt;
            resultMsg = 'この端末の学習履歴をクラウドへ保存しました';
          }
        } else if (!localHasData) {
          // ローカルが空でリモートにデータあり：無条件でリモートを取り込む
          finalState = remote.state;
          applyingRemoteUpdatedAtRef.current = finalState.updatedAt;
          setBackupBeforeSync(local);
          setState(finalState);
          resultMsg = 'クラウドから最新の学習履歴を取り込みました';
        } else if (local.updatedAt === remote.state.updatedAt) {
          // 完全に同一状態
          resultMsg = 'クラウドと最新状態で一致しています';
        } else {
          // 両方に進捗あり：競合・初回合流・片側更新を判定
          const localTs = Date.parse(local.updatedAt) || 0;
          const remoteTs = Date.parse(remote.state.updatedAt) || 0;
          const lastSyncedStateTs = Date.parse(cfg.lastSyncedStateUpdatedAt || '') || 0;

          const isFirstJoinOnThisDevice = !cfg.lastRemoteGistUpdatedAt;
          const remoteChangedSinceLastSync = Boolean(
            cfg.lastRemoteGistUpdatedAt && cfg.lastRemoteGistUpdatedAt !== remote.remoteGistUpdatedAt
          );
          const localChangedSinceLastSync = localTs > lastSyncedStateTs;

          if (
            isFirstJoinOnThisDevice ||
            (remoteChangedSinceLastSync && localChangedSinceLastSync)
          ) {
            // 初回合流 または 複数端末の同時学習（競合）：非破壊マージで両方を統合
            finalState = mergeStudyStates(local, remote.state);
            applyingRemoteUpdatedAtRef.current = finalState.updatedAt;
            setBackupBeforeSync(local);
            setState(finalState);
            const uploaded = await updateSecretSyncGist(cfg.token, cfg.gistId, finalState);
            finalRemoteGistUpdatedAt = uploaded.remoteGistUpdatedAt;
            resultMsg = '複数端末の学習履歴を安全に統合し、クラウドへ保存しました';
          } else if (remoteTs > localTs && !localChangedSinceLastSync) {
            // リモートのみ新しい：そのままローカルへ反映
            finalState = remote.state;
            applyingRemoteUpdatedAtRef.current = finalState.updatedAt;
            setBackupBeforeSync(local);
            setState(finalState);
            resultMsg = '別端末の最新履歴を自動で反映しました';
          } else {
            // ローカルが新しい：クラウドへ保存
            const uploaded = await updateSecretSyncGist(cfg.token, cfg.gistId, local);
            finalRemoteGistUpdatedAt = uploaded.remoteGistUpdatedAt;
            resultMsg = '最新の学習履歴をクラウドへ自動保存しました';
          }
        }

        const nowIso = new Date().toISOString();
        const updatedConfig: GistSyncConfig = {
          ...cfg,
          lastSyncedAt: nowIso,
          lastSyncedStateUpdatedAt: finalState.updatedAt,
          lastRemoteGistUpdatedAt: finalRemoteGistUpdatedAt,
        };
        persistGistConfig(updatedConfig);
        const hasNewerLocalEdit = stateRef.current.updatedAt !== finalState.updatedAt;
        setPendingLocalChanges(hasNewerLocalEdit);
        setSyncPhase('synced');
        setSyncMessage(resultMsg);
        return { ok: true, message: resultMsg };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'クラウド同期に失敗しました';
        setSyncPhase('error');
        setSyncMessage(msg);
        return { ok: false, message: msg };
      } finally {
        syncInFlightRef.current = false;
      }
    },
    [persistGistConfig]
  );

  /** GitHubトークンを受け取り、非公開Gistの自動検出または新規作成＋初回同期を行う */
  const connectCloudSync = useCallback(
    async (rawToken: string, optionalGistId?: string): Promise<{ ok: boolean; message: string }> => {
      const token = rawToken.trim();
      if (!token) {
        return { ok: false, message: 'GitHubアクセストークンを入力してください。' };
      }

      setSyncPhase('syncing');
      setSyncMessage('GitHubへ接続して非公開Gistを確認しています...');

      try {
        const { username } = await verifyGithubToken(token);
        let gistId = (optionalGistId || '').trim();
        let createdFresh = false;
        let initialRemoteUpdatedAt: string | undefined;

        if (!gistId) {
          const existingId = await findExistingSyncGist(token);
          if (existingId) {
            gistId = existingId;
          } else {
            // 初回端末：非公開（Secret）Gistを自動作成
            const created = await createSecretSyncGist(token, stateRef.current);
            gistId = created.gistId;
            initialRemoteUpdatedAt = created.remoteGistUpdatedAt;
            createdFresh = true;
          }
        }

        const newConfig: GistSyncConfig = {
          token,
          gistId,
          autoSync: true,
          username,
          lastSyncedAt: createdFresh ? new Date().toISOString() : undefined,
          lastSyncedStateUpdatedAt: createdFresh ? stateRef.current.updatedAt : undefined,
          lastRemoteGistUpdatedAt: initialRemoteUpdatedAt,
        };
        persistGistConfig(newConfig);

        if (createdFresh) {
          setPendingLocalChanges(false);
          setSyncPhase('synced');
          const msg = `@${username} の非公開Gistを自動作成し、自動同期を開始しました。他の端末でも同じトークンを入力するだけで繋がります。`;
          setSyncMessage(msg);
          return { ok: true, message: msg };
        }

        // 既存Gistが見つかった（2台目以降など）：即座に安全同期（取り込み／統合）
        const syncRes = await executeCloudSync(newConfig);
        if (syncRes.ok) {
          const msg = `@${username} の既存非公開Gistを自動検出しました（${syncRes.message}）`;
          setSyncMessage(msg);
          return { ok: true, message: msg };
        }
        return syncRes;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'GitHub接続に失敗しました';
        setSyncPhase('error');
        setSyncMessage(msg);
        return { ok: false, message: msg };
      }
    },
    [executeCloudSync, persistGistConfig]
  );

  const setAutoSyncEnabled = useCallback(
    (enabled: boolean) => {
      const cfg = configRef.current;
      if (!cfg) return;
      persistGistConfig({ ...cfg, autoSync: enabled });
      setSyncMessage(enabled ? '自動同期を有効にしました' : '自動同期を一時停止しました（手動同期は利用可能）');
    },
    [persistGistConfig]
  );

  const disconnectCloudSync = useCallback(() => {
    persistGistConfig(null);
    setPendingLocalChanges(false);
    setSyncPhase('unconfigured');
    setSyncMessage('連携を解除し、この端末のトークンを削除しました');
  }, [persistGistConfig]);

  // 1. アプリ起動時（設定済み＋自動同期ONなら自動で最新状態を取得）
  useEffect(() => {
    const cfg = configRef.current;
    if (!cfg || !cfg.autoSync) return;
    void executeCloudSync(cfg);
  }, [executeCloudSync]);

  // 2. 学習データの更新を検知し、2.5秒デバウンス後に自動同期
  useEffect(() => {
    if (state.updatedAt === prevStateUpdatedAtRef.current) return;
    prevStateUpdatedAtRef.current = state.updatedAt;

    // リモート反映による state 更新は再アップロードしない
    if (applyingRemoteUpdatedAtRef.current === state.updatedAt) {
      applyingRemoteUpdatedAtRef.current = null;
      return;
    }

    const cfg = configRef.current;
    if (!cfg || !cfg.autoSync) return;

    setPendingLocalChanges(true);
    const timer = window.setTimeout(() => {
      void executeCloudSync();
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [state.updatedAt, executeCloudSync]);

  // 3. 画面復帰（他端末で学習後にiPadを開いたとき等）＆ オンライン復帰時に自動同期
  useEffect(() => {
    if (!gistConfig || !gistConfig.autoSync) return;

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      if (Date.now() - lastSyncCheckMsRef.current < 30000) return;
      void executeCloudSync();
    };

    const handleOnline = () => {
      void executeCloudSync();
    };

    const handleOffline = () => {
      setSyncPhase('offline');
      setSyncMessage('オフライン中（端末内へ保存し、復帰後に自動同期します）');
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [gistConfig, executeCloudSync]);

  const cloudSync: CloudSyncController = {
    configured: Boolean(gistConfig && gistConfig.token && gistConfig.gistId),
    autoSync: Boolean(gistConfig?.autoSync),
    phase: syncPhase,
    username: gistConfig?.username,
    gistId: gistConfig?.gistId,
    lastSyncedAt: gistConfig?.lastSyncedAt,
    pendingLocalChanges,
    message: syncMessage,
    connect: connectCloudSync,
    syncNow: () => executeCloudSync(),
    setAutoSync: setAutoSyncEnabled,
    disconnect: disconnectCloudSync,
  };

  return {
    state,
    toggleRoadmapTask,
    markSqlDrillSolved,
    markSchemaQuizSolved,
    saveCbtDraft,
    recordReviewMiss,
    recordReviewPerfect,
    requeueReviewItem,
    setFlashcardStatus,
    setLastModule,
    incrementAttempts,
    generateSyncCode,
    restoreFromSyncCode,
    exportJson,
    importJson,
    canUndoSync: backupBeforeSync !== null,
    undoLastSync,
    cloudSync,
  };
}
