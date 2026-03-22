import React from 'react'

interface NoteItem {
  id: string
  title: string
  updatedAt: number
}

interface RecentNotesProps {
  notes: NoteItem[]
  onNoteClick?: (id: string) => void
  onViewAll?: () => void
}

const ClockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
)

const FileTextIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
)

const RecentNotes: React.FC<RecentNotesProps> = ({ notes, onNoteClick, onViewAll }) => {
  const formatTime = (ts: number) => {
    const diff = Date.now() - ts
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes} 分钟前`
    if (hours < 24) return `${hours} 小时前`
    if (days === 1) return '昨天'
    return `${days} 天前`
  }

  const displayNotes = notes.slice(0, 5)

  return (
    <div className="ke-widget">
      <div className="ke-widget__header">
        <ClockIcon />
        <h3 className="ke-widget__title">最近编辑</h3>
      </div>
      <div className="ke-widget__body">
        {displayNotes.length === 0 ? (
          <div className="ke-widget__empty">暂无笔记</div>
        ) : (
          <ul className="ke-note-list">
            {displayNotes.map((note) => (
              <li
                key={note.id}
                className="ke-note-item"
                onClick={() => onNoteClick?.(note.id)}
              >
                <div className="ke-note-item__left">
                  <FileTextIcon />
                  <span className="ke-note-item__title">{note.title || '无标题'}</span>
                </div>
                <span className="ke-note-item__time">{formatTime(note.updatedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {notes.length > 5 && (
        <button className="ke-widget__footer-link" onClick={onViewAll}>
          查看全部
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      )}
    </div>
  )
}

export default RecentNotes
