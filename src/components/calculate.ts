export type ChartLimits = {
  cl: number;
  ucl: number;
  lcl: number;
};

export function calculateGChartLimits(values: number[]): ChartLimits {
  const cl = values.reduce((sum, v) => sum + v, 0) / values.length;
  const ucl = cl + 3 * Math.sqrt(cl);
  const lcl = Math.max(0, cl - 3 * Math.sqrt(cl));
  return { cl, ucl, lcl };
}

export function calculateTChartLimits(values: number[]): ChartLimits {
  if (values.length === 0) return { cl: 0, ucl: 0, lcl: 0 };
  const cl = values.reduce((sum, val) => sum + val, 0) / values.length;
  const range = Math.max(...values) - Math.min(...values);
  const ucl = cl + 0.5 * range;
  const lcl = Math.max(0, cl - 0.5 * range);
  return { cl, ucl, lcl };
}

export function calculateIChartLimits(values: number[]): ChartLimits {
  if (values.length < 2) return { cl: 0, ucl: 0, lcl: 0 };
  const cl = values.reduce((sum, val) => sum + val, 0) / values.length;
  const ranges = values.slice(1).map((val, i) => Math.abs(val - values[i]));
  const mrBar = ranges.reduce((sum, r) => sum + r, 0) / ranges.length;
  const d2 = 1.128;
  const sigma = mrBar / d2;
  const ucl = cl + 3 * sigma;
  const lcl = Math.max(0, cl - 3 * sigma);
  return { cl, ucl, lcl };
}
