import React from 'react'

interface TopicItem {
  id: string
  name: string
  noteCount?: number
}

interface RecommendedLink {
  id: string
  title: string
  excerpt?: string
}

interface KnowledgeFlowProps {
  topics: TopicItem[]
  recommendations: RecommendedLink[]
  onTopicClick?: (id: string) => void
  onLinkClick?: (id: string) => void
}

const BrainIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.54"/>
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.54"/>
  </svg>
)

const LinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
)

const KnowledgeFlow: React.FC<KnowledgeFlowProps> = ({
  topics,
  recommendations,
  onTopicClick,
  onLinkClick,
}) => {
  return (
    <div className="ke-widget">
      <div className="ke-widget__header">
        <BrainIcon />
        <h3 className="ke-widget__title">知识流</h3>
      </div>
      <div className="ke-widget__body">
        {topics.length > 0 && (
          <div className="ke-kflow-section">
            <div className="ke-kflow-label">最近关注</div>
            <div className="ke-kflow-tags">
              {topics.map((t) => (
                <button
                  key={t.id}
                  className="ke-tag ke-tag--clickable"
                  onClick={() => onTopicClick?.(t.id)}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
                  </svg>
                  {t.name}
                  {t.noteCount !== undefined && (
                    <span className="ke-tag__count">{t.noteCount}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {recommendations.length > 0 && (
          <div className="ke-kflow-section">
            <div className="ke-kflow-label">推荐连接</div>
            <ul className="ke-rec-list">
              {recommendations.map((r) => (
                <li
                  key={r.id}
                  className="ke-rec-item"
                  onClick={() => onLinkClick?.(r.id)}
                >
                  <span className="ke-rec-item__arrow">
                    <LinkIcon />
                  </span>
                  <span className="ke-rec-item__title">{r.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {topics.length === 0 && recommendations.length === 0 && (
          <div className="ke-widget__empty">开始记录笔记，系统将自动推荐关联内容</div>
        )}
      </div>
    </div>
  )
}

export default KnowledgeFlow
