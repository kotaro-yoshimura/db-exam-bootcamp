// DB Specialist Bootcamp & Simulator 共通型定義

/** メインモジュールID */
export type ModuleId = 'home' | 'lab' | 'sql' | 'cbt' | 'review' | 'roadmap' | 'cards';

/** 過去問の年度タグ */
export type ExamYear = 'R7秋' | 'R6秋' | 'R5秋' | 'R3秋' | 'H31春' | 'H28春';

/** 関係スキーマのキー種別（なし / 主キー実線 / 外部キー破線 / 主兼外二重線） */
export type KeyRole = 'none' | 'pk' | 'fk' | 'pkfk';

/** 関係スキーマの1属性定義 */
export interface SchemaAttribute {
  name: string;
  role: KeyRole;
  /** サブタイプ由来の冗長属性などで角括弧表示する場合 true */
  isRedundant?: boolean;
  /** 参照先テーブル（外部キー解説用） */
  references?: string;
  /** 補足メモ */
  note?: string;
}

/** 関係スキーマテーブル定義 */
export interface RelationSchema {
  tableName: string;
  attributes: SchemaAttribute[];
  explanation?: string;
}

/** 関数従属性（FD）の種別 */
export type FdType = 'full' | 'partial' | 'transitive' | 'bcnf';

/** 関数従属性の1ルール */
export interface FunctionalDependency {
  id: string;
  determinant: string[];
  dependent: string[];
  type: FdType;
  label: string;
}

/** 正規化ステップ（非正規→1NF→2NF→3NF→BCNF） */
export interface NormalizationStep {
  level: 'UNF' | '1NF' | '2NF' | '3NF' | 'BCNF';
  title: string;
  summary: string;
  problemPoint: string;
  relations: RelationSchema[];
  fds: FunctionalDependency[];
}

/** 正規化・FDパズル問題 */
export interface NormalizationCase {
  id: string;
  year: ExamYear;
  examSection: string;
  title: string;
  domain: string;
  scenario: string;
  steps: NormalizationStep[];
  /** 主キー/外部キー/主兼外タップ採点対象スキーマ */
  quizSchema: RelationSchema;
  quizHint: string;
}

/** E-R図5大パターンID */
export type ErPatternId =
  | 'associative'
  | 'subtype'
  | 'self-ref'
  | 'multi-role'
  | 'tx-split-agg';

/** E-R図のエンティティノード（Canvas描画用） */
export interface ErEntityNode {
  id: string;
  name: string;
  /** 0..1 の正規化座標 */
  x: number;
  y: number;
  width?: number;
  height?: number;
  kind?: 'entity' | 'associative' | 'supertype' | 'subtype';
  pkAttrs: string[];
  otherAttrs?: string[];
  redundantAttrs?: string[];
}

/** E-R図のリレーションシップ（Canvas描画用） */
export interface ErRelationship {
  from: string;
  to: string;
  fromCard: '1' | '0..1' | 'N' | '0..N' | '1..N';
  toCard: '1' | '0..1' | 'N' | '0..N' | '1..N';
  label?: string;
  /** 自己参照または複数役割のカーブオフセット */
  curveOffset?: number;
  isSubtypeEdge?: boolean;
  subtypeRule?: '排他(XOR)' | '共存(OR)';
}

/** E-R図5大パターン定義 */
export interface ErPatternDefinition {
  id: ErPatternId;
  title: string;
  shortTitle: string;
  years: ExamYear[];
  keyPoint: string;
  cbtTip: string;
  entities: ErEntityNode[];
  relationships: ErRelationship[];
  relationsWithRedundant: RelationSchema[];
  relationsWithoutRedundant?: RelationSchema[];
  toggleLabel?: string;
}

/** SQL道場の1演習問題 */
export interface SqlDrillProblem {
  id: string;
  year: ExamYear;
  examSection: string;
  title: string;
  category: 'window' | 'recursive' | 'subquery' | 'aggregate' | 'join';
  difficulty: '基礎' | '標準' | '難問';
  description: string;
  schemaSql: string;
  seedSql: string;
  starterSql: string;
  answerSql: string;
  explanation: string;
  /** オフラインフォールバック用のテーブルデータ */
  offlineTables: Record<string, Array<Record<string, string | number | null>>>;
  /** 模範解答のプリコンパイル済み結果キャッシュ */
  expectedResult: SqlQueryResult;
  /** 別解や途中式用キーワード判定 */
  requiredKeywords: string[];
  /** ウィンドウ関数可視化プリセットID（該当する場合） */
  windowPresetId?: string;
}

/** SQL実行結果 */
export interface SqlQueryResult {
  columns: string[];
  rows: Array<Array<string | number | null>>;
  engine: 'wasm' | 'offline-cache' | 'offline-eval';
  executionMs: number;
  note?: string;
}

/** CBT本番スプリット画面の設問タイプ */
export type CbtQuestionType = 'essay' | 'schema' | 'signal';

/** 本文シグナル発掘用の文節トークン */
export interface SignalSegment {
  id: string;
  text: string;
  /** 主キー・多重度の重要シグナルなら true */
  isSignal: boolean;
  /** シグナル種別 */
  signalKind?: '主キー根拠' | '多重度1対多' | '多重度多対多' | '複合主キー' | 'サブタイプ/排他' | '履歴/時系列';
  /** 解説 */
  explanation?: string;
}

/** CBT午後試験問題（R7秋〜H28春） */
export interface CbtPastExam {
  id: string;
  year: ExamYear;
  section: string;
  title: string;
  timeLimitMin: number;
  category: '概念データモデル' | '論理設計・SQL' | '物理設計・障害回復';
  backgroundText: string;
  /** 業務ルール箇条書き */
  businessRules: string[];
  /** Canvas図解用のエンティティ・リレーション */
  diagramEntities: ErEntityNode[];
  diagramRelationships: ErRelationship[];
  /** A4メモ用紙のお手本略記項目 */
  a4MemoNotes: {
    entities: string[];
    arrows: string[];
    pkCandidates: string[];
    traps: string[];
  };
  /** 記述設問リスト */
  essayQuestions: Array<{
    id: string;
    label: string;
    prompt: string;
    maxChars: number;
    officialAnswer: string;
    gradingPoints: string[];
    hint: string;
  }>;
  /** スキーマ下線設問 */
  schemaQuestion: {
    id: string;
    prompt: string;
    schema: RelationSchema;
  };
  /** 本文シグナル発掘問題 */
  signalDrill: {
    id: string;
    instruction: string;
    segments: SignalSegment[];
  };
}

/** 弱点復習キューアイテムのカテゴリ */
export type ReviewItemKind = 'schema' | 'essay' | 'signal' | 'physical';

/** 弱点復習キューの1アイテム（2回連続満点で卒業） */
export interface ReviewQueueItem {
  id: string;
  kind: ReviewItemKind;
  year: ExamYear;
  title: string;
  prompt: string;
  /** 再出題用のペイロード（JSON化可能な軽量データ） */
  payload: {
    schema?: RelationSchema;
    officialAnswer?: string;
    gradingPoints?: string[];
    maxChars?: number;
    signalSegments?: SignalSegment[];
    physicalFormula?: string;
    physicalExpected?: string;
    explanation?: string;
  };
  /** 現在の連続満点回数（2で卒業） */
  consecutivePerfect: number;
  /** 累計誤答回数 */
  missCount: number;
  /** 卒業済みフラグ */
  graduated: boolean;
  /** 最終更新日時（ISO文字列） */
  updatedAt: string;
  /** ユーザーの直近メモ */
  lastUserAnswer?: string;
}

/** 18週間ロードマップの1タスク */
export interface RoadmapTask {
  id: string;
  label: string;
  /** タスク種別（テキスト通読 / アプリ演習 / 過去問CBT / 弱点復習） */
  category?: 'textbook' | 'app' | 'cbt' | 'review';
  targetModule?: ModuleId;
}

/** 18週間ロードマップの1週分 */
export interface RoadmapWeek {
  weekNumber: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  phase: 'Phase 1: 基礎・正規化徹底' | 'Phase 2: 概念モデル・E-R図習得' | 'Phase 3: SQL・トランザクション実戦' | 'Phase 4: 物理設計・計算問題制覇' | 'Phase 5: CBT本番形式・弱点完全撲滅';
  theme: string;
  /** この週に読み進めるテキスト範囲（合格教本など） */
  textbookRange: string;
  goal: string;
  recommendedYears: ExamYear[];
  tasks: RoadmapTask[];
}

/** 合格教本9章・重要語句フラッシュカード */
export interface FlashcardItem {
  id: string;
  chapter: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  chapterTitle: string;
  term: string;
  reading?: string;
  definition: string;
  examPoint: string;
  importance: 'A' | 'B' | 'C';
}

/** フラッシュカード習得ステータス */
export type CardStatus = 'unseen' | 'review' | 'mastered';

/** localStorage および Base64同期で保存する学習状態全体 */
export interface StudyState {
  version: 1;
  updatedAt: string;
  /** 完了したロードマップタスクIDの配列 */
  completedRoadmapTasks: string[];
  /** 完了したSQL道場問題ID */
  solvedSqlDrills: string[];
  /** 完了した正規化/スキーマクイズID */
  solvedSchemaQuizzes: string[];
  /** CBT記述解答の下書き（questionId -> text） */
  cbtDrafts: Record<string, string>;
  /** 弱点復習キュー */
  reviewQueue: ReviewQueueItem[];
  /** フラッシュカード習得ステータス（cardId -> status） */
  flashcardStatus: Record<string, CardStatus>;
  /** 累計演習回数 */
  totalAttempts: number;
  /** 最終アクセスモジュール */
  lastModule: ModuleId;
}
