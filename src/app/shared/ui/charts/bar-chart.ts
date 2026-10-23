import { Component, computed, input } from '@angular/core';

export interface BarPoint {
  label: string;
  value: number;
}

const WIDTH = 600;
const HEIGHT = 160;
const PAD_LEFT = 8;
const PAD_BOTTOM = 22;
const PAD_TOP = 8;

/**
 * A small bar chart in plain SVG (no charting library): one bar per point, the value in a tooltip, the first, middle and last
 * labels under the axis. `format` turns a value into text for the tooltip and the top label.
 */
@Component({
  selector: 'app-bar-chart',
  templateUrl: './bar-chart.html',
  styleUrl: './bar-chart.scss',
})
export class BarChart {
  readonly points = input.required<readonly BarPoint[]>();
  readonly format = input<(value: number) => string>((value) => String(value));
  readonly ariaLabel = input.required<string>();

  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;
  protected readonly baseline = HEIGHT - PAD_BOTTOM;

  protected readonly max = computed(() => Math.max(0, ...this.points().map((p) => p.value)));

  protected readonly bars = computed(() => {
    const points = this.points();
    const max = this.max();
    if (points.length === 0) return [];
    const slot = (WIDTH - PAD_LEFT) / points.length;
    const usable = HEIGHT - PAD_BOTTOM - PAD_TOP;
    return points.map((point, index) => {
      const height = max > 0 ? (point.value / max) * usable : 0;
      return {
        x: PAD_LEFT + index * slot + slot * 0.15,
        width: slot * 0.7,
        height: point.value > 0 ? Math.max(height, 2) : 0,
        y: HEIGHT - PAD_BOTTOM - (point.value > 0 ? Math.max(height, 2) : 0),
        tooltip: `${point.label}: ${this.format()(point.value)}`,
        labelX: PAD_LEFT + index * slot + slot / 2,
        label: point.label,
        showLabel:
          index === 0 || index === points.length - 1 || index === Math.floor(points.length / 2),
      };
    });
  });
}
