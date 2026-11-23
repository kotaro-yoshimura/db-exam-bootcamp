// 使い方・運用マニュアルモーダル（ホーム画面から移設：サイドバーおよびモバイルヘッダーの「?」ボタンから開く）
import React from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenSync: () => void;
}

export const HelpModal: React.FC<Props> = ({ open, onClose, onOpenSync }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 shadow-xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <h3 className="text-base font-bold text-[#1D1D1F]">使い方・運用マニュアル</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
          >
            閉じる
          </button>
        </div>

        {/* 1. テキスト通読 × アプリ演習の進め方 */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-[#1D1D1F]">
            1. テキスト通読 × アプリ演習の進め方
          </h4>
          <ol className="space-y-2 text-xs text-[#6E6E73] leading-relaxed list-decimal pl-4">
            <li>
              <strong className="text-[#1D1D1F]">まずテキストを通読：</strong>
              毎週先頭の「テキスト」タスクに沿って、合格教本の該当章をシンプルに読み進めます（Week 13で全9章1周完了）。
            </li>
            <li>
              <strong className="text-[#1D1D1F]">図解ラボ＆SQL道場で定着：</strong>
              読んだ直後に該当するシミュレーターやSQL道場を触り、計算式やクエリの動きを視覚で確認します。
            </li>
            <li>
              <strong className="text-[#1D1D1F]">CBT演習 ＆ Gemini添削：</strong>
              「CBT演習」で時間計測し、手書きメモ・本文シグナル発掘・記述解答を実施。添削用プロンプトコピーからレビューを受けます。
            </li>
            <li>
              <strong className="text-[#1D1D1F]">弱点キューの消化：</strong>
              間違えた問題は「弱点復習」へ自動登録されます。2回連続満点で卒業させ、本番前の取りこぼしを無くします。
            </li>
          </ol>
        </div>

        {/* 2. 端末同期とiPadオフライン運用 */}
        <div className="space-y-2 border-t border-slate-200 pt-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-[#1D1D1F]">2. 端末同期とiPadオフライン運用</h4>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSync();
              }}
              className="text-xs font-semibold text-[#007AFF] hover:underline"
            >
              データ同期を開く →
            </button>
          </div>
          <div className="rounded-lg border border-slate-200 bg-[#F5F5F7] p-3 text-xs text-[#1D1D1F] leading-relaxed">
            <strong>iPadショートカット（data: URL）起動時の注意：</strong>
            Safariの仕様上、タブを閉じるとブラウザ内の自動保存が初期化されます。学習を終える前に必ず「データ同期」から同期コードをコピーするか、GitHub非公開Gist自動同期をご利用ください。
          </div>
          <ul className="space-y-1.5 text-xs text-[#6E6E73] leading-relaxed list-disc pl-4">
            <li>
              <strong className="text-[#1D1D1F]">GitHub非公開Gist自動同期：</strong>
              初回トークン登録だけでMac・iPad・iPhone間の学習進捗を自動クラウド同期します。
            </li>
            <li>
              <strong className="text-[#1D1D1F]">3秒同期（アカウント不要）：</strong>
              送信側で「同期コードをコピー」→ 受信側で「データ同期」を開きペーストして復元します。
            </li>
            <li>
              <strong className="text-[#1D1D1F]">定期バックアップ：</strong>
              週に1度「JSONエクスポート保存」でファイル控えを取ると安心です。
            </li>
          </ul>
        </div>

        {/* 3. 関係スキーマ下線表記の凡例 */}
        <div className="space-y-2 border-t border-slate-200 pt-4">
          <h4 className="text-xs font-bold text-[#1D1D1F]">3. 関係スキーマ下線表記の凡例</h4>
          <div className="grid grid-cols-1 gap-2.5 rounded-lg border border-slate-200 bg-[#F5F5F7] p-3.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="key-pk font-bold text-[#007AFF]">受注番号</span>
              <span className="text-[#6E6E73]">実線 ＝ 主キー（PK）</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="key-fk font-semibold text-[#15803d]">顧客コード</span>
              <span className="text-[#6E6E73]">破線 ＝ 外部キー（FK）</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="key-pkfk font-bold text-[#b45309]">商品コード</span>
              <span className="text-[#6E6E73]">二重線 ＝ 主キー兼外部キー</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#1D1D1F]">
                [会員区分]
              </span>
              <span className="text-[#6E6E73]">角括弧 ＝ サブタイプ冗長属性</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
