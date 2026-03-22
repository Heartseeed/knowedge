import React from 'react'
import { Lightbulb, Link2, SplitSquareVertical, Plus, MessageSquare } from 'lucide-react'
import type { WritingHint } from '../writing-hints'

interface WritingHintPanelProps {
  hints: WritingHint[]
  onHintClick?: (hint: WritingHint) => void
}

const TYPE_CONFIG = {
  example: { icon: Lightbulb, color: '#f59e0b', label: '示例建议' },
  link: { icon: Link2, color: '#6366f1', label: '链接建议' },
  split: { icon: SplitSquareVertical, color: '#10b981', label: '拆分建议' },
  expand: { icon: Plus, color: '#ec4899', label: '扩展建议' },
}

export const WritingHintPanel: React.FC<WritingHintPanelProps> = ({
  hints,
  onHintClick,
}) => {
  if (!hints || hints.length === 0) {
    return null
  }

  return (
    <div className="ke-writing-hints">
      {/* Header */}
      <div className="ke-writing-hints__header">
        <MessageSquare size={14} className="ke-writing-hints__icon" />
        <span className="ke-writing-hints__title">写作建议</span>
        <span className="ke-writing-hints__count">{hints.length}</span>
      </div>

      {/* Hints list */}
      <div className="ke-writing-hints__list">
        {hints.slice(0, 3).map((hint, index) => {
          const config = TYPE_CONFIG[hint.type]
          const Icon = config.icon
          return (
            <div 
              key={index} 
              className="ke-writing-hints__hint"
              style={{ borderLeftColor: config.color }}
              onClick={() => onHintClick?.(hint)}
            >
              <div className="ke-writing-hints__hint-header">
                <Icon size={14} style={{ color: config.color }} />
                <span className="ke-writing-hints__hint-title">{hint.title}</span>
              </div>
              <p className="ke-writing-hints__hint-desc">{hint.description}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default WritingHintPanel
