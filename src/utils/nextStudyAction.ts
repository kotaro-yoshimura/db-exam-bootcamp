// 現在の学習進捗から「次に何を勉強すればいいか」を自動判定する純粋ロジック
import type { ModuleId, RoadmapTask, RoadmapWeek, StudyState } from '../types/exam';
import { ROADMAP_WEEKS } from '../data/roadmap';
import { SQL_DRILLS } from '../data/sqlDrills';
import { FLASHCARDS_200 } from '../data/flashcards200';
import { formatLocalYmd } from './examDate';

export interface NextStudyAction {
  /** 表示用タグ（例：今週の次ステップ / 弱点優先 / 先取り学習） */
  badge: string;
  /** 今やるべき内容（太字見出し） */
  title: string;
  /** 補足説明（なぜ今これか・対象範囲など） */
  reason: string;
  /** 主アクションボタンの文言 */
  ctaLabel: string;
  /** 遷移先モジュール（テキスト通読タスクなどアプリ内完了のみの場合は undefined） */
  targetModule?: ModuleId;
  /** 連動するロードマップタスクID（チェック完了に使える） */
  roadmapTaskId?: string;
  /** 連動する週インデックス */
  weekIdx?: number;
  /** テキスト通読タスクかどうか */
  isTextbookTask?: boolean;
}

const MODULE_CTA: Record<ModuleId, string> = {
  home: 'ホームを見る',
  lab: '図解ラボを開く',
  sql: 'SQL道場を開く',
  cbt: 'CBT演習を開く',
  review: '弱点復習を開く',
  roadmap: '行程カレンダーを開く',
  cards: '重要語句200を開く',
};

/** 選択中または現在週の状況から「次にやるべき1手」を返す */
export function computeNextStudyAction(
  state: StudyState,
  selectedWeekIdx?: number
): NextStudyAction {
  const completedSet = new Set(state.completedRoadmapTasks);
  const todayStr = formatLocalYmd();
  const currentWeekIdx = Math.max(
    0,
    ROADMAP_WEEKS.findIndex((w) => todayStr >= w.startDate && todayStr <= w.endDate)
  );
  const focusIdx =
    selectedWeekIdx !== undefined && ROADMAP_WEEKS[selectedWeekIdx]
      ? selectedWeekIdx
      : currentWeekIdx;
  const focusWeek: RoadmapWeek = ROADMAP_WEEKS[focusIdx] || ROADMAP_WEEKS[0];

  // 1. 現在フォーカス中の週（今週）に未完了タスクがあれば、その先頭を最優先で提示
  const nextTaskInFocus: RoadmapTask | undefined = focusWeek.tasks.find(
    (t) => !completedSet.has(t.id)
  );
  if (nextTaskInFocus) {
    const doneInWeek = focusWeek.tasks.filter((t) => completedSet.has(t.id)).length;
    const isTb = nextTaskInFocus.category === 'textbook';
    const weekTag = `Week ${String(focusWeek.weekNumber).padStart(2, '0')}（${doneInWeek + 1}/${focusWeek.tasks.length}番目）`;

    if (isTb || !nextTaskInFocus.targetModule) {
      return {
        badge: weekTag,
        title: nextTaskInFocus.label,
        reason: `対象テキスト：${focusWeek.textbookRange} ／ 読み終えたら下のボタンで完了チェックし、次の演習へ進みましょう。`,
        ctaLabel: '読み終えて完了にする',
        roadmapTaskId: nextTaskInFocus.id,
        weekIdx: focusIdx,
        isTextbookTask: true,
      };
    }

    return {
      badge: weekTag,
      title: nextTaskInFocus.label,
      reason: `今週のテーマ「${focusWeek.theme}」を進めるための次の演習です。`,
      ctaLabel: MODULE_CTA[nextTaskInFocus.targetModule],
      targetModule: nextTaskInFocus.targetModule,
      roadmapTaskId: nextTaskInFocus.id,
      weekIdx: focusIdx,
      isTextbookTask: false,
    };
  }

  // 2. 今週のタスクを全完了済み → 未卒業の弱点キューがあれば最優先で消化
  const activeWeak = state.reviewQueue.filter((q) => !q.graduated);
  if (activeWeak.length > 0) {
    return {
      badge: `弱点優先（残り${activeWeak.length}件）`,
      title: `弱点復習：${activeWeak[0].title}`,
      reason: `今週のタスクはすべて完了済みです。未卒業の弱点を2回連続満点で卒業させましょう。`,
      ctaLabel: '今すぐ弱点復習を始める',
      targetModule: 'review',
    };
  }

  // 3. 要復習のフラッシュカードが残っていればそちらを提示
  const reviewCards = FLASHCARDS_200.filter((c) => state.flashcardStatus[c.id] === 'review');
  if (reviewCards.length > 0) {
    return {
      badge: `語句復習（要復習 ${reviewCards.length}語）`,
      title: '「要復習」の重要語句カードを0語にする',
      reason: '今週の計画は達成済みです。曖昧だった重要語句を仕上げましょう。',
      ctaLabel: '重要語句200を開く',
      targetModule: 'cards',
    };
  }

  // 4. 次の週に未完了タスクがあれば先取りを提示
  const nextWeekIdx = ROADMAP_WEEKS.findIndex(
    (w, idx) => idx > focusIdx && w.tasks.some((t) => !completedSet.has(t.id))
  );
  if (nextWeekIdx >= 0) {
    const nw = ROADMAP_WEEKS[nextWeekIdx];
    const firstTask = nw.tasks.find((t) => !completedSet.has(t.id))!;
    return {
      badge: `今週クリア・Week ${String(nw.weekNumber).padStart(2, '0')} 先取り`,
      title: firstTask.label,
      reason: `Week ${String(focusWeek.weekNumber).padStart(2, '0')} は完了済みです。次週「${nw.theme}」を先取りできます。`,
      ctaLabel: firstTask.targetModule ? MODULE_CTA[firstTask.targetModule] : '次週をチェックする',
      targetModule: firstTask.targetModule,
      roadmapTaskId: firstTask.id,
      weekIdx: nextWeekIdx,
      isTextbookTask: firstTask.category === 'textbook',
    };
  }

  // 5. 未クリアのSQL道場があれば提示
  const unsolvedSql = SQL_DRILLS.find((d) => !state.solvedSqlDrills.includes(d.id));
  if (unsolvedSql) {
    return {
      badge: 'SQL実践仕上げ',
      title: `SQL道場：${unsolvedSql.year} ${unsolvedSql.title}`,
      reason: '未クリアの過去問SQLに挑戦して実戦力を固めましょう。',
      ctaLabel: 'SQL道場を開く',
      targetModule: 'sql',
    };
  }

  // 6. すべて完了時：CBT本番演習で総仕上げ
  return {
    badge: 'CBT本番仕上げ',
    title: '過去問6年度のCBTタイマー通し演習',
    reason: '全スケジュールを達成しています。本番タイマーとGemini添削で仕上げましょう。',
    ctaLabel: 'CBT演習を開く',
    targetModule: 'cbt',
  };
}
