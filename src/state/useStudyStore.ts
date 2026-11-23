// 学習履歴・進捗・弱点復習キュー・Base64クリップボード同期ストア
import { useState, useEffect, useCallback } from 'react';
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

const STORAGE_KEY = 'db_spec_bootcamp_state_v1';

/** 初期学習状態 */
export function createInitialStudyState(): StudyState {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
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
}

export function useStudyStore(): StudyStore {
  const [state, setState] = useState<StudyState>(() => loadFromStorage());
  const [backupBeforeSync, setBackupBeforeSync] = useState<StudyState | null>(null);

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
        setState(decoded);
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
        setBackupBeforeSync(state);
        setState(parsed);
        return {
          ok: true,
          message: `JSON復元完了（最終更新: ${new Date(parsed.updatedAt).toLocaleString('ja-JP')}）`,
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
    setState(backupBeforeSync);
    setBackupBeforeSync(null);
  }, [backupBeforeSync]);

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
  };
}
