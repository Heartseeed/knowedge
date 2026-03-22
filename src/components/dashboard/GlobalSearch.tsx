import React, { useState } from 'react'

interface GlobalSearchProps {
  onSearch?: (query: string) => void
  onClose?: () => void
  variant?: 'banner' | 'inline'
}

const GlobalSearch: React.FC<GlobalSearchProps> = ({ 
  onSearch, 
  onClose, 
  variant = 'banner' 
}) => {
  const [query, setQuery] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch?.(query)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose?.()
    }
  }

  if (variant === 'inline') {
    return (
      <div className="ke-search-inline">
        <form onSubmit={handleSubmit} className="ke-search-inline__form">
          <input
            type="text"
            className="ke-search-inline__input"
            placeholder="搜索笔记 / 标签 / 内容 / 双链..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button type="submit" className="ke-search-inline__btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="ke-search-banner">
      <form className="ke-search-form" onSubmit={handleSubmit}>
        <div className="ke-search-wrap">
          <div className="ke-search-input-row">
            <svg className="ke-search-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              className="ke-search-input"
              placeholder="搜索笔记 / 标签 / 内容 / 双链..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            {query && (
              <button
                type="button"
                className="ke-search-clear"
                onClick={() => setQuery('')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
          <button type="submit" className="ke-search-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            <span>搜索</span>
          </button>
        </div>
        <div className="ke-search-hints">
          <span className="ke-search-hint-item">
            <kbd>Enter</kbd> 搜索
          </span>
          <span className="ke-search-hint-item">
            <kbd>Esc</kbd> 关闭
          </span>
          <span className="ke-search-hint-item ke-search-hint--tip">
            支持 [[双链]] 搜索
          </span>
        </div>
      </form>
    </div>
  )
}

export default GlobalSearch
