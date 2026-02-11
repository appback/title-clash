import React from 'react'

/**
 * CSS-only horizontal bar chart.
 * @param {object} props
 * @param {{ label: string, value: number, rank?: number }[]} props.data
 * @param {number} [props.maxValue] - Override max. Default: max of data values.
 */
export default function BarChart({ data, maxValue }) {
  const max = maxValue || Math.max(...data.map(d => d.value), 1)

  return (
    <div className="bar-chart" role="img" aria-label="Vote distribution chart">
      {data.map((item, i) => {
        const pct = Math.round((item.value / max) * 100)
        const rankClass = item.rank && item.rank <= 3 ? ' rank-' + item.rank : ''
        return (
          <div className="bar-chart-row" key={i}>
            <div className="bar-chart-label" title={item.label}>{item.label}</div>
            <div className="bar-chart-track">
              <div
                className={'bar-chart-fill' + rankClass}
                style={{ width: Math.max(pct, 2) + '%' }}
              >
                {pct >= 15 && (
                  <span className="bar-chart-value">{item.value}</span>
                )}
              </div>
            </div>
            {pct < 15 && (
              <span className="bar-chart-value-outside">{item.value}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
