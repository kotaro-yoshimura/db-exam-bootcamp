// モジュール2：実機SQL道場（sql.js WASM ＋ オフライン評価＆プリコンパイルキャッシュ）データ
import type { SqlDrillProblem } from '../types/exam';

/**
 * 過去問準拠 実機SQL道場 6問（R7秋・R6秋・R5秋・R3秋・H31春・H28春）
 */
export const SQL_DRILLS: SqlDrillProblem[] = [
  {
    id: 'sql-r7-window-moving',
    year: 'R7秋',
    examSection: '午後Ⅰ 問2（販売分析・ウィンドウ関数）',
    title: '店舗別の累計売上と直近3日間の移動平均（ROWSフレーム）',
    category: 'window',
    difficulty: '標準',
    description:
      '日別売上表 `daily_sales` から、店舗コード（store_id）ごとに売上日（sale_date）昇順で「店舗別累計売上（cum_sales）」と「当日を含む直近3行の移動平均（ma3_sales、小数第1位丸め）」を算出するSQLを作成せよ。結果は store_id, sale_date の昇順とすること。',
    schemaSql: `
      CREATE TABLE daily_sales (
        store_id TEXT,
        sale_date TEXT,
        amount INTEGER
      );
    `,
    seedSql: `
      INSERT INTO daily_sales VALUES
        ('S01', '2026-10-01', 120),
        ('S01', '2026-10-02', 150),
        ('S01', '2026-10-03', 180),
        ('S01', '2026-10-04', 90),
        ('S02', '2026-10-01', 200),
        ('S02', '2026-10-02', 140),
        ('S02', '2026-10-03', 260);
    `,
    starterSql: `SELECT
  store_id,
  sale_date,
  amount,
  -- ここに店舗別累計売上 (cum_sales) と直近3日移動平均 (ma3_sales) を記述
  SUM(amount) OVER (
    PARTITION BY store_id
    ORDER BY sale_date
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS cum_sales,
  ROUND(AVG(amount) OVER (
    PARTITION BY store_id
    ORDER BY sale_date
    ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
  ), 1) AS ma3_sales
FROM daily_sales
ORDER BY store_id, sale_date;`,
    answerSql: `SELECT
  store_id,
  sale_date,
  amount,
  SUM(amount) OVER (
    PARTITION BY store_id
    ORDER BY sale_date
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS cum_sales,
  ROUND(AVG(amount) OVER (
    PARTITION BY store_id
    ORDER BY sale_date
    ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
  ), 1) AS ma3_sales
FROM daily_sales
ORDER BY store_id, sale_date;`,
    explanation:
      'ROWS BETWEEN 2 PRECEDING AND CURRENT ROW は「物理的に2行前から現在行まで」をフレームに含める。ORDER BY だけ書いてフレーム句を省略するとデフォルトは RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW になり、同値キー（タイ）がある場合に挙動が変わる点がDBスペシャリスト試験の超頻出ポイント！',
    offlineTables: {
      daily_sales: [
        { store_id: 'S01', sale_date: '2026-10-01', amount: 120 },
        { store_id: 'S01', sale_date: '2026-10-02', amount: 150 },
        { store_id: 'S01', sale_date: '2026-10-03', amount: 180 },
        { store_id: 'S01', sale_date: '2026-10-04', amount: 90 },
        { store_id: 'S02', sale_date: '2026-10-01', amount: 200 },
        { store_id: 'S02', sale_date: '2026-10-02', amount: 140 },
        { store_id: 'S02', sale_date: '2026-10-03', amount: 260 },
      ],
    },
    expectedResult: {
      columns: ['store_id', 'sale_date', 'amount', 'cum_sales', 'ma3_sales'],
      rows: [
        ['S01', '2026-10-01', 120, 120, 120],
        ['S01', '2026-10-02', 150, 270, 135],
        ['S01', '2026-10-03', 180, 450, 150],
        ['S01', '2026-10-04', 90, 540, 140],
        ['S02', '2026-10-01', 200, 200, 200],
        ['S02', '2026-10-02', 140, 340, 170],
        ['S02', '2026-10-03', 260, 600, 200],
      ],
      engine: 'offline-cache',
      executionMs: 0.5,
    },
    requiredKeywords: ['partition by', 'order by', '2 preceding', 'current row', 'sum', 'avg'],
    windowPresetId: 'moving-avg',
  },
  {
    id: 'sql-r6-rank-lag',
    year: 'R6秋',
    examSection: '午後Ⅰ 問3（営業成績ランキング＆前月比）',
    title: '部門内順位（RANK vs DENSE_RANK）と1位との差分算出',
    category: 'window',
    difficulty: '標準',
    description:
      '営業実績表 `emp_perf` から、部門（dept）ごとの売上高（sales）降順で `RANK()`（rnk）、`DENSE_RANK()`（drnk）、および同一部門内の1位売上との差額（diff_from_top = MAX(sales) OVER(...) - sales）を求めよ。結果は dept 昇順、sales 降順、emp_name 昇順とする。',
    schemaSql: `
      CREATE TABLE emp_perf (
        dept TEXT,
        emp_name TEXT,
        sales INTEGER
      );
    `,
    seedSql: `
      INSERT INTO emp_perf VALUES
        ('東日本', '佐藤', 500),
        ('東日本', '鈴木', 500),
        ('東日本', '高橋', 420),
        ('西日本', '田中', 600),
        ('西日本', '伊藤', 450),
        ('西日本', '渡辺', 450);
    `,
    starterSql: `SELECT
  dept,
  emp_name,
  sales,
  RANK() OVER (PARTITION BY dept ORDER BY sales DESC) AS rnk,
  DENSE_RANK() OVER (PARTITION BY dept ORDER BY sales DESC) AS drnk,
  MAX(sales) OVER (PARTITION BY dept) - sales AS diff_from_top
FROM emp_perf
ORDER BY dept, sales DESC, emp_name;`,
    answerSql: `SELECT
  dept,
  emp_name,
  sales,
  RANK() OVER (PARTITION BY dept ORDER BY sales DESC) AS rnk,
  DENSE_RANK() OVER (PARTITION BY dept ORDER BY sales DESC) AS drnk,
  MAX(sales) OVER (PARTITION BY dept) - sales AS diff_from_top
FROM emp_perf
ORDER BY dept, sales DESC, emp_name;`,
    explanation:
      '同率1位が2名いる場合、RANK()は「1, 1, 3」（飛び番あり）、DENSE_RANK()は「1, 1, 2」（飛び番なし）となる。また OVER(PARTITION BY dept) のように ORDER BY を省略するとパーティション全行がフレーム対象となり、部門最大値を全行から参照できる。',
    offlineTables: {
      emp_perf: [
        { dept: '東日本', emp_name: '佐藤', sales: 500 },
        { dept: '東日本', emp_name: '鈴木', sales: 500 },
        { dept: '東日本', emp_name: '高橋', sales: 420 },
        { dept: '西日本', emp_name: '田中', sales: 600 },
        { dept: '西日本', emp_name: '伊藤', sales: 450 },
        { dept: '西日本', emp_name: '渡辺', sales: 450 },
      ],
    },
    expectedResult: {
      columns: ['dept', 'emp_name', 'sales', 'rnk', 'drnk', 'diff_from_top'],
      rows: [
        ['東日本', '佐藤', 500, 1, 1, 0],
        ['東日本', '鈴木', 500, 1, 1, 0],
        ['東日本', '高橋', 420, 3, 2, 80],
        ['西日本', '田中', 600, 1, 1, 0],
        ['西日本', '伊藤', 450, 2, 2, 150],
        ['西日本', '渡辺', 450, 2, 2, 150],
      ],
      engine: 'offline-cache',
      executionMs: 0.5,
    },
    requiredKeywords: ['rank()', 'dense_rank()', 'partition by', 'max('],
    windowPresetId: 'rank-compare',
  },
  {
    id: 'sql-r3-recursive-bom',
    year: 'R3秋',
    examSection: '午後Ⅱ 問2（部品表BOM・再帰SQL）',
    title: 'WITH RECURSIVE による部品展開と累計必要員数の計算',
    category: 'recursive',
    difficulty: '難問',
    description:
      '親子部品構成表 `bom(parent_id, child_id, qty)` を使い、完成品 `P100` を1台製造するために必要なすべての下位部品について、展開階層（lvl：直下を1）と親からの乗算による累計必要数（total_qty）を `WITH RECURSIVE` で展開せよ。',
    schemaSql: `
      CREATE TABLE bom (
        parent_id TEXT,
        child_id TEXT,
        qty INTEGER
      );
    `,
    seedSql: `
      INSERT INTO bom VALUES
        ('P100', 'A10', 2),
        ('P100', 'B20', 1),
        ('A10',  'C01', 4),
        ('A10',  'C02', 3),
        ('B20',  'C01', 2),
        ('C02',  'D99', 5);
    `,
    starterSql: `WITH RECURSIVE explode(part_id, lvl, total_qty) AS (
  -- アンカーメンバ（初期集合）
  SELECT child_id, 1, qty
  FROM bom
  WHERE parent_id = 'P100'
  UNION ALL
  -- 再帰メンバ（親の累計数 × 子の構成数）
  SELECT b.child_id, e.lvl + 1, e.total_qty * b.qty
  FROM explode e
  JOIN bom b ON e.part_id = b.parent_id
)
SELECT part_id, lvl, total_qty
FROM explode
ORDER BY lvl, part_id;`,
    answerSql: `WITH RECURSIVE explode(part_id, lvl, total_qty) AS (
  SELECT child_id, 1, qty
  FROM bom
  WHERE parent_id = 'P100'
  UNION ALL
  SELECT b.child_id, e.lvl + 1, e.total_qty * b.qty
  FROM explode e
  JOIN bom b ON e.part_id = b.parent_id
)
SELECT part_id, lvl, total_qty
FROM explode
ORDER BY lvl, part_id;`,
    explanation:
      '再帰CTEは「初期集合（アンカー）」と「再帰ステップ」を UNION ALL で結合するのが基本。UNION（重複排除）を使うと同一部品が別経路で同数量になった場合に消えてしまうため、BOM員数展開では必ず UNION ALL を使い、最後に部品別 SUM(total_qty) で集約する！',
    offlineTables: {
      bom: [
        { parent_id: 'P100', child_id: 'A10', qty: 2 },
        { parent_id: 'P100', child_id: 'B20', qty: 1 },
        { parent_id: 'A10', child_id: 'C01', qty: 4 },
        { parent_id: 'A10', child_id: 'C02', qty: 3 },
        { parent_id: 'B20', child_id: 'C01', qty: 2 },
        { parent_id: 'C02', child_id: 'D99', qty: 5 },
      ],
    },
    expectedResult: {
      columns: ['part_id', 'lvl', 'total_qty'],
      rows: [
        ['A10', 1, 2],
        ['B20', 1, 1],
        ['C01', 2, 8],
        ['C01', 2, 2],
        ['C02', 2, 6],
        ['D99', 3, 30],
      ],
      engine: 'offline-cache',
      executionMs: 0.6,
    },
    requiredKeywords: ['with recursive', 'union all', 'join bom', 'e.lvl + 1'],
  },
  {
    id: 'sql-r5-not-exists',
    year: 'R5秋',
    examSection: '午後Ⅰ 問1（配送未完了チェック・NOT EXISTS）',
    title: 'NOT EXISTS による「全明細出荷済み」受注の抽出（二重否定）',
    category: 'subquery',
    difficulty: '難問',
    description:
      '受注表 `orders` と受注明細表 `order_items` から、「未出荷（status = \'未出荷\'）の明細が1件も存在しない」＝すなわち全明細が出荷完了した受注番号（order_id）と顧客名（customer）を抽出せよ。',
    schemaSql: `
      CREATE TABLE orders (order_id TEXT, customer TEXT);
      CREATE TABLE order_items (order_id TEXT, line_no INTEGER, status TEXT);
    `,
    seedSql: `
      INSERT INTO orders VALUES ('O01', '東京商事'), ('O02', '大阪物産'), ('O03', '福岡電機');
      INSERT INTO order_items VALUES
        ('O01', 1, '出荷済'), ('O01', 2, '出荷済'),
        ('O02', 1, '出荷済'), ('O02', 2, '未出荷'),
        ('O03', 1, '出荷済');
    `,
    starterSql: `SELECT o.order_id, o.customer
FROM orders o
WHERE NOT EXISTS (
  SELECT 1
  FROM order_items i
  WHERE i.order_id = o.order_id
    AND i.status = '未出荷'
)
ORDER BY o.order_id;`,
    answerSql: `SELECT o.order_id, o.customer
FROM orders o
WHERE NOT EXISTS (
  SELECT 1
  FROM order_items i
  WHERE i.order_id = o.order_id
    AND i.status = '未出荷'
)
ORDER BY o.order_id;`,
    explanation:
      'SQLには全称量化子（FOR ALL）がないため、「すべて出荷済」＝「未出荷の行が存在しない（NOT EXISTS）」と二重否定に変換する。NOT IN はサブクエリ結果に NULL が1件でも混入すると結果全体が UNKNOWN（0件）になる罠があるため、実務・試験とも NOT EXISTS が推奨される！',
    offlineTables: {
      orders: [
        { order_id: 'O01', customer: '東京商事' },
        { order_id: 'O02', customer: '大阪物産' },
        { order_id: 'O03', customer: '福岡電機' },
      ],
      order_items: [
        { order_id: 'O01', line_no: 1, status: '出荷済' },
        { order_id: 'O01', line_no: 2, status: '出荷済' },
        { order_id: 'O02', line_no: 1, status: '出荷済' },
        { order_id: 'O02', line_no: 2, status: '未出荷' },
        { order_id: 'O03', line_no: 1, status: '出荷済' },
      ],
    },
    expectedResult: {
      columns: ['order_id', 'customer'],
      rows: [
        ['O01', '東京商事'],
        ['O03', '福岡電機'],
      ],
      engine: 'offline-cache',
      executionMs: 0.4,
    },
    requiredKeywords: ['not exists', 'order_items', '未出荷'],
  },
  {
    id: 'sql-h31-case-having',
    year: 'H31春',
    examSection: '午後Ⅰ 問3（在庫・入出庫クロス集計）',
    title: 'CASE式による入庫・出庫別集計と現在在庫マイナス検知',
    category: 'aggregate',
    difficulty: '基礎',
    description:
      '入出庫履歴 `stock_tx(item_id, tx_type, qty)` から、商品ごとに「入庫合計（in_qty）」「出庫合計（out_qty）」「現在在庫（stock = 入庫 - 出庫）」を算出し、現在在庫が 10 未満の要注意商品だけを `HAVING` で抽出せよ。',
    schemaSql: `
      CREATE TABLE stock_tx (item_id TEXT, tx_type TEXT, qty INTEGER);
    `,
    seedSql: `
      INSERT INTO stock_tx VALUES
        ('IT01', 'IN', 50), ('IT01', 'OUT', 45),
        ('IT02', 'IN', 30), ('IT02', 'OUT', 10),
        ('IT03', 'IN', 20), ('IT03', 'OUT', 15), ('IT03', 'OUT', 3);
    `,
    starterSql: `SELECT
  item_id,
  SUM(CASE WHEN tx_type = 'IN' THEN qty ELSE 0 END) AS in_qty,
  SUM(CASE WHEN tx_type = 'OUT' THEN qty ELSE 0 END) AS out_qty,
  SUM(CASE WHEN tx_type = 'IN' THEN qty ELSE -qty END) AS stock
FROM stock_tx
GROUP BY item_id
HAVING SUM(CASE WHEN tx_type = 'IN' THEN qty ELSE -qty END) < 10
ORDER BY item_id;`,
    answerSql: `SELECT
  item_id,
  SUM(CASE WHEN tx_type = 'IN' THEN qty ELSE 0 END) AS in_qty,
  SUM(CASE WHEN tx_type = 'OUT' THEN qty ELSE 0 END) AS out_qty,
  SUM(CASE WHEN tx_type = 'IN' THEN qty ELSE -qty END) AS stock
FROM stock_tx
GROUP BY item_id
HAVING SUM(CASE WHEN tx_type = 'IN' THEN qty ELSE -qty END) < 10
ORDER BY item_id;`,
    explanation:
      'CASE式を集約関数SUM()の内側に置くことで、1回の表走査で入庫・出庫・残高を同時計算できる。WHEREはGROUP BY前の行フィルタ、HAVINGはGROUP BY後のグループ絞り込みである点も基本中の基本！',
    offlineTables: {
      stock_tx: [
        { item_id: 'IT01', tx_type: 'IN', qty: 50 },
        { item_id: 'IT01', tx_type: 'OUT', qty: 45 },
        { item_id: 'IT02', tx_type: 'IN', qty: 30 },
        { item_id: 'IT02', tx_type: 'OUT', qty: 10 },
        { item_id: 'IT03', tx_type: 'IN', qty: 20 },
        { item_id: 'IT03', tx_type: 'OUT', qty: 15 },
        { item_id: 'IT03', tx_type: 'OUT', qty: 3 },
      ],
    },
    expectedResult: {
      columns: ['item_id', 'in_qty', 'out_qty', 'stock'],
      rows: [
        ['IT01', 50, 45, 5],
        ['IT03', 20, 18, 2],
      ],
      engine: 'offline-cache',
      executionMs: 0.4,
    },
    requiredKeywords: ['case when', 'group by', 'having'],
  },
  {
    id: 'sql-h28-overlap',
    year: 'H28春',
    examSection: '午後Ⅰ 問2（会議室予約の期間重複検出）',
    title: '自己結合による時間帯ダブルブッキング検出SQL',
    category: 'join',
    difficulty: '標準',
    description:
      '会議室予約表 `reservations(res_id, room_id, start_h, end_h)` から、同一会議室で予約時間帯が重複しているペア（res_a < res_b）を抽出せよ。終了時刻と開始時刻が一致（例：10-12 と 12-14）は重複とみなさない。',
    schemaSql: `
      CREATE TABLE reservations (res_id TEXT, room_id TEXT, start_h INTEGER, end_h INTEGER);
    `,
    seedSql: `
      INSERT INTO reservations VALUES
        ('R1', 'M01', 9, 11),
        ('R2', 'M01', 10, 12),
        ('R3', 'M01', 12, 14),
        ('R4', 'M02', 13, 15),
        ('R5', 'M02', 14, 16);
    `,
    starterSql: `SELECT
  a.room_id,
  a.res_id AS res_a,
  b.res_id AS res_b
FROM reservations a
JOIN reservations b
  ON a.room_id = b.room_id
 AND a.res_id < b.res_id
 AND a.start_h < b.end_h
 AND a.end_h > b.start_h
ORDER BY a.room_id, a.res_id;`,
    answerSql: `SELECT
  a.room_id,
  a.res_id AS res_a,
  b.res_id AS res_b
FROM reservations a
JOIN reservations b
  ON a.room_id = b.room_id
 AND a.res_id < b.res_id
 AND a.start_h < b.end_h
 AND a.end_h > b.start_h
ORDER BY a.room_id, a.res_id;`,
    explanation:
      '2つの区間 [a.start, a.end) と [b.start, b.end) が重複する必充条件は「a.start < b.end AND a.end > b.start」！さらに a.res_id < b.res_id で自分自身との結合および逆順ペア (R2, R1) の重複出力を防ぐのは鉄板テクニック。',
    offlineTables: {
      reservations: [
        { res_id: 'R1', room_id: 'M01', start_h: 9, end_h: 11 },
        { res_id: 'R2', room_id: 'M01', start_h: 10, end_h: 12 },
        { res_id: 'R3', room_id: 'M01', start_h: 12, end_h: 14 },
        { res_id: 'R4', room_id: 'M02', start_h: 13, end_h: 15 },
        { res_id: 'R5', room_id: 'M02', start_h: 14, end_h: 16 },
      ],
    },
    expectedResult: {
      columns: ['room_id', 'res_a', 'res_b'],
      rows: [
        ['M01', 'R1', 'R2'],
        ['M02', 'R4', 'R5'],
      ],
      engine: 'offline-cache',
      executionMs: 0.4,
    },
    requiredKeywords: ['join reservations', 'start_h <', 'end_h >'],
  },
];

/** ウィンドウ関数フレーム可視化Canvas用の行データ */
export interface WindowSampleRow {
  rowIdx: number;
  partition: string;
  orderVal: number;
  orderLabel: string;
  amount: number;
}

export const WINDOW_VISUALIZER_ROWS: WindowSampleRow[] = [
  { rowIdx: 0, partition: '東日本', orderVal: 1, orderLabel: '10/01', amount: 120 },
  { rowIdx: 1, partition: '東日本', orderVal: 2, orderLabel: '10/02', amount: 150 },
  { rowIdx: 2, partition: '東日本', orderVal: 2, orderLabel: '10/02(同日)', amount: 150 },
  { rowIdx: 3, partition: '東日本', orderVal: 3, orderLabel: '10/03', amount: 210 },
  { rowIdx: 4, partition: '東日本', orderVal: 4, orderLabel: '10/04', amount: 90 },
  { rowIdx: 5, partition: '西日本', orderVal: 1, orderLabel: '10/01', amount: 200 },
  { rowIdx: 6, partition: '西日本', orderVal: 2, orderLabel: '10/02', amount: 140 },
  { rowIdx: 7, partition: '西日本', orderVal: 3, orderLabel: '10/03', amount: 260 },
];
