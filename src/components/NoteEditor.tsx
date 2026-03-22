import React, { useEffect, useState, useRef, useCallback } from 'react'
import type { Note } from '../db/indexeddb'
import LinkAutocomplete from './LinkAutocomplete'

type ViewMode = 'edit' | 'preview' | 'split'
type EditorMode = 'rich' | 'markdown'

interface NoteEditorProps {
  note?: Note
  notes: Note[]
  onChange: (note: Note) => void
  onSave?: () => void
  viewMode?: ViewMode
  onViewModeChange?: (mode: ViewMode) => void
}

const NoteEditor: React.FC<NoteEditorProps> = ({
  note,
  notes,
  onChange,
  onSave,
  viewMode = 'split',
  onViewModeChange,
}) => {
  const [mode, setMode] = useState<EditorMode>('markdown')
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout>()

  // Initialize content from note
  useEffect(() => {
    if (note) {
      // Strip HTML for markdown display
      const plainContent = note.content.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')
      setContent(plainContent)
      setTitle(note.title)
      setIsDirty(false)
    }
  }, [note?.id])

  // Auto-save with debounce
  useEffect(() => {
    if (!isDirty || !note) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      handleSave()
    }, 2000)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [content, title, isDirty])

  // Content change handler
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent)
    setIsDirty(true)
    
    // Convert to HTML for storage
    const html = markdownToHtml(newContent)
    onChange({
      ...note!,
      content: html,
      contentMarkdown: newContent,
      updatedAt: Date.now(),
    })
  }, [note, onChange])

  // Title change handler
  const handleTitleChange = useCallback((newTitle: string) => {
    setTitle(newTitle)
    setIsDirty(true)
    onChange({
      ...note!,
      title: newTitle,
      updatedAt: Date.now(),
    })
  }, [note, onChange])

  // Manual save
  const handleSave = useCallback(() => {
    const html = markdownToHtml(content)
    onChange({
      ...note!,
      title: title || '无标题',
      content: html,
      contentMarkdown: content,
      updatedAt: Date.now(),
    })
    setIsDirty(false)
    setLastSaved(new Date())
    onSave?.()
  }, [content, title, note, onChange, onSave])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
      // Toggle mode with Ctrl+Shift+M
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'M') {
        e.preventDefault()
        setMode(m => m === 'rich' ? 'markdown' : 'rich')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave])

  // Insert formatting
  const insertFormatting = useCallback((prefix: string, suffix: string = prefix) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.slice(start, end)
    const newContent = content.slice(0, start) + prefix + selectedText + suffix + content.slice(end)
    
    handleContentChange(newContent)
    
    // Restore cursor position
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(
        start + prefix.length,
        end + prefix.length
      )
    }, 0)
  }, [content, handleContentChange])

  // Insert wiki link
  const handleInsertLink = useCallback((linkTitle: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const cursorPos = textarea.selectionStart
    const newContent = content.slice(0, cursorPos) + `[[${linkTitle}]]` + content.slice(cursorPos)
    
    handleContentChange(newContent)
  }, [content, handleContentChange])

  // Markdown to HTML converter
  const markdownToHtml = (md: string): string => {
    let html = md
      // Headers
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Wiki links - transform to HTML
      .replace(/\[\[(.+?)\]\]/g, '<a class="ke-wiki-link" href="#">$1</a>')
      // Line breaks
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
    // Wrap in paragraph
    html = `<p>${html}</p>`
    // Clean up empty paragraphs
    html = html.replace(/<p><\/p>/g, '')
    return html
  }

  // Render markdown preview
  const renderPreview = () => {
    return { __html: markdownToHtml(content) }
  }

  if (!note) {
    return (
      <div className="ke-note-editor ke-note-editor--empty">
        <div className="ke-note-editor__empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          <p>选择一个笔记开始编辑</p>
        </div>
      </div>
    )
  }

  return (
    <div className="ke-note-editor">
      {/* Header */}
      <div className="ke-note-editor__header">
        <input
          type="text"
          className="ke-note-editor__title"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="无标题"
        />
        <div className="ke-note-editor__meta">
          <span className="ke-note-editor__status">
            {isDirty ? (
              <span className="ke-note-editor__unsaved">未保存</span>
            ) : lastSaved ? (
              <span className="ke-note-editor__saved">
                已保存 {lastSaved.toLocaleTimeString()}
              </span>
            ) : null}
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="ke-note-editor__toolbar">
        {/* Formatting buttons */}
        <div className="ke-note-editor__toolbar-group">
          <button
            className="ke-note-editor__toolbar-btn"
            onClick={() => insertFormatting('**')}
            title="加粗 (Ctrl+B)"
          >
            <strong>B</strong>
          </button>
          <button
            className="ke-note-editor__toolbar-btn"
            onClick={() => insertFormatting('*')}
            title="斜体 (Ctrl+I)"
          >
            <em>I</em>
          </button>
          <button
            className="ke-note-editor__toolbar-btn"
            onClick={() => insertFormatting('# ', '')}
            title="标题"
          >
            H
          </button>
        </div>

        <div className="ke-note-editor__toolbar-divider" />

        {/* Insert buttons */}
        <div className="ke-note-editor__toolbar-group">
          <button
            className="ke-note-editor__toolbar-btn"
            onClick={() => insertFormatting('[[')}
            title="插入链接 [["
          >
            🔗
          </button>
          <button
            className="ke-note-editor__toolbar-btn"
            onClick={() => insertFormatting('- ', '')}
            title="列表项"
          >
            •
          </button>
          <button
            className="ke-note-editor__toolbar-btn"
            onClick={() => insertFormatting('> ', '')}
            title="引用"
          >
            "
          </button>
        </div>

        <div className="ke-note-editor__toolbar-divider" />

        {/* View mode buttons */}
        {onViewModeChange && (
          <div className="ke-note-editor__toolbar-group ke-note-editor__toolbar-group--view">
            <button
              className={`ke-note-editor__toolbar-btn ${mode === 'markdown' ? 'ke-note-editor__toolbar-btn--active' : ''}`}
              onClick={() => setMode('markdown')}
              title="Markdown 模式"
            >
              M↓
            </button>
            <button
              className={`ke-note-editor__toolbar-btn ${mode === 'rich' ? 'ke-note-editor__toolbar-btn--active' : ''}`}
              onClick={() => setMode('rich')}
              title="富文本模式"
            >
              Aa
            </button>
          </div>
        )}

        {/* Save button */}
        <div className="ke-note-editor__toolbar-spacer" />
        <button
          className="ke-note-editor__toolbar-btn ke-note-editor__toolbar-btn--save"
          onClick={handleSave}
          disabled={!isDirty}
        >
          保存
        </button>
      </div>

      {/* Editor body */}
      <div className={`ke-note-editor__body ke-note-editor__body--${mode}`}>
        {mode === 'markdown' ? (
          <>
            <div className="ke-note-editor__input">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="开始写作... 使用 [[ 插入链接"
                spellCheck
              />
            </div>
            <div className="ke-note-editor__preview">
              <div className="ke-note-editor__preview-content" dangerouslySetInnerHTML={renderPreview()} />
            </div>
          </>
        ) : (
          <div className="ke-note-editor__input ke-note-editor__input--full">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="开始写作..."
              spellCheck
            />
          </div>
        )}
      </div>

      {/* Wiki link autocomplete */}
      {mode === 'markdown' && (
        <LinkAutocomplete
          editorRef={textareaRef}
          notes={notes}
          currentNoteId={note.id}
          onInsert={handleInsertLink}
        />
      )}

      {/* Footer */}
      <div className="ke-note-editor__footer">
        <span className="ke-note-editor__hint">
          按 <kbd>Ctrl</kbd>+<kbd>S</kbd> 保存 · 使用 <kbd>[[</kbd> 创建链接
        </span>
        <span className="ke-note-editor__word-count">
          {content.split(/\s+/).filter(w => w.length > 0).length} 字
        </span>
      </div>
    </div>
  )
}

export default NoteEditor
