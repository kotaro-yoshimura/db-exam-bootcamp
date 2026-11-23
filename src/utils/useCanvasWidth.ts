// HTML5 Canvas コンテナ幅を ResizeObserver で正確に追跡するフック
// モバイルの非表示タブ（hidden）から復帰した際も即座に再計測・再描画させる
import { useState, useEffect, type RefObject } from 'react';

export function useCanvasContainerWidth(
  containerRef: RefObject<HTMLDivElement | null>,
  fallbackWidth = 340
): number {
  const [width, setWidth] = useState<number>(fallbackWidth);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const w = el.clientWidth;
      if (w > 0) {
        setWidth(w);
      }
    };

    update();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        update();
      });
      ro.observe(el);
    }

    window.addEventListener('resize', update);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [containerRef]);

  return width;
}
