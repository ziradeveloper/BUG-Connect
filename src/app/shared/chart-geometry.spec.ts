import { buildLineChart, type ChartSeriesPoint } from './chart-geometry';

/**
 * The shared SVG geometry behind the wave-6 line charts.
 *
 * Extracted so the client reports page and the platform analytics page cannot
 * drift apart. The invariants that matter for both templates: the axis maximum
 * is a whole number of messages, the paths are drawable when a window is flat or
 * empty, and the dots line up with the series they are drawn from.
 */
describe('chart geometry', () => {
  const day = 86_400_000;
  const start = Date.UTC(2026, 9, 2);

  const point = (index: number, inbound: number, outbound: number): ChartSeriesPoint => ({
    date: new Date(start + index * day).toISOString(),
    label: `${2 + index} Oct`,
    inbound,
    outbound,
    total: inbound + outbound,
  });

  it('maps a series into the plot box', () => {
    const chart = buildLineChart([point(0, 4, 2), point(1, 8, 4), point(2, 6, 3)]);

    expect(chart.width).toBe(600);
    expect(chart.height).toBe(220);
    expect(chart.points).toHaveLength(3);
    expect(chart.points[0]!.x).toBe(chart.left);
    expect(chart.points[2]!.x).toBe(chart.right);
    // 12 is the busiest day, so the axis rounds up to 15.
    expect(chart.max).toBe(15);
    expect(chart.inbound.startsWith('M')).toBe(true);
    expect(chart.outbound.startsWith('M')).toBe(true);
    expect(chart.area.endsWith('Z')).toBe(true);
    expect(chart.gridlines.map((line) => line.label)).toEqual(['15', '11', '8', '4', '0']);
    // The busiest day sits highest on the canvas (smallest y).
    const highest = Math.min(...chart.points.map((entry) => entry.y));

    expect(chart.points[1]!.y).toBe(highest);
    expect(chart.labels).toEqual(['2 Oct', '3 Oct', '4 Oct']);
  });

  it('never divides by zero on a flat or empty window', () => {
    const flat = buildLineChart([point(0, 0, 0), point(1, 0, 0)]);

    expect(flat.max).toBe(5);
    expect(flat.points.every((entry) => entry.y === flat.bottom)).toBe(true);
    expect(flat.gridlines[0]!.label).toBe('5');

    const empty = buildLineChart([]);

    expect(empty.points).toEqual([]);
    expect(empty.area).toBe('');
    expect(empty.inbound).toBe('');
    expect(empty.outbound).toBe('');
    expect(empty.labels).toEqual([]);
    expect(empty.max).toBe(5);
  });

  it('thins the day labels out on a long window', () => {
    const ninety = Array.from({ length: 90 }, (_, index) => point(index, index % 5, index % 3));
    const chart = buildLineChart(ninety);

    expect(chart.points).toHaveLength(90);
    expect(chart.labels.length).toBeLessThanOrEqual(8);
    // The first and the last day are always labelled.
    expect(chart.labels[0]).toBe(ninety[0]!.label);
    expect(chart.labels[chart.labels.length - 1]).toBe(ninety[89]!.label);
  });

  it('honours a different canvas', () => {
    const chart = buildLineChart([point(0, 2, 1), point(1, 3, 2)], {
      width: 400,
      height: 160,
      padding: { top: 10, right: 10, bottom: 20, left: 30 },
      maxLabels: 2,
    });

    expect(chart.width).toBe(400);
    expect(chart.height).toBe(160);
    expect(chart.left).toBe(30);
    expect(chart.right).toBe(390);
    expect(chart.bottom).toBe(140);
    expect(chart.points[1]!.x).toBe(390);
    expect(chart.labels).toHaveLength(2);
  });

  it('rounds coordinates to a tenth so the markup stays readable', () => {
    const chart = buildLineChart([point(0, 1, 1), point(1, 2, 1), point(2, 3, 2)]);

    for (const entry of chart.points) {
      expect(Number.isInteger(entry.x * 10)).toBe(true);
      expect(Number.isInteger(entry.y * 10)).toBe(true);
    }
  });
});
