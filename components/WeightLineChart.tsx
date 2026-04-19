import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import type { UnitSystem } from '@/lib/units';
import { displayWeight } from '@/lib/units';

export interface WeightPoint {
  date: string; // YYYY-MM-DD
  weightKg: number;
}

interface WeightLineChartProps {
  data: WeightPoint[];
  goalWeightKg?: number | null;
  unitSystem: UnitSystem;
  width: number;
  height: number;
  /** If true, show x-axis date labels */
  showLabels?: boolean;
}

const PAD = { top: 12, right: 12, bottom: (showL: boolean) => (showL ? 28 : 8), left: 36 };

function buildPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
}

export function WeightLineChart({
  data,
  goalWeightKg,
  unitSystem,
  width,
  height,
  showLabels = false,
}: WeightLineChartProps) {
  const padBottom = PAD.bottom(showLabels);

  const { points, goalY, yMin, yMax } = useMemo(() => {
    if (data.length === 0) return { points: [], goalY: null, yMin: 0, yMax: 0 };

    const weights = data.map((d) => d.weightKg);
    const allWeights = goalWeightKg != null ? [...weights, goalWeightKg] : weights;
    const rawMin = Math.min(...allWeights);
    const rawMax = Math.max(...allWeights);
    const padding = Math.max((rawMax - rawMin) * 0.15, 1);
    const yMin = rawMin - padding;
    const yMax = rawMax + padding;

    const chartW = width - PAD.left - PAD.right;
    const chartH = height - PAD.top - padBottom;

    const toX = (i: number) =>
      data.length === 1 ? PAD.left + chartW / 2 : PAD.left + (i / (data.length - 1)) * chartW;
    const toY = (kg: number) => PAD.top + chartH - ((kg - yMin) / (yMax - yMin)) * chartH;

    const points = data.map((d, i) => ({ x: toX(i), y: toY(d.weightKg), date: d.date }));
    const goalY = goalWeightKg != null ? toY(goalWeightKg) : null;

    return { points, goalY, yMin, yMax };
  }, [data, goalWeightKg, width, height, padBottom]);

  if (data.length === 0) {
    return (
      <View style={{ width, height }} className="items-center justify-center">
        <Text className="text-xs text-zinc-600">No weight data yet</Text>
      </View>
    );
  }

  const chartH = height - PAD.top - padBottom;

  // Y-axis labels: 3 evenly spaced
  const yLabels = [yMin, (yMin + yMax) / 2, yMax].map((kg) => ({
    y: PAD.top + chartH - ((kg - yMin) / (yMax - yMin)) * chartH,
    label: displayWeight(kg, unitSystem),
  }));

  // X-axis labels: first, middle, last
  const xLabelIndices =
    data.length <= 2
      ? data.map((_, i) => i)
      : [0, Math.floor((data.length - 1) / 2), data.length - 1];

  const pathD = buildPath(points);

  return (
    <Svg width={width} height={height}>
      {/* Y-axis grid lines + labels */}
      {yLabels.map((yl, i) => (
        <React.Fragment key={i}>
          <Line
            x1={PAD.left}
            y1={yl.y}
            x2={width - PAD.right}
            y2={yl.y}
            stroke="#2e2e2e"
            strokeWidth={1}
          />
          <SvgText x={PAD.left - 4} y={yl.y + 4} fontSize={9} fill="#52525b" textAnchor="end">
            {yl.label}
          </SvgText>
        </React.Fragment>
      ))}

      {/* Goal weight dashed line */}
      {goalY != null && (
        <Line
          x1={PAD.left}
          y1={goalY}
          x2={width - PAD.right}
          y2={goalY}
          stroke="#1a9e6e"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      )}

      {/* Weight line */}
      <Path d={pathD} stroke="#3b82f6" strokeWidth={2} fill="none" strokeLinejoin="round" />

      {/* Data points */}
      {points.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={3} fill="#3b82f6" />
      ))}

      {/* Most recent point highlighted */}
      {points.length > 0 && (
        <Circle
          cx={points[points.length - 1]!.x}
          cy={points[points.length - 1]!.y}
          r={5}
          fill="#3b82f6"
          stroke="#0f0f0f"
          strokeWidth={2}
        />
      )}

      {/* X-axis labels */}
      {showLabels &&
        xLabelIndices.map((idx) => {
          const p = points[idx];
          if (!p) return null;
          const [, m, d] = data[idx]!.date.split('-');
          return (
            <SvgText
              key={idx}
              x={p.x}
              y={height - 4}
              fontSize={9}
              fill="#52525b"
              textAnchor="middle"
            >
              {`${parseInt(m ?? '0', 10)}/${parseInt(d ?? '0', 10)}`}
            </SvgText>
          );
        })}
    </Svg>
  );
}
