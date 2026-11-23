// GitHub 非公開Gist 自動同期 ＋ Base64圧縮3秒同期 ＆ JSONバックアップモーダル（Apple HIG ニュートラルUI）
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

const GITHUB_NEW_TOKEN_URL =
  'https://github.com/settings/tokens/new?scopes=gist&description=DB-Exam-Bootcamp-Sync';

export const SyncModal: React.FC<Props> = ({ open, onClose, store, pwaStatus }) => {
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [optionalGistId, setOptionalGistId] = useState('');
  const [showAdvancedGist, setShowAdvancedGist] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const [pasteCode, setPasteCode] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const { cloudSync } = store;

  const handleConnectGist = async () => {
    const res = await cloudSync.connect(tokenInput, optionalGistId || undefined);
    setStatusMsg({ ok: res.ok, text: res.message });
    if (res.ok) {
      setTokenInput('');
      setOptionalGistId('');
      setShowToken(false);
      setConfirmDisconnect(false);
    }
  };

  const handleSyncNow = async () => {
    const res = await cloudSync.syncNow();
    setStatusMsg({ ok: res.ok, text: res.message });
  };

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

  const cloudBadgeStyle =
    cloudSync.phase === 'syncing'
      ? 'border-sky-200 bg-sky-50 text-[#007AFF]'
      : cloudSync.phase === 'error'
        ? 'border-red-200 bg-red-50 text-red-700'
        : cloudSync.phase === 'offline' || cloudSync.pendingLocalChanges
          ? 'border-slate-300 bg-[#F5F5F7] text-[#1D1D1F]'
          : cloudSync.configured
            ? 'border-sky-200 bg-sky-50 text-[#007AFF]'
            : 'border-slate-200 bg-[#F5F5F7] text-[#6E6E73]';

  const cloudBadgeLabel = !cloudSync.configured
    ? '未設定'
    : cloudSync.phase === 'syncing'
      ? '同期中...'
      : cloudSync.phase === 'error'
        ? '同期エラー'
        : cloudSync.phase === 'offline'
          ? 'オフライン待機'
          : cloudSync.pendingLocalChanges
            ? '同期待機中'
            : cloudSync.autoSync
              ? '自動同期ON'
              : '手動同期のみ';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 shadow-xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <h3 className="text-base font-bold text-[#1D1D1F]">データ同期 ＆ バックアップ</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
          >
            閉じる
          </button>
        </div>

        {/* 現在の保存サマリー */}
        <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-lg border border-slate-200 bg-[#F5F5F7] py-2.5 text-center text-xs">
          <div>
            <div className="text-[11px] text-[#6E6E73]">行程完了</div>
            <div className="mt-0.5 font-mono text-sm font-bold tabular-nums text-[#1D1D1F]">
              {store.state.completedRoadmapTasks.length}件
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#6E6E73]">未卒業弱点</div>
            <div className="mt-0.5 font-mono text-sm font-bold tabular-nums text-[#1D1D1F]">
              {activeReviewCount}件
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#6E6E73]">200語習得</div>
            <div className="mt-0.5 font-mono text-sm font-bold tabular-nums text-[#1D1D1F]">
              {masteredCards}/200
            </div>
          </div>
        </div>

        {statusMsg && (
          <div
            className={`rounded-lg border px-3 py-2.5 text-xs font-medium ${
              statusMsg.ok
                ? 'border-sky-200 bg-sky-50 text-[#1D1D1F]'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {statusMsg.text}
          </div>
        )}

        {/* 1. GitHub 非公開Gist 無料自動同期 */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold text-[#1D1D1F]">
                1. GitHub 非公開Gist 自動同期（無料）
              </div>
              <div className="mt-0.5 text-[11px] text-[#6E6E73]">
                Mac・iPad・iPhone 間で学習履歴を自動クラウド同期（非公開保存）
              </div>
            </div>
            <span
              className={`shrink-0 rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold ${cloudBadgeStyle}`}
            >
              {cloudBadgeLabel}
            </span>
          </div>

          {!cloudSync.configured ? (
            <div className="space-y-2.5">
              <div className="rounded-lg border border-slate-200 bg-[#F5F5F7] p-2.5 text-[11px] leading-relaxed text-[#6E6E73] space-y-1">
                <div className="font-semibold text-[#1D1D1F]">初回設定（約30秒・無料）</div>
                <div>
                  1. 下のリンクを開き、一番下の「Generate token」を押してトークンを発行（
                  <code className="rounded bg-white px-1 py-0.5 font-mono text-[10px] border border-slate-200 text-[#1D1D1F]">
                    gist
                  </code>{' '}
                  権限だけ自動選択されます）
                </div>
                <div>2. 表示されたトークン（ghp_...）をコピーして下の欄へ貼り付け</div>
                <div>3. 2台目以降の端末も同じトークンを貼るだけで自動検出して繋がります</div>
              </div>

              <a
                href={GITHUB_NEW_TOKEN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center rounded-lg border border-[#007AFF] bg-sky-50/70 py-2 text-xs font-semibold text-[#007AFF] hover:bg-sky-100/70 transition"
              >
                GitHub で Gist 専用トークンを発行する ↗
              </a>

              <div className="space-y-2">
                <div className="flex gap-1.5">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    autoComplete="off"
                    spellCheck={false}
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-[#F5F5F7] px-3 py-2 font-mono text-base md:text-sm text-[#1D1D1F] focus:border-[#007AFF] focus:bg-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((v) => !v)}
                    className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-[#6E6E73] hover:bg-[#F5F5F7]"
                  >
                    {showToken ? '隠す' : '表示'}
                  </button>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedGist((v) => !v)}
                    className="text-[11px] text-[#6E6E73] underline underline-offset-2 hover:text-[#1D1D1F]"
                  >
                    {showAdvancedGist ? '詳細設定を閉じる' : '既存の Gist ID を手動指定する（通常不要）'}
                  </button>
                  {showAdvancedGist && (
                    <input
                      type="text"
                      value={optionalGistId}
                      onChange={(e) => setOptionalGistId(e.target.value)}
                      placeholder="空欄なら非公開Gistを自動検出・自動作成します"
                      className="mt-1.5 w-full rounded-lg border border-slate-200 bg-[#F5F5F7] px-3 py-2 font-mono text-base md:text-sm text-[#1D1D1F] focus:border-[#007AFF] focus:bg-white focus:outline-none"
                    />
                  )}
                </div>

                <button
                  type="button"
                  disabled={cloudSync.phase === 'syncing'}
                  onClick={handleConnectGist}
                  className="w-full rounded-lg bg-[#007AFF] py-2.5 text-xs font-semibold text-white hover:bg-[#0066D6] disabled:opacity-50 transition"
                >
                  {cloudSync.phase === 'syncing'
                    ? 'GitHubへ接続中...'
                    : '接続して自動同期を開始する'}
                </button>
                <p className="text-[10px] leading-relaxed text-[#6E6E73]">
                  ※トークンはこの端末のブラウザ内（localStorage）にのみ保存され、GitHubの公開リポジトリやJSONバックアップには含まれません。
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="rounded-lg border border-slate-200 bg-[#F5F5F7] p-2.5 text-[11px] text-[#6E6E73] space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    連携アカウント：
                    <span className="font-mono font-semibold text-[#1D1D1F]">
                      @{cloudSync.username || 'GitHub'}
                    </span>
                  </span>
                  {cloudSync.gistId && (
                    <a
                      href={`https://gist.github.com/${cloudSync.gistId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[10px] text-[#007AFF] underline underline-offset-2"
                    >
                      非公開Gistを確認 ↗
                    </a>
                  )}
                </div>
                <div>
                  最終同期：
                  <span className="font-mono tabular-nums text-[#1D1D1F]">
                    {cloudSync.lastSyncedAt
                      ? new Date(cloudSync.lastSyncedAt).toLocaleString('ja-JP')
                      : '未実行'}
                  </span>
                </div>
                <div className="text-[#6E6E73]">{cloudSync.message}</div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={cloudSync.phase === 'syncing'}
                  onClick={handleSyncNow}
                  className="flex-1 rounded-lg bg-[#007AFF] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0066D6] disabled:opacity-50"
                >
                  {cloudSync.phase === 'syncing' ? '同期中...' : '今すぐ同期'}
                </button>
                <button
                  type="button"
                  onClick={() => cloudSync.setAutoSync(!cloudSync.autoSync)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7]"
                >
                  自動同期: {cloudSync.autoSync ? 'ON' : 'OFF'}
                </button>
                {store.canUndoSync && (
                  <button
                    type="button"
                    onClick={() => {
                      store.undoLastSync();
                      setStatusMsg({ ok: true, text: '直前の同期を取り消し、元の状態へ戻しました。' });
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
                  >
                    直前の同期を戻す
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                <span className="text-[10px] text-[#6E6E73]">
                  複数端末でオフライン学習した場合も自動で安全統合されます
                </span>
                {!confirmDisconnect ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDisconnect(true)}
                    className="text-[11px] font-semibold text-[#6E6E73] hover:text-red-600"
                  >
                    連携解除
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        cloudSync.disconnect();
                        setConfirmDisconnect(false);
                        setStatusMsg({
                          ok: true,
                          text: 'この端末のトークンを削除して連携を解除しました（クラウド上のGistは保持されています）。',
                        });
                      }}
                      className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700"
                    >
                      トークン削除を実行
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDisconnect(false)}
                      className="text-[10px] text-[#6E6E73]"
                    >
                      キャンセル
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 2. 手動Base64同期（オフライン・アカウント不要） */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-2.5">
          <div className="text-xs font-bold text-[#1D1D1F]">
            2. 手動3秒同期（Base64圧縮コード・アカウント不要）
          </div>
          <button
            type="button"
            onClick={handleCopySyncCode}
            className="w-full rounded-lg border border-slate-200 bg-[#F5F5F7] py-2 text-xs font-semibold text-[#1D1D1F] hover:bg-slate-200/70 transition"
          >
            この端末の進捗を同期コードとしてコピー
          </button>
          {generatedCode && (
            <textarea
              readOnly
              value={generatedCode}
              rows={2}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-lg border border-slate-200 bg-[#F5F5F7] p-2.5 font-mono text-base md:text-sm text-[#6E6E73]"
            />
          )}
          <textarea
            value={pasteCode}
            onChange={(e) => setPasteCode(e.target.value)}
            rows={2}
            placeholder="他端末からコピーした DBBC1: 同期コードを貼り付けて復元..."
            className="w-full rounded-lg border border-slate-200 bg-[#F5F5F7] p-2.5 font-mono text-base md:text-sm text-[#1D1D1F] focus:border-[#007AFF] focus:bg-white focus:outline-none"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRestoreSyncCode}
              className="flex-1 rounded-lg border border-[#007AFF] bg-white py-2 text-xs font-semibold text-[#007AFF] hover:bg-sky-50"
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
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#6E6E73] hover:bg-[#F5F5F7]"
              >
                元に戻す
              </button>
            )}
          </div>
        </div>

        {/* 3. JSONファイルのエクスポート / インポート */}
        <div className="rounded-lg border border-slate-200 bg-[#F5F5F7] p-3.5 space-y-2">
          <div className="text-xs font-bold text-[#1D1D1F]">
            3. JSONファイルによるバックアップ・復元
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleDownloadJson}
              className="rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold text-[#1D1D1F] hover:bg-slate-50"
            >
              JSONエクスポート保存
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold text-[#1D1D1F] hover:bg-slate-50"
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
          <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-[#1D1D1F]">
                4. アプリモード ＆ オフラインPWA状態
              </div>
              <span className="rounded-md border border-slate-200 bg-[#F5F5F7] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#1D1D1F]">
                {pwaStatus.isStandalone
                  ? 'ホーム画面アプリ'
                  : pwaStatus.isLocalSingleFile
                    ? 'ローカルHTML'
                    : 'ブラウザ起動'}
              </span>
            </div>
            <div className="text-[11px] leading-relaxed text-[#6E6E73]">
              <div>
                通信状態：
                <span className="font-semibold text-[#1D1D1F]">
                  {pwaStatus.isOnline ? 'オンライン' : 'オフライン'}
                </span>
                {' ／ '}
                キャッシュ：
                <span className="font-semibold text-[#1D1D1F]">
                  {pwaStatus.offlineCached ? '準備完了（機内モード起動可）' : '未キャッシュ'}
                </span>
              </div>
              <div className="mt-0.5 text-[#6E6E73]">{pwaStatus.detail}</div>
              {!pwaStatus.isStandalone && pwaStatus.isSecureOrigin && (
                <div className="mt-1.5 rounded-lg border border-slate-200 bg-[#F5F5F7] px-2.5 py-1.5 text-[11px] text-[#1D1D1F]">
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
                  className="rounded-lg bg-[#007AFF] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0066D6]"
                >
                  この端末にアプリをインストール
                </button>
              )}
              {pwaStatus.swState === 'update-available' && (
                <button
                  type="button"
                  onClick={applyPwaUpdate}
                  className="rounded-lg border border-[#007AFF] bg-sky-50 px-3 py-1.5 text-xs font-semibold text-[#007AFF] hover:bg-sky-100"
                >
                  最新バージョンへ更新
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
