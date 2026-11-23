// Base64圧縮ワンタップ3秒同期 ＆ JSONエクスポート/インポートモーダル（ライト・端正UI）
import React, { useState, useRef } from 'react';
import type { StudyStore } from '../../state/useStudyStore';
import { copyTextReliable } from '../../utils/syncCodec';
import { applyPwaUpdate, triggerInstallPrompt, type PwaStatus } from '../../utils/pwa';

interface Props {
  open: boolean;
  onClose: () => void;
  store: StudyStore;
  pwaStatus?: PwaStatus;
}

export const SyncModal: React.FC<Props> = ({ open, onClose, store, pwaStatus }) => {
  const [pasteCode, setPasteCode] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const handleCopySyncCode = async () => {
    const code = store.generateSyncCode();
    setGeneratedCode(code);
    const copied = await copyTextReliable(code);
    setStatusMsg({
      ok: true,
      text: copied
        ? `Base64圧縮同期コード（${code.length}文字）をクリップボードへコピーしました。他端末で貼り付けて復元してください。`
        : '自動コピー不可のため、下の欄を選択して手動コピーしてください。',
    });
  };

  const handleRestoreSyncCode = () => {
    if (!pasteCode.trim()) {
      setStatusMsg({ ok: false, text: '同期コードを貼り付けてから復元ボタンを押してください。' });
      return;
    }
    const res = store.restoreFromSyncCode(pasteCode);
    setStatusMsg({ ok: res.ok, text: res.message });
    if (res.ok) setPasteCode('');
  };

  const handleDownloadJson = () => {
    const json = store.exportJson();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateTag = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `db-bootcamp-backup-${dateTag}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatusMsg({
      ok: true,
      text: `JSONバックアップ（db-bootcamp-backup-${dateTag}.json）を保存しました。`,
    });
  };

  const handleUploadJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      const res = store.importJson(content);
      setStatusMsg({ ok: res.ok, text: res.message });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const activeReviewCount = store.state.reviewQueue.filter((q) => !q.graduated).length;
  const masteredCards = Object.values(store.state.flashcardStatus).filter((s) => s === 'mastered').length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg border border-[#d4d4d0] bg-white p-5 shadow-xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#e4e4e0] pb-3">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-wider text-[#71717a]">
              DATA SYNC &amp; BACKUP
            </div>
            <h3 className="mt-0.5 text-base font-bold text-[#18181b]">
              端末間3秒同期（Base64 / JSON）
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[#d4d4d0] bg-white px-2.5 py-1 text-xs font-semibold text-[#52525b] hover:bg-[#f1f1ee]"
          >
            閉じる
          </button>
        </div>

        {/* 現在の保存サマリー */}
        <div className="grid grid-cols-3 divide-x divide-[#e4e4e0] rounded-md border border-[#e4e4e0] bg-[#f6f6f4] py-2.5 text-center text-xs">
          <div>
            <div className="text-[11px] text-[#71717a]">行程完了</div>
            <div className="mt-0.5 font-mono text-sm font-bold text-[#18181b]">
              {store.state.completedRoadmapTasks.length}件
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#71717a]">未卒業弱点</div>
            <div className="mt-0.5 font-mono text-sm font-bold text-[#be123c]">
              {activeReviewCount}件
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#71717a]">200語習得</div>
            <div className="mt-0.5 font-mono text-sm font-bold text-[#15803d]">
              {masteredCards}/200
            </div>
          </div>
        </div>

        {/* 1. Base64ワンタップコピー */}
        <div className="rounded-md border border-[#e4e4e0] bg-white p-3.5 space-y-2.5">
          <div className="text-xs font-bold text-[#18181b]">
            1. この端末の進捗を送る（MacBook ⇔ iPad / iPhone）
          </div>
          <button
            type="button"
            onClick={handleCopySyncCode}
            className="w-full rounded-md bg-[#18181b] py-2.5 text-xs font-semibold text-white hover:bg-[#27272a] transition"
          >
            Base64圧縮同期コードをコピー
          </button>
          {generatedCode && (
            <textarea
              readOnly
              value={generatedCode}
              rows={2}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded border border-[#d4d4d0] bg-[#f6f6f4] p-2 font-mono text-[10px] text-[#52525b]"
            />
          )}
        </div>

        {/* 2. Base64ペースト復元 */}
        <div className="rounded-md border border-[#e4e4e0] bg-white p-3.5 space-y-2.5">
          <div className="text-xs font-bold text-[#18181b]">
            2. コピーした同期コードから復元する
          </div>
          <textarea
            value={pasteCode}
            onChange={(e) => setPasteCode(e.target.value)}
            rows={3}
            placeholder="DBBC1: で始まる同期コードを貼り付けてください..."
            className="w-full rounded-md border border-[#d4d4d0] bg-[#f6f6f4] p-2.5 font-mono text-xs text-[#18181b] focus:border-[#18181b] focus:bg-white focus:outline-none"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRestoreSyncCode}
              className="flex-1 rounded-md border border-[#18181b] bg-[#18181b] py-2 text-xs font-semibold text-white hover:bg-[#27272a]"
            >
              同期コードから復元
            </button>
            {store.canUndoSync && (
              <button
                type="button"
                onClick={() => {
                  store.undoLastSync();
                  setStatusMsg({ ok: true, text: '直前の同期を取り消し、元の状態へ戻しました。' });
                }}
                className="rounded-md border border-[#d4d4d0] bg-white px-3 py-2 text-xs font-semibold text-[#52525b] hover:bg-[#f1f1ee]"
              >
                元に戻す
              </button>
            )}
          </div>
        </div>

        {/* 3. JSONファイルのエクスポート / インポート */}
        <div className="rounded-md border border-[#e4e4e0] bg-[#f6f6f4] p-3.5 space-y-2">
          <div className="text-xs font-bold text-[#18181b]">
            3. JSONファイルによるバックアップ・復元
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleDownloadJson}
              className="rounded-md border border-[#d4d4d0] bg-white py-2 text-xs font-semibold text-[#18181b] hover:bg-[#f1f1ee]"
            >
              JSONエクスポート保存
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-md border border-[#d4d4d0] bg-white py-2 text-xs font-semibold text-[#18181b] hover:bg-[#f1f1ee]"
            >
              JSONインポート復元
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleUploadJson}
              className="hidden"
            />
          </div>
        </div>

        {/* 4. アプリモード・オフラインPWA状態 */}
        {pwaStatus && (
          <div className="rounded-md border border-[#e4e4e0] bg-white p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-[#18181b]">
                4. アプリモード ＆ オフラインPWA状態
              </div>
              <span
                className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                  pwaStatus.offlineCached
                    ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]'
                    : 'border-[#e4e4e0] bg-[#f6f6f4] text-[#52525b]'
                }`}
              >
                {pwaStatus.isStandalone
                  ? 'ホーム画面アプリ'
                  : pwaStatus.isLocalSingleFile
                    ? 'ローカルHTML'
                    : 'ブラウザ起動'}
              </span>
            </div>
            <div className="text-[11px] leading-relaxed text-[#52525b]">
              <div>
                通信状態：
                <span className="font-semibold text-[#18181b]">
                  {pwaStatus.isOnline ? 'オンライン' : 'オフライン'}
                </span>
                {' ／ '}
                キャッシュ：
                <span className="font-semibold text-[#18181b]">
                  {pwaStatus.offlineCached ? '準備完了（機内モード起動可）' : '未キャッシュ'}
                </span>
              </div>
              <div className="mt-0.5 text-[#71717a]">{pwaStatus.detail}</div>
              {!pwaStatus.isStandalone && pwaStatus.isSecureOrigin && (
                <div className="mt-1.5 rounded border border-[#e4e4e0] bg-[#f6f6f4] px-2.5 py-1.5 text-[11px] text-[#3f3f46]">
                  iPhone / iPad の Safari 下部「共有（□に↑）」→「ホーム画面に追加」で、アドレスバーなしの全画面アプリとして起動できます。
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {pwaStatus.canInstallPrompt && (
                <button
                  type="button"
                  onClick={async () => {
                    const accepted = await triggerInstallPrompt();
                    if (accepted) {
                      setStatusMsg({ ok: true, text: 'ホーム画面へのアプリ追加を開始しました。' });
                    }
                  }}
                  className="rounded-md bg-[#18181b] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#27272a]"
                >
                  この端末にアプリをインストール
                </button>
              )}
              {pwaStatus.swState === 'update-available' && (
                <button
                  type="button"
                  onClick={applyPwaUpdate}
                  className="rounded-md border border-[#1d4ed8] bg-[#eff6ff] px-3 py-1.5 text-xs font-semibold text-[#1d4ed8] hover:bg-[#dbeafe]"
                >
                  最新バージョンへ更新
                </button>
              )}
            </div>
          </div>
        )}

        {statusMsg && (
          <div
            className={`rounded-md border px-3 py-2.5 text-xs font-medium ${
              statusMsg.ok
                ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]'
                : 'border-[#fecdd3] bg-[#fff1f2] text-[#9f1239]'
            }`}
          >
            {statusMsg.text}
          </div>
        )}
      </div>
    </div>
  );
};
