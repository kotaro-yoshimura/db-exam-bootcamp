// モジュール3用：過去問6年度分（R7秋・R6秋・R5秋・R3秋・H31春・H28春）CBT本番スプリット画面＆本文シグナル発掘データ
import type { CbtPastExam } from '../types/exam';

export const CBT_PAST_EXAMS: CbtPastExam[] = [
  {
    id: 'cbt-r7-autumn',
    year: 'R7秋',
    section: '午後Ⅱ 問1（概念データモデル・ECサブスク＆分納出荷）',
    title: 'サブスクリプション契約と複数回分納・請求集約システム',
    timeLimitMin: 60,
    category: '概念データモデル',
    backgroundText:
      'X社は法人・個人向けに事務機器のサブスクリプションと消耗品販売を行っている。今回、1件の注文を在庫状況に応じて複数回に分けて分納出荷でき、さらに同一顧客の当月出荷分を月末に1枚の請求書へ集約できる新基幹DBを設計することになった。',
    businessRules: [
      '会員は「個人会員」と「法人会員」のいずれか一方に必ず属し、会員IDで一意に識別される。法人会員のみ与信限度額を持ち、売掛請求の対象となる。',
      '1回の注文では複数種類の商品を指定できる。同一注文内で同じ商品を重複指定することはない。',
      '1つの注文明細に対して、在庫引当の結果に応じて複数回に分けて出荷（分納）が行われる場合がある。出荷は出荷番号ごとに識別される。',
      '法人会員への出荷は、締日ごとにまとめて高々1つの請求に紐づけられる。請求確定前の出荷は請求と関連付かない。',
    ],
    diagramEntities: [
      { id: 'member', name: '会員', x: 0.14, y: 0.25, kind: 'supertype', pkAttrs: ['会員ID'], otherAttrs: ['会員区分'] },
      { id: 'corp', name: '法人会員', x: 0.14, y: 0.72, kind: 'subtype', pkAttrs: ['会員ID(FK)'], otherAttrs: ['与信限度額'], redundantAttrs: ['[会員区分]'] },
      { id: 'ord', name: '注文', x: 0.44, y: 0.25, kind: 'entity', pkAttrs: ['注文番号'], otherAttrs: ['会員ID(FK)', '注文日'] },
      { id: 'ord_d', name: '注文明細', x: 0.44, y: 0.72, kind: 'associative', pkAttrs: ['注文番号(FK)', '商品コード(FK)'], otherAttrs: ['注文数量'] },
      { id: 'ship', name: '出荷', x: 0.78, y: 0.25, kind: 'entity', pkAttrs: ['出荷番号'], otherAttrs: ['出荷日', '請求番号(FK)'] },
      { id: 'inv', name: '請求', x: 0.78, y: 0.72, kind: 'entity', pkAttrs: ['請求番号'], otherAttrs: ['会員ID(FK)', '請求締日'] },
    ],
    diagramRelationships: [
      { from: 'member', to: 'corp', fromCard: '1', toCard: '0..1', isSubtypeEdge: true, subtypeRule: '排他(XOR)' },
      { from: 'member', to: 'ord', fromCard: '1', toCard: '0..N', label: '注文する' },
      { from: 'ord', to: 'ord_d', fromCard: '1', toCard: '1..N', label: '明細' },
      { from: 'ord_d', to: 'ship', fromCard: '1', toCard: '0..N', label: '分納出荷' },
      { from: 'inv', to: 'ship', fromCard: '0..1', toCard: '1..N', label: '月末集約' },
    ],
    a4MemoNotes: {
      entities: ['会員(スーパー) → 個人 / 法人[排他]', '注文 → 注文明細(連関) ← 商品', '出荷 ──(0..1:N)── 請求'],
      arrows: ['会員 1→N 注文（矢印は多側）', '注文明細 1→N 出荷明細（分納あり）', '請求 0..1→N 出荷（請求前はNULL）'],
      pkCandidates: ['注文明細 = {注文番号#, 商品コード#}', '出荷明細 = {出荷番号#, 注文番号#, 商品コード#}', '法人会員 = {会員ID#, [会員区分]}'],
      traps: ['請求番号は出荷側の外部キー（NULL許可）', '「いずれか一方」＝排他サブタイプ＋冗長属性[会員区分]'],
    },
    essayQuestions: [
      {
        id: 'r7-q1',
        label: '設問1(1)',
        prompt:
          '「法人会員」表にスーパータイプの属性である「会員区分」を冗長属性 [会員区分] として保持し、CHECK制約と複合外部キーを設定する設計上の理由を45字以内で述べよ。',
        maxChars: 45,
        officialAnswer: '個人会員の会員IDが誤って法人会員表に登録される不整合をDBMSの制約で防ぐため。',
        gradingPoints: [
          '個人会員（別サブタイプ）の誤登録防止に言及',
          'DBMSの参照整合性/CHECK制約で保証する点に言及',
        ],
        hint: '単なる会員IDだけの外部キーだと「個人会員の会員ID」でも参照整合性チェックを通過してしまう！',
      },
      {
        id: 'r7-q2',
        label: '設問1(2)',
        prompt:
          '「出荷」表の外部キー「請求番号」に NOT NULL 制約を付けてはならない理由を、業務プロセスの観点から35字以内で述べよ。',
        maxChars: 35,
        officialAnswer: '出荷時点では月末の請求が確定しておらず、請求番号が未定だから。',
        gradingPoints: [
          '出荷時点と請求確定時点のタイミングのずれ（未請求状態）を明記',
        ],
        hint: '出荷レコードがINSERTされるタイミングと、請求番号が採番されるタイミングの違いを考える。',
      },
    ],
    schemaQuestion: {
      id: 'r7-schema',
      prompt: '分納に対応する「出荷明細」表の主キー（実線）・外部キー（破線）・主兼外（二重線）をすべて正しく指定せよ。',
      schema: {
        tableName: '出荷明細',
        attributes: [
          { name: '出荷番号', role: 'pkfk', references: '出荷' },
          { name: '注文番号', role: 'pkfk', references: '注文明細' },
          { name: '商品コード', role: 'pkfk', references: '注文明細' },
          { name: '出荷倉庫コード', role: 'fk', references: '倉庫' },
          { name: '出荷数量', role: 'none' },
        ],
        explanation:
          '出荷と注文明細(注文番号, 商品コード)が多対多となる場合、出荷番号・注文番号・商品コードの3つすべてが主キー兼外部キー（二重線）となる。出荷倉庫コードは純粋外部キー（破線）。',
      },
    },
    signalDrill: {
      id: 'r7-signal',
      instruction: '以下の午後問題本文から「主キー構成・多重度・サブタイプ」の決定打となるシグナル表現をすべてタップして発掘せよ！',
      segments: [
        { id: 'r7s1', text: '会員は、', isSignal: false },
        {
          id: 'r7s2',
          text: '個人会員と法人会員のいずれか一方に必ず属し、',
          isSignal: true,
          signalKind: 'サブタイプ/排他',
          explanation: '「いずれか一方に必ず属する」＝完全かつ排他（XOR）なサブタイプ構造の決定打！',
        },
        {
          id: 'r7s3',
          text: '会員IDごとに一意に識別される。',
          isSignal: true,
          signalKind: '主キー根拠',
          explanation: '「〇〇ごとに一意に識別」＝スーパータイプ「会員」の主キーが会員IDであることを確定。',
        },
        { id: 'r7s4', text: '注文は画面から受け付け、', isSignal: false },
        {
          id: 'r7s5',
          text: '同一注文内で同じ商品を重複指定することはない。',
          isSignal: true,
          signalKind: '複合主キー',
          explanation: '重複指定なし＝「注文明細」の主キーは明細行番号ではなく {注文番号, 商品コード} の複合PKに確定！',
        },
        { id: 'r7s6', text: 'その後、出荷指示が行われ、', isSignal: false },
        {
          id: 'r7s7',
          text: '1件の出荷は高々1つの請求に紐づけられる。',
          isSignal: true,
          signalKind: '多重度1対多',
          explanation: '「高々1つ」＝0または1（0..1）。請求側が「0..1」、出荷側が「多」かつ出荷表の請求番号FKはNULL許容！',
        },
      ],
    },
  },
  {
    id: 'cbt-r6-autumn',
    year: 'R6秋',
    section: '午後Ⅰ 問1（物理設計・クラスタ索引＆容量設計）',
    title: 'シェアサイクル貸出履歴の検索性能改善と索引選定',
    timeLimitMin: 45,
    category: '物理設計・障害回復',
    backgroundText:
      'Y社のシェアサイクル運行DBでは「利用履歴」表が1,000万行を超え、利用日範囲検索とポート別集計が遅延している。現在、主キー（利用ID：連番）にクラスタ索引が張られ、ポートID列に非クラスタ（低クラスタ）索引が張られている。',
    businessRules: [
      '利用履歴は利用開始日時順に連番の利用IDが採番され、ほぼ時系列順にデータページへ格納される。',
      '日次バッチは直近1日分（全体の約0.3%、3万行）を利用開始日時で抽出し、ポートごとに集計する。',
      '特定ポートの過去1年分（全体の約5%、50万行）を検索するSQLで、非クラスタ索引を使うと表探索（フルスキャン）より大幅に遅くなる現象が発生した。',
    ],
    diagramEntities: [
      { id: 'port', name: 'ポート', x: 0.2, y: 0.45, kind: 'entity', pkAttrs: ['ポートID'], otherAttrs: ['ポート名', '収容台数'] },
      { id: 'bike', name: '自転車', x: 0.5, y: 0.2, kind: 'entity', pkAttrs: ['自転車ID'], otherAttrs: ['型式', '現在ポートID(FK)'] },
      { id: 'ride', name: '利用履歴(1000万行)', x: 0.72, y: 0.58, kind: 'associative', pkAttrs: ['利用ID'], otherAttrs: ['会員ID(FK)', '貸出ポートID(FK)', '返却ポートID(FK)', '利用開始日時'] },
    ],
    diagramRelationships: [
      { from: 'port', to: 'ride', fromCard: '1', toCard: '0..N', label: '貸出ポート', curveOffset: -35 },
      { from: 'port', to: 'ride', fromCard: '1', toCard: '0..N', label: '返却ポート', curveOffset: 35 },
      { from: 'bike', to: 'ride', fromCard: '1', toCard: '0..N', label: '利用される' },
    ],
    a4MemoNotes: {
      entities: ['ポート ←(貸出/返却の2ロール)─ 利用履歴(1000万行)'],
      arrows: ['高クラスタ：ページ連続 → ceil(抽出行/1P行数)', '低クラスタ：散乱 → 抽出行数そのままのI/O！'],
      pkCandidates: ['利用履歴：主キー＝利用ID（開始日時と強相関）', '複合索引候補：(貸出ポートID, 利用開始日時)'],
      traps: ['低クラスタ索引は抽出率数%で表探索(全ページ)を上回る！', 'インデックスオンリースキャン（カバリング索引）で表アクセス0化'],
    },
    essayQuestions: [
      {
        id: 'r6-q1',
        label: '設問2(1)',
        prompt:
          '抽出率が全体の5%であるにもかかわらず、ポートIDの非クラスタ索引を使うと全表探索よりページI/O数が増大する理由を50字以内で述べよ。',
        maxChars: 50,
        officialAnswer: '同一ポートの行が複数のデータページに分散しており、行ごとにランダムI/Oで同一ページを重複読込するから。',
        gradingPoints: [
          '低クラスタ（データがページ全体に分散している点）に言及',
          'ランダムアクセスによる同一ページの重複I/O発生に言及',
        ],
        hint: '高クラスタ索引のI/Oは ceil(抽出行/ページ内行数) だが、低クラスタは最悪「抽出行数そのまま」になる！',
      },
      {
        id: 'r6-q2',
        label: '設問2(2)',
        prompt:
          'ポートIDでの検索時にデータページへのアクセスを一切行わずに結果を得るための索引設計手法と具体的な列構成を40字以内で答えよ。',
        maxChars: 40,
        officialAnswer: '索引だけで検索が完了する複合索引（貸出ポートID、利用開始日時、利用料金）を作成する。',
        gradingPoints: [
          'インデックスオンリースキャン（カバリング索引）の意図が明確',
          'WHERE句とSELECT句の必要列を複合索引に含める点',
        ],
        hint: 'SELECT句で参照する列も索引のキー（またはINCLUDE列）に含めると表本体を読まずに済む！',
      },
    ],
    schemaQuestion: {
      id: 'r6-schema',
      prompt: '貸出・返却の2役割を持つ「利用履歴」表の下線（主キー・外部キー・主兼外）を正しく指定せよ。',
      schema: {
        tableName: '利用履歴',
        attributes: [
          { name: '利用ID', role: 'pk' },
          { name: '会員ID', role: 'fk', references: '会員' },
          { name: '自転車ID', role: 'fk', references: '自転車' },
          { name: '貸出ポートID', role: 'fk', references: 'ポート' },
          { name: '返却ポートID', role: 'fk', references: 'ポート' },
          { name: '利用開始日時', role: 'none' },
        ],
        explanation: '貸出ポートIDと返却ポートIDは同一エンティティ「ポート」への複数役割外部キー（ともに破線）。利用開始日時は非キー。',
      },
    },
    signalDrill: {
      id: 'r6-signal',
      instruction: '本文から「複数役割」「NULL許容」「履歴管理」のシグナル表現をタップして発掘せよ！',
      segments: [
        { id: 'r6s1', text: '会員は自転車を借りる際、', isSignal: false },
        {
          id: 'r6s2',
          text: '貸出ポートとは異なる返却ポートに乗り捨て返却できる。',
          isSignal: true,
          signalKind: '多重度1対多',
          explanation: '同一エンティティ「ポート」に対して「貸出」「返却」の2つの役割（ロール付き外部キー2本）が必要！',
        },
        { id: 'r6s3', text: 'なお、走行中の利用履歴については、', isSignal: false },
        {
          id: 'r6s4',
          text: '返却完了まで返却ポートは未定である。',
          isSignal: true,
          signalKind: '多重度1対多',
          explanation: '返却前は0件（0..1）となるため、返却ポートIDは NULL 許容の外部キーとなる！',
        },
        {
          id: 'r6s5',
          text: '同一会員が同じ日に複数回利用することもある。',
          isSignal: true,
          signalKind: '履歴/時系列',
          explanation: '{会員ID, 利用日} では一意にならず、利用ID（サロゲートキー）または利用開始日時まで含めた主キーが必要！',
        },
      ],
    },
  },
  {
    id: 'cbt-r5-autumn',
    year: 'R5秋',
    section: '午後Ⅱ 問2（物流・排他制御＆チェックポイント障害回復）',
    title: '倉庫在庫引当のデッドロック対策とチェックポイント回復設計',
    timeLimitMin: 60,
    category: '物理設計・障害回復',
    backgroundText:
      'Z物流の倉庫管理システムでは、複数のピッキング端末から同時に同一商品の在庫引当と移動更新が行われる。ピーク時にデッドロックが頻発し、また夜間バッチ直後のシステム障害時にRDBMSの再開始時間が30分を超過する問題が露呈した。',
    businessRules: [
      '倉庫間移動トランザクションは「移動元倉庫の在庫行」を排他ロック(X)した後、「移動先倉庫の在庫行」を排他ロック(X)して数量を更新する。',
      '倉庫A→Bへの移動と、倉庫B→Aへの移動が同時実行されると、互いに相手が保持する排他ロックの解放待ちとなりデッドロックが発生する。',
      '夜間一括バッチではチェックポイント間隔が極端に長く設定されていたため、障害発生後のREDO対象ログが膨大になっていた。',
    ],
    diagramEntities: [
      { id: 'wh', name: '倉庫', x: 0.2, y: 0.48, kind: 'entity', pkAttrs: ['倉庫コード'], otherAttrs: ['倉庫名'] },
      { id: 'stock', name: '倉庫別在庫', x: 0.52, y: 0.25, kind: 'associative', pkAttrs: ['倉庫コード(FK)', '商品コード(FK)'], otherAttrs: ['在庫数', '引当済数'] },
      { id: 'move', name: '在庫移動指示', x: 0.52, y: 0.74, kind: 'entity', pkAttrs: ['移動指示番号'], otherAttrs: ['移動元倉庫(FK)', '移動先倉庫(FK)', '商品コード(FK)'] },
      { id: 'item', name: '商品', x: 0.84, y: 0.48, kind: 'entity', pkAttrs: ['商品コード'], otherAttrs: ['商品名'] },
    ],
    diagramRelationships: [
      { from: 'wh', to: 'stock', fromCard: '1', toCard: '0..N', label: '保管' },
      { from: 'item', to: 'stock', fromCard: '1', toCard: '0..N', label: '在庫' },
      { from: 'wh', to: 'move', fromCard: '1', toCard: '0..N', label: '移動元/先(2本)', curveOffset: 30 },
      { from: 'item', to: 'move', fromCard: '1', toCard: '0..N', label: '対象商品' },
    ],
    a4MemoNotes: {
      entities: ['倉庫 1:N 倉庫別在庫 N:1 商品', '在庫移動指示(移動元倉庫FK, 移動先倉庫FK)'],
      arrows: ['デッドロック原因：A→Bロック と B→Aロックの逆順獲得', '対策：倉庫コード昇順に統一してロック獲得'],
      pkCandidates: ['倉庫別在庫 = {倉庫コード#, 商品コード#}'],
      traps: ['CP前コミット＝回復不要 / CP後コミット＝REDO / 未コミット＝UNDO', 'ロック粒度拡大は同時実行性を下げるため順序統一が最善'],
    },
    essayQuestions: [
      {
        id: 'r5-q1',
        label: '設問3(1)',
        prompt:
          '倉庫A⇔B間の同時在庫移動で発生するデッドロックを、ロック粒度を広げずにアプリケーション側で確実に防止する方法を40字以内で述べよ。',
        maxChars: 40,
        officialAnswer: '移動元・移動先にかかわらず、倉庫コードの昇順など一定の順序で排他ロックを獲得する。',
        gradingPoints: [
          'ロック獲得順序の統一（倉庫コード昇順など）を明記',
          '循環待ち（Wait-For Graphの閉路）を断ち切る対策になっている点',
        ],
        hint: 'デッドロックの4条件のうち「循環待ち」を破る最も定石のアプリケーション対策！',
      },
      {
        id: 'r5-q2',
        label: '設問3(2)',
        prompt:
          '夜間バッチ中にチェックポイントを適切な間隔で取得することでRDBMS再開始時間が短縮される理由を45字以内で述べよ。',
        maxChars: 45,
        officialAnswer: 'ダーティページがDBへ書き出され、障害時にロールフォワード（REDO）するログ量が減るから。',
        gradingPoints: [
          'バッファ上の更新済みページ（ダーティページ）のディスク書出し',
          '障害回復時のREDO対象ログ削減に言及',
        ],
        hint: 'チェックポイント完了前にコミット済みのトランザクションはディスク反映済みなのでREDO不要になる！',
      },
    ],
    schemaQuestion: {
      id: 'r5-schema',
      prompt: '「倉庫別在庫」表の主キー・外部キー・主兼外を正しく指定せよ。',
      schema: {
        tableName: '倉庫別在庫',
        attributes: [
          { name: '倉庫コード', role: 'pkfk', references: '倉庫' },
          { name: '商品コード', role: 'pkfk', references: '商品' },
          { name: '管理担当者ID', role: 'fk', references: '社員' },
          { name: '実在庫数', role: 'none' },
          { name: '引当済数', role: 'none' },
        ],
        explanation: '倉庫×商品の連関表なので倉庫コード・商品コードは主兼外（二重線）、管理担当者IDは外部キー（破線）。',
      },
    },
    signalDrill: {
      id: 'r5-signal',
      instruction: '排他制御・在庫モデルに関する重要シグナルをタップして発掘せよ！',
      segments: [
        { id: 'r5s1', text: '各商品は複数の倉庫に保管でき、', isSignal: false },
        {
          id: 'r5s2',
          text: '倉庫と商品の組合せごとに1つの在庫レコードで管理する。',
          isSignal: true,
          signalKind: '複合主キー',
          explanation: '「AとBの組合せごとに1つ」＝連関エンティティの複合主キー {倉庫コード, 商品コード} の決定打！',
        },
        { id: 'r5s3', text: '在庫移動時は、', isSignal: false },
        {
          id: 'r5s4',
          text: '移動元倉庫と移動先倉庫の2行を同一トランザクション内で更新する。',
          isSignal: true,
          signalKind: '多重度1対多',
          explanation: '同一倉庫表の2行更新＝複数役割FK（移動元/移動先）＋逆順ロックによるデッドロック危険箇所！',
        },
        {
          id: 'r5s5',
          text: '移動履歴は同一日に同一倉庫間で複数回発生し得る。',
          isSignal: true,
          signalKind: '履歴/時系列',
          explanation: '同一日に複数回＝日付だけでは一意にならず、移動指示番号や時刻・連番が主キーに必要！',
        },
      ],
    },
  },
  {
    id: 'cbt-r3-autumn',
    year: 'R3秋',
    section: '午後Ⅱ 問1（マイクロサービス・補償TX vs 2PC・組織再帰）',
    title: '分散予約システムにおける2相コミット課題とSaga補償トランザクション',
    timeLimitMin: 60,
    category: '論理設計・SQL',
    backgroundText:
      '旅行予約サイトでは「航空券予約DB」「ホテル予約DB」「決済DB」が独立したマイクロサービスとして稼働している。従来は2相コミット（2PC）を検討したが、外部決済APIを含む高負荷環境でのブロッキングが課題となり、補償トランザクション（Saga）方式へ転換する。',
    businessRules: [
      '旅行パッケージの予約は「航空券仮押さえ → ホテル予約 → 決済確定」の順に各サービスのローカルトランザクションを実行する。',
      '決済確定が失敗した場合、すでにコミット済みの「ホテル予約」と「航空券仮押さえ」を取り消す補償トランザクションを逆順に実行する。',
      '組織階層（本社→支社→営業所）は自己参照構造を持ち、任意の組織配下の全売上を再帰SQL（WITH RECURSIVE）で集計する。',
    ],
    diagramEntities: [
      { id: 'trip', name: '旅行予約', x: 0.2, y: 0.5, kind: 'entity', pkAttrs: ['旅行予約ID'], otherAttrs: ['顧客ID(FK)', '予約状態'] },
      { id: 'flight', name: '航空券予約', x: 0.55, y: 0.22, kind: 'entity', pkAttrs: ['航空予約ID'], otherAttrs: ['旅行予約ID(FK)', '補償状態'] },
      { id: 'hotel', name: 'ホテル予約', x: 0.55, y: 0.5, kind: 'entity', pkAttrs: ['宿泊予約ID'], otherAttrs: ['旅行予約ID(FK)', '補償状態'] },
      { id: 'pay', name: '決済', x: 0.55, y: 0.78, kind: 'entity', pkAttrs: ['決済ID'], otherAttrs: ['旅行予約ID(FK)', '結果区分'] },
      { id: 'org', name: '販売組織', x: 0.85, y: 0.5, kind: 'entity', pkAttrs: ['組織コード'], otherAttrs: ['上位組織コード(FK)'] },
    ],
    diagramRelationships: [
      { from: 'trip', to: 'flight', fromCard: '1', toCard: '0..N', label: 'TX1' },
      { from: 'trip', to: 'hotel', fromCard: '1', toCard: '0..N', label: 'TX2' },
      { from: 'trip', to: 'pay', fromCard: '1', toCard: '0..1', label: 'TX3' },
      { from: 'org', to: 'org', fromCard: '0..1', toCard: '0..N', label: '自己参照階層', curveOffset: -70 },
    ],
    a4MemoNotes: {
      entities: ['旅行予約 1:N 航空券/ホテル / 0..1 決済', '販売組織（自己参照1:N 上位組織コードNULL可）'],
      arrows: ['2PC：Prepare後にロック長期保持→コーディネータ障害でブロッキング', 'Saga：即時コミット→失敗時は逆順で補償TX（結果整合性）'],
      pkCandidates: ['販売組織 = {組織コード} / 上位組織コード(FK, NULL可)'],
      traps: ['Sagaは分離性(Isolation)が弱いため「仮予約状態」の設計や冪等性が必須！'],
    },
    essayQuestions: [
      {
        id: 'r3-q1',
        label: '設問1(1)',
        prompt:
          'マイクロサービス間で2相コミット（2PC）を採用した場合に可用性・性能が低下する主な理由を45字以内で述べよ。',
        maxChars: 45,
        officialAnswer: '全ノードの合意完了までロックを長期保持し、調停者障害時に参加DBがブロッキング状態になるから。',
        gradingPoints: [
          'ロック保持時間の長期化によるスループット低下',
          'コーディネータ（調停者）障害時のブロッキング（インダウト状態）に言及',
        ],
        hint: 'Prepareフェーズで「コミット可能」と返答した参加者は、最終指示が来るまでロックを解放できない！',
      },
      {
        id: 'r3-q2',
        label: '設問1(2)',
        prompt:
          '補償トランザクション（Saga）方式ではACID特性のうち分離性（Isolation）が完全に保証されない。業務上の不整合を防ぐための設計工夫を40字以内で述べよ。',
        maxChars: 40,
        officialAnswer: '「仮予約中」などのセマンティックロック状態を設け、補償処理には冪等性を持たせる。',
        gradingPoints: [
          '状態フラグ（仮予約・保留など）によるアプリケーションレベルの制御（セマンティックロック）',
          '再送に備えた冪等性（複数回実行しても結果同一）への言及',
        ],
        hint: '他トランザクションから「途中までコミット済みのデータ」が見えてしまう問題への対処法！',
      },
    ],
    schemaQuestion: {
      id: 'r3-schema',
      prompt: '組織階層を表す自己参照テーブル「販売組織」の下線を正しく指定せよ。',
      schema: {
        tableName: '販売組織',
        attributes: [
          { name: '組織コード', role: 'pk' },
          { name: '組織名', role: 'none' },
          { name: '上位組織コード', role: 'fk', references: '販売組織' },
          { name: '責任者社員ID', role: 'fk', references: '社員' },
        ],
        explanation: '上位組織コードは自テーブル「販売組織」の主キーを参照する自己参照外部キー（破線・NULL許容）。',
      },
    },
    signalDrill: {
      id: 'r3-signal',
      instruction: '自己参照階層と分散トランザクション要件のシグナルをタップして発掘せよ！',
      segments: [
        {
          id: 'r3s1',
          text: '各販売組織は高々1つの上位組織に属し、',
          isSignal: true,
          signalKind: '多重度1対多',
          explanation: '「高々1つの上位組織」＝自己参照の0..1対多（ツリー構造）。上位組織コードFK（NULL許容）が確定！',
        },
        {
          id: 'r3s2',
          text: '最上位の本社には上位組織が存在しない。',
          isSignal: true,
          signalKind: '多重度1対多',
          explanation: '最上位ノードの存在＝自己参照FKはNOT NULLにしてはいけない（0..1側）根拠！',
        },
        { id: 'r3s3', text: 'また予約処理では、', isSignal: false },
        {
          id: 'r3s4',
          text: '1回の旅行予約に複数のホテル宿泊を含めることができる。',
          isSignal: true,
          signalKind: '多重度1対多',
          explanation: '旅行予約 1 : N ホテル予約 → ホテル予約側が「旅行予約ID」を外部キーとして保持！',
        },
      ],
    },
  },
  {
    id: 'cbt-h31-spring',
    year: 'H31春',
    section: '午後Ⅱ 問1（製造・工程作業・部品構成BOM）',
    title: '多品種少量生産の工程指示と部品消費実績モデル',
    timeLimitMin: 60,
    category: '概念データモデル',
    backgroundText:
      '精密機器メーカーM社では、顧客仕様に合わせた受注生産を行っている。1つの製品は複数の部品から構成され、同じ汎用部品が複数の親製品や中間ユニットに共通利用される。',
    businessRules: [
      '部品は完成品・中間品・購入部品に分類され、親部品と子部品は多対多の部品構成（BOM）関係にある。',
      '製造指図ごとに複数の工程作業が工程順番号で識別され、各工程作業で複数の部品が消費される。',
      '同一工程作業内で同じ部品を複数ロットから消費する場合があるため、ロット番号ごとに消費実績を記録する。',
    ],
    diagramEntities: [
      { id: 'part', name: '部品', x: 0.18, y: 0.25, kind: 'entity', pkAttrs: ['部品コード'], otherAttrs: ['部品名', '部品区分'] },
      { id: 'bom', name: '部品構成(BOM)', x: 0.18, y: 0.72, kind: 'associative', pkAttrs: ['親部品コード(FK)', '子部品コード(FK)'], otherAttrs: ['員数'] },
      { id: 'mo', name: '製造指図', x: 0.54, y: 0.25, kind: 'entity', pkAttrs: ['製造指図番号'], otherAttrs: ['製品部品コード(FK)', '指図数量'] },
      { id: 'op', name: '工程作業', x: 0.54, y: 0.72, kind: 'entity', pkAttrs: ['製造指図番号(FK)', '工程順'], otherAttrs: ['作業者ID(FK)'] },
      { id: 'use', name: '部品消費実績', x: 0.85, y: 0.5, kind: 'associative', pkAttrs: ['製造指図番号(FK)', '工程順(FK)', '部品コード(FK)', 'ロット番号'], otherAttrs: ['消費数'] },
    ],
    diagramRelationships: [
      { from: 'part', to: 'bom', fromCard: '1', toCard: '0..N', label: '親/子(2本)', curveOffset: -25 },
      { from: 'part', to: 'mo', fromCard: '1', toCard: '0..N', label: '製造対象' },
      { from: 'mo', to: 'op', fromCard: '1', toCard: '1..N', label: '工程展開' },
      { from: 'op', to: 'use', fromCard: '1', toCard: '0..N', label: '部品消費' },
    ],
    a4MemoNotes: {
      entities: ['部品 1:N(親/子2本) 部品構成(BOM)', '製造指図 → 工程作業 → 部品消費実績'],
      arrows: ['BOMは多対多なので自己参照FK不可→必ず連関エンティティ！', '工程作業の複合PKが部品消費実績へ複合FKとして伝播'],
      pkCandidates: ['部品構成 = {親部品コード#, 子部品コード#}', '部品消費実績 = {製造指図番号#, 工程順#, 部品コード#, ロット番号}'],
      traps: ['工程順も親「工程作業」の複合PKの一部なので破線必須！'],
    },
    essayQuestions: [
      {
        id: 'h31-q1',
        label: '設問2(1)',
        prompt:
          '部品構成（BOM）を「部品」表内の自己参照外部キー（親部品コード）だけでは表現できない理由を40字以内で述べよ。',
        maxChars: 40,
        officialAnswer: '1つの子部品が複数の親部品に共通利用される多対多の関係を表現できないから。',
        gradingPoints: [
          '1つの部品が複数の親を持つ（多対多 / ネットワーク構造）点に言及',
        ],
        hint: '自己参照外部キー1本で表せるのは「親が高々1つ（1対多のツリー）」だけ！',
      },
    ],
    schemaQuestion: {
      id: 'h31-schema',
      prompt: '自己参照の多対多を解消する「部品構成（BOM）」表の下線を正しく指定せよ。',
      schema: {
        tableName: '部品構成',
        attributes: [
          { name: '親部品コード', role: 'pkfk', references: '部品' },
          { name: '子部品コード', role: 'pkfk', references: '部品' },
          { name: '必要員数', role: 'none' },
          { name: '有効開始日', role: 'none' },
        ],
        explanation: '親部品コード・子部品コードともに「部品」表の主キーを参照する主キー兼外部キー（二重線）。',
      },
    },
    signalDrill: {
      id: 'h31-signal',
      instruction: '製造・BOMモデルで主キー構造を決めるシグナル表現を発掘せよ！',
      segments: [
        {
          id: 'h31s1',
          text: '同じ汎用部品が複数の親製品に共通して組み込まれる。',
          isSignal: true,
          signalKind: '多重度多対多',
          explanation: '子部品から見て親が複数＝多対多のBOM構造。連関エンティティ「部品構成(親部品コード, 子部品コード)」が必須！',
        },
        { id: 'h31s2', text: '製造現場では、', isSignal: false },
        {
          id: 'h31s3',
          text: '同一工程作業内で同じ部品を複数ロットから消費する場合がある。',
          isSignal: true,
          signalKind: '複合主キー',
          explanation: '{製造指図番号, 工程順, 部品コード} だけでは一意にならず、「ロット番号」を主キーに追加する決定打！',
        },
      ],
    },
  },
  {
    id: 'cbt-h28-spring',
    year: 'H28春',
    section: '午後Ⅰ 問2（物理容量見積り4096B・PCTFREE＆単価履歴）',
    title: '4096Bページ空き領域率（PCTFREE）容量設計と単価履歴管理',
    timeLimitMin: 45,
    category: '物理設計・障害回復',
    backgroundText:
      '金融サービスF社では、契約マスタおよび日次取引明細表の容量見積りを行っている。ページサイズ 4,096B、制御ヘッダ 96B、空き領域率（PCTFREE）20%、1行長 200B の条件下で必要ページ数を正確に算出し、将来の行更新によるページ分割（行移行）を抑制する。',
    businessRules: [
      '商品の適用単価は改定されることがあり、適用開始日ごとに単価履歴を保持する。',
      'ページ内の最大格納行数は必ず小数点以下切捨て（floor）、テーブル全体の必要ページ数は必ず小数点以下切上げ（ceil）で算出する。',
      'PCTFREE（空き領域率）を確保しないまま可変長列のUPDATEを行うと、ページ溢れによる「行移行（Row Migration）」が発生し、1行取得に2ページI/Oを要して性能劣化する。',
    ],
    diagramEntities: [
      { id: 'prod', name: '商品', x: 0.22, y: 0.48, kind: 'entity', pkAttrs: ['商品コード'], otherAttrs: ['商品名'] },
      { id: 'price', name: '商品単価履歴', x: 0.56, y: 0.48, kind: 'entity', pkAttrs: ['商品コード(FK)', '適用開始日'], otherAttrs: ['単価'] },
      { id: 'tx', name: '取引明細(4096B頁)', x: 0.85, y: 0.48, kind: 'entity', pkAttrs: ['取引ID'], otherAttrs: ['商品コード(FK)', '取引日', '取引金額'] },
    ],
    diagramRelationships: [
      { from: 'prod', to: 'price', fromCard: '1', toCard: '1..N', label: '改定履歴' },
      { from: 'prod', to: 'tx', fromCard: '1', toCard: '0..N', label: '取引対象' },
    ],
    a4MemoNotes: {
      entities: ['商品 1:N 商品単価履歴(商品コード#, 適用開始日)'],
      arrows: ['1P最大行数 = floor(利用可能B / 1行長) ※必ず切捨て！', '必要ページ数 = ceil(総行数 / 1P最大行数) ※必ず切上げ！'],
      pkCandidates: ['商品単価履歴 = {商品コード#(FK), 適用開始日(PK)}'],
      traps: ['4096Bのヘッダ96Bを引く順序（先引き vs 後引き）は問題文の定義式を厳守！', '行移行（ポインタ連鎖）防止のためにPCTFREEを確保する'],
    },
    essayQuestions: [
      {
        id: 'h28-q1',
        label: '設問2(1)',
        prompt:
          '可変長列を含む表に適切な空き領域率（PCTFREE）を設定しないまま更新を繰り返した場合に生じる物理現象と性能への悪影響を45字以内で述べよ。',
        maxChars: 45,
        officialAnswer: '行長増加でページに収まらず行移行が発生し、ポインタ経由の追加I/Oで検索性能が低下する。',
        gradingPoints: [
          '行移行（またはページ分割・オーバフロー領域への退避）の発生',
          '間接参照による追加ディスクI/O発生と性能低下',
        ],
        hint: '更新で行サイズが増えたとき、元のページに空きがないと別ページへ追い出され、元ページに転送ポインタが残る！',
      },
    ],
    schemaQuestion: {
      id: 'h28-schema',
      prompt: '時系列の単価改定を管理する「商品単価履歴」表の下線を正しく指定せよ。',
      schema: {
        tableName: '商品単価履歴',
        attributes: [
          { name: '商品コード', role: 'pkfk', references: '商品' },
          { name: '適用開始日', role: 'pk' },
          { name: '改定承認者ID', role: 'fk', references: '社員' },
          { name: '単価', role: 'none' },
        ],
        explanation: '商品コードは親「商品」参照の主兼外（二重線）、適用開始日は純粋主キー（実線）、改定承認者IDは外部キー（破線）。',
      },
    },
    signalDrill: {
      id: 'h28-signal',
      instruction: '履歴主キーと物理設計の決定打シグナルをタップして発掘せよ！',
      segments: [
        {
          id: 'h28s1',
          text: '商品単価は適用開始日ごとに改定履歴を保持し、同日に複数回改定することはない。',
          isSignal: true,
          signalKind: '履歴/時系列',
          explanation: '同日複数回なし＝{商品コード, 適用開始日} で一意に決まる複合主キーが確定！',
        },
        { id: 'h28s2', text: 'また、テーブル容量設計では、', isSignal: false },
        {
          id: 'h28s3',
          text: '1行を複数ページにまたがって格納することはできない。',
          isSignal: true,
          signalKind: '主キー根拠',
          explanation: '行跨ぎ不可＝1ページ最大格納行数は必ず小数点以下「切捨て（floor）」、必要ページ数は「切上げ（ceil）」！',
        },
      ],
    },
  },
];
