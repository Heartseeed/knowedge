import React, { useState, useEffect, useRef, useCallback } from 'react'
import { SimpleSearch, type SearchDimension } from '../search'
import type { Note } from '../db/indexeddb'

interface SearchModalProps {
  notes: Note[]
  isOpen: boolean
  onClose: () => void
  onSelectNote: (noteId: string) => void
  onCreateNote?: (title: string) => void
}

interface SearchResult {
  id: string
  title: string
  content: string
  plainContent: string
  tags: string[]
  type: string
  status: string
  matchType: 'title' | 'content' | 'tag' | 'folder' | 'type'
  score: number
}

// Search section types
type SearchSection = 'recent' | 'suggestions' | 'results' | 'create'

// Dimension options with category descriptions
const DIMENSIONS: { value: SearchDimension; label: string; icon: string; desc: string }[] = [
  { value: 'all', label: '全部', icon: '🔍', desc: '标题+内容+标签' },
  { value: 'title', label: '标题', icon: '📝', desc: '仅标题' },
  { value: 'content', label: '内容', icon: '📄', desc: '仅正文' },
  { value: 'tag', label: '标签', icon: '🏷️', desc: '按标签' },
  { value: 'folder', label: '文件夹', icon: '📁', desc: '按文件夹' },
  { value: 'type', label: '类别', icon: '📑', desc: '想法/读书/概念等' },
]

// Note type descriptions for category filter
const NOTE_TYPE_LABELS: Record<string, { label: string; icon: string; desc: string }> = {
  idea: { label: '想法', icon: '💡', desc: '灵感和创意' },
  reading: { label: '读书笔记', icon: '📖', desc: '书籍文章摘要' },
  concept: { label: '概念', icon: '🧠', desc: '定义和原理' },
  practice: { label: '实践', icon: '🧪', desc: '方法论和步骤' },
  card: { label: '卡片', icon: '📌', desc: '重要知识点' },
  tutorial: { label: '教程', icon: '📚', desc: '学习指南' },
  project: { label: '项目', icon: '🚀', desc: '项目记录' },
  note: { label: '笔记', icon: '📝', desc: '一般笔记' },
  other: { label: '其他', icon: '📋', desc: '其他内容' },
}

const EnhancedSearch: React.FC<SearchModalProps> = ({
  notes,
  isOpen,
  onClose,
  onSelectNote,
  onCreateNote,
}) => {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<SearchResult[]>([])
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [activeSection, setActiveSection] = useState<SearchSection>('recent')
  const [isSearching, setIsSearching] = useState(false)
  const [dimension, setDimension] = useState<SearchDimension>('all')
  const [showResults, setShowResults] = useState(false)
  const [showDimensionDropdown, setShowDimensionDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchEngine = useRef(new SimpleSearch())
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  // Build search index when notes change
  useEffect(() => {
    searchEngine.current.build(
      notes.map(n => ({
        id: n.id,
        title: n.title,
        content: n.content.replace(/<[^>]+>/g, ''),
        tags: n.tags || [],
        folderId: n.folderId,
        type: n.type,
      }))
    )
  }, [notes])

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
      setQuery('')
      setSuggestions([])
      setResults([])
      setSelectedIndex(0)
      setActiveSection('recent')
      setShowResults(false)
      setShowDimensionDropdown(false)
    }
  }, [isOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDimensionDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Real-time suggestions (autocomplete)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (!query.trim()) {
      setSuggestions([])
      setActiveSection('recent')
      return
    }

    // Debounce for suggestions
    searchTimeoutRef.current = setTimeout(() => {
      const searchResults = searchEngine.current.search(query, dimension)
      
      const scored: SearchResult[] = searchResults.slice(0, 5).map(n => {
        const note = notes.find(note => note.id === n.id)
        const plainContent = n.content.replace(/<[^>]+>/g, '')
        
        let matchType: 'title' | 'content' | 'tag' | 'folder' | 'type' = 'content'
        const titleLower = n.title.toLowerCase()
        const queryLower = query.toLowerCase()
        
        if (dimension === 'title' || (dimension === 'all' && (titleLower === queryLower || titleLower.includes(queryLower)))) {
          matchType = 'title'
        } else if (dimension === 'tag') {
          matchType = 'tag'
        } else if (dimension === 'folder') {
          matchType = 'folder'
        } else if (dimension === 'type') {
          matchType = 'type'
        }
        
        let score = 10
        if (matchType === 'title') score += 20
        
        return {
          id: n.id,
          title: n.title,
          content: plainContent.slice(0, 120),
          plainContent,
          tags: n.tags || [],
          type: note?.type || 'note',
          status: note?.status || 'organized',
          matchType,
          score,
        }
      })

      scored.sort((a, b) => b.score - a.score)
      setSuggestions(scored)
      setActiveSection('suggestions')
    }, 100)
  }, [query, notes, dimension])

  // Perform full search when user clicks search button
  const performSearch = useCallback(() => {
    if (!query.trim()) return

    setIsSearching(true)
    setShowResults(true)

    const searchResults = searchEngine.current.search(query, dimension)
    
    const scored: SearchResult[] = searchResults.slice(0, 20).map(n => {
      const note = notes.find(note => note.id === n.id)
      const plainContent = n.content.replace(/<[^>]+>/g, '')
      
      let matchType: 'title' | 'content' | 'tag' | 'folder' | 'type' = 'content'
      const titleLower = n.title.toLowerCase()
      const queryLower = query.toLowerCase()
      
      if (dimension === 'title' || (dimension === 'all' && (titleLower === queryLower || titleLower.includes(queryLower)))) {
        matchType = 'title'
      } else if (dimension === 'tag') {
        matchType = 'tag'
      } else if (dimension === 'folder') {
        matchType = 'folder'
      } else if (dimension === 'type') {
        matchType = 'type'
      }
      
      let score = 10
      if (matchType === 'title') score += 20
      
      return {
        id: n.id,
        title: n.title,
        content: plainContent.slice(0, 150),
        plainContent,
        tags: n.tags || [],
        type: note?.type || 'note',
        status: note?.status || 'organized',
        matchType,
        score,
      }
    })

    scored.sort((a, b) => b.score - a.score)
    setResults(scored)
    setActiveSection('results')
    setSelectedIndex(0)
    setIsSearching(false)
  }, [query, notes, dimension])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (showResults) {
        const totalItems = results.length + (query.trim() ? 1 : 0)
        if (selectedIndex === results.length && query.trim()) {
          onCreateNote?.(query)
        } else if (results[selectedIndex]) {
          onSelectNote(results[selectedIndex].id)
          onClose()
        }
      } else {
        performSearch()
      }
      return
    }

    let itemCount = 0
    if (showResults) {
      itemCount = results.length + (query.trim() ? 1 : 0)
    } else if (activeSection === 'suggestions') {
      itemCount = suggestions.length
    } else if (activeSection === 'recent') {
      itemCount = results.length
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(i => (i + 1) % Math.max(1, itemCount))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(i => (i - 1 + Math.max(1, itemCount)) % Math.max(1, itemCount))
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }, [results, suggestions, selectedIndex, showResults, activeSection, query, onSelectNote, onCreateNote, onClose, performSearch])

  // Highlight matching text
  const highlightMatch = (text: string, searchQuery: string) => {
    if (!searchQuery.trim()) return text
    try {
      const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`(${escaped})`, 'gi')
      const parts = text.split(regex)
      return parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="ke-search-highlight">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )
    } catch {
      return text
    }
  }

  // Get type icon
  const getTypeIcon = (type: string) => {
    return NOTE_TYPE_LABELS[type]?.icon || '📝'
  }

  // Get type label
  const getTypeLabel = (type: string) => {
    return NOTE_TYPE_LABELS[type]?.label || '笔记'
  }

  // Get status badge
  const getStatusBadge = (status: string) => {
    const badges: Record<string, { text: string; className: string }> = {
      inbox: { text: '草稿箱', className: 'ke-search-badge--inbox' },
      organized: { text: '已整理', className: 'ke-search-badge--organized' },
      connected: { text: '已连接', className: 'ke-search-badge--connected' },
    }
    const badge = badges[status]
    if (!badge) return null
    return <span className={`ke-search-badge ${badge.className}`}>{badge.text}</span>
  }

  if (!isOpen) return null

  // Get current dimension display
  const currentDimension = DIMENSIONS.find(d => d.value === dimension) || DIMENSIONS[0]

  return (
    <>
      <div className="ke-modal-overlay ke-search-overlay" onClick={onClose} />
      <div className="ke-search-modal">
        {/* Search Input */}
        <div className="ke-search-modal__header">
          <svg className="ke-search-modal__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>

          {/* Dimension Dropdown */}
          <div className="ke-search-dimension-dropdown" ref={dropdownRef}>
            <button 
              className="ke-search-dimension-btn"
              onClick={() => setShowDimensionDropdown(!showDimensionDropdown)}
            >
              <span className="ke-search-dimension-btn__icon">{currentDimension.icon}</span>
              <span className="ke-search-dimension-btn__label">{currentDimension.label}</span>
              <svg className="ke-search-dimension-btn__arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            
            {showDimensionDropdown && (
              <div className="ke-search-dimension-menu">
                {DIMENSIONS.map((dim) => (
                  <button
                    key={dim.value}
                    className={`ke-search-dimension-option ${dimension === dim.value ? 'ke-search-dimension-option--active' : ''}`}
                    onClick={() => {
                      setDimension(dim.value)
                      setShowDimensionDropdown(false)
                    }}
                  >
                    <span className="ke-search-dimension-option__icon">{dim.icon}</span>
                    <span className="ke-search-dimension-option__label">{dim.label}</span>
                    {dimension === dim.value && (
                      <svg className="ke-search-dimension-option__check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <input
            ref={inputRef}
            type="text"
            className="ke-search-modal__input"
            placeholder="搜索笔记、标签、内容... 或输入新建"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setShowResults(false)
            }}
            onKeyDown={handleKeyDown}
          />
          {isSearching && (
            <div className="ke-search-modal__loading">
              <div className="ke-spinner" />
            </div>
          )}
          {query && !isSearching && (
            <button
              className="ke-search-modal__clear"
              onClick={() => {
                setQuery('')
                setShowResults(false)
                setSuggestions([])
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
          <button 
            className="ke-search-btn"
            onClick={performSearch}
            disabled={!query.trim()}
          >
            搜索
          </button>
        </div>

        {/* Category Filter (when type dimension selected) */}
        {dimension === 'type' && (
          <div className="ke-search-categories">
            <span className="ke-search-categories__label">选择类别：</span>
            <div className="ke-search-categories__list">
              {Object.entries(NOTE_TYPE_LABELS).map(([key, val]) => (
                <button
                  key={key}
                  className="ke-search-category"
                  onClick={() => setQuery(val.label)}
                >
                  <span>{val.icon}</span>
                  <span>{val.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Suggestions (Autocomplete) */}
        {!showResults && suggestions.length > 0 && (
          <div className="ke-search-suggestions">
            <div className="ke-search-suggestions__title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <path d="M12 17h.01"/>
              </svg>
              联想建议
            </div>
            <ul className="ke-search-suggestions__list">
              {suggestions.map((suggestion, index) => (
                <li
                  key={suggestion.id}
                  className={`ke-search-suggestion ${index === selectedIndex ? 'ke-search-suggestion--selected' : ''}`}
                  onClick={() => {
                    onSelectNote(suggestion.id)
                    onClose()
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span className="ke-search-suggestion__icon">{getTypeIcon(suggestion.type)}</span>
                  <div className="ke-search-suggestion__content">
                    <span className="ke-search-suggestion__title">
                      {highlightMatch(suggestion.title, query)}
                    </span>
                    <span className="ke-search-suggestion__excerpt">
                      {suggestion.content.slice(0, 50)}...
                    </span>
                  </div>
                  <span className="ke-search-suggestion__type">{getTypeLabel(suggestion.type)}</span>
                </li>
              ))}
            </ul>
            <div className="ke-search-suggestions__hint">
              按 <kbd>Enter</kbd> 或点击「搜索」查看完整结果
            </div>
          </div>
        )}

        {/* No suggestions */}
        {!showResults && query.trim() && suggestions.length === 0 && (
          <div className="ke-search-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <p>未找到 "<strong>{query}</strong>" 相关笔记</p>
            <button className="ke-search-btn ke-search-btn--inline" onClick={() => onCreateNote?.(query)}>
              创建笔记
            </button>
          </div>
        )}

        {/* Results */}
        <div className="ke-search-modal__body">
          {/* Recent Notes Section */}
          {activeSection === 'recent' && !showResults && results.length > 0 && (
            <div className="ke-search-modal__section">
              <div className="ke-search-modal__section-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                最近笔记
              </div>
              <ul className="ke-search-modal__list">
                {results.map((result, index) => (
                  <li
                    key={result.id}
                    className={`ke-search-modal__item ${index === selectedIndex ? 'ke-search-modal__item--selected' : ''}`}
                    onClick={() => {
                      onSelectNote(result.id)
                      onClose()
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <span className="ke-search-modal__item-icon">
                      {getTypeIcon(result.type)}
                    </span>
                    <div className="ke-search-modal__item-content">
                      <div className="ke-search-modal__item-title">
                        {highlightMatch(result.title, query)}
                      </div>
                      <div className="ke-search-modal__item-meta">
                        {getStatusBadge(result.status)}
                        {result.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="ke-search-modal__tag">#{tag}</span>
                        ))}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Search Results Section */}
          {showResults && (
            <>
              {results.length > 0 && (
                <div className="ke-search-modal__section">
                  <div className="ke-search-modal__section-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                    搜索结果 ({results.length})
                  </div>
                  <ul className="ke-search-modal__list">
                    {results.map((result, index) => (
                      <li
                        key={result.id}
                        className={`ke-search-modal__item ${index === selectedIndex ? 'ke-search-modal__item--selected' : ''}`}
                        onClick={() => {
                          onSelectNote(result.id)
                          onClose()
                        }}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <span className="ke-search-modal__item-icon">
                          {getTypeIcon(result.type)}
                        </span>
                        <div className="ke-search-modal__item-content">
                          <div className="ke-search-modal__item-title">
                            {highlightMatch(result.title, query)}
                          </div>
                          <div className="ke-search-modal__item-excerpt">
                            {highlightMatch(result.content, query)}
                          </div>
                          <div className="ke-search-modal__item-meta">
                            {getStatusBadge(result.status)}
                            {result.matchType === 'title' && (
                              <span className="ke-search-match-badge">标题匹配</span>
                            )}
                            {result.tags.slice(0, 2).map(tag => (
                              <span key={tag} className="ke-search-modal__tag">
                                {highlightMatch(`#${tag}`, query)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* No results state */}
              {results.length === 0 && query.trim() && (
                <div className="ke-search-modal__empty">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  <p>未找到 "<strong>{query}</strong>" 相关笔记</p>
                </div>
              )}
            </>
          )}

          {/* Create new note option */}
          {showResults && query.trim() && (
            <div className="ke-search-modal__section">
              <div className="ke-search-modal__section-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                创建
              </div>
              <div
                className={`ke-search-modal__create ${selectedIndex === results.length ? 'ke-search-modal__create--selected' : ''}`}
                onClick={() => onCreateNote?.(query)}
                onMouseEnter={() => setSelectedIndex(results.length)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                <span>创建笔记 "<strong>{highlightMatch(query, query)}</strong>"</span>
                <kbd>Enter</kbd>
              </div>
            </div>
          )}
        </div>

        {/* Footer hints */}
        <div className="ke-search-modal__footer">
          <span className="ke-search-modal__hint">
            <kbd>↑↓</kbd> 导航
          </span>
          <span className="ke-search-modal__hint">
            <kbd>Enter</kbd> {showResults ? '选择' : '搜索'}
          </span>
          <span className="ke-search-modal__hint">
            <kbd>Esc</kbd> 关闭
          </span>
        </div>
      </div>
    </>
  )
}

export default EnhancedSearch
