// 使い方・運用マニュアルモーダル（Apple HIG 準拠・3タブ視覚ガイド）
// タブ構成：「学習の流れ」／「表記・機能」／「同期・PWA」
import React, { useState } from 'react';
import type { ModuleId } from '../../types/exam';
import { ChevronRightIcon, ModuleNavIcon, SyncIcon } from './NavIcons';

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenSync: () => void;
  onNavigateModule?: (id: ModuleId) => void;
}

type HelpTab = 'flow' | 'guide' | 'sync';

const STUDY_STEPS: Array<{
  step: string;
  title: string;
  summary: string;
  target: ModuleId;
  targetLabel: string;
}> = [
  {
    step: '01',
    title: 'まずテキストを通読',
    summary: '毎週先頭の「テキスト」タスクに沿って合格教本を読み進めます（Week 13で全9章1周完了）。',
    target: 'roadmap',
    targetLabel: '行程表',
  },
  {
    step: '02',
    title: '図解ラボ ＆ SQL道場で定着',
    summary: '読んだ直後に正規化FD・E-R図5大パターン・物理I/O・実機SQLを動かして視覚で定着させます。',
    target: 'lab',
    targetLabel: '図解ラボ',
  },
  {
    step: '03',
    title: 'CBT演習 ＆ Gemini添削',
    summary: 'タイマーONで手書きメモ・本文シグナル・記述を実施。添削プロンプトを1タップでコピーできます。',
    target: 'cbt',
    targetLabel: 'CBT演習',
  },
  {
    step: '04',
    title: '弱点キューを2回連続満点で卒業',
    summary: '誤答した問題は自動登録されます。2回連続で満点を取り切ることで本番の取りこぼしをなくします。',
    target: 'review',
    targetLabel: '弱点復習',
  },
];

const MODULE_GUIDE: Array<{
  id: ModuleId;
  name: string;
  desc: string;
}> = [
  { id: 'home', name: 'ホーム', desc: '今週のチェックリストとクイック再開から1秒で学習開始' },
  { id: 'lab', name: '図解ラボ', desc: '正規化FD・E-R図5大パターン・SQL/排他/分散TX・物理I/O・容量計算' },
  { id: 'sql', name: 'SQL道場', desc: '過去問6問をSQLite実機実行＆自動採点＋フレーム可視化' },
  { id: 'cbt', name: 'CBT演習', desc: '過去問6年度の本番2ペイン演習・A4手書きメモ・シグナル発掘・添削連携' },
  { id: 'review', name: '弱点復習', desc: '誤答問題を自動収集し「2回連続満点」で卒業させる反復ドリル' },
  { id: 'roadmap', name: '行程カレンダー', desc: '2026年11月〜2027年3月の月間カレンダー＆全18週間進捗トラッカー' },
  { id: 'cards', name: '重要語句200', desc: '合格教本全9章・重要度A/B/Cフィルタ対応の200語フラッシュカード' },
];

export const HelpModal: React.FC<Props> = ({
  open,
  onClose,
  onOpenSync,
  onNavigateModule,
}) => {
  const [activeTab, setActiveTab] = useState<HelpTab>('flow');

  if (!open) return null;

  const handleJump = (id: ModuleId) => {
    if (!onNavigateModule) return;
    onClose();
    onNavigateModule(id);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 固定ヘッダー ＆ セグメント切替 */}
        <div className="shrink-0 space-y-3 border-b border-slate-200 bg-white px-5 pt-4 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[#1D1D1F]">使い方・運用マニュアル</h3>
              <p className="mt-0.5 text-xs text-[#6E6E73]">
                令和8年度後期 CBT 合格に向けた学習手順と機能ガイド
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
            >
              閉じる
            </button>
          </div>

          <div
            role="tablist"
            aria-label="マニュアルセクション切替"
            className="grid grid-cols-3 gap-1 rounded-lg bg-[#E5E5EA]/90 p-1"
          >
            {(
              [
                { id: 'flow', label: '学習の流れ' },
                { id: 'guide', label: '表記・機能' },
                { id: 'sync', label: '同期・PWA' },
              ] as const
            ).map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-md py-1.5 text-xs font-semibold transition ${
                    active ? 'bg-white text-[#1D1D1F] shadow-xs' : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* スクロール可能な本文エリア */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* ================= タブ1：学習の流れ ================= */}
          {activeTab === 'flow' && (
            <>
              {/* 4ステップカード */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#6E6E73]">基本の4ステップ</h4>
                <div className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
                  {STUDY_STEPS.map((item) => (
                    <div
                      key={item.step}
                      className="flex items-start justify-between gap-3 px-3.5 py-3"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#007AFF]/10 font-mono text-[11px] font-bold tabular-nums text-[#007AFF]">
                          {item.step}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[13px] font-bold text-[#1D1D1F]">{item.title}</div>
                          <p className="mt-0.5 text-xs leading-relaxed text-[#6E6E73]">
                            {item.summary}
                          </p>
                        </div>
                      </div>
                      {onNavigateModule && (
                        <button
                          type="button"
                          onClick={() => handleJump(item.target)}
                          className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-slate-200 bg-[#F5F5F7] px-2.5 py-1 text-[11px] font-semibold text-[#007AFF] hover:bg-sky-50"
                        >
                          <span>{item.targetLabel}</span>
                          <ChevronRightIcon className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* シーン別おすすめルーティン */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#6E6E73]">シーン別の使い分け</h4>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-[#F5F5F7] p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1D1D1F]">スキマ時間</span>
                      <span className="font-mono text-[10px] tabular-nums text-[#6E6E73]">5〜10分</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-[#6E6E73]">
                      iPhoneで「200語」の重要度A・要復習カードを周回し、弱点キューを1問消化。
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-[#F5F5F7] p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1D1D1F]">平日夜</span>
                      <span className="font-mono text-[10px] tabular-nums text-[#6E6E73]">30分</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-[#6E6E73]">
                      テキスト該当章を読了後、iPadで図解ラボとSQL道場（2ペイン）を動かして理解を固定。
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-[#F5F5F7] p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1D1D1F]">週末演習</span>
                      <span className="font-mono text-[10px] tabular-nums text-[#6E6E73]">60分</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-[#6E6E73]">
                      CBT演習でタイマー計測＋Apple Pencil手書きメモ＋Gemini添削で記述精度を仕上げ。
                    </p>
                  </div>
                </div>
              </div>

              {/* 端末別の快適操作ヒント */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-1.5">
                  <div className="text-xs font-bold text-[#1D1D1F]">iPhone での操作ヒント</div>
                  <ul className="space-y-1 text-[11px] leading-relaxed text-[#6E6E73] list-disc pl-4">
                    <li>SQL・CBT画面では上部の「問題・図表｜解答｜解説」バーでスクロール位置を保ったまま切替</li>
                    <li>横幅のある図解キャンバスは左右スワイプで全体を確認可能</li>
                  </ul>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-1.5">
                  <div className="text-xs font-bold text-[#1D1D1F]">iPad / Mac での操作ヒント</div>
                  <ul className="space-y-1 text-[11px] leading-relaxed text-[#6E6E73] list-disc pl-4">
                    <li>SQLエディタは <code className="rounded border border-slate-200 bg-[#F5F5F7] px-1 font-mono text-[10px] text-[#1D1D1F]">Cmd/Ctrl + Enter</code> で即実行・自動採点</li>
                    <li>CBT画面は比率（50-50 / 60-40 / 40-60）切替とApple Pencil直接描画に対応</li>
                  </ul>
                </div>
              </div>
            </>
          )}

          {/* ================= タブ2：表記・機能 ================= */}
          {activeTab === 'guide' && (
            <>
              {/* 関係スキーマ下線表記リファレンス */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-[#6E6E73]">関係スキーマ下線表記の凡例</h4>
                  <span className="text-[11px] text-[#6E6E73]">
                    クイズ時は属性タップで4種を順番に切替
                  </span>
                </div>

                {/* 実寸サンプル行 */}
                <div className="rounded-lg border border-slate-200 bg-[#F5F5F7] px-3.5 py-2.5 text-xs">
                  <div className="mb-1 text-[10px] font-semibold text-[#6E6E73]">表示イメージ</div>
                  <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-sm">
                    <span className="font-bold text-[#1D1D1F]">受注明細</span>
                    <span className="text-[#6E6E73]">(</span>
                    <span className="key-pk font-bold text-[#007AFF]">受注番号</span>
                    <span className="text-slate-400">,</span>
                    <span className="key-pkfk font-bold text-[#b45309]">商品コード</span>
                    <span className="text-slate-400">,</span>
                    <span className="key-fk font-semibold text-[#15803d]">倉庫コード</span>
                    <span className="text-slate-400">,</span>
                    <span className="text-[#1D1D1F]">数量</span>
                    <span className="text-slate-400">,</span>
                    <span className="rounded border border-slate-300 bg-white px-1 text-xs font-semibold text-[#1D1D1F]">
                      [会員区分]
                    </span>
                    <span className="text-[#6E6E73]">)</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                    <span className="key-pk font-bold text-[#007AFF]">受注番号</span>
                    <span className="text-[#6E6E73]">実線 ＝ 主キー（PK）</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                    <span className="key-fk font-semibold text-[#15803d]">倉庫コード</span>
                    <span className="text-[#6E6E73]">破線 ＝ 外部キー（FK）</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                    <span className="key-pkfk font-bold text-[#b45309]">商品コード</span>
                    <span className="text-[#6E6E73]">二重線 ＝ 主兼外（PK+FK）</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                    <span className="rounded border border-slate-300 bg-[#F5F5F7] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#1D1D1F]">
                      [会員区分]
                    </span>
                    <span className="text-[#6E6E73]">角括弧 ＝ サブタイプ冗長属性</span>
                  </div>
                </div>
              </div>

              {/* 弱点復習キューの卒業ルール（視覚フロー） */}
              <div className="rounded-lg border border-slate-200 bg-[#F5F5F7] p-3.5 space-y-2">
                <div className="text-xs font-bold text-[#1D1D1F]">弱点復習キューの卒業ルール</div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border border-slate-200 bg-white p-2">
                    <div className="font-mono text-xs font-bold tabular-nums text-[#1D1D1F]">0 / 2</div>
                    <div className="mt-0.5 text-[11px] text-[#6E6E73]">誤答で自動登録</div>
                  </div>
                  <div className="rounded-lg border border-sky-200 bg-sky-50/70 p-2">
                    <div className="font-mono text-xs font-bold tabular-nums text-[#007AFF]">1 / 2</div>
                    <div className="mt-0.5 text-[11px] text-[#6E6E73]">1回目満点（あと1回）</div>
                  </div>
                  <div className="rounded-lg bg-[#007AFF] p-2 text-white">
                    <div className="font-mono text-xs font-bold tabular-nums">2 / 2 卒業</div>
                    <div className="mt-0.5 text-[11px] text-white/85">2回連続満点で定着</div>
                  </div>
                </div>
                <p className="text-[11px] text-[#6E6E73]">
                  ※ 途中で1回でも誤答すると <span className="font-mono tabular-nums text-[#1D1D1F]">0/2</span> に戻るため、まぐれ正解を排除できます。
                </p>
              </div>

              {/* 7画面の役割早見表 */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#6E6E73]">各メニューの役割（タップで移動）</h4>
                <div className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
                  {MODULE_GUIDE.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleJump(m.id)}
                      className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-[#F5F5F7] transition"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#F5F5F7] text-[#007AFF]">
                          <ModuleNavIcon id={m.id} className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#1D1D1F]">{m.name}</div>
                          <div className="truncate text-[11px] text-[#6E6E73]">{m.desc}</div>
                        </div>
                      </div>
                      <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-[#6E6E73]" />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ================= タブ3：同期・PWA ================= */}
          {activeTab === 'sync' && (
            <>
              {/* 3つの同期・バックアップ方式比較 */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#6E6E73]">端末間同期・バックアップ方法</h4>
                <div className="space-y-2">
                  <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-3.5 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#1D1D1F]">
                        1. GitHub 非公開Gist 自動同期（無料）
                      </span>
                      <span className="rounded-md bg-[#007AFF] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        おすすめ
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-[#6E6E73]">
                      初回に <code className="rounded border border-slate-200 bg-white px-1 font-mono text-[10px] text-[#1D1D1F]">gist</code> 権限トークンを登録するだけで、Mac・iPad・iPhone間を自動同期。オフライン中に複数端末で進めても自動で安全マージされます。
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-1">
                    <div className="text-xs font-bold text-[#1D1D1F]">
                      2. Base64 圧縮3秒同期（アカウント不要）
                    </div>
                    <p className="text-[11px] leading-relaxed text-[#6E6E73]">
                      送信側で同期コードをコピーし、受信側で貼り付けるだけ。Appleのユニバーサルクリップボードなら端末間を数秒で移行できます。
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-1">
                    <div className="text-xs font-bold text-[#1D1D1F]">
                      3. JSON ファイル保存（週1バックアップ推奨）
                    </div>
                    <p className="text-[11px] leading-relaxed text-[#6E6E73]">
                      学習履歴をそのままファイル保存・復元可能。誤って上書きした場合も「直前の同期を戻す」で1タップ復元できます。
                    </p>
                  </div>
                </div>
              </div>

              {/* ホーム画面アプリ（PWA）化と更新手順 */}
              <div className="rounded-lg border border-slate-200 bg-[#F5F5F7] p-3.5 space-y-2">
                <div className="text-xs font-bold text-[#1D1D1F]">
                  iPhone / iPad でホーム画面アプリ（PWA）として使う
                </div>
                <ol className="space-y-1 text-[11px] leading-relaxed text-[#6E6E73] list-decimal pl-4">
                  <li>
                    Safari でアプリを開き、下部メニューの <strong className="text-[#1D1D1F]">共有（□に↑）→「ホーム画面に追加」</strong> をタップ。
                  </li>
                  <li>
                    アドレスバーなしの全画面・履歴自動保存・機内モード完全オフライン（SQLite WASM含む）で起動できます。
                  </li>
                  <li>
                    更新時は画面下の <strong className="text-[#1D1D1F]">「更新する」</strong>（または同期画面の「最新バージョンへ更新」）で最新版へ切り替わります。
                  </li>
                </ol>
              </div>

              {/* ショートカット起動時の注意 */}
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-[11px] leading-relaxed text-amber-900">
                <strong>単一HTML（iOSショートカット / data: URL）起動時の注意：</strong>
                Safariの仕様上、タブを閉じると端末内保存が初期化されます。普段使いはPWA（ホーム画面追加）を推奨します。ショートカット利用時は終了前に同期コードを控えてください。
              </div>
            </>
          )}
        </div>

        {/* 固定フッター */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 bg-[#F5F5F7] px-5 py-3">
          <span className="font-mono text-[11px] tabular-nums text-[#6E6E73]">
            対象期間：2026/11/23 – 2027/03/28（18週間）
          </span>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSync();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#007AFF] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0066D6] transition"
          >
            <SyncIcon className="h-3.5 w-3.5" />
            <span>データ同期を開く</span>
          </button>
        </div>
      </div>
    </div>
  );
};
