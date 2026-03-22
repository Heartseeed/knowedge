import React, { useState, useEffect, useMemo } from 'react'
import { calculateSM2, formatInterval, sortByPriority, type ReviewLevel } from '../spaced-repetition'
import type { Note } from '../db/indexeddb'

interface ReviewPageProps {
  notes: Note[]
  onBack: () => void
  onNoteClick: (noteId: string) => void
  onReviewComplete: (noteId: string, reviewData: {
    reviewCount: number
    nextReviewAt: number
    easeFactor: number
    interval: number
  }) => void
}

interface ReviewCard {
  note: Note
  priority: number
  isOverdue: boolean
  daysOverdue: number
  daysUntilDue: number
}

const ReviewPage: React.FC<ReviewPageProps> = ({
  notes,
  onBack,
  onNoteClick,
  onReviewComplete,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [sessionStats, setSessionStats] = useState({ easy: 0, medium: 0, hard: 0 })

  // Filter and sort review cards
  const reviewCards = useMemo<ReviewCard[]>(() => {
    const now = Date.now()
    const dueNotes = notes.filter(n => 
      n.nextReviewAt && n.nextReviewAt <= now + 24 * 60 * 60 * 1000
    )
    
    return sortByPriority(dueNotes).map(note => ({
      note,
      priority: 0, // Already sorted
      isOverdue: note.nextReviewAt! < now,
      daysOverdue: Math.floor((now - note.nextReviewAt!) / (24 * 60 * 60 * 1000)),
      daysUntilDue: Math.floor((note.nextReviewAt! - now) / (24 * 60 * 60 * 1000)),
    }))
  }, [notes])

  // Reset state when cards change
  useEffect(() => {
    if (reviewCards.length === 0) {
      setIsComplete(true)
    } else {
      setCurrentIndex(0)
      setShowAnswer(false)
      setIsComplete(false)
    }
  }, [reviewCards.length])

  const currentCard = reviewCards[currentIndex]

  // Handle review response
  const handleReview = (level: ReviewLevel) => {
    if (!currentCard) return

    const note = currentCard.note
    const gradeValue = level === 'easy' ? 5 : level === 'medium' ? 3 : 1

    const result = calculateSM2(
      note.easeFactor || 2.5,
      note.interval || 1,
      note.reviewCount || 0,
      gradeValue as 0 | 1 | 2 | 3 | 4 | 5
    )

    // Update session stats
    setSessionStats(prev => ({
      ...prev,
      [level]: prev[level] + 1,
    }))

    // Notify parent
    onReviewComplete(note.id, {
      reviewCount: result.repetitions,
      nextReviewAt: result.nextReviewAt,
      easeFactor: result.easeFactor,
      interval: result.interval,
    })

    // Move to next card
    if (currentIndex < reviewCards.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setShowAnswer(false)
    } else {
      setIsComplete(true)
    }
  }

  // Skip current card
  const handleSkip = () => {
    if (currentIndex < reviewCards.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setShowAnswer(false)
    } else {
      setIsComplete(true)
    }
  }

  // Get type icon
  const getTypeIcon = (type?: string) => {
    const icons: Record<string, string> = {
      concept: '🧠',
      reading: '📖',
      practice: '🧪',
      idea: '💡',
      card: '📌',
      note: '📝',
    }
    return icons[type || ''] || '📝'
  }

  // Get content without HTML
  const getPlainContent = (content: string) => {
    return content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  }

  return (
    <div className="ke-review-page">
      {/* Header */}
      <header className="ke-review-page__header">
        <button className="ke-review-page__back" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          <span>返回</span>
        </button>
        
        <div className="ke-review-page__title">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <span>知识回顾</span>
        </div>

        {!isComplete && (
          <div className="ke-review-page__progress">
            <span>{currentIndex + 1} / {reviewCards.length}</span>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="ke-review-page__content">
        {isComplete ? (
          // Completion screen
          <div className="ke-review-complete">
            <div className="ke-review-complete__icon">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <h2 className="ke-review-complete__title">今日复习完成！</h2>
            <p className="ke-review-complete__subtitle">
              继续保持，知识会越来越扎实
            </p>
            
            <div className="ke-review-complete__stats">
              <div className="ke-review-complete__stat ke-review-complete__stat--easy">
                <span className="ke-review-complete__stat-num">{sessionStats.easy}</span>
                <span className="ke-review-complete__stat-label">简单</span>
              </div>
              <div className="ke-review-complete__stat ke-review-complete__stat--medium">
                <span className="ke-review-complete__stat-num">{sessionStats.medium}</span>
                <span className="ke-review-complete__stat-label">一般</span>
              </div>
              <div className="ke-review-complete__stat ke-review-complete__stat--hard">
                <span className="ke-review-complete__stat-num">{sessionStats.hard}</span>
                <span className="ke-review-complete__stat-label">困难</span>
              </div>
            </div>

            <button className="ke-btn ke-btn--primary" onClick={onBack}>
              返回首页
            </button>
          </div>
        ) : currentCard ? (
          // Review card
          <div className="ke-review-card" key={currentCard.note.id}>
            {/* Card header */}
            <div className="ke-review-card__header">
              <div className="ke-review-card__meta">
                <span className="ke-review-card__type">
                  {getTypeIcon(currentCard.note.type)} {currentCard.note.type === 'concept' ? '概念' : 
                    currentCard.note.type === 'reading' ? '读书' :
                    currentCard.note.type === 'practice' ? '实践' :
                    currentCard.note.type === 'idea' ? '想法' : '卡片'}
                </span>
                <span className="ke-review-card__status">
                  {currentCard.isOverdue ? (
                    <span className="ke-review-card__overdue">
                      逾期 {currentCard.daysOverdue} 天
                    </span>
                  ) : (
                    <span className="ke-review-card__due">
                      今日待复习
                    </span>
                  )}
                </span>
              </div>
              
              <h2 className="ke-review-card__title">{currentCard.note.title}</h2>
              
              {currentCard.note.tags && currentCard.note.tags.length > 0 && (
                <div className="ke-review-card__tags">
                  {currentCard.note.tags.map(tag => (
                    <span key={tag} className="ke-review-card__tag">#{tag}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Card content */}
            <div className="ke-review-card__content">
              {!showAnswer ? (
                <div className="ke-review-card__question">
                  <div className="ke-review-card__prompt">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    <span>回忆一下，这篇笔记讲了什么？</span>
                  </div>
                  
                  <button 
                    className="ke-btn ke-btn--primary ke-btn--lg"
                    onClick={() => setShowAnswer(true)}
                  >
                    显示答案
                  </button>
                </div>
              ) : (
                <div className="ke-review-card__answer">
                  <div className="ke-review-card__answer-content">
                    <div className="ke-review-card__label">答案</div>
                    <div className="ke-review-card__text">
                      {getPlainContent(currentCard.note.content)}
                    </div>
                  </div>

                  {/* Review buttons */}
                  <div className="ke-review-card__actions">
                    <div className="ke-review-card__actions-label">这次回顾感觉如何？</div>
                    <div className="ke-review-card__btns">
                      <button 
                        className="ke-review-btn ke-review-btn--hard"
                        onClick={() => handleReview('hard')}
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="15" y1="9" x2="9" y2="15"/>
                          <line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                        <span className="ke-review-btn__label">困难</span>
                        <span className="ke-review-btn__hint">明天再复习</span>
                      </button>
                      
                      <button 
                        className="ke-review-btn ke-review-btn--medium"
                        onClick={() => handleReview('medium')}
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="8" y1="12" x2="16" y2="12"/>
                        </svg>
                        <span className="ke-review-btn__label">一般</span>
                        <span className="ke-review-btn__hint">
                          {formatInterval(Math.round((currentCard.note.interval || 1) * 1.5))}后再复习
                        </span>
                      </button>
                      
                      <button 
                        className="ke-review-btn ke-review-btn--easy"
                        onClick={() => handleReview('easy')}
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                          <polyline points="9 12 12 15 16 10"/>
                        </svg>
                        <span className="ke-review-btn__label">简单</span>
                        <span className="ke-review-btn__hint">
                          {formatInterval(Math.round((currentCard.note.interval || 1) * (currentCard.note.easeFactor || 2.5) * 2))}后再复习
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Card footer */}
            <div className="ke-review-card__footer">
              <button 
                className="ke-review-card__skip"
                onClick={handleSkip}
              >
                跳过
              </button>
              <button 
                className="ke-review-card__detail"
                onClick={() => onNoteClick(currentCard.note.id)}
              >
                查看详情
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </button>
            </div>

            {/* Progress bar */}
            <div className="ke-review-card__progress">
              <div 
                className="ke-review-card__progress-bar"
                style={{ width: `${((currentIndex + 1) / reviewCards.length) * 100}%` }}
              />
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}

export default ReviewPage
