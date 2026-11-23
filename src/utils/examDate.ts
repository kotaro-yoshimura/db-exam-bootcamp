// 試験日カウントダウン・日付フォーマットの共通ユーティリティ
const EXAM_TARGET_ISO = '2027-03-28T00:00:00+09:00';

/** YYYY-MM-DD 形式でローカル日付を返す */
export function formatLocalYmd(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 試験目標日（2027/03/28）までの残り日数を返す */
export function getDaysLeftToExam(now: Date = new Date()): number {
  const target = new Date(EXAM_TARGET_ISO);
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}
