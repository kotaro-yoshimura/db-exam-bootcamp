// モジュール1用データ：正規化・FDステップ分解パズル ＆ E-R図5大パターン×関係スキーマ連動ビルダー
import type { NormalizationCase, ErPatternDefinition } from '../types/exam';

/**
 * 正規化・FDステップ分解＆主キー/外部キー/主兼外タップ採点ケース（過去問題材）
 */
export const NORMALIZATION_CASES: NormalizationCase[] = [
  {
    id: 'norm-r7-order',
    year: 'R7秋',
    examSection: '午後Ⅰ 問1（受発注・配送管理）',
    title: '受注伝票の非正規→BCNF分解と連関スキーマ下線判定',
    domain: 'EC・卸売受発注システム',
    scenario:
      '1件の受注伝票に複数の商品明細が記載される。顧客ごとに担当営業と顧客ランクが決まり、商品ごとに商品分類と分類担当部署が決まる。さらに受注時の適用単価は商品マスタの標準単価とは独立して記録される。',
    steps: [
      {
        level: 'UNF',
        title: '非正規形（繰り返し項目あり）',
        summary: '1枚の受注伝票内に「商品コード・商品名・数量・適用単価」の明細グループが繰り返されている状態。',
        problemPoint: '繰り返しグループが存在するため、関係データベースの表として1セル1値になっていない。',
        relations: [
          {
            tableName: '受注伝票（非正規）',
            attributes: [
              { name: '受注番号', role: 'pk' },
              { name: '受注日', role: 'none' },
              { name: '顧客コード', role: 'none' },
              { name: '顧客名', role: 'none' },
              { name: '担当営業ID', role: 'none' },
              { name: '営業名', role: 'none' },
              { name: '{明細行番号, 商品コード, 商品名, 商品分類ID, 分類名, 数量, 適用単価}', role: 'none' },
            ],
          },
        ],
        fds: [
          {
            id: 'fd-unf-1',
            determinant: ['受注番号'],
            dependent: ['受注日', '顧客コード', '顧客名'],
            type: 'full',
            label: '伝票ヘッダ従属',
          },
        ],
      },
      {
        level: '1NF',
        title: '第1正規形（繰り返しグループの展開）',
        summary: '繰り返し項目をフラット化し、複合主キー「受注番号＋明細行番号（または商品コード）」で1行を一意に識別する。',
        problemPoint:
          '部分関数従属が残存！「受注番号」だけで受注日・顧客コードが決まり、「商品コード」だけで商品名・商品分類IDが決まるため、挿入・更新・削除異常が発生する。',
        relations: [
          {
            tableName: '受注明細_1NF',
            attributes: [
              { name: '受注番号', role: 'pk' },
              { name: '商品コード', role: 'pk' },
              { name: '受注日', role: 'none' },
              { name: '顧客コード', role: 'none' },
              { name: '顧客名', role: 'none' },
              { name: '担当営業ID', role: 'none' },
              { name: '営業名', role: 'none' },
              { name: '商品名', role: 'none' },
              { name: '商品分類ID', role: 'none' },
              { name: '分類名', role: 'none' },
              { name: '数量', role: 'none' },
              { name: '適用単価', role: 'none' },
            ],
          },
        ],
        fds: [
          {
            id: 'fd-1nf-1',
            determinant: ['受注番号', '商品コード'],
            dependent: ['数量', '適用単価'],
            type: 'full',
            label: '完全関数従属',
          },
          {
            id: 'fd-1nf-2',
            determinant: ['受注番号'],
            dependent: ['受注日', '顧客コード', '顧客名', '担当営業ID', '営業名'],
            type: 'partial',
            label: '部分関数従属（要分離）',
          },
          {
            id: 'fd-1nf-3',
            determinant: ['商品コード'],
            dependent: ['商品名', '商品分類ID', '分類名'],
            type: 'partial',
            label: '部分関数従属（要分離）',
          },
        ],
      },
      {
        level: '2NF',
        title: '第2正規形（部分関数従属の解消）',
        summary: '主キーの一部にのみ従属する属性を「受注」「商品」「受注明細」の3表へ分離。',
        problemPoint:
          '推移的関数従属が残存！「受注番号 → 顧客コード → 顧客名・担当営業ID → 営業名」および「商品コード → 商品分類ID → 分類名」の連鎖がある。',
        relations: [
          {
            tableName: '受注_2NF',
            attributes: [
              { name: '受注番号', role: 'pk' },
              { name: '受注日', role: 'none' },
              { name: '顧客コード', role: 'none' },
              { name: '顧客名', role: 'none' },
              { name: '担当営業ID', role: 'none' },
              { name: '営業名', role: 'none' },
            ],
          },
          {
            tableName: '商品_2NF',
            attributes: [
              { name: '商品コード', role: 'pk' },
              { name: '商品名', role: 'none' },
              { name: '商品分類ID', role: 'none' },
              { name: '分類名', role: 'none' },
            ],
          },
          {
            tableName: '受注明細',
            attributes: [
              { name: '受注番号', role: 'pkfk', references: '受注' },
              { name: '商品コード', role: 'pkfk', references: '商品' },
              { name: '数量', role: 'none' },
              { name: '適用単価', role: 'none' },
            ],
          },
        ],
        fds: [
          {
            id: 'fd-2nf-1',
            determinant: ['受注番号'],
            dependent: ['受注日', '顧客コード'],
            type: 'full',
            label: '直接従属',
          },
          {
            id: 'fd-2nf-2',
            determinant: ['顧客コード'],
            dependent: ['顧客名', '担当営業ID'],
            type: 'transitive',
            label: '推移的関数従属（要分離）',
          },
          {
            id: 'fd-2nf-3',
            determinant: ['担当営業ID'],
            dependent: ['営業名'],
            type: 'transitive',
            label: '推移的関数従属（要分離）',
          },
          {
            id: 'fd-2nf-4',
            determinant: ['商品分類ID'],
            dependent: ['分類名'],
            type: 'transitive',
            label: '推移的関数従属（要分離）',
          },
        ],
      },
      {
        level: '3NF',
        title: '第3正規形（推移的関数従属の解消）',
        summary: '非キー属性間の従属を切り出し、「受注」「顧客」「担当営業」「商品」「商品分類」「受注明細」の6表へ正規化完了。',
        problemPoint: '非自明なすべての関数従属性の決定項が候補キーになっているため、本ケースはBCNFも同時に満たす。',
        relations: [
          {
            tableName: '受注',
            attributes: [
              { name: '受注番号', role: 'pk' },
              { name: '受注日', role: 'none' },
              { name: '顧客コード', role: 'fk', references: '顧客' },
            ],
          },
          {
            tableName: '顧客',
            attributes: [
              { name: '顧客コード', role: 'pk' },
              { name: '顧客名', role: 'none' },
              { name: '担当営業ID', role: 'fk', references: '担当営業' },
            ],
          },
          {
            tableName: '担当営業',
            attributes: [
              { name: '担当営業ID', role: 'pk' },
              { name: '営業名', role: 'none' },
            ],
          },
          {
            tableName: '商品',
            attributes: [
              { name: '商品コード', role: 'pk' },
              { name: '商品名', role: 'none' },
              { name: '商品分類ID', role: 'fk', references: '商品分類' },
            ],
          },
          {
            tableName: '商品分類',
            attributes: [
              { name: '商品分類ID', role: 'pk' },
              { name: '分類名', role: 'none' },
            ],
          },
          {
            tableName: '受注明細',
            attributes: [
              { name: '受注番号', role: 'pkfk', references: '受注' },
              { name: '商品コード', role: 'pkfk', references: '商品' },
              { name: '数量', role: 'none' },
              { name: '適用単価', role: 'none' },
            ],
          },
        ],
        fds: [
          {
            id: 'fd-3nf-1',
            determinant: ['受注番号', '商品コード'],
            dependent: ['数量', '適用単価'],
            type: 'full',
            label: '完全従属（連関表）',
          },
          {
            id: 'fd-3nf-2',
            determinant: ['受注番号'],
            dependent: ['受注日', '顧客コード'],
            type: 'full',
            label: '完全従属（受注）',
          },
          {
            id: 'fd-3nf-3',
            determinant: ['顧客コード'],
            dependent: ['顧客名', '担当営業ID'],
            type: 'full',
            label: '完全従属（顧客）',
          },
        ],
      },
    ],
    quizSchema: {
      tableName: '受注明細（出荷割当拡張版）',
      attributes: [
        { name: '受注番号', role: 'pkfk', references: '受注', note: '親「受注」の主キーを参照し、複合主キーの一部' },
        { name: '商品コード', role: 'pkfk', references: '商品', note: '親「商品」の主キーを参照し、複合主キーの一部' },
        { name: '出荷倉庫コード', role: 'fk', references: '倉庫', note: '明細ごとに引当先倉庫を1つ指定する外部キー' },
        { name: '受注数量', role: 'none', note: '非キー属性' },
        { name: '適用単価', role: 'none', note: '受注時点の確定単価（非キー属性）' },
        { name: '希望納期', role: 'none', note: '非キー属性' },
      ],
      explanation:
        '同一受注内で同一商品は1明細のみ（連関エンティティ）なので「受注番号」「商品コード」は主キー兼外部キー（二重線）。「出荷倉庫コード」は主キーには含まれない外部キー（破線）。',
    },
    quizHint: '連関エンティティの親参照キーは「主キー兼外部キー（二重線）」、引当先倉庫コードは純粋な「外部キー（破線）」になる。',
  },
  {
    id: 'norm-r3-bcnf',
    year: 'R3秋',
    examSection: '午後Ⅰ 問2（研修講師・講座割当）',
    title: '3NFを満たすがBCNF違反となるケースの分解',
    domain: '資格研修・講座運営システム',
    scenario:
      '受講生は1つの講座科目につき1名の担当講師から指導を受ける。また、各講師は専門の1科目だけを担当する（講師ID → 科目ID）。',
    steps: [
      {
        level: '3NF',
        title: '第3正規形だがBCNF違反（決定項が非スーパーキー）',
        summary:
          '候補キーは {受講生ID, 科目ID} と {受講生ID, 講師ID} の2つ。すべての非キー属性が存在しないため定義上3NFを満たすが、「講師ID → 科目ID」の決定項「講師ID」がスーパーキーではない！',
        problemPoint:
          '講師がどの科目を担当しているかという情報が、受講生が1人も申し込んでいないと登録できない（挿入異常）。',
        relations: [
          {
            tableName: '受講割当_3NF',
            attributes: [
              { name: '受講生ID', role: 'pkfk', references: '受講生' },
              { name: '科目ID', role: 'pkfk', references: '科目' },
              { name: '講師ID', role: 'fk', references: '講師' },
            ],
          },
        ],
        fds: [
          {
            id: 'fd-bcnf-1',
            determinant: ['受講生ID', '科目ID'],
            dependent: ['講師ID'],
            type: 'full',
            label: '候補キーからの従属',
          },
          {
            id: 'fd-bcnf-2',
            determinant: ['講師ID'],
            dependent: ['科目ID'],
            type: 'bcnf',
            label: 'BCNF違反（講師IDはスーパーキーではない）',
          },
        ],
      },
      {
        level: 'BCNF',
        title: 'ボイス・コッド正規形（BCNF）分解後',
        summary:
          '「講師ID → 科目ID」を独立した「講師担当科目」表に分離し、「受講割当」は {受講生ID, 講師ID} で管理する。',
        problemPoint:
          'BCNF分解により冗長性と更新異常は解消されるが、「受講生ID＋科目ID → 講師ID」という関数従属性が表をまたぐため従属性保存にならない点に注意（試験頻出論点！）。',
        relations: [
          {
            tableName: '講師担当科目',
            attributes: [
              { name: '講師ID', role: 'pkfk', references: '講師' },
              { name: '科目ID', role: 'fk', references: '科目' },
            ],
          },
          {
            tableName: '受講担当',
            attributes: [
              { name: '受講生ID', role: 'pkfk', references: '受講生' },
              { name: '講師ID', role: 'pkfk', references: '講師担当科目' },
            ],
          },
        ],
        fds: [
          {
            id: 'fd-bcnf-3',
            determinant: ['講師ID'],
            dependent: ['科目ID'],
            type: 'full',
            label: '決定項＝主キー（BCNF達成）',
          },
        ],
      },
    ],
    quizSchema: {
      tableName: '研修受講履歴（試験頻出・履歴型）',
      attributes: [
        { name: '受講生ID', role: 'pkfk', references: '受講生', note: '受講生マスタ参照かつ主キー構成' },
        { name: '講座コード', role: 'pkfk', references: '講座', note: '講座マスタ参照かつ主キー構成' },
        { name: '受講開始日', role: 'pk', note: '同一講座を再受講できるため主キーに日時を含む（純粋主キー・実線）' },
        { name: '担当講師ID', role: 'fk', references: '講師', note: '講師マスタへの外部キー（破線）' },
        { name: '修了判定区分', role: 'none', note: '非キー属性' },
      ],
      explanation:
        '「同一講座を別の日に再受講できる」場合、受講開始日はマスタ参照ではない純粋な主キー（実線）になる。受講生ID・講座コードは主兼外（二重線）、担当講師IDは外部キー（破線）。',
    },
    quizHint: '再受講を許す履歴エンティティでは「日付・連番」が純粋な主キー（実線）として加わる！',
  },
  {
    id: 'norm-h31-mfg',
    year: 'H31春',
    examSection: '午後Ⅱ 問1（製造・部品構成・作業実績）',
    title: '作業指示と使用部品実績の複合主キー・外部キー判定',
    domain: '生産管理・製造実行システム（MES）',
    scenario:
      '製造指図ごとに複数の工程作業が割り当てられ、各工程作業で複数の部品が消費される。作業実績には作業担当者IDと使用設備コードが記録される。',
    steps: [
      {
        level: '1NF',
        title: '第1正規形（工程作業・消費部品のフラット化）',
        summary: '製造指図書に工程情報と消費部品が混在している状態。',
        problemPoint: '製造指図番号だけで製品コード・計画数量が決まり、部品コードだけで部品名が決まる部分関数従属がある。',
        relations: [
          {
            tableName: '製造実績_1NF',
            attributes: [
              { name: '製造指図番号', role: 'pk' },
              { name: '工程順', role: 'pk' },
              { name: '部品コード', role: 'pk' },
              { name: '製品コード', role: 'none' },
              { name: '担当者ID', role: 'none' },
              { name: '部品名', role: 'none' },
              { name: '消費数量', role: 'none' },
            ],
          },
        ],
        fds: [
          {
            id: 'fd-h31-1',
            determinant: ['製造指図番号'],
            dependent: ['製品コード'],
            type: 'partial',
            label: '部分従属（製造指図へ）',
          },
          {
            id: 'fd-h31-2',
            determinant: ['製造指図番号', '工程順'],
            dependent: ['担当者ID'],
            type: 'partial',
            label: '部分従属（工程作業へ）',
          },
          {
            id: 'fd-h31-3',
            determinant: ['部品コード'],
            dependent: ['部品名'],
            type: 'partial',
            label: '部分従属（部品マスタへ）',
          },
        ],
      },
      {
        level: '3NF',
        title: '第3正規形（3階層親子構造への分解）',
        summary: '「製造指図」→「工程作業」→「部品消費実績」の識別関係（親の主キーを子が引き継ぐ構造）に整理。',
        problemPoint: '複合外部キー（製造指図番号＋工程順）がそのまま主キーの一部（主兼外）になる点が見落としやすい！',
        relations: [
          {
            tableName: '製造指図',
            attributes: [
              { name: '製造指図番号', role: 'pk' },
              { name: '製品コード', role: 'fk', references: '製品' },
              { name: '計画数量', role: 'none' },
            ],
          },
          {
            tableName: '工程作業',
            attributes: [
              { name: '製造指図番号', role: 'pkfk', references: '製造指図' },
              { name: '工程順', role: 'pk' },
              { name: '担当者ID', role: 'fk', references: '社員' },
            ],
          },
          {
            tableName: '部品消費実績',
            attributes: [
              { name: '製造指図番号', role: 'pkfk', references: '工程作業' },
              { name: '工程順', role: 'pkfk', references: '工程作業' },
              { name: '部品コード', role: 'pkfk', references: '部品' },
              { name: '消費数量', role: 'none' },
            ],
          },
        ],
        fds: [
          {
            id: 'fd-h31-4',
            determinant: ['製造指図番号', '工程順', '部品コード'],
            dependent: ['消費数量'],
            type: 'full',
            label: '完全関数従属',
          },
        ],
      },
    ],
    quizSchema: {
      tableName: '部品消費実績',
      attributes: [
        { name: '製造指図番号', role: 'pkfk', references: '工程作業', note: '親「工程作業」の複合PKの1部' },
        { name: '工程順', role: 'pkfk', references: '工程作業', note: '親「工程作業」の複合PKの1部（破線忘れ注意！）' },
        { name: '部品コード', role: 'pkfk', references: '部品', note: '部品マスタへの外部キー兼主キー' },
        { name: '払出倉庫コード', role: 'fk', references: '倉庫', note: '倉庫マスタ参照の外部キー' },
        { name: '消費数量', role: 'none', note: '非キー属性' },
      ],
      explanation:
        '「工程順」は親「工程作業」の複合主キー（製造指図番号, 工程順）の一部として参照されるため、実線だけでなく破線も必須の主兼外（二重線）！午後試験最大のひっかけポイント。',
    },
    quizHint: '親テーブル「工程作業」の主キーが (製造指図番号, 工程順) の複合キーである点に注目！',
  },
];

/**
 * E-R図5大パターン × 関係スキーマ連動ビルダー定義
 */
export const ER_PATTERNS: ErPatternDefinition[] = [
  {
    id: 'associative',
    title: '① 連関エンティティ（多対多の解消）',
    shortTitle: '① 連関エンティティ',
    years: ['R7秋', 'H31春', 'R6秋'],
    keyPoint:
      '多対多（N:M）の関係はRDBMSでは直接実装できない。中間に連関エンティティを挟み、「1対多 ← 連関 → 多対1」へ分解する。両側の親の主キーを引き継ぎ「主キー兼外部キー（二重線）」とするのが基本。',
    cbtTip:
      '本文に「1件の受注で複数商品を注文でき、同じ商品が別受注にも登場する。明細ごとに数量・適用単価を持つ」とあれば即座に連関エンティティ！同一受注内で同商品を複数回登場させる場合は「明細行番号」を純粋主キーに追加する。',
    entities: [
      {
        id: 'order',
        name: '受注',
        x: 0.16,
        y: 0.5,
        kind: 'entity',
        pkAttrs: ['受注番号'],
        otherAttrs: ['受注日', '顧客コード(FK)'],
      },
      {
        id: 'order_detail',
        name: '受注明細',
        x: 0.5,
        y: 0.5,
        kind: 'associative',
        pkAttrs: ['受注番号(FK)', '商品コード(FK)'],
        otherAttrs: ['受注数量', '適用単価'],
      },
      {
        id: 'product',
        name: '商品',
        x: 0.84,
        y: 0.5,
        kind: 'entity',
        pkAttrs: ['商品コード'],
        otherAttrs: ['商品名', '標準単価'],
      },
    ],
    relationships: [
      { from: 'order', to: 'order_detail', fromCard: '1', toCard: '1..N', label: '明細を含む' },
      { from: 'product', to: 'order_detail', fromCard: '1', toCard: '0..N', label: '受注される' },
    ],
    toggleLabel: '同一受注内の同一商品重複を許可（明細行番号を主キー化）',
    relationsWithRedundant: [
      {
        tableName: '受注',
        attributes: [
          { name: '受注番号', role: 'pk' },
          { name: '受注日', role: 'none' },
          { name: '顧客コード', role: 'fk', references: '顧客' },
        ],
      },
      {
        tableName: '受注明細（重複許可パターン）',
        attributes: [
          { name: '受注番号', role: 'pkfk', references: '受注' },
          { name: '明細行番号', role: 'pk' },
          { name: '商品コード', role: 'fk', references: '商品' },
          { name: '受注数量', role: 'none' },
          { name: '適用単価', role: 'none' },
        ],
        explanation: '明細行番号を主キーにすることで商品コードは主キーから外れ、純粋な外部キー（破線）に変化する！',
      },
      {
        tableName: '商品',
        attributes: [
          { name: '商品コード', role: 'pk' },
          { name: '商品名', role: 'none' },
          { name: '標準単価', role: 'none' },
        ],
      },
    ],
    relationsWithoutRedundant: [
      {
        tableName: '受注',
        attributes: [
          { name: '受注番号', role: 'pk' },
          { name: '受注日', role: 'none' },
          { name: '顧客コード', role: 'fk', references: '顧客' },
        ],
      },
      {
        tableName: '受注明細（標準連関パターン）',
        attributes: [
          { name: '受注番号', role: 'pkfk', references: '受注' },
          { name: '商品コード', role: 'pkfk', references: '商品' },
          { name: '受注数量', role: 'none' },
          { name: '適用単価', role: 'none' },
        ],
        explanation: '同一受注内で商品コードが一意なら、両方とも主キー兼外部キー（二重線）となる。',
      },
      {
        tableName: '商品',
        attributes: [
          { name: '商品コード', role: 'pk' },
          { name: '商品名', role: 'none' },
          { name: '標準単価', role: 'none' },
        ],
      },
    ],
  },
  {
    id: 'subtype',
    title: '② サブタイプと冗長属性 [ ]',
    shortTitle: '② サブタイプ・冗長属性',
    years: ['R6秋', 'R3秋', 'R7秋'],
    keyPoint:
      '共通属性をスーパータイプ（例：会員）に集約し、固有属性をサブタイプ（例：個人会員・法人会員）へ分離。サブタイプの主キーはスーパータイプの主キーと同一（主キー兼外部キー）。外部キー参照整合性を厳密に制約するため「会員区分」をサブタイプにも冗長属性 [会員区分] として持たせるのがDB試験の王道！',
    cbtTip:
      'スーパータイプに「区分属性（排他XOR）」があり、サブタイプ側固有のリレーションシップが存在する場合は、CHECK制約＋複合外部キーで型安全を保証するため角括弧付き冗長属性 [区分] を置く。',
    entities: [
      {
        id: 'member',
        name: '会員（スーパータイプ）',
        x: 0.5,
        y: 0.22,
        kind: 'supertype',
        pkAttrs: ['会員ID'],
        otherAttrs: ['会員区分', '登録日', '住所'],
      },
      {
        id: 'individual',
        name: '個人会員',
        x: 0.24,
        y: 0.74,
        kind: 'subtype',
        pkAttrs: ['会員ID(FK)'],
        otherAttrs: ['氏名', '生年月日'],
        redundantAttrs: ['[会員区分="個人"]'],
      },
      {
        id: 'corporate',
        name: '法人会員',
        x: 0.76,
        y: 0.74,
        kind: 'subtype',
        pkAttrs: ['会員ID(FK)'],
        otherAttrs: ['法人名', '与信限度額', '担当者名'],
        redundantAttrs: ['[会員区分="法人"]'],
      },
    ],
    relationships: [
      {
        from: 'member',
        to: 'individual',
        fromCard: '1',
        toCard: '0..1',
        isSubtypeEdge: true,
        subtypeRule: '排他(XOR)',
      },
      {
        from: 'member',
        to: 'corporate',
        fromCard: '1',
        toCard: '0..1',
        isSubtypeEdge: true,
        subtypeRule: '排他(XOR)',
      },
    ],
    toggleLabel: '冗長属性 [会員区分] をサブタイプへ配置（試験厳密型）',
    relationsWithRedundant: [
      {
        tableName: '会員',
        attributes: [
          { name: '会員ID', role: 'pk' },
          { name: '会員区分', role: 'none', note: 'UNIQUE(会員ID, 会員区分) を設定' },
          { name: '登録日', role: 'none' },
          { name: '住所', role: 'none' },
        ],
      },
      {
        tableName: '個人会員',
        attributes: [
          { name: '会員ID', role: 'pkfk', references: '会員' },
          { name: '[会員区分]', role: 'fk', isRedundant: true, references: '会員', note: 'CHECK(会員区分="個人") かつ複合FKで排他保証' },
          { name: '氏名', role: 'none' },
          { name: '生年月日', role: 'none' },
        ],
      },
      {
        tableName: '法人会員',
        attributes: [
          { name: '会員ID', role: 'pkfk', references: '会員' },
          { name: '[会員区分]', role: 'fk', isRedundant: true, references: '会員', note: 'CHECK(会員区分="法人") かつ複合FKで排他保証' },
          { name: '法人名', role: 'none' },
          { name: '与信限度額', role: 'none' },
        ],
      },
    ],
    relationsWithoutRedundant: [
      {
        tableName: '会員',
        attributes: [
          { name: '会員ID', role: 'pk' },
          { name: '会員区分', role: 'none' },
          { name: '登録日', role: 'none' },
          { name: '住所', role: 'none' },
        ],
      },
      {
        tableName: '個人会員（シンプル型）',
        attributes: [
          { name: '会員ID', role: 'pkfk', references: '会員' },
          { name: '氏名', role: 'none' },
          { name: '生年月日', role: 'none' },
        ],
        explanation: '冗長属性を省く場合、法人会員IDを誤って個人会員表にINSERTする不整合を外部キー制約だけでは防げない。',
      },
      {
        tableName: '法人会員（シンプル型）',
        attributes: [
          { name: '会員ID', role: 'pkfk', references: '会員' },
          { name: '法人名', role: 'none' },
          { name: '与信限度額', role: 'none' },
        ],
      },
    ],
  },
  {
    id: 'self-ref',
    title: '③ 自己参照1対多（階層・ツリー構造）',
    shortTitle: '③ 自己参照1対多',
    years: ['R5秋', 'R3秋', 'H31春'],
    keyPoint:
      '組織階層（上位部門→下位部門）、社員の上司、カテゴリ階層など「ツリー構造（1つの親に複数の子、各子の親は高々1つ）」は、自分自身の主キーを参照する外部キー（NULL許容）で表現する。',
    cbtTip:
      '「最上位の部門には上位部門が存在しない」→ 上位部門コードは NULL許容（0..1側）。一方「1つの部品が複数の親製品に使われる（部品表BOM＝多対多のネットワーク構造）」なら自己参照ではなく「部品構成(親部品ID, 子部品ID, 構成数)」の連関エンティティを使う！',
    entities: [
      {
        id: 'dept',
        name: '組織部門',
        x: 0.34,
        y: 0.54,
        kind: 'entity',
        pkAttrs: ['部門コード'],
        otherAttrs: ['部門名', '上位部門コード(FK/NULL可)', '階層レベル'],
      },
      {
        id: 'emp',
        name: '社員',
        x: 0.76,
        y: 0.54,
        kind: 'entity',
        pkAttrs: ['社員ID'],
        otherAttrs: ['氏名', '所属部門コード(FK)', '上司社員ID(FK/NULL可)'],
      },
    ],
    relationships: [
      {
        from: 'dept',
        to: 'dept',
        fromCard: '0..1',
        toCard: '0..N',
        label: '上位部門 1 : N 下位部門',
        curveOffset: -90,
      },
      {
        from: 'dept',
        to: 'emp',
        fromCard: '1',
        toCard: '0..N',
        label: '所属',
      },
      {
        from: 'emp',
        to: 'emp',
        fromCard: '0..1',
        toCard: '0..N',
        label: '上司 1 : N 部下',
        curveOffset: -90,
      },
    ],
    toggleLabel: '多対多の部品表BOM（自己参照連関パターン）と比較表示',
    relationsWithRedundant: [
      {
        tableName: '部品（BOM多対多の親エンティティ）',
        attributes: [
          { name: '部品コード', role: 'pk' },
          { name: '部品名', role: 'none' },
        ],
      },
      {
        tableName: '部品構成（自己参照の多対多解消）',
        attributes: [
          { name: '親部品コード', role: 'pkfk', references: '部品' },
          { name: '子部品コード', role: 'pkfk', references: '部品' },
          { name: '必要員数', role: 'none' },
        ],
        explanation: '1つの部品が複数の上位部品に組み込まれる（DAG構造）場合、自己参照外部キー1本では表現できず連関エンティティ必須！',
      },
    ],
    relationsWithoutRedundant: [
      {
        tableName: '組織部門（ツリー型・自己参照1対多）',
        attributes: [
          { name: '部門コード', role: 'pk' },
          { name: '部門名', role: 'none' },
          { name: '上位部門コード', role: 'fk', references: '組織部門', note: '最上位ルート部門はNULL' },
        ],
      },
      {
        tableName: '社員（ツリー型・自己参照1対多）',
        attributes: [
          { name: '社員ID', role: 'pk' },
          { name: '氏名', role: 'none' },
          { name: '所属部門コード', role: 'fk', references: '組織部門' },
          { name: '上司社員ID', role: 'fk', references: '社員', note: '社長など最上位はNULL' },
        ],
      },
    ],
  },
  {
    id: 'multi-role',
    title: '④ 同一エンティティ間の複数役割（ロール名）',
    shortTitle: '④ 複数役割(ロール)',
    years: ['R5秋', 'H28春', 'R7秋'],
    keyPoint:
      '「配送」が「拠点」に対して「発送元拠点」と「配送先拠点」の2つの役割で結びつく場合、E-R図では同一エンティティ間に2本のリレーションシップを引き、関係スキーマではロール名を冠した2つの外部キーを持つ。',
    cbtTip:
      '「申請者と承認者はどちらも社員」「出発空港と到着空港はどちらも空港」「貸出店舗と返却店舗はどちらも店舗」といった記述は100%このパターン！属性名に必ず役割名（発送元拠点コード／配送先拠点コード）を付けること。',
    entities: [
      {
        id: 'hub',
        name: '物流拠点',
        x: 0.22,
        y: 0.5,
        kind: 'entity',
        pkAttrs: ['拠点コード'],
        otherAttrs: ['拠点名', '都道府県', '拠点区分'],
      },
      {
        id: 'shipment',
        name: '配送指示',
        x: 0.72,
        y: 0.5,
        kind: 'entity',
        pkAttrs: ['配送指示番号'],
        otherAttrs: ['発送元拠点コード(FK)', '配送先拠点コード(FK)', '集荷予定日', '担当者ID(FK)'],
      },
    ],
    relationships: [
      {
        from: 'hub',
        to: 'shipment',
        fromCard: '1',
        toCard: '0..N',
        label: '発送元拠点として',
        curveOffset: -58,
      },
      {
        from: 'hub',
        to: 'shipment',
        fromCard: '1',
        toCard: '0..N',
        label: '配送先拠点として',
        curveOffset: 58,
      },
    ],
    toggleLabel: '中継拠点を経由する多段配送（配送区間明細追加）',
    relationsWithRedundant: [
      {
        tableName: '配送指示',
        attributes: [
          { name: '配送指示番号', role: 'pk' },
          { name: '発送元拠点コード', role: 'fk', references: '物流拠点' },
          { name: '最終配送先拠点コード', role: 'fk', references: '物流拠点' },
          { name: '集荷予定日', role: 'none' },
        ],
      },
      {
        tableName: '配送区間（多段中継対応）',
        attributes: [
          { name: '配送指示番号', role: 'pkfk', references: '配送指示' },
          { name: '区間連番', role: 'pk' },
          { name: '出発拠点コード', role: 'fk', references: '物流拠点' },
          { name: '到着拠点コード', role: 'fk', references: '物流拠点' },
        ],
      },
    ],
    relationsWithoutRedundant: [
      {
        tableName: '物流拠点',
        attributes: [
          { name: '拠点コード', role: 'pk' },
          { name: '拠点名', role: 'none' },
          { name: '都道府県', role: 'none' },
        ],
      },
      {
        tableName: '配送指示',
        attributes: [
          { name: '配送指示番号', role: 'pk' },
          { name: '発送元拠点コード', role: 'fk', references: '物流拠点', note: 'ロール1：発送元' },
          { name: '配送先拠点コード', role: 'fk', references: '物流拠点', note: 'ロール2：配送先' },
          { name: '集荷予定日', role: 'none' },
        ],
      },
    ],
  },
  {
    id: 'tx-split-agg',
    title: '⑤ トランザクション分割と集約（発注→分納→合算請求）',
    shortTitle: '⑤ TX分割と集約',
    years: ['R7秋', 'R6秋', 'H31春'],
    keyPoint:
      '業務フローの「分割（1回の受注が複数回の分納出荷に分かれる：1対多）」と「集約（複数の出荷を月末に1件の請求書へまとめる：多対1）」の組み合わせ。外部キーは常に「多（矢印の先）」側へ配置する！',
    cbtTip:
      '「分割」は子（出荷）が親（受注）のFKを持ち、「集約」は元イベント（出荷）がまとめ先（請求）のNULL許容FK（請求確定前はNULL！）を持つのが鉄則。請求と出荷が多対多になる場合のみ連関表を挟む。',
    entities: [
      {
        id: 'po',
        name: '受注',
        x: 0.14,
        y: 0.5,
        kind: 'entity',
        pkAttrs: ['受注番号'],
        otherAttrs: ['顧客コード(FK)', '受注日'],
      },
      {
        id: 'ship',
        name: '出荷（分割＋集約ハブ）',
        x: 0.5,
        y: 0.5,
        kind: 'associative',
        pkAttrs: ['出荷番号'],
        otherAttrs: ['受注番号(FK)', '請求番号(FK/NULL可)', '出荷日'],
      },
      {
        id: 'inv',
        name: '請求',
        x: 0.86,
        y: 0.5,
        kind: 'entity',
        pkAttrs: ['請求番号'],
        otherAttrs: ['顧客コード(FK)', '締日', '請求金額'],
      },
    ],
    relationships: [
      { from: 'po', to: 'ship', fromCard: '1', toCard: '0..N', label: '分割出荷 (1:N)' },
      { from: 'inv', to: 'ship', fromCard: '0..1', toCard: '1..N', label: '月末集約請求 (0..1:N)' },
    ],
    toggleLabel: '1回の出荷に複数受注を混載する（多対多→出荷明細連関）',
    relationsWithRedundant: [
      {
        tableName: '出荷（混載許可時）',
        attributes: [
          { name: '出荷番号', role: 'pk' },
          { name: '出荷日', role: 'none' },
          { name: '請求番号', role: 'fk', references: '請求', note: '締処理前はNULL' },
        ],
      },
      {
        tableName: '出荷明細（受注との多対多を解消）',
        attributes: [
          { name: '出荷番号', role: 'pkfk', references: '出荷' },
          { name: '受注番号', role: 'pkfk', references: '受注明細' },
          { name: '商品コード', role: 'pkfk', references: '受注明細' },
          { name: '出荷数量', role: 'none' },
        ],
        explanation: '1回の出荷便に複数受注を混載する場合、出荷と受注がM:Nになるため「出荷明細」で結ぶ。',
      },
    ],
    relationsWithoutRedundant: [
      {
        tableName: '受注',
        attributes: [
          { name: '受注番号', role: 'pk' },
          { name: '顧客コード', role: 'fk', references: '顧客' },
          { name: '受注日', role: 'none' },
        ],
      },
      {
        tableName: '出荷',
        attributes: [
          { name: '出荷番号', role: 'pk' },
          { name: '受注番号', role: 'fk', references: '受注', note: '分割元（NOT NULL）' },
          { name: '請求番号', role: 'fk', references: '請求', note: '集約先（請求確定前はNULL）' },
          { name: '出荷日', role: 'none' },
        ],
      },
      {
        tableName: '請求',
        attributes: [
          { name: '請求番号', role: 'pk' },
          { name: '顧客コード', role: 'fk', references: '顧客' },
          { name: '請求締日', role: 'none' },
          { name: '請求総額', role: 'none' },
        ],
      },
    ],
  },
];
