import { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { formatMoney } from '../format.js'

/**
 * Interactive Donut Chart for category expenses.
 * Includes a pure SVG fallback when running in headless / test environments without container layout.
 */
export default function CategoryPieChart({ data }) {
  const [activeIndex, setActiveIndex] = useState(null)

  const chartData = useMemo(() => {
    return data
      .filter((d) => d.value > 0)
      .map((d) => ({
        name: d.name,
        emoji: d.emoji,
        value: d.value,
        color: d.color,
        percentage: d.percentage,
      }))
  }, [data])

  if (!chartData.length) {
    return (
      <div className="chart-empty">
        <p className="muted">No expense data to display in chart</p>
      </div>
    )
  }

  return (
    <div className="pie-chart-wrapper" style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            dataKey="value"
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || '#999999'}
                stroke={activeIndex === index ? '#1f2430' : 'transparent'}
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

function CustomTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const item = payload[0].payload
    return (
      <div className="chart-tooltip">
        <div className="tooltip-title">
          <span>{item.emoji}</span> <strong>{item.name}</strong>
        </div>
        <div className="tooltip-value">{formatMoney(item.value)}</div>
        <div className="tooltip-pct muted small">{item.percentage}% of expenses</div>
      </div>
    )
  }
  return null
}
