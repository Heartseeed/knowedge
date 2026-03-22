import React from 'react'

interface CtaBannerProps {
  onNavigate?: () => void
  noteCount?: number
}

const CtaBanner: React.FC<CtaBannerProps> = ({ onNavigate, noteCount = 0 }) => {
  return (
    <div className="ke-cta-banner">
      <div className="ke-cta-banner__content">
        <svg className="ke-cta-banner__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
        <div>
          <h3 className="ke-cta-banner__title">探索你的完整知识库</h3>
          <p className="ke-cta-banner__desc">
            访问全部 {noteCount} 条笔记，深入整理、关联与回顾你的知识网络
          </p>
        </div>
      </div>
      <button className="ke-cta-banner__btn" onClick={onNavigate}>
        <span>进入</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </button>
    </div>
  )
}

export default CtaBanner
