// モジュール5後半：合格教本9章・重要語句200フラッシュカード（紙の単語帳・インデックスカード調）
import React, { useState, useMemo } from 'react';
import { FLASHCARDS_200, CHAPTER_TITLES } from '../../data/flashcards200';
import type { CardStatus } from '../../types/exam';
import type { StudyStore } from '../../state/useStudyStore';

interface Props {
  store: StudyStore;
}

export const FlashcardDeck: React.FC<Props> = ({ store }) => {
  const [chapterFilter, setChapterFilter] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<'all' | CardStatus>('all');
  const [importanceFilter, setImportanceFilter] = useState<'all' | 'A' | 'B' | 'C'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'deck' | 'list'>('deck');
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [shuffleSeed, setShuffleSeed] = useState(0);

  const filteredCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = FLASHCARDS_200.filter((c) => {
      if (chapterFilter !== 0 && c.chapter !== chapterFilter) return false;
      if (importanceFilter !== 'all' && c.importance !== importanceFilter) return false;
      const st: CardStatus = store.state.flashcardStatus[c.id] || 'unseen';
      if (statusFilter !== 'all' && st !== statusFilter) return false;
      if (
        q &&
        !c.term.toLowerCase().includes(q) &&
        !c.definition.toLowerCase().includes(q) &&
        !c.examPoint.toLowerCase().includes(q) &&
        !(c.reading || '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });

    if (shuffleSeed === 0) return list;
    const copy = [...list];
    let s = shuffleSeed;
    for (let i = copy.length - 1; i > 0; i--) {
      s = (s * 1664525 + 1013904223) % 4294967296;
      const j = s % (i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }, [chapterFilter, statusFilter, importanceFilter, searchQuery, store.state.flashcardStatus, shuffleSeed]);

  const safeIdx = filteredCards.length === 0 ? 0 : Math.min(cardIdx, filteredCards.length - 1);
  const currentCard = filteredCards[safeIdx] || null;

  const masteredCount = FLASHCARDS_200.filter(
    (c) => store.state.flashcardStatus[c.id] === 'mastered'
  ).length;
  const reviewCount = FLASHCARDS_200.filter(
    (c) => store.state.flashcardStatus[c.id] === 'review'
  ).length;

  const handleMarkStatus = (status: CardStatus) => {
    if (!currentCard) return;
    store.setFlashcardStatus(currentCard.id, status);
    setFlipped(false);
    if (safeIdx < filteredCards.length - 1) {
      setCardIdx(safeIdx + 1);
    } else {
      setCardIdx(0);
    }
  };

  return (
    <div className="space-y-4">
      {/* サマリー＆フィルタ */}
      <div className="rounded-lg border border-[#e4e4e0] bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
            <span className="font-bold text-[#18181b]">全収録 {FLASHCARDS_200.length}語</span>
            <span className="text-[#15803d] font-semibold">習得済 {masteredCount}</span>
            <span className="text-[#be123c] font-semibold">要復習 {reviewCount}</span>
            <span className="text-[#71717a]">
              未学習 {FLASHCARDS_200.length - masteredCount - reviewCount}
            </span>
          </div>

          <div className="inline-flex rounded-md border border-[#d4d4d0] bg-[#f1f1ee] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('deck')}
              className={`rounded px-3 py-1 text-xs font-semibold ${
                viewMode === 'deck' ? 'bg-white text-[#18181b] shadow-xs' : 'text-[#52525b]'
              }`}
            >
              単語カード
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`rounded px-3 py-1 text-xs font-semibold ${
                viewMode === 'list' ? 'bg-white text-[#18181b] shadow-xs' : 'text-[#52525b]'
              }`}
            >
              一覧表 ({filteredCards.length})
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <select
            value={chapterFilter}
            onChange={(e) => {
              setChapterFilter(Number(e.target.value));
              setCardIdx(0);
              setFlipped(false);
            }}
            className="rounded-md border border-[#d4d4d0] bg-white px-2.5 py-1.5 text-xs text-[#18181b] lg:col-span-2"
          >
            <option value={0}>全9章（200語すべて）</option>
            {(Object.keys(CHAPTER_TITLES) as unknown as Array<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9>).map(
              (ch) => (
                <option key={ch} value={ch}>
                  {CHAPTER_TITLES[ch]}
                </option>
              )
            )}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'all' | CardStatus);
              setCardIdx(0);
              setFlipped(false);
            }}
            className="rounded-md border border-[#d4d4d0] bg-white px-2.5 py-1.5 text-xs text-[#18181b]"
          >
            <option value="all">状態：すべて</option>
            <option value="unseen">未学習のみ</option>
            <option value="review">要復習のみ</option>
            <option value="mastered">習得済のみ</option>
          </select>

          <select
            value={importanceFilter}
            onChange={(e) => {
              setImportanceFilter(e.target.value as 'all' | 'A' | 'B' | 'C');
              setCardIdx(0);
              setFlipped(false);
            }}
            className="rounded-md border border-[#d4d4d0] bg-white px-2.5 py-1.5 text-xs text-[#18181b]"
          >
            <option value="all">重要度：すべて</option>
            <option value="A">重要度A（頻出）</option>
            <option value="B">重要度B（標準）</option>
            <option value="C">重要度C（発展）</option>
          </select>

          <div className="flex gap-1.5">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCardIdx(0);
              }}
              placeholder="語句を検索..."
              className="w-full rounded-md border border-[#d4d4d0] bg-white px-2.5 py-1.5 text-xs text-[#18181b]"
            />
            <button
              type="button"
              onClick={() => {
                setShuffleSeed((s) => (s === 0 ? Date.now() % 100000 : 0));
                setCardIdx(0);
                setFlipped(false);
              }}
              className={`shrink-0 rounded-md border px-2.5 py-1.5 text-xs font-semibold ${
                shuffleSeed !== 0
                  ? 'border-[#18181b] bg-[#18181b] text-white'
                  : 'border-[#d4d4d0] bg-white text-[#52525b]'
              }`}
            >
              順不同
            </button>
          </div>
        </div>
      </div>

      {/* 単語カード暗記モード（紙のインデックスカード風） */}
      {viewMode === 'deck' ? (
        currentCard ? (
          <div className="mx-auto max-w-2xl space-y-4">
            <div className="flex items-center justify-between text-xs text-[#71717a]">
              <span className="font-mono">
                {safeIdx + 1} / {filteredCards.length}（{currentCard.id}）
              </span>
              <span>カードをタップして裏面を表示</span>
            </div>

            <div
              className="card-perspective cursor-pointer select-none"
              onClick={() => setFlipped((f) => !f)}
            >
              <div
                className={`card-inner relative min-h-[280px] w-full ${flipped ? 'is-flipped' : ''}`}
              >
                {/* 表面 */}
                <div className="card-face absolute inset-0 flex flex-col justify-between rounded-lg border border-[#d4d4d0] bg-white p-6 shadow-xs">
                  <div className="flex items-center justify-between gap-2 border-b border-[#e4e4e0] pb-2.5">
                    <span className="text-xs font-semibold text-[#52525b]">
                      {currentCard.chapterTitle}
                    </span>
                    <span
                      className={`rounded border px-2 py-0.5 font-mono text-[11px] font-bold ${
                        currentCard.importance === 'A'
                          ? 'border-[#fecdd3] bg-[#fff1f2] text-[#be123c]'
                          : currentCard.importance === 'B'
                            ? 'border-[#fde68a] bg-[#fffbeb] text-[#b45309]'
                            : 'border-[#e4e4e0] bg-[#f6f6f4] text-[#52525b]'
                      }`}
                    >
                      重要度 {currentCard.importance}
                    </span>
                  </div>

                  <div className="my-auto py-6 text-center space-y-2">
                    <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#18181b] leading-snug">
                      {currentCard.term}
                    </div>
                    {currentCard.reading && (
                      <div className="font-mono text-xs text-[#71717a]">{currentCard.reading}</div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-[#f1f1ee] pt-2.5 text-xs text-[#71717a]">
                    <span>
                      状態：
                      <strong className="ml-1 text-[#18181b]">
                        {store.state.flashcardStatus[currentCard.id] === 'mastered'
                          ? '習得済'
                          : store.state.flashcardStatus[currentCard.id] === 'review'
                            ? '要復習'
                            : '未学習'}
                      </strong>
                    </span>
                    <span className="font-semibold text-[#18181b]">タップして解説を見る</span>
                  </div>
                </div>

                {/* 裏面 */}
                <div className="card-face card-face-back absolute inset-0 flex flex-col justify-between rounded-lg border border-[#18181b] bg-[#fafafa] p-6 shadow-xs">
                  <div className="flex items-center justify-between gap-2 border-b border-[#e4e4e0] pb-2.5">
                    <span className="text-sm font-bold text-[#18181b]">{currentCard.term}</span>
                    <span className="font-mono text-[11px] text-[#71717a]">解説</span>
                  </div>

                  <div className="my-auto space-y-3 py-2">
                    <div>
                      <div className="text-[11px] font-bold text-[#71717a]">定義・仕組み</div>
                      <p className="mt-1 text-sm text-[#18181b] leading-relaxed">
                        {currentCard.definition}
                      </p>
                    </div>
                    <div className="rounded-md border border-[#fde68a] bg-[#fffbeb] p-3">
                      <div className="text-[11px] font-bold text-[#92400e]">午後試験のポイント</div>
                      <p className="mt-1 text-xs sm:text-sm text-[#78350f] leading-relaxed">
                        {currentCard.examPoint}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-[#e4e4e0] pt-2 text-right text-xs text-[#71717a]">
                    タップして表面へ戻る
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => {
                  setFlipped(false);
                  setCardIdx((safeIdx - 1 + filteredCards.length) % filteredCards.length);
                }}
                className="rounded-md border border-[#d4d4d0] bg-white py-2.5 text-xs font-semibold text-[#18181b] hover:bg-[#f1f1ee]"
              >
                ← 前へ
              </button>
              <button
                type="button"
                onClick={() => handleMarkStatus('review')}
                className="rounded-md border border-[#fecdd3] bg-[#fff1f2] py-2.5 text-xs font-bold text-[#be123c] hover:bg-[#ffe4e6]"
              >
                要復習
              </button>
              <button
                type="button"
                onClick={() => handleMarkStatus('mastered')}
                className="rounded-md border border-[#bbf7d0] bg-[#f0fdf4] py-2.5 text-xs font-bold text-[#15803d] hover:bg-[#dcfce7]"
              >
                習得済
              </button>
              <button
                type="button"
                onClick={() => {
                  setFlipped(false);
                  setCardIdx((safeIdx + 1) % filteredCards.length);
                }}
                className="rounded-md border border-[#d4d4d0] bg-white py-2.5 text-xs font-semibold text-[#18181b] hover:bg-[#f1f1ee]"
              >
                次へ →
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[#d4d4d0] bg-white p-8 text-center text-sm text-[#71717a]">
            条件に一致する重要語句がありません。フィルタを調整してください。
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {filteredCards.map((c) => {
            const st: CardStatus = store.state.flashcardStatus[c.id] || 'unseen';
            return (
              <div
                key={c.id}
                className="rounded-lg border border-[#e4e4e0] bg-white p-3.5 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-[10px] font-semibold text-[#71717a]">
                      第{c.chapter}章 ・ 重要度{c.importance}
                    </span>
                    <div className="text-sm font-bold text-[#18181b]">{c.term}</div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => store.setFlashcardStatus(c.id, st === 'review' ? 'unseen' : 'review')}
                      className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${
                        st === 'review'
                          ? 'border-[#be123c] bg-[#be123c] text-white'
                          : 'border-[#d4d4d0] bg-white text-[#52525b]'
                      }`}
                    >
                      要復習
                    </button>
                    <button
                      type="button"
                      onClick={() => store.setFlashcardStatus(c.id, st === 'mastered' ? 'unseen' : 'mastered')}
                      className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${
                        st === 'mastered'
                          ? 'border-[#15803d] bg-[#15803d] text-white'
                          : 'border-[#d4d4d0] bg-white text-[#52525b]'
                      }`}
                    >
                      習得済
                    </button>
                  </div>
                </div>
                <p className="text-xs text-[#3f3f46] leading-relaxed">{c.definition}</p>
                <p className="text-[11px] text-[#92400e] leading-relaxed">要点：{c.examPoint}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
