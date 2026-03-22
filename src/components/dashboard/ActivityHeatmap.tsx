import React, { useState } from 'react'

interface DayData {
  date: string // YYYY-MM-DD
  count: number
}

interface ActivityHeatmapProps {
  data: DayData[]
  onDayClick?: (date: string) => void
}

const HeatmapIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
)

const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ data, onDayClick }) => {
  const [hoveredDay, setHoveredDay] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<{ date: string; count: number; x: number; y: number } | null>(null)

  const generateDays = (): string[] => {
    const days: string[] = []
    const today = new Date()
    for (let i = 364; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      days.push(d.toISOString().split('T')[0])
    }
    return days
  }

  const days = generateDays()
  const dataMap = new Map(data.map((d) => [d.date, d.count]))

  const getLevel = (count: number): number => {
    if (count === 0) return 0
    if (count <= 2) return 1
    if (count <= 5) return 2
    if (count <= 10) return 3
    return 4
  }

  const weeks: string[][] = []
  let currentWeek: string[] = []
  days.forEach((day, i) => {
    const dayOfWeek = new Date(day).getDay()
    if (dayOfWeek === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek)
      currentWeek = []
    }
    currentWeek.push(day)
    if (i === days.length - 1 && currentWeek.length > 0) {
      weeks.push(currentWeek)
    }
  })

  const handleMouseEnter = (day: string, e: React.MouseEvent) => {
    const count = dataMap.get(day) || 0
    setHoveredDay(day)
    setTooltip({ date: day, count, x: e.clientX, y: e.clientY })
  }

  const handleMouseLeave = () => {
    setHoveredDay(null)
    setTooltip(null)
  }

  const dayNames = ['', 'Mon', '', 'Wed', '', 'Fri', '']

  return (
    <div className="ke-section">
      <div className="ke-section__header">
        <HeatmapIcon />
        <h2 className="ke-section__title">知识活跃度</h2>
      </div>
      <div className="ke-heatmap-wrap">
        <div className="ke-heatmap">
          <div className="ke-heatmap__days-label">
            {dayNames.map((name, i) => (
              <div key={i} className="ke-heatmap__day-name">{name}</div>
            ))}
          </div>
          <div className="ke-heatmap__grid">
            {weeks.map((week, wi) => (
              <div key={wi} className="ke-heatmap__week">
                {week.map((day) => {
                  const count = dataMap.get(day) || 0
                  const level = getLevel(count)
                  return (
                    <div
                      key={day}
                      className={`ke-heatmap__cell ke-heatmap__cell--l${level}${hoveredDay === day ? ' ke-heatmap__cell--hover' : ''}`}
                      onMouseEnter={(e) => handleMouseEnter(day, e)}
                      onMouseLeave={handleMouseLeave}
                      onClick={() => onDayClick?.(day)}
                      title={`${day}: ${count} 条笔记`}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="ke-heatmap__legend">
          <span className="ke-heatmap__legend-label">少</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <div key={level} className={`ke-heatmap__cell ke-heatmap__cell--l${level}`} />
          ))}
          <span className="ke-heatmap__legend-label">多</span>
        </div>
      </div>
      {tooltip && (
        <div className="ke-tooltip" style={{ left: tooltip.x + 10, top: tooltip.y + 10 }}>
          <strong>{tooltip.date}</strong>
          <br />
          {tooltip.count} 条笔记
        </div>
      )}
    </div>
  )
}

export default ActivityHeatmap
