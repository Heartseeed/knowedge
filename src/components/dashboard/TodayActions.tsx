import React from 'react'

interface TodayActionsProps {
  reviewCount?: number
  draftCount?: number
  onReviewClick?: () => void
  onDraftClick?: () => void
  onNewNote?: () => void
}

// SVG Icons for each action type
const ReviewIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)

const EditIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)

const IdeaIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3m3.343-5.657-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
  </svg>
)

const TodayActions: React.FC<TodayActionsProps> = ({
  reviewCount = 0,
  draftCount = 0,
  onReviewClick = () => {},
  onDraftClick = () => {},
  onNewNote = () => {},
}) => {
  return (
    <div className="ke-today-actions">
      <div className="ke-today-actions__header">
        <div className="ke-today-actions__title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span>今日行动</span>
        </div>
        <span className="ke-today-actions__date">
          {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
        </span>
      </div>
      
      <div className="ke-today-actions__grid">
        {/* Review card */}
        <div className="ke-action-card" onClick={onReviewClick}>
          <div className="ke-action-card__icon ke-action-card__icon--review">
            <ReviewIcon />
          </div>
          <div className="ke-action-card__body">
            <div className="ke-action-card__title">回顾旧笔记</div>
            <div className="ke-action-card__meta">
              <span className="ke-action-card__count">{reviewCount + 3} 条待回顾</span>
              <span className="ke-action-card__badge">{reviewCount} 条逾期</span>
            </div>
          </div>
          <div className="ke-action-card__arrow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        </div>

        {/* Draft card */}
        <div className="ke-action-card" onClick={onDraftClick}>
          <div className="ke-action-card__icon ke-action-card__icon--draft">
            <EditIcon />
          </div>
          <div className="ke-action-card__body">
            <div className="ke-action-card__title">完善草稿</div>
            <div className="ke-action-card__meta">
              <span className="ke-action-card__count">{draftCount} 条未完成</span>
              <span className="ke-action-card__badge ke-action-card__badge--draft">待续写</span>
            </div>
          </div>
          <div className="ke-action-card__arrow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        </div>

        {/* New idea card */}
        <div className="ke-action-card" onClick={onNewNote}>
          <div className="ke-action-card__icon ke-action-card__icon--idea">
            <IdeaIcon />
          </div>
          <div className="ke-action-card__body">
            <div className="ke-action-card__title">记录新想法</div>
            <div className="ke-action-card__meta">
              <span className="ke-action-card__count">随时捕捉灵感</span>
            </div>
          </div>
          <div className="ke-action-card__cta">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TodayActions
