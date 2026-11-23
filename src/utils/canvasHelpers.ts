// HTML5 Canvas 2D API 共通ヘルパー（iOS/iPadOSインラインSVG黒塗りバグ100%回避）
// すべての図解で devicePixelRatio スケーリングと明示的HEXカラーを適用する

export const CANVAS_COLORS = {
  bg: '#0f172a',
  bgPanel: '#1e293b',
  bgCard: '#172554',
  bgDarker: '#020617',
  border: '#334155',
  borderLight: '#475569',
  cyan: '#38bdf8',
  cyanSoft: '#0c4a6e',
  emerald: '#34d399',
  emeraldSoft: '#064e3b',
  rose: '#fb7185',
  roseSoft: '#4c0519',
  amber: '#f59e0b',
  amberSoft: '#451a03',
  violet: '#a78bfa',
  textMain: '#f8fafc',
  textSub: '#cbd5e1',
  textMuted: '#94a3b8',
} as const;

export const CANVAS_FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic UI", sans-serif';

export const CANVAS_MONO_FAMILY =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

/**
 * Canvasを論理サイズ (width x height) かつ devicePixelRatio 対応で初期化する
 */
export function setupHiDpiCanvas(
  canvas: HTMLCanvasElement,
  logicalWidth: number,
  logicalHeight: number
): CanvasRenderingContext2D | null {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = Math.max(1, Math.floor(logicalWidth));
  const h = Math.max(1, Math.floor(logicalHeight));

  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
  }
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/**
 * 角丸矩形のパスを描画する（古いSafari互換のため手動arcToで実装）
 */
export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  fill?: string,
  stroke?: string,
  lineWidth = 1.5
): void {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();

  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

/**
 * 矢印線を描画する（実線・破線対応）
 */
export function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineWidth = 2,
  dashed = false,
  headSize = 9
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  if (dashed) {
    ctx.setLineDash([6, 4]);
  }

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // 矢尻を描画
  ctx.setLineDash([]);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headSize * Math.cos(angle - Math.PI / 6),
    y2 - headSize * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    x2 - headSize * Math.cos(angle + Math.PI / 6),
    y2 - headSize * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * 二次ベジェ曲線の矢印を描画する（自己参照・複数役割・FD矢印用）
 */
export function drawCurvedArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  cx: number,
  cy: number,
  x2: number,
  y2: number,
  color: string,
  lineWidth = 2,
  dashed = false,
  headSize = 8
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  if (dashed) {
    ctx.setLineDash([5, 4]);
  }
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(cx, cy, x2, y2);
  ctx.stroke();

  ctx.setLineDash([]);
  const angle = Math.atan2(y2 - cy, x2 - cx);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headSize * Math.cos(angle - Math.PI / 6),
    y2 - headSize * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    x2 - headSize * Math.cos(angle + Math.PI / 6),
    y2 - headSize * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * 試験標準のE-R図端点（1: 縦棒、多(N): 矢印/カラスの足）を描画する
 */
export function drawCardinalityMarker(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  angleFromNode: number,
  card: '1' | '0..1' | 'N' | '0..N' | '1..N',
  color: string
): void {
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(angleFromNode);
  ctx.strokeStyle = color;
  ctx.fillStyle = CANVAS_COLORS.bg;
  ctx.lineWidth = 2;

  const isMany = card === 'N' || card === '0..N' || card === '1..N';
  const isZeroable = card === '0..1' || card === '0..N';

  if (isMany) {
    // 情報処理技術者試験の1対多矢印（開いた矢尻/カラスの足）
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(2, -7);
    ctx.moveTo(14, 0);
    ctx.lineTo(2, 7);
    ctx.stroke();
  } else {
    // 「1」を示す垂直バー
    ctx.beginPath();
    ctx.moveTo(10, -7);
    ctx.lineTo(10, 7);
    ctx.stroke();
  }

  if (isZeroable) {
    // 0許可の白丸
    ctx.beginPath();
    ctx.arc(20, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * テキストをCanvas上の最大幅に収まるよう省略して描画する
 */
export function drawFittedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number
): void {
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, x, y);
    return;
  }
  let clipped = text;
  while (clipped.length > 1 && ctx.measureText(clipped + '…').width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  ctx.fillText(clipped + '…', x, y);
}

/**
 * バッジ（ピル型ラベル）を描画する
 */
export function drawPillBadge(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  bgColor: string,
  borderColor: string,
  textColor: string,
  fontSize = 11
): void {
  ctx.save();
  ctx.font = `600 ${fontSize}px ${CANVAS_FONT_FAMILY}`;
  const metrics = ctx.measureText(text);
  const w = metrics.width + 14;
  const h = fontSize + 8;
  drawRoundedRect(ctx, cx - w / 2, cy - h / 2, w, h, h / 2, bgColor, borderColor, 1.2);
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy + 0.5);
  ctx.restore();
}

/**
 * グリッド背景（図面風）を描画する
 */
export function drawCanvasGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  step = 24
): void {
  ctx.fillStyle = CANVAS_COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= width; x += step) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, height);
  }
  for (let y = 0; y <= height; y += step) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
  }
  ctx.stroke();
  ctx.restore();
}
