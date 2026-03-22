import React, { useState } from 'react'

interface FloatingCaptureProps {
  onCapture?: (content: string) => void
}

const FloatingCapture: React.FC<FloatingCaptureProps> = ({ onCapture }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [content, setContent] = useState('')

  const handleSubmit = () => {
    if (content.trim()) {
      onCapture?.(content.trim())
      setContent('')
      setIsOpen(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit()
    }
    if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <>
      {/* Floating Button - refined style */}
      <button
        className="ke-fab"
        onClick={() => setIsOpen(!isOpen)}
        title="快速捕获 (Ctrl+Shift+K)"
        aria-label="快速捕获"
      >
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        )}
      </button>

      {/* Capture Modal */}
      {isOpen && (
        <>
          <div className="ke-modal-overlay" onClick={() => setIsOpen(false)} />
          <div className="ke-modal ke-modal--capture">
            <div className="ke-modal__header">
              <div className="ke-modal__title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                快速捕获
              </div>
              <button className="ke-modal__close" onClick={() => setIsOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="ke-modal__body">
              <textarea
                className="ke-capture-textarea"
                placeholder="记录想法、笔记、链接...&#10;&#10;支持 Markdown 语法&#10;输入 [[ 快速建立双链"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
              <div className="ke-capture-hints">
                <span>
                  <kbd>Ctrl</kbd>+<kbd>Enter</kbd> 提交
                </span>
                <span>
                  <kbd>Esc</kbd> 关闭
                </span>
              </div>
            </div>
            <div className="ke-modal__footer">
              <button className="ke-btn ke-btn--ghost" onClick={() => setIsOpen(false)}>
                取消
              </button>
              <button
                className="ke-btn ke-btn--primary"
                onClick={handleSubmit}
                disabled={!content.trim()}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                存入草稿箱
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default FloatingCapture
