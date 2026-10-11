/**
 * SVG geometry for the wave-6 line charts.
 *
 * Both the client reports page and the platform analytics page draw the same
 * picture — a daily series with grid lines, an area under the inbound line, two
 * series and a dot per day — so the maths lives here once instead of twice. The
 * output is plain strings and numbers: no charting library, and nothing here
 * touches the DOM, which keeps it server-renderable.
 */

export interface ChartSeriesPoint {
  /** Stable key for `trackBy` — the day's ISO timestamp. */
  date: string;
  label: string;
  inbound: number;
  outbound: number;
  total: number;
}

export interface ChartGeometry {
  width: number;
  height: number;
  /** The plot box, so a template can place axis marks without redoing the maths. */
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** Path data for each series, and the filled area under the inbound line. */
  inbound: string;
  outbound: string;
  area: string;
  /** Rounded-up axis maximum, so the grid lines land on whole messages. */
  max: number;
  gridlines: { y: number; label: string }[];
  points: { x: number; y: number; total: number; point: ChartSeriesPoint }[];
  /** Day labels under the chart, thinned out so a 90-day window stays legible. */
  labels: string[];
}

export interface ChartOptions {
  width?: number;
  height?: number;
  padding?: { top: number; right: number; bottom: number; left: number };
  /** At most this many x-axis labels. */
  maxLabels?: number;
}

const DEFAULTS = {
  width: 600,
  height: 220,
  padding: { top: 14, right: 14, bottom: 26, left: 46 },
  maxLabels: 7,
};

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Maps a daily series into SVG coordinates. The axis maximum is rounded up to the
 * next five so the grid lines read as whole messages, and a flat or empty window
 * still draws a baseline rather than dividing by zero.
 */
export function buildLineChart(
  points: ChartSeriesPoint[],
  options: ChartOptions = {},
): ChartGeometry {
  const width = options.width ?? DEFAULTS.width;
  const height = options.height ?? DEFAULTS.height;
  const padding = options.padding ?? DEFAULTS.padding;
  const maxLabels = options.maxLabels ?? DEFAULTS.maxLabels;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const rawMax = Math.max(...points.map((point) => point.total), 1);
  const max = Math.max(5, Math.ceil((rawMax * 1.1) / 5) * 5);
  const step = points.length > 1 ? plotWidth / (points.length - 1) : 0;
  const baseline = padding.top + plotHeight;
  const xAt = (index: number): number => round(padding.left + index * step);
  const yAt = (value: number): number => round(padding.top + plotHeight - (value / max) * plotHeight);

  const plotted = points.map((point, index) => ({
    x: xAt(index),
    y: yAt(point.total),
    total: point.total,
    point,
  }));
  const line = (pick: (point: ChartSeriesPoint) => number): string =>
    plotted
      .map(
        (entry, index) =>
          `${index === 0 ? 'M' : 'L'}${entry.x},${yAt(pick(entry.point)).toFixed(1)}`,
      )
      .join(' ');
  const area = plotted.length
    ? `${line((point) => point.inbound)} L${plotted[plotted.length - 1]!.x},${baseline} L${plotted[0]!.x},${baseline} Z`
    : '';
  const labelEvery = Math.max(1, Math.ceil(points.length / maxLabels));

  return {
    width,
    height,
    left: padding.left,
    right: width - padding.right,
    top: padding.top,
    bottom: baseline,
    inbound: line((point) => point.inbound),
    outbound: line((point) => point.outbound),
    area,
    max,
    gridlines: [1, 0.75, 0.5, 0.25, 0].map((fraction) => ({
      y: yAt(max * fraction),
      label: String(Math.round(max * fraction)),
    })),
    points: plotted,
    labels: points
      .filter((_, index) => index % labelEvery === 0 || index === points.length - 1)
      .map((point) => point.label),
  };
}
