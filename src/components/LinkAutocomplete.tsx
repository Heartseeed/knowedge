import React, { useState, useEffect, useRef } from 'react'
import { findLinkSuggestions, type LinkSuggestion } from '../backlinks'
import type { Note } from '../db/indexeddb'

interface LinkAutocompleteProps {
  editorRef?: React.RefObject<HTMLTextAreaElement | null>
  notes: Note[]
  currentNoteId?: string
  onInsert: (title: string, displayText?: string) => void
  query?: string  // Current search query from [[
}

const LinkAutocomplete: React.FC<LinkAutocompleteProps> = ({
  notes,
  currentNoteId,
  onInsert,
  query: externalQuery,
}) => {
  const [isOpen, setIsOpen] = useState(true)
  const [query, setQuery] = useState(externalQuery || '')
  const [suggestions, setSuggestions] = useState<LinkSuggestion[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const popupRef = useRef<HTMLDivElement>(null)

  // Update query when external query changes
  useEffect(() => {
    if (externalQuery !== undefined) {
      setQuery(externalQuery)
    }
  }, [externalQuery])

  // Get suggestions based on query
  useEffect(() => {
    if (!isOpen) return
    
    const results = findLinkSuggestions(query, notes, currentNoteId, 8)
    setSuggestions(results)
    setSelectedIndex(0)
  }, [query, notes, currentNoteId, isOpen])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          e.stopPropagation()
          setSelectedIndex(prev => Math.min(prev + 1, Math.max(0, suggestions.length - 1)))
          break
        case 'ArrowUp':
          e.preventDefault()
          e.stopPropagation()
          setSelectedIndex(prev => Math.max(prev - 1, 0))
          break
        case 'Enter':
        case 'Tab':
          e.preventDefault()
          e.stopPropagation()
          if (suggestions[selectedIndex]) {
            onInsert(suggestions[selectedIndex].title)
            setIsOpen(false)
          }
          break
        case 'Escape':
          e.preventDefault()
          e.stopPropagation()
          setIsOpen(false)
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [isOpen, suggestions, selectedIndex, onInsert])

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

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop to prevent clicks */}
      <div 
        style={{ position: 'fixed', inset: 0, zIndex: 999 }} 
        onClick={() => setIsOpen(false)}
      />
      
      <div
        ref={popupRef}
        className="ke-link-autocomplete"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 320,
          zIndex: 1000,
        }}
      >
        {/* Header */}
        <div className="ke-link-autocomplete__header">
          <span className="ke-link-autocomplete__title">🔗 插入链接</span>
          <span className="ke-link-autocomplete__query">"{query || '搜索笔记...'}"</span>
        </div>

        {/* Suggestions list */}
        <div className="ke-link-autocomplete__list">
          {suggestions.length > 0 ? (
            suggestions.map((suggestion, index) => (
              <div
                key={suggestion.id}
                className={`ke-link-autocomplete__item ${index === selectedIndex ? 'ke-link-autocomplete__item--selected' : ''}`}
                onClick={() => {
                  onInsert(suggestion.title)
                  setIsOpen(false)
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span className="ke-link-autocomplete__icon">
                  {getTypeIcon(notes.find(n => n.id === suggestion.id)?.type)}
                </span>
                <div className="ke-link-autocomplete__content">
                  <div className="ke-link-autocomplete__item-title">
                    {suggestion.title}
                  </div>
                  {suggestion.excerpt && (
                    <div className="ke-link-autocomplete__item-excerpt">
                      {suggestion.excerpt.slice(0, 60)}...
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="ke-link-autocomplete__empty">
              {query ? '未找到匹配的笔记' : '输入以搜索笔记'}
            </div>
          )}
        </div>

        {/* Footer hints */}
        <div className="ke-link-autocomplete__footer">
          <span><kbd>↑↓</kbd> 导航</span>
          <span><kbd>Enter</kbd> 插入</span>
          <span><kbd>Esc</kbd> 取消</span>
        </div>
      </div>
    </>
  )
}

export default LinkAutocomplete
