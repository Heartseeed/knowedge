import React from 'react'

interface QuickAccessProps {
  onNewNote?: () => void
  onInbox?: () => void
  onGraph?: () => void
  onTimeline?: () => void
}

// SVG Icons for quick access items
const PlusIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 5v14M5 12h14"/>
  </svg>
)

const InboxIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
  </svg>
)

const GraphIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
)

const TimelineIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)

const QuickAccess: React.FC<QuickAccessProps> = ({
  onNewNote,
  onInbox,
  onGraph,
  onTimeline,
}) => {
  const items = [
    { icon: <PlusIcon />, label: '新建笔记', action: onNewNote, color: '#6366f1' },
    { icon: <InboxIcon />, label: '草稿箱', action: onInbox, color: '#f59e0b', badge: 3 },
    { icon: <GraphIcon />, label: '知识网络', action: onGraph, color: '#8b5cf6' },
    { icon: <TimelineIcon />, label: '时间轴', action: onTimeline, color: '#06b6d4' },
  ]

  return (
    <div className="ke-quick-access">
      <div className="ke-quick-access__header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
        <span>快速入口</span>
      </div>
      <div className="ke-quick-access__grid">
        {items.map((item) => (
          <button
            key={item.label}
            className="ke-quick-item"
            onClick={item.action}
            style={{ '--item-color': item.color } as React.CSSProperties}
          >
            <div className="ke-quick-item__icon" style={{ color: item.color }}>
              {item.icon}
            </div>
            <span className="ke-quick-item__label">{item.label}</span>
            {item.badge !== undefined && (
              <span className="ke-quick-item__badge">{item.badge}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

export default QuickAccess
