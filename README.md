# DB Specialist Bootcamp & Simulator（令和8年度後期・CBT対策）

データベーススペシャリスト試験（令和8年度後期・CBT方式）合格に向けた、モジュラー構成（Vite + React + TypeScript + Tailwind CSS）かつ単一HTMLファイル（`vite-plugin-singlefile`）でiPhone/iPadオフライン動作する学習Webアプリです。

詳細なアーキテクチャ解説（エンジニア学習用）と使用・運用マニュアルは [docs/ARCHITECTURE_AND_MANUAL.md](docs/ARCHITECTURE_AND_MANUAL.md) を参照してください。

## クイックスタート

```bash
# 依存パッケージ導入
npm install

# 開発サーバー起動
npm run dev

# 型チェック＋単一HTMLビルド（dist/index.html を出力）
npm run build

# 同一Wi-Fi内のiPad/iPhoneからSafari確認
npx vite preview --host 0.0.0.0 --port 4173
```

## 主な特徴
- **PWA（ホーム画面アプリ）完全対応**：`manifest.webmanifest`・専用アプリアイコン・Service Worker（`sql-wasm.wasm` 含む自動オフラインキャッシュ＆ビルド時キャッシュバージョン自動更新）を搭載し、HTTPS配信後にSafariから「ホーム画面に追加」するとアドレスバーなしの全画面・オフライン・データ自動保存で稼働
- **インラインSVG不使用（0件）**：すべてのE-R図・FD図・タイムライン・チャート・4096Bページマップを HTML5 `<canvas>` 2D API（`devicePixelRatio`対応）で描画
- **SQL実行二段構え**：`sql.js`（SQLite WASM）＋ オフライン自動フォールバック評価＆プリコンパイルキャッシュ
- **iPadOS単一HTMLオフライン両立**：クラシックIIFE `<script>` 変換プラグイン＋`data:` URL 向け `MessageChannel` ガード搭載（ショートカット起動も引き続き利用可能）
- **無料クラウド自動同期 ＆ 3秒端末同期**：GitHub 非公開 Gist による端末間自動同期（無料・オフライン競合時の非破壊マージ対応）＋ `localStorage` 自動保存＋LZ77圧縮Base64同期コード＋JSON入出力
- **5大モジュール**：3大Canvasラボ／実機SQL道場／CBTスプリット画面＆3大特化機能／2回連続満点卒業の弱点復習キュー／18週間ロードマップ＆合格教本9章・重要語句200フラッシュカード
