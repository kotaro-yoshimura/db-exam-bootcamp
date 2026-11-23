// シミュレーター①：正規化・FDステップ分解パズル＋PK/FK/PK兼FKタップ採点＋E-R図5大パターン×関係スキーマ連動ビルダー
import React, { useState, useEffect, useRef } from 'react';
import { NORMALIZATION_CASES, ER_PATTERNS } from '../../data/erPatterns';
import type { KeyRole, RelationSchema, ErPatternDefinition } from '../../types/exam';
import type { StudyStore } from '../../state/useStudyStore';
import {
  CANVAS_COLORS,
  CANVAS_FONT_FAMILY,
  setupHiDpiCanvas,
  drawRoundedRect,
  drawArrow,
  drawCurvedArrow,
  drawCardinalityMarker,
  drawFittedText,
  drawPillBadge,
  drawCanvasGrid,
} from '../../utils/canvasHelpers';

interface Props {
  store: StudyStore;
}

const KEY_ROLE_CYCLE: KeyRole[] = ['none', 'pk', 'fk', 'pkfk'];

const KEY_ROLE_LABEL: Record<KeyRole, string> = {
  none: '通常',
  pk: '主キー(実線)',
  fk: '外部キー(破線)',
  pkfk: '主兼外(二重線)',
};

const KEY_ROLE_CLASS: Record<KeyRole, string> = {
  none: 'key-none text-[#18181b]',
  pk: 'key-pk text-[#1d4ed8] font-bold',
  fk: 'key-fk text-[#15803d] font-semibold',
  pkfk: 'key-pkfk text-[#b45309] font-bold',
};

/** 関係スキーマを試験表記の下線付きでレンダリングする共通表示部品 */
export const SchemaLineDisplay: React.FC<{ schema: RelationSchema }> = ({ schema }) => (
  <div className="rounded-md border border-[#e4e4e0] bg-[#f6f6f4] p-3">
    <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-2 text-sm leading-relaxed">
      <span className="font-bold text-[#18181b]">{schema.tableName}</span>
      <span className="text-[#71717a]">(</span>
      {schema.attributes.map((attr, idx) => (
        <React.Fragment key={`${schema.tableName}-${attr.name}-${idx}`}>
          <span
            className={`inline-block px-0.5 ${KEY_ROLE_CLASS[attr.role]} ${
              attr.isRedundant ? 'bg-[#fffbeb] rounded px-1 border border-[#fde68a]' : ''
            }`}
            title={
              attr.references
                ? `${KEY_ROLE_LABEL[attr.role]} → 参照先: ${attr.references}${attr.note ? `（${attr.note}）` : ''}`
                : attr.note || KEY_ROLE_LABEL[attr.role]
            }
          >
            {attr.name}
          </span>
          {idx < schema.attributes.length - 1 && <span className="text-[#a1a1aa]">,</span>}
        </React.Fragment>
      ))}
      <span className="text-[#71717a]">)</span>
    </div>
    {schema.explanation && (
      <p className="mt-2 text-xs text-[#52525b] leading-relaxed">{schema.explanation}</p>
    )}
  </div>
);

export const NormalizationErSim: React.FC<Props> = ({ store }) => {
  const [subTab, setSubTab] = useState<'norm' | 'er'>('norm');

  const [caseIdx, setCaseIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const activeCase = NORMALIZATION_CASES[caseIdx];
  const activeStep = activeCase.steps[Math.min(stepIdx, activeCase.steps.length - 1)];

  const [userRoles, setUserRoles] = useState<KeyRole[]>(() =>
    activeCase.quizSchema.attributes.map(() => 'none')
  );
  const [quizResult, setQuizResult] = useState<{
    checked: boolean;
    perfect: boolean;
    score: number;
    total: number;
  } | null>(null);

  const handleSelectCase = (idx: number) => {
    setCaseIdx(idx);
    setStepIdx(0);
    setUserRoles(NORMALIZATION_CASES[idx].quizSchema.attributes.map(() => 'none'));
    setQuizResult(null);
  };

  const handleToggleAttrRole = (attrIdx: number) => {
    setQuizResult(null);
    setUserRoles((prev) =>
      prev.map((role, i) => {
        if (i !== attrIdx) return role;
        const nextIdx = (KEY_ROLE_CYCLE.indexOf(role) + 1) % KEY_ROLE_CYCLE.length;
        return KEY_ROLE_CYCLE[nextIdx];
      })
    );
  };

  const handleGradeSchemaQuiz = () => {
    const attrs = activeCase.quizSchema.attributes;
    let correct = 0;
    attrs.forEach((a, i) => {
      if (userRoles[i] === a.role) correct++;
    });
    const perfect = correct === attrs.length;
    setQuizResult({ checked: true, perfect, score: correct, total: attrs.length });

    if (perfect) {
      store.markSchemaQuizSolved(activeCase.id);
    } else {
      store.recordReviewMiss({
        id: `review-schema-${activeCase.id}`,
        kind: 'schema',
        year: activeCase.year,
        title: `${activeCase.year} ${activeCase.quizSchema.tableName} 下線判定`,
        prompt: `${activeCase.scenario} 関係スキーマ「${activeCase.quizSchema.tableName}」の各属性に主キー(実線)・外部キー(破線)・主兼外(二重線)を指定せよ。`,
        payload: {
          schema: activeCase.quizSchema,
          explanation: activeCase.quizSchema.explanation,
        },
      });
    }
  };

  const [patternIdx, setPatternIdx] = useState(0);
  const [toggleVariant, setToggleVariant] = useState(true);
  const activePattern: ErPatternDefinition = ER_PATTERNS[patternIdx];
  const currentSchemas =
    toggleVariant || !activePattern.relationsWithoutRedundant
      ? activePattern.relationsWithRedundant
      : activePattern.relationsWithoutRedundant;

  const fdCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fdContainerRef = useRef<HTMLDivElement | null>(null);
  const erCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const erContainerRef = useRef<HTMLDivElement | null>(null);
  const [canvasTick, setCanvasTick] = useState(0);

  useEffect(() => {
    const onResize = () => setCanvasTick((t) => t + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Canvas 1: 関数従属性（FD）ビジュアル図の描画（高コントラスト図板維持）
  useEffect(() => {
    if (subTab !== 'norm') return;
    const canvas = fdCanvasRef.current;
    const container = fdContainerRef.current;
    if (!canvas || !container) return;

    const width = Math.max(300, container.clientWidth);
    const fds = activeStep.fds;
    const height = Math.max(200, 74 + fds.length * 56);
    const ctx = setupHiDpiCanvas(canvas, width, height);
    if (!ctx) return;

    drawCanvasGrid(ctx, width, height, 24);

    ctx.fillStyle = CANVAS_COLORS.textMain;
    ctx.font = `700 13px ${CANVAS_FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`関数従属性（FD）マップ — ${activeStep.level}: ${activeStep.title}`, 14, 22);

    const legends: Array<{ label: string; color: string }> = [
      { label: '完全従属', color: CANVAS_COLORS.emerald },
      { label: '部分従属(2NF違反)', color: CANVAS_COLORS.rose },
      { label: '推移従属(3NF違反)', color: CANVAS_COLORS.amber },
      { label: 'BCNF違反', color: CANVAS_COLORS.violet },
    ];
    let lx = 14;
    ctx.font = `600 11px ${CANVAS_FONT_FAMILY}`;
    for (const lg of legends) {
      ctx.fillStyle = lg.color;
      ctx.fillRect(lx, 40, 10, 10);
      ctx.fillStyle = CANVAS_COLORS.textSub;
      ctx.fillText(lg.label, lx + 14, 45);
      lx += ctx.measureText(lg.label).width + 26;
      if (lx > width - 80) break;
    }

    const leftX = 16;
    const leftW = Math.min(220, width * 0.34);
    const rightX = Math.max(leftX + leftW + 78, width * 0.56);
    const rightW = Math.max(110, width - rightX - 16);

    fds.forEach((fd, idx) => {
      const y = 70 + idx * 54;
      const boxH = 38;
      const color =
        fd.type === 'full'
          ? CANVAS_COLORS.emerald
          : fd.type === 'partial'
            ? CANVAS_COLORS.rose
            : fd.type === 'transitive'
              ? CANVAS_COLORS.amber
              : CANVAS_COLORS.violet;

      drawRoundedRect(ctx, leftX, y, leftW, boxH, 8, CANVAS_COLORS.bgPanel, CANVAS_COLORS.cyan, 1.5);
      ctx.fillStyle = CANVAS_COLORS.textMain;
      ctx.font = `600 12px ${CANVAS_FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      drawFittedText(ctx, fd.determinant.join(' + '), leftX + leftW / 2, y + boxH / 2, leftW - 14);

      drawRoundedRect(ctx, rightX, y, rightW, boxH, 8, CANVAS_COLORS.bgPanel, color, 1.8);
      ctx.fillStyle = CANVAS_COLORS.textMain;
      drawFittedText(ctx, fd.dependent.join(', '), rightX + rightW / 2, y + boxH / 2, rightW - 14);

      const arrowX1 = leftX + leftW + 4;
      const arrowX2 = rightX - 5;
      const midY = y + boxH / 2;
      drawArrow(ctx, arrowX1, midY, arrowX2, midY, color, 2.2, fd.type !== 'full', 9);

      const midX = (arrowX1 + arrowX2) / 2;
      drawPillBadge(ctx, fd.label, midX, midY - 14, CANVAS_COLORS.bgDarker, color, color, 10);
    });
  }, [subTab, activeStep, canvasTick]);

  // Canvas 2: E-R図5大パターンの描画
  useEffect(() => {
    if (subTab !== 'er') return;
    const canvas = erCanvasRef.current;
    const container = erContainerRef.current;
    if (!canvas || !container) return;

    const width = Math.max(320, container.clientWidth);
    const height = width < 520 ? 340 : 370;
    const ctx = setupHiDpiCanvas(canvas, width, height);
    if (!ctx) return;

    drawCanvasGrid(ctx, width, height, 24);

    ctx.fillStyle = CANVAS_COLORS.textMain;
    ctx.font = `700 13px ${CANVAS_FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`E-R図ブループリント — ${activePattern.title}`, 14, 22);
    drawPillBadge(
      ctx,
      toggleVariant ? '拡張/厳密モード' : '基本モード',
      width - 74,
      22,
      CANVAS_COLORS.cyanSoft,
      CANVAS_COLORS.cyan,
      CANVAS_COLORS.cyan,
      10
    );

    const boxW = Math.min(188, Math.max(116, width * 0.27));
    const nodeMap = new Map<
      string,
      { cx: number; cy: number; w: number; h: number; node: ErPatternDefinition['entities'][number] }
    >();

    activePattern.entities.forEach((ent) => {
      const extraLines =
        ent.pkAttrs.length +
        (ent.otherAttrs?.length || 0) +
        (toggleVariant && ent.redundantAttrs ? ent.redundantAttrs.length : 0);
      const boxH = Math.max(76, 36 + extraLines * 17);
      const cx = Math.max(boxW / 2 + 12, Math.min(width - boxW / 2 - 12, ent.x * width));
      const cy = Math.max(boxH / 2 + 44, Math.min(height - boxH / 2 - 16, ent.y * height));
      nodeMap.set(ent.id, { cx, cy, w: boxW, h: boxH, node: ent });
    });

    activePattern.relationships.forEach((rel) => {
      const fromBox = nodeMap.get(rel.from);
      const toBox = nodeMap.get(rel.to);
      if (!fromBox || !toBox) return;

      const lineColor = rel.isSubtypeEdge ? CANVAS_COLORS.amber : CANVAS_COLORS.cyan;

      if (rel.from === rel.to) {
        const topY = fromBox.cy - fromBox.h / 2;
        const x1 = fromBox.cx - fromBox.w * 0.25;
        const x2 = fromBox.cx + fromBox.w * 0.25;
        const loopY = Math.max(46, topY - 58);

        ctx.save();
        ctx.strokeStyle = CANVAS_COLORS.emerald;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, topY);
        ctx.bezierCurveTo(x1 - 24, loopY, x2 + 24, loopY, x2, topY);
        ctx.stroke();
        ctx.restore();

        drawCardinalityMarker(ctx, x1, topY, -Math.PI / 2, rel.fromCard, CANVAS_COLORS.emerald);
        drawCardinalityMarker(ctx, x2, topY, -Math.PI / 2, rel.toCard, CANVAS_COLORS.emerald);
        if (rel.label) {
          drawPillBadge(
            ctx,
            rel.label,
            fromBox.cx,
            loopY + 4,
            CANVAS_COLORS.emeraldSoft,
            CANVAS_COLORS.emerald,
            CANVAS_COLORS.emerald,
            10
          );
        }
        return;
      }

      const dx = toBox.cx - fromBox.cx;
      const dy = toBox.cy - fromBox.cy;
      const angle = Math.atan2(dy, dx);

      const getEdgePoint = (
        box: { cx: number; cy: number; w: number; h: number },
        ang: number
      ) => {
        const cos = Math.cos(ang);
        const sin = Math.sin(ang);
        const tx = Math.abs(cos) > 0.001 ? box.w / 2 / Math.abs(cos) : 9999;
        const ty = Math.abs(sin) > 0.001 ? box.h / 2 / Math.abs(sin) : 9999;
        const t = Math.min(tx, ty);
        return { x: box.cx + cos * t, y: box.cy + sin * t };
      };

      const p1 = getEdgePoint(fromBox, angle);
      const p2 = getEdgePoint(toBox, angle + Math.PI);

      if (rel.curveOffset) {
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        const nx = -Math.sin(angle);
        const ny = Math.cos(angle);
        const cx = mx + nx * rel.curveOffset;
        const cy = my + ny * rel.curveOffset;

        drawCurvedArrow(ctx, p1.x, p1.y, cx, cy, p2.x, p2.y, lineColor, 2, false, 8);
        if (rel.label) {
          drawPillBadge(
            ctx,
            rel.label,
            (p1.x + 2 * cx + p2.x) / 4,
            (p1.y + 2 * cy + p2.y) / 4,
            CANVAS_COLORS.bgDarker,
            lineColor,
            CANVAS_COLORS.textMain,
            10
          );
        }
      } else {
        ctx.save();
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.restore();

        if (!rel.isSubtypeEdge) {
          drawCardinalityMarker(ctx, p1.x, p1.y, angle, rel.fromCard, lineColor);
          drawCardinalityMarker(ctx, p2.x, p2.y, angle + Math.PI, rel.toCard, lineColor);
        } else {
          const mx = (p1.x + p2.x) / 2;
          const my = (p1.y + p2.y) / 2;
          drawPillBadge(
            ctx,
            rel.subtypeRule || 'サブタイプ',
            mx,
            my,
            CANVAS_COLORS.amberSoft,
            CANVAS_COLORS.amber,
            CANVAS_COLORS.amber,
            10
          );
        }

        if (rel.label) {
          drawPillBadge(
            ctx,
            rel.label,
            (p1.x + p2.x) / 2,
            (p1.y + p2.y) / 2 - 12,
            CANVAS_COLORS.bgDarker,
            CANVAS_COLORS.borderLight,
            CANVAS_COLORS.textSub,
            10
          );
        }
      }
    });

    nodeMap.forEach(({ cx, cy, w, h, node }) => {
      const x = cx - w / 2;
      const y = cy - h / 2;
      const borderColor =
        node.kind === 'associative'
          ? CANVAS_COLORS.emerald
          : node.kind === 'supertype' || node.kind === 'subtype'
            ? CANVAS_COLORS.amber
            : CANVAS_COLORS.cyan;
      const headerBg =
        node.kind === 'associative'
          ? CANVAS_COLORS.emeraldSoft
          : node.kind === 'supertype' || node.kind === 'subtype'
            ? CANVAS_COLORS.amberSoft
            : CANVAS_COLORS.cyanSoft;

      drawRoundedRect(ctx, x, y, w, h, 8, CANVAS_COLORS.bgPanel, borderColor, 1.8);
      drawRoundedRect(ctx, x + 1, y + 1, w - 2, 26, 7, headerBg);
      ctx.fillStyle = CANVAS_COLORS.textMain;
      ctx.font = `700 12px ${CANVAS_FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      drawFittedText(ctx, node.name, cx, y + 14, w - 12);

      const pkCount = node.pkAttrs.length;
      let curY = y + 38;
      ctx.textAlign = 'left';
      ctx.font = `600 11px ${CANVAS_FONT_FAMILY}`;

      node.pkAttrs.forEach((pk) => {
        const isFk = pk.includes('(FK)');
        ctx.fillStyle = isFk ? CANVAS_COLORS.amber : CANVAS_COLORS.cyan;
        drawFittedText(ctx, `# ${pk}`, x + 8, curY, w - 16);
        const textW = Math.min(ctx.measureText(`# ${pk}`).width, w - 18);
        ctx.strokeStyle = isFk ? CANVAS_COLORS.amber : CANVAS_COLORS.cyan;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(x + 8, curY + 7);
        ctx.lineTo(x + 8 + textW, curY + 7);
        ctx.stroke();
        if (isFk) {
          ctx.save();
          ctx.strokeStyle = CANVAS_COLORS.emerald;
          ctx.setLineDash([3, 2]);
          ctx.beginPath();
          ctx.moveTo(x + 8, curY + 10);
          ctx.lineTo(x + 8 + textW, curY + 10);
          ctx.stroke();
          ctx.restore();
        }
        curY += 17;
      });

      ctx.strokeStyle = CANVAS_COLORS.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 6, y + 30 + pkCount * 17 + 1);
      ctx.lineTo(x + w - 6, y + 30 + pkCount * 17 + 1);
      ctx.stroke();

      curY += 4;
      ctx.font = `500 11px ${CANVAS_FONT_FAMILY}`;
      (node.otherAttrs || []).forEach((attr) => {
        const isFk = attr.includes('(FK');
        ctx.fillStyle = isFk ? CANVAS_COLORS.emerald : CANVAS_COLORS.textSub;
        drawFittedText(ctx, attr, x + 8, curY, w - 16);
        curY += 16;
      });

      if (toggleVariant && node.redundantAttrs) {
        node.redundantAttrs.forEach((ra) => {
          ctx.fillStyle = CANVAS_COLORS.amber;
          ctx.font = `700 11px ${CANVAS_FONT_FAMILY}`;
          drawFittedText(ctx, ra, x + 8, curY, w - 16);
          curY += 16;
        });
      }
    });
  }, [subTab, activePattern, toggleVariant, canvasTick]);

  return (
    <div className="space-y-4">
      {/* サブタブ */}
      <div className="inline-flex rounded-md border border-[#d4d4d0] bg-[#f1f1ee] p-0.5">
        <button
          type="button"
          onClick={() => setSubTab('norm')}
          className={`rounded px-3.5 py-1.5 text-xs font-semibold transition ${
            subTab === 'norm' ? 'bg-white text-[#18181b] shadow-xs' : 'text-[#52525b] hover:text-[#18181b]'
          }`}
        >
          正規化・FD分解 ＆ 下線採点
        </button>
        <button
          type="button"
          onClick={() => setSubTab('er')}
          className={`rounded px-3.5 py-1.5 text-xs font-semibold transition ${
            subTab === 'er' ? 'bg-white text-[#18181b] shadow-xs' : 'text-[#52525b] hover:text-[#18181b]'
          }`}
        >
          E-R図5大パターン連動ビルダー
        </button>
      </div>

      {subTab === 'norm' ? (
        <div className="space-y-5">
          {/* 過去問ケース選択 */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {NORMALIZATION_CASES.map((c, idx) => {
              const solved = store.state.solvedSchemaQuizzes.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectCase(idx)}
                  className={`rounded-lg border p-3 text-left transition ${
                    idx === caseIdx
                      ? 'border-[#18181b] bg-white'
                      : 'border-[#e4e4e0] bg-white/60 hover:border-[#a1a1aa] hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold text-[#1d4ed8]">
                      {c.year}
                    </span>
                    {solved && (
                      <span className="rounded border border-[#bbf7d0] bg-[#f0fdf4] px-1.5 py-0.5 text-[10px] font-semibold text-[#15803d]">
                        満点済
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm font-bold text-[#18181b]">{c.title}</div>
                  <div className="mt-0.5 text-[11px] text-[#71717a]">{c.examSection}</div>
                </button>
              );
            })}
          </div>

          {/* 業務シナリオと正規化ステップ */}
          <div className="rounded-lg border border-[#e4e4e0] bg-white p-4 space-y-4">
            <p className="text-sm text-[#3f3f46] leading-relaxed">
              <span className="font-bold text-[#18181b]">業務シナリオ：</span>
              {activeCase.scenario}
            </p>

            <div className="flex flex-wrap items-center gap-1.5">
              {activeCase.steps.map((st, idx) => (
                <button
                  key={st.level}
                  type="button"
                  onClick={() => setStepIdx(idx)}
                  className={`rounded-md px-3 py-1.5 font-mono text-xs font-semibold transition ${
                    idx === stepIdx
                      ? 'bg-[#18181b] text-white'
                      : 'border border-[#d4d4d0] bg-[#f6f6f4] text-[#52525b] hover:bg-[#e4e4e0]'
                  }`}
                >
                  Step {idx + 1}: {st.level}
                </button>
              ))}
            </div>

            {/* HTML5 Canvas FD図板 */}
            <div
              ref={fdContainerRef}
              className="w-full overflow-hidden rounded-md border border-[#1e293b] bg-[#0f172a]"
            >
              <canvas ref={fdCanvasRef} className="block w-full" />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-md border border-[#e4e4e0] bg-[#f6f6f4] p-3.5 space-y-2">
                <div className="text-xs font-bold text-[#18181b]">{activeStep.title}</div>
                <p className="text-xs sm:text-sm text-[#3f3f46] leading-relaxed">{activeStep.summary}</p>
                <div className="rounded border border-[#fecdd3] bg-[#fff1f2] p-2.5 text-xs text-[#9f1239] leading-relaxed">
                  <span className="font-bold">着目ポイント：</span>
                  {activeStep.problemPoint}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-bold text-[#52525b]">この段階の関係スキーマ</div>
                {activeStep.relations.map((rel) => (
                  <SchemaLineDisplay key={rel.tableName} schema={rel} />
                ))}
              </div>
            </div>
          </div>

          {/* 下線タップ採点クイズ */}
          <div className="rounded-lg border border-[#e4e4e0] bg-white p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f1f1ee] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#18181b]">
                  下線タップ採点クイズ：{activeCase.quizSchema.tableName}
                </h3>
                <p className="text-xs text-[#71717a] mt-0.5">
                  属性をタップして「通常 → 主キー(実線) → 外部キー(破線) → 主兼外(二重線)」を切替（誤答は弱点キューへ自動登録）
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="text-[#1d4ed8] font-semibold">実線＝主キー</span>
                <span className="text-[#15803d] font-semibold">破線＝外部キー</span>
                <span className="text-[#b45309] font-semibold">二重線＝主兼外</span>
              </div>
            </div>

            <div className="rounded-md border border-[#e4e4e0] bg-[#f6f6f4] p-4">
              <div className="mb-3 text-xs text-[#52525b]">ヒント：{activeCase.quizHint}</div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-[#18181b]">
                  {activeCase.quizSchema.tableName} (
                </span>
                {activeCase.quizSchema.attributes.map((attr, idx) => {
                  const chosen = userRoles[idx] || 'none';
                  const isCorrectAttr = quizResult?.checked && chosen === attr.role;
                  const isWrongAttr = quizResult?.checked && chosen !== attr.role;
                  return (
                    <button
                      key={attr.name}
                      type="button"
                      onClick={() => handleToggleAttrRole(idx)}
                      className={`flex flex-col items-center rounded-md border px-3 py-2 transition active:scale-95 ${
                        isCorrectAttr
                          ? 'border-[#15803d] bg-[#f0fdf4]'
                          : isWrongAttr
                            ? 'border-[#be123c] bg-[#fff1f2]'
                            : 'border-[#d4d4d0] bg-white hover:border-[#18181b]'
                      }`}
                    >
                      <span className={`text-sm ${KEY_ROLE_CLASS[chosen]}`}>{attr.name}</span>
                      <span className="mt-1 text-[10px] text-[#71717a]">
                        {KEY_ROLE_LABEL[chosen]}
                      </span>
                    </button>
                  );
                })}
                <span className="text-sm font-bold text-[#18181b]">)</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleGradeSchemaQuiz}
                className="rounded-md bg-[#18181b] px-4 py-2 text-xs font-semibold text-white hover:bg-[#27272a] transition"
              >
                下線を採点する
              </button>
              <button
                type="button"
                onClick={() => {
                  setUserRoles(activeCase.quizSchema.attributes.map(() => 'none'));
                  setQuizResult(null);
                }}
                className="rounded-md border border-[#d4d4d0] bg-white px-3.5 py-2 text-xs font-semibold text-[#52525b] hover:bg-[#f1f1ee]"
              >
                リセット
              </button>
            </div>

            {quizResult && (
              <div
                className={`rounded-md border p-4 space-y-2 ${
                  quizResult.perfect
                    ? 'border-[#bbf7d0] bg-[#f0fdf4]'
                    : 'border-[#fecdd3] bg-[#fff1f2]'
                }`}
              >
                <div className="text-xs font-bold">
                  {quizResult.perfect ? (
                    <span className="text-[#15803d]">
                      満点正解（{quizResult.score}/{quizResult.total}）
                    </span>
                  ) : (
                    <span className="text-[#be123c]">
                      {quizResult.score}/{quizResult.total} 正解 — 弱点復習キューへ自動登録しました（2回連続満点で卒業）
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#3f3f46] leading-relaxed">
                  {activeCase.quizSchema.explanation}
                </p>
                <SchemaLineDisplay schema={activeCase.quizSchema} />
              </div>
            )}
          </div>
        </div>
      ) : (
        /* E-R図5大パターン連動ビルダー */
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {ER_PATTERNS.map((pat, idx) => (
              <button
                key={pat.id}
                type="button"
                onClick={() => {
                  setPatternIdx(idx);
                  setToggleVariant(true);
                }}
                className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                  idx === patternIdx
                    ? 'border-[#18181b] bg-[#18181b] text-white'
                    : 'border-[#d4d4d0] bg-white text-[#52525b] hover:bg-[#f1f1ee]'
                }`}
              >
                {pat.shortTitle}
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-[#e4e4e0] bg-white p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-[#18181b]">{activePattern.title}</h3>
                <div className="mt-1 text-xs font-mono text-[#71717a]">
                  出題実績：{activePattern.years.join(' / ')}
                </div>
              </div>

              {activePattern.toggleLabel && (
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-[#d4d4d0] bg-[#f6f6f4] px-3 py-1.5 text-xs font-medium text-[#18181b]">
                  <input
                    type="checkbox"
                    checked={toggleVariant}
                    onChange={(e) => setToggleVariant(e.target.checked)}
                    className="h-4 w-4 accent-[#18181b]"
                  />
                  <span>{activePattern.toggleLabel}</span>
                </label>
              )}
            </div>

            <div
              ref={erContainerRef}
              className="w-full overflow-hidden rounded-md border border-[#1e293b] bg-[#0f172a]"
            >
              <canvas ref={erCanvasRef} className="block w-full" />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-[#52525b]">
                連動関係スキーマ（実線＝主キー / 破線＝外部キー / 二重線＝主兼外 / [ ]＝冗長属性）
              </div>
              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                {currentSchemas.map((rel) => (
                  <SchemaLineDisplay key={rel.tableName} schema={rel} />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-md border border-[#e4e4e0] bg-[#f6f6f4] p-3.5 text-xs text-[#3f3f46] leading-relaxed">
                <div className="mb-1 font-bold text-[#18181b]">構造の核心ポイント</div>
                {activePattern.keyPoint}
              </div>
              <div className="rounded-md border border-[#fde68a] bg-[#fffbeb] p-3.5 text-xs text-[#78350f] leading-relaxed">
                <div className="mb-1 font-bold text-[#92400e]">CBT午後試験の見抜き方</div>
                {activePattern.cbtTip}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
