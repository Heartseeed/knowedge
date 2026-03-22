import React, { useMemo } from 'react'
import { Calendar, Clock, ArrowLeft } from 'lucide-react'
import type { Note } from '../db/indexeddb'

interface TimelinePageProps {
  notes: Note[]
  onBack: () => void
  onNoteClick: (noteId: string) => void
}

const NOTE_TYPE_ICONS: Record<string, string> = {
  concept: '🧠',
  reading: '📖',
  practice: '🧪',
  idea: '💡',
  card: '📌',
  note: '📝',
  tutorial: '📚',
  project: '📋',
  other: '📄',
}

const NOTE_TYPE_LABELS: Record<string, string> = {
  concept: '概念',
  reading: '读书',
  practice: '实践',
  idea: '想法',
  card: '卡片',
  note: '笔记',
  tutorial: '教程',
  project: '项目',
  other: '其他',
}

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) return `${diffDays} 天前`

  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const TimelinePage: React.FC<TimelinePageProps> = ({
  notes,
  onBack,
  onNoteClick,
}) => {
  // Group notes by date
  const groupedNotes = useMemo(() => {
    const sortedNotes = [...notes].sort((a, b) => b.updatedAt - a.updatedAt)
    
    const groups: Record<string, Note[]> = {}
    
    sortedNotes.forEach(note => {
      const date = new Date(note.updatedAt)
      const dateKey = date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      
      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(note)
    })
    
    return Object.entries(groups).map(([date, items]) => ({
      date,
      notes: items,
    }))
  }, [notes])

  return (
    <div className="ke-timeline-page">
      {/* Header */}
      <header className="ke-timeline-page__header">
        <button 
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 0',
            marginBottom: 16,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--ke-text-secondary)',
            fontSize: '0.9rem',
          }}
        >
          <ArrowLeft size={18} />
          返回
        </button>
        <h1 className="ke-timeline-page__title">
          <Calendar size={24} style={{ marginRight: 12 }} />
          笔记时间线
        </h1>
        <p className="ke-timeline-page__subtitle">
          按时间顺序查看所有笔记的创建和修改记录
        </p>
      </header>

      {/* Timeline */}
      <div className="ke-timeline-page__content">
        {groupedNotes.length > 0 ? (
          <div className="ke-timeline">
            {groupedNotes.map(({ date, notes }) => (
              <div key={date} className="ke-timeline__group">
                <div className="ke-timeline__date">{date}</div>
                <div className="ke-timeline__items">
                  {notes.map(note => (
                    <div
                      key={note.id}
                      className="ke-timeline__item"
                      onClick={() => onNoteClick(note.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="ke-timeline__item-icon">
                          {NOTE_TYPE_ICONS[note.type] || '📝'}
                        </span>
                        <span className="ke-timeline__item-title">{note.title}</span>
                        <span 
                          style={{
                            fontSize: '0.7rem',
                            padding: '2px 6px',
                            background: 'var(--ke-bg-subtle)',
                            borderRadius: 4,
                            color: 'var(--ke-text-muted)',
                          }}
                        >
                          {NOTE_TYPE_LABELS[note.type] || '笔记'}
                        </span>
                      </div>
                      <div className="ke-timeline__item-time">
                        <Clock size={12} style={{ marginRight: 4 }} />
                        {formatTime(note.updatedAt)}
                        {note.createdAt !== note.updatedAt && (
                          <span style={{ marginLeft: 12, opacity: 0.7 }}>
                            创建于 {formatTime(note.createdAt)}
                          </span>
                        )}
                      </div>
                      {note.tags && note.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                          {note.tags.slice(0, 3).map(tag => (
                            <span 
                              key={tag}
                              style={{
                                fontSize: '0.7rem',
                                padding: '2px 6px',
                                background: 'var(--ke-primary-light)',
                                color: 'var(--ke-primary)',
                                borderRadius: 4,
                              }}
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="ke-timeline__empty">
            <div className="ke-timeline__empty-icon">📝</div>
            <p className="ke-timeline__empty-text">
              还没有笔记<br />
              <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                创建你的第一条笔记，开启知识管理之旅
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default TimelinePage
