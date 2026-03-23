import React from 'react'

interface ReviewItem {
  id: string
  title: string
  dueCount?: number
}

interface SmartReviewProps {
  todayCount: number
  overdueCount: number
  newUnreviewedCount: number
  todayList: ReviewItem[]
  overdueList: ReviewItem[]
  onStartReview?: () => void
  onItemClick?: (id: string) => void
}

const RefreshIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
)

const AlertIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
)

const ChevronRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)

const SmartReview: React.FC<SmartReviewProps> = ({
  todayCount = 0,
  overdueCount = 0,
  newUnreviewedCount = 0,
  todayList = [],
  overdueList = [],
  onStartReview = () => {},
  onItemClick = () => {},
}) => {
  const totalToReview = todayCount + overdueCount + newUnreviewedCount

  return (
    <div className="ke-widget">
      <div className="ke-widget__header">
        <RefreshIcon />
        <h3 className="ke-widget__title">智能回顾</h3>
      </div>
      <div className="ke-widget__body">
        <div className="ke-review-stats">
          <div className="ke-review-stat">
            <span className="ke-review-stat__num">{todayCount}</span>
            <span className="ke-review-stat__label">今日必看</span>
          </div>
          <div className="ke-review-stat ke-review-stat--warn">
            <span className="ke-review-stat__num">{overdueCount}</span>
            <span className="ke-review-stat__label">逾期</span>
          </div>
          <div className="ke-review-stat ke-review-stat--new">
            <span className="ke-review-stat__num">{newUnreviewedCount}</span>
            <span className="ke-review-stat__label">新增未消化</span>
          </div>
        </div>

        {overdueList.length > 0 && (
          <div className="ke-review-section">
            <div className="ke-review-section__title">逾期笔记</div>
            <ul className="ke-rec-list">
              {overdueList.slice(0, 2).map((item) => (
                <li
                  key={item.id}
                  className="ke-rec-item ke-rec-item--overdue"
                  onClick={() => onItemClick?.(item.id)}
                >
                  <span className="ke-rec-item__arrow">
                    <AlertIcon />
                  </span>
                  <span className="ke-rec-item__title">{item.title}</span>
                  <ChevronRightIcon />
                </li>
              ))}
            </ul>
          </div>
        )}

        {todayList.length > 0 && (
          <div className="ke-review-section">
            <div className="ke-review-section__title">今日推荐</div>
            <ul className="ke-rec-list">
              {todayList.slice(0, 3).map((item) => (
                <li
                  key={item.id}
                  className="ke-rec-item"
                  onClick={() => onItemClick?.(item.id)}
                >
                  <span className="ke-rec-item__title">{item.title}</span>
                  {item.dueCount !== undefined && (
                    <span className="ke-rec-item__badge">{item.dueCount}</span>
                  )}
                  <ChevronRightIcon />
                </li>
              ))}
            </ul>
          </div>
        )}

        {totalToReview === 0 && (
          <div className="ke-widget__empty">今日复习已完成，继续积累知识吧！</div>
        )}
      </div>

      {totalToReview > 0 && (
        <button className="ke-btn ke-btn--primary ke-btn--full" onClick={onStartReview}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          开始回顾
        </button>
      )}
    </div>
  )
}

export default SmartReview
