/**
 * 그래프·시각화 팝업의 '산출 그래프 형태' 샘플 — 각 그래프 유형의 대표 모양을
 * 자체 SVG 도식(schematic)으로 보여준다(이미지 자산 없이, 앱 배포 불필요).
 * 함께 '대표적으로 쓰는 모델/분석'과 '입력 데이터 형태'를 한 줄씩 곁들인다.
 * (사용자 요청 2026-07-23) — 스니펫 id → PLOT_META 로 매핑, DistCodeDialog intro로 렌더.
 */
import type { PlotSnippet } from "@/lib/reference/plotSnippets";

type PlotShape =
  | "hist"
  | "box"
  | "scatterLine"
  | "heatmap"
  | "matrix"
  | "scatterGroups"
  | "scatter3d"
  | "scatterShapes"
  | "columns"
  | "residual"
  | "twoLines"
  | "roc"
  | "prCurve"
  | "calibration"
  | "gain"
  | "barsH"
  | "lineMono"
  | "linesFan";

interface PlotMeta {
  shape: PlotShape;
  /** 대표적으로 함께 쓰는 모델·분석 */
  models: string;
  /** 입력 데이터 형태(어떤 열이 필요한지) */
  inputShape: string;
}

/** 스니펫 id → 샘플 모양·대표 모델·입력 데이터 형태 */
export const PLOT_META: Record<string, PlotMeta> = {
  // ── 탐색(EDA) ──
  "hist-kde": {
    shape: "hist",
    models: "분포 확인 — 요율·연령·클레임액 등 모든 수치형 변수의 형태 파악",
    inputShape: "수치형 변수 1개 (한 열)",
  },
  "box-violin": {
    shape: "box",
    models: "집단 비교 — t검정·ANOVA 전 시각 점검(그룹별 요율·손해율)",
    inputShape: "그룹(범주) 열 1개 + 값(수치) 열 1개",
  },
  "scatter-reg": {
    shape: "scatterLine",
    models: "선형회귀·상관분석 — 두 수치 변수의 선형 관계",
    inputShape: "수치 x 1열 + 수치 y 1열",
  },
  "corr-heatmap": {
    shape: "heatmap",
    models: "회귀·GLM 변수 선택 — 다중공선성 사전 점검",
    inputShape: "수치형 여러 열 (상관행렬 대상)",
  },
  "scatter-matrix": {
    shape: "matrix",
    models: "탐색적 분석(EDA) — 여러 변수 쌍 관계 일괄 확인",
    inputShape: "수치형 여러 열 (2~5개 권장)",
  },
  "select-columns": {
    shape: "columns",
    models: "플롯·분석 전 데이터 준비 — x·y·구분 열 고르기",
    inputShape: "데이터셋 df + 쓸 열 이름(또는 위치) 목록",
  },
  "scatter-groups": {
    shape: "scatterGroups",
    models: "K-평균·군집·분류 결과(2D) — 두 축 + 범주 색 구분",
    inputShape: "x 1열 + y 1열 + 구분(범주·군집) 1열",
  },
  "scatter-3d": {
    shape: "scatter3d",
    models: "3변수 관계·군집(3D) — 2D로 겹쳐 안 보일 때",
    inputShape: "x·y·z 3열 + 구분(범주) 1열",
  },
  "scatter-shape-color": {
    shape: "scatterShapes",
    models: "군집·분류·범주 비교 — 그룹이 많거나 흑백 출력 대비",
    inputShape: "x 1열 + y 1열 + 구분(범주) 1열",
  },
  // ── 모델 진단 ──
  "residual-plot": {
    shape: "residual",
    models: "선형회귀·트리 회귀 — 예측 대비 잔차의 등분산·패턴 점검",
    inputShape: "회귀 모델 + 검증셋(예측 pred·실제 y)",
  },
  "learning-curve": {
    shape: "twoLines",
    models: "모든 지도학습 — 표본 수 대비 과소/과대적합 진단",
    inputShape: "estimator + X(특성 행렬)·y(라벨)",
  },
  "validation-curve": {
    shape: "twoLines",
    models: "트리·SVM 등 하이퍼파라미터 튜닝 대상 모델",
    inputShape: "estimator + X·y + 바꿀 파라미터 1개",
  },
  "roc-curve": {
    shape: "roc",
    models: "로지스틱·랜덤포레스트·GBM 등 이진 분류기",
    inputShape: "분류 모델 + 검증셋(X_te·y_te, y는 0/1)",
  },
  "pr-curve": {
    shape: "prCurve",
    models: "불균형 분류(해지·사기 등 양성 희소)",
    inputShape: "분류 모델 + 검증셋(양성 드문 0/1)",
  },
  "calibration-curve": {
    shape: "calibration",
    models: "요율·확률을 그대로 쓰는 분류기(예측확률 신뢰도)",
    inputShape: "검증셋 실제 y(0/1) + 예측확률 proba",
  },
  "lift-gain": {
    shape: "gain",
    models: "타깃 마케팅·해지 방어 — 상위 고객 선별 효율",
    inputShape: "검증셋 실제 y(0/1) + 예측확률 proba",
  },
  // ── 해석 ──
  "feature-importance": {
    shape: "barsH",
    models: "랜덤포레스트·GBM·결정트리(트리 기반)",
    inputShape: "학습된 트리 모델 + 특성명 리스트",
  },
  "permutation-importance": {
    shape: "barsH",
    models: "모델 비의존 — 모든 지도학습 모델",
    inputShape: "학습된 모델 + 검증셋 X_te·y_te",
  },
  pdp: {
    shape: "lineMono",
    models: "트리·부스팅 등 비선형 모델의 변수 효과",
    inputShape: "학습된 모델 + X + 볼 변수 1~2개",
  },
  ice: {
    shape: "linesFan",
    models: "상호작용 탐지 — 트리·부스팅 모델",
    inputShape: "학습된 모델 + X + 볼 변수 1개",
  },
};

const P = "#4A90C2"; // primary
const A = "#B4531F"; // accent(스니펫 코드와 동일한 주황)
const G = "#94A3B8"; // 회색 기준선
const T = "#0E9488"; // 세 번째 그룹(teal)
const AX = "#CBD5E1"; // 축

/** 축(x·y) 두 선 */
function Axes() {
  return (
    <>
      <line x1={16} y1={64} x2={116} y2={64} stroke={AX} strokeWidth={1} />
      <line x1={16} y1={10} x2={16} y2={64} stroke={AX} strokeWidth={1} />
    </>
  );
}

const HIST_H = [16, 28, 40, 34, 22, 11];

/** 그래프 유형별 대표 모양 도식 — 128×80 뷰박스 */
export function PlotSampleSvg({ shape }: { shape: PlotShape }) {
  return (
    <svg
      viewBox="0 0 128 80"
      width="100%"
      role="img"
      aria-label="그래프 형태 예시"
      style={{ maxWidth: 90, height: "auto" }}
    >
      <rect x={1} y={1} width={126} height={78} rx={6} fill="white" stroke={AX} />
      <Axes />
      {shape === "hist" ? (
        <>
          {HIST_H.map((h, i) => (
            <rect
              key={i}
              x={20 + i * 15}
              y={64 - h}
              width={12}
              height={h}
              fill={P}
              opacity={0.35}
            />
          ))}
          <path
            d="M20 50 Q45 18 62 22 Q85 28 110 54"
            fill="none"
            stroke={A}
            strokeWidth={2}
          />
        </>
      ) : shape === "box" ? (
        <>
          {[46, 86].map((cx, i) => {
            const top = i === 0 ? 22 : 30;
            const bt = i === 0 ? 58 : 54;
            const bh = i === 0 ? [30, 46] : [36, 48];
            return (
              <g key={cx}>
                <line x1={cx} y1={top} x2={cx} y2={bt} stroke={P} strokeWidth={1.2} />
                <rect
                  x={cx - 11}
                  y={bh[0]}
                  width={22}
                  height={bh[1] - bh[0]}
                  fill={P}
                  opacity={0.22}
                  stroke={P}
                />
                <line
                  x1={cx - 11}
                  y1={(bh[0] + bh[1]) / 2}
                  x2={cx + 11}
                  y2={(bh[0] + bh[1]) / 2}
                  stroke={A}
                  strokeWidth={1.6}
                />
              </g>
            );
          })}
        </>
      ) : shape === "scatterLine" ? (
        <>
          {[
            [26, 55], [36, 50], [44, 46], [52, 44], [60, 38],
            [70, 34], [80, 30], [92, 26], [104, 20],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={2.3} fill={P} opacity={0.75} />
          ))}
          <line x1={20} y1={58} x2={112} y2={18} stroke={A} strokeWidth={2} />
        </>
      ) : shape === "heatmap" ? (
        <>
          {Array.from({ length: 16 }).map((_, k) => {
            const r = Math.floor(k / 4);
            const c = k % 4;
            const v = (Math.sin(r * 1.3 + c * 0.7) + 1) / 2; // 결정적 0~1
            const col = r === c ? A : P;
            return (
              <rect
                key={k}
                x={40 + c * 15}
                y={14 + r * 12}
                width={14}
                height={11}
                fill={col}
                opacity={r === c ? 0.85 : 0.2 + v * 0.6}
              />
            );
          })}
        </>
      ) : shape === "matrix" ? (
        <>
          {[0, 1].map((r) =>
            [0, 1].map((c) => (
              <g key={`${r}${c}`}>
                <rect
                  x={30 + c * 42}
                  y={14 + r * 26}
                  width={38}
                  height={22}
                  fill="none"
                  stroke={AX}
                />
                {r === c ? (
                  [0, 1, 2].map((b) => (
                    <rect
                      key={b}
                      x={34 + c * 42 + b * 9}
                      y={30 + r * 26 - b * 3}
                      width={6}
                      height={5 + b * 3}
                      fill={P}
                      opacity={0.4}
                    />
                  ))
                ) : (
                  [[8, 6], [18, 12], [28, 9], [14, 15]].map(([dx, dy], i) => (
                    <circle
                      key={i}
                      cx={30 + c * 42 + dx}
                      cy={14 + r * 26 + dy}
                      r={1.8}
                      fill={P}
                      opacity={0.7}
                    />
                  ))
                )}
              </g>
            ))
          )}
        </>
      ) : shape === "scatterGroups" ? (
        <>
          {[
            { col: P, pts: [[30, 46], [36, 52], [40, 44], [34, 40]] },
            { col: A, pts: [[64, 30], [70, 36], [74, 26], [68, 22]] },
            { col: T, pts: [[92, 52], [98, 46], [104, 54], [96, 40]] },
          ].map((grp, gi) =>
            grp.pts.map(([x, y], i) => (
              <circle key={`${gi}-${i}`} cx={x} cy={y} r={2.6} fill={grp.col} opacity={0.8} />
            ))
          )}
        </>
      ) : shape === "scatter3d" ? (
        <>
          {/* pseudo-3D 축(원점에서 x·y·z) + 입체 산점 */}
          <line x1={34} y1={58} x2={104} y2={58} stroke={AX} strokeWidth={1} />
          <line x1={34} y1={58} x2={34} y2={16} stroke={AX} strokeWidth={1} />
          <line x1={34} y1={58} x2={64} y2={38} stroke={AX} strokeWidth={1} />
          {[
            { col: P, pts: [[48, 44], [56, 48], [52, 38]] },
            { col: A, pts: [[70, 34], [78, 40], [74, 28]] },
            { col: T, pts: [[86, 50], [92, 44], [88, 52]] },
          ].map((grp, gi) =>
            grp.pts.map(([x, y], i) => (
              <circle key={`${gi}-${i}`} cx={x} cy={y} r={2.5} fill={grp.col} opacity={0.82} />
            ))
          )}
          <text x={106} y={60} fontSize={7} fill={G}>x</text>
          <text x={30} y={14} fontSize={7} fill={G}>z</text>
          <text x={66} y={36} fontSize={7} fill={G}>y</text>
        </>
      ) : shape === "scatterShapes" ? (
        <>
          {/* 그룹1: 원(P) */}
          {[[30, 46], [38, 40], [34, 52]].map(([x, y], i) => (
            <circle key={`c${i}`} cx={x} cy={y} r={3} fill={P} opacity={0.85} />
          ))}
          {/* 그룹2: 사각(A) */}
          {[[64, 30], [72, 36], [68, 24]].map(([x, y], i) => (
            <rect key={`r${i}`} x={x - 3} y={y - 3} width={6} height={6} fill={A} opacity={0.85} />
          ))}
          {/* 그룹3: 삼각(T) */}
          {[[92, 52], [100, 46], [96, 56]].map(([x, y], i) => (
            <polygon
              key={`t${i}`}
              points={`${x},${y - 3.5} ${x - 3.5},${y + 3} ${x + 3.5},${y + 3}`}
              fill={T}
              opacity={0.85}
            />
          ))}
        </>
      ) : shape === "columns" ? (
        <>
          {/* 표에서 특정 열 선택 — 선택된 열은 primary로 강조 */}
          <rect x={26} y={14} width={76} height={50} rx={2} fill="none" stroke={AX} />
          <rect x={26} y={14} width={76} height={11} fill={G} opacity={0.18} />
          {[0, 1, 2, 3].map((c) => {
            const selected = c === 0 || c === 1 || c === 3;
            return (
              <rect
                key={c}
                x={26 + c * 19}
                y={25}
                width={19}
                height={39}
                fill={selected ? P : "white"}
                opacity={selected ? 0.28 : 1}
                stroke={AX}
                strokeWidth={0.5}
              />
            );
          })}
          {[1, 2, 3].map((c) => (
            <line key={c} x1={26 + c * 19} y1={14} x2={26 + c * 19} y2={64} stroke={AX} strokeWidth={0.5} />
          ))}
        </>
      ) : shape === "residual" ? (
        <>
          <line x1={16} y1={40} x2={116} y2={40} stroke={A} strokeWidth={1.4} strokeDasharray="4 3" />
          {[
            [26, 34], [34, 46], [42, 38], [50, 44], [58, 36],
            [66, 45], [74, 38], [84, 43], [94, 37], [104, 42],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={2.2} fill={P} opacity={0.7} />
          ))}
        </>
      ) : shape === "twoLines" ? (
        <>
          <polyline
            points="20,54 40,40 60,32 80,28 104,25"
            fill="none"
            stroke={P}
            strokeWidth={2}
          />
          <polyline
            points="20,58 40,50 60,46 80,44 104,42"
            fill="none"
            stroke={A}
            strokeWidth={2}
          />
        </>
      ) : shape === "roc" ? (
        <>
          <line x1={16} y1={64} x2={112} y2={14} stroke={G} strokeWidth={1.2} strokeDasharray="4 3" />
          <path d="M16 64 Q22 24 60 18 Q92 14 112 14" fill="none" stroke={P} strokeWidth={2} />
        </>
      ) : shape === "prCurve" ? (
        <>
          <path d="M18 18 Q60 20 84 34 Q104 46 112 58" fill="none" stroke={P} strokeWidth={2} />
          <line x1={16} y1={52} x2={116} y2={52} stroke={G} strokeWidth={1} strokeDasharray="4 3" />
        </>
      ) : shape === "calibration" ? (
        <>
          <line x1={16} y1={64} x2={112} y2={14} stroke={G} strokeWidth={1.2} strokeDasharray="4 3" />
          <polyline
            points="20,58 38,52 56,38 74,34 92,22 108,16"
            fill="none"
            stroke={P}
            strokeWidth={2}
          />
          {[[20, 58], [56, 38], [92, 22], [108, 16]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={2.4} fill={P} />
          ))}
        </>
      ) : shape === "gain" ? (
        <>
          <line x1={16} y1={64} x2={112} y2={14} stroke={G} strokeWidth={1.2} strokeDasharray="4 3" />
          <path d="M16 64 Q34 30 64 20 Q92 14 112 14" fill="none" stroke={P} strokeWidth={2} />
        </>
      ) : shape === "barsH" ? (
        <>
          {[64, 46, 34, 22].map((w, i) => (
            <rect
              key={i}
              x={18}
              y={16 + i * 12}
              width={w}
              height={8}
              fill={P}
              opacity={0.75 - i * 0.12}
            />
          ))}
        </>
      ) : shape === "lineMono" ? (
        <path d="M18 56 Q40 54 58 40 Q78 24 110 20" fill="none" stroke={P} strokeWidth={2.2} />
      ) : shape === "linesFan" ? (
        <>
          {[
            "M18 58 Q44 50 66 40 Q88 30 110 26",
            "M18 54 Q44 44 66 34 Q88 22 110 16",
            "M18 60 Q44 56 66 48 Q88 40 110 36",
          ].map((d, i) => (
            <path key={i} d={d} fill="none" stroke={G} strokeWidth={1} opacity={0.7} />
          ))}
          <path d="M18 56 Q44 47 66 37 Q88 26 110 22" fill="none" stroke={P} strokeWidth={2.2} />
        </>
      ) : null}
    </svg>
  );
}

/** 팝업 상단 프리뷰 블록 — 샘플 모양 + 대표 모델 + 입력 데이터 형태 */
export function PlotSnippetPreview({ snippet }: { snippet: PlotSnippet }) {
  const meta = PLOT_META[snippet.id];
  if (!meta) return null;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/50 px-2.5 py-2 sm:flex-row sm:items-center sm:gap-3">
      <div className="shrink-0 self-center">
        <PlotSampleSvg shape={meta.shape} />
        <p className="mt-0.5 text-center text-[10px] text-muted-foreground">산출 그래프 형태(예시)</p>
      </div>
      <dl className="min-w-0 flex-1 space-y-1 text-[12.5px] leading-relaxed">
        <div className="flex gap-2">
          <dt className="shrink-0 font-semibold text-foreground">대표 모델·분석</dt>
          <dd className="min-w-0 text-foreground/80">{meta.models}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 font-semibold text-foreground">입력 데이터</dt>
          <dd className="min-w-0 text-foreground/80">{meta.inputShape}</dd>
        </div>
      </dl>
    </div>
  );
}
