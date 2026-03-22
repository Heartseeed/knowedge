import React, { useState } from 'react'
import { 
  RefreshCw, Tag, BookMarked, Sparkles, ChevronRight, 
  Dice5, Rocket, Globe, Lightbulb, Link2, 
  StickyNote, BarChart3, Timer, Search, CheckCircle2, AlertCircle
} from 'lucide-react'
import type { ReviewQueue } from '../types'

interface RightWidgetsProps {
  tags: string[]
  reviewQueue: ReviewQueue
  onTagClick: (tag: string) => void
  onReviewStart: () => void
  onNoteClick: (id: string) => void
}

const ICON_SIZE = 16
const PRIMARY_COLOR = 'var(--ke-primary)'

const KnowledgeGraph: React.FC = () => {
  const nodes = [
    { id: 'n1', label: 'AI', x: 60, y: 50, color: '#6366f1' },
    { id: 'n2', label: '学习方法', x: 180, y: 30, color: '#8b5cf6' },
    { id: 'n3', label: '认知', x: 180, y: 90, color: '#06b6d4' },
    { id: 'n4', label: '费曼', x: 300, y: 50, color: '#10b981' },
  ]

  const edges = [
    { from: 'n1', to: 'n2' },
    { from: 'n1', to: 'n3' },
    { from: 'n2', to: 'n4' },
    { from: 'n3', to: 'n4' },
  ]

  return (
    <svg viewBox="0 0 360 140" className="kb-graph">
      {edges.map((edge, i) => {
        const fromNode = nodes.find(n => n.id === edge.from)!
        const toNode = nodes.find(n => n.id === edge.to)!
        return (
          <line
            key={i}
            x1={fromNode.x}
            y1={fromNode.y}
            x2={toNode.x}
            y2={toNode.y}
            stroke="#6366f1"
            strokeWidth="2"
            strokeOpacity="0.4"
          />
        )
      })}
      {nodes.map(node => (
        <g key={node.id} className="kb-graph__node">
          <circle
            cx={node.x}
            cy={node.y}
            r="24"
            fill={node.color}
            fillOpacity="0.15"
            stroke={node.color}
            strokeWidth="2"
          />
          <text
            x={node.x}
            y={node.y + 4}
            textAnchor="middle"
            fontSize="11"
            fill="var(--ke-text-primary)"
          >
            {node.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

export const RightWidgets: React.FC<RightWidgetsProps> = ({
  tags,
  reviewQueue,
  onTagClick,
  onReviewStart,
  onNoteClick,
}) => {
  const [activeTab, setActiveTab] = useState<'tags' | 'review'>('review')

  return (
    <aside className="kb-right">
      <div className="kb-right__tabs">
        <button
          className={`kb-right__tab ${activeTab === 'review' ? 'active' : ''}`}
          onClick={() => setActiveTab('review')}
        >
          <RefreshCw size={14} />
          <span>学习队列</span>
        </button>
        <button
          className={`kb-right__tab ${activeTab === 'tags' ? 'active' : ''}`}
          onClick={() => setActiveTab('tags')}
        >
          <Tag size={14} />
          <span>标签</span>
        </button>
      </div>

      {activeTab === 'review' ? (
        <div className="kb-right__content">
          <section className="kb-widget">
            <div className="kb-widget__header">
              <span className="kb-widget__title">
                <BookMarked size={14} />
                <span>今日必看</span>
              </span>
              <span className="kb-widget__badge">{reviewQueue.today.length}</span>
            </div>
            <ul className="kb-review-list">
              {reviewQueue.today.map(item => (
                <li key={item.id} className="kb-review-item kb-review-item--today">
                  <button className="kb-review-item__btn" onClick={() => onNoteClick(item.id)}>
                    <span className="kb-review-item__title">{item.title}</span>
                    {item.dueCount && (
                      <span className="kb-review-item__due">{item.dueCount}x</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="kb-widget">
            <div className="kb-widget__header">
              <span className="kb-widget__title">
                <Sparkles size={14} color={PRIMARY_COLOR} />
                <span>推荐复习</span>
              </span>
            </div>
            <ul className="kb-review-list">
              {reviewQueue.recommend.map(item => (
                <li key={item.id} className="kb-review-item">
                  <button className="kb-review-item__btn" onClick={() => onNoteClick(item.id)}>
                    <span className="kb-review-item__arrow">
                      <ChevronRight size={14} />
                    </span>
                    <span className="kb-review-item__title">{item.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="kb-widget">
            <div className="kb-widget__header">
              <span className="kb-widget__title">
                <Dice5 size={14} />
                <span>随机探索</span>
              </span>
            </div>
            <ul className="kb-review-list">
              {reviewQueue.explore.map(item => (
                <li key={item.id} className="kb-review-item kb-review-item--explore">
                  <button className="kb-review-item__btn" onClick={() => onNoteClick(item.id)}>
                    <span className="kb-review-item__dice">
                      <Dice5 size={14} />
                    </span>
                    <span className="kb-review-item__title">{item.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <button className="kb-review-start-btn" onClick={onReviewStart}>
            <Rocket size={16} />
            <span>开始今日回顾</span>
          </button>
        </div>
      ) : (
        <div className="kb-right__content">
          <section className="kb-widget">
            <div className="kb-widget__header">
              <span className="kb-widget__title">
                <Tag size={14} />
                <span>标签云</span>
              </span>
            </div>
            <div className="kb-tag-cloud kb-tag-cloud--large">
              {tags.map((tag, i) => (
                <button
                  key={tag}
                  className="kb-tag kb-tag--clickable"
                  style={{ fontSize: `${0.75 + (i % 3) * 0.1}rem` }}
                  onClick={() => onTagClick(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      <section className="kb-widget kb-widget--graph">
        <div className="kb-widget__header">
          <span className="kb-widget__title">
            <Globe size={14} />
            <span>知识图谱</span>
          </span>
          <button className="kb-widget__action">
            <Search size={14} />
          </button>
        </div>
        <KnowledgeGraph />
      </section>

      <footer className="kb-right__footer">
        <div className="kb-status">
          <span className="kb-status__label">
            <BarChart3 size={14} />
            <span>本周活跃度</span>
          </span>
          <div className="kb-status__bar">
            <div className="kb-status__fill" style={{ width: '65%' }} />
          </div>
        </div>
        <div className="kb-status">
          <span className="kb-status__label">
            <Timer size={14} />
            <span>回顾提醒</span>
          </span>
          <span className="kb-status__value">3 条待复习</span>
        </div>
      </footer>
    </aside>
  )
}

export default RightWidgets
