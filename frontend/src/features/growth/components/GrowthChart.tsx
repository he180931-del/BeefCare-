import type { GrowthChartPoint } from '../types'
import { dayFloat, fmtDayMonth, fmtKg } from '../domain/growthFormat'

const BRAND = '#08734e'
const niceStep = (range: number) => [5, 10, 15, 20, 25, 50, 100, 200].find((s) => range / s <= 4) ?? 200

/** Biểu đồ cân nặng bằng SVG thuần: chấm đặc là cân thực tế, chấm rỗng là ước tính. */
export default function GrowthChart({ points, height = 190 }: { points: GrowthChartPoint[]; height?: number }) {
  if (!points.length) {
    return <div className="flex items-center justify-center rounded border border-dashed border-edge text-xs text-muted" style={{ height }}>Chưa có lần cân hợp lệ để vẽ biểu đồ.</div>
  }
  const W = 640
  const padL = 56
  const padR = 28
  const padT = 24
  const padB = 28
  const kgs = points.map((p) => p.kg)
  const min = Math.min(...kgs)
  const max = Math.max(...kgs)
  const step = niceStep(Math.max(max - min, 10))
  const lo = Math.floor((min - step * 0.3) / step) * step
  const hi = Math.max(Math.ceil((max + step * 0.3) / step) * step, lo + step)
  const ticks: number[] = []
  for (let v = lo; v <= hi; v += step) ticks.push(v)
  const t0 = dayFloat(points[0].at)
  const t1 = dayFloat(points[points.length - 1].at)
  const inner = W - padL - padR - 40
  const x = (at: string) => padL + 20 + (t1 === t0 ? inner / 2 : ((dayFloat(at) - t0) / (t1 - t0)) * inner)
  const y = (kg: number) => padT + (1 - (kg - lo) / (hi - lo)) * (height - padT - padB)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.at).toFixed(1)} ${y(p.kg).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label="Biểu đồ cân nặng theo thời gian" className="block h-auto w-full">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#dedede" />
          <text x={padL - 8} y={y(v) + 3} textAnchor="end" fontSize="10" fill="#666666">{`${v} kg`}</text>
        </g>
      ))}
      {points.length > 1 && <path d={path} fill="none" stroke={BRAND} strokeWidth="2" />}
      {points.map((p) => (
        <g key={p.at}>
          <circle cx={x(p.at)} cy={y(p.kg)} r="5" fill={p.basis === 'MEASURED' ? BRAND : '#ffffff'} stroke={BRAND} strokeWidth="2" />
          <text x={x(p.at)} y={y(p.kg) - 10} textAnchor="middle" fontSize="10" fontWeight="500" fill="#212121">{`${fmtKg(p.kg)} kg`}</text>
          <text x={x(p.at)} y={height - 8} textAnchor="middle" fontSize="10" fill="#666666">{fmtDayMonth(p.at)}</text>
        </g>
      ))}
    </svg>
  )
}

export function ChartLegend() {
  return (
    <div className="flex items-center gap-3 text-[11px] text-muted">
      <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full border border-brand bg-brand" />Cân thực tế</span>
      <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full border border-brand bg-white" />Ước tính</span>
    </div>
  )
}
