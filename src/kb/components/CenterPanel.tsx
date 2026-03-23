import React, { useState, useEffect, useCallback, useRef } from 'react'
import TipTapEditor, { TipTapEditorHandle } from '../../components/TipTapEditor'
import { VersionHistoryPanel } from '../../components/VersionHistoryPanel'
import { ColorPicker } from '../../components/ColorPicker'
import { FindReplaceModal } from '../../components/FindReplaceModal'
import type { NoteSnapshot } from '../../db/indexeddb'
import { 
  Edit3, Columns, Eye, Plus, Brain, BookOpen, FlaskConical, 
  Lightbulb, StickyNote, FileText, Clock, CheckCircle2, 
  Archive, Inbox, LightbulbIcon, Link2, Sparkles, 
  PanelLeft, ChevronLeft, ChevronRight, Cloud, CloudOff, Loader2, Check,
  Undo, Redo, Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Quote,
  Code, CodeSquare, Link2Icon, Minus, Highlighter, Pin, Trash2, RotateCcw, Trash, ChevronDown,
  Paperclip, Star, History, X, Search, Replace
} from 'lucide-react'
import type { Note, ViewMode, NoteType } from '../types'
import { initDB } from '../../db/indexeddb'

// Editor mode type
type EditorMode = 'rich' | 'markdown'

interface CenterPanelProps {
  notes: Note[]
  selectedNote: Note | undefined
  viewMode: ViewMode
  onNoteSelect: (note: Note) => void
  onViewModeChange: (mode: ViewMode) => void
  onNoteChange?: (note: Note) => void
  onNoteTypeChange?: (noteId: string, type: NoteType) => void
  onTogglePin?: (note: Note) => void
  onToggleStar?: (note: Note) => void
  onDeleteNote?: (note: Note) => void
  onRestoreNote?: (note: Note) => void
  onPermanentDelete?: (note: Note) => void
  onCreateNote?: (type?: NoteType) => void
  noteListCollapsed?: boolean
  onNoteListToggle?: () => void
  leftNavCollapsed?: boolean
  isTrashView?: boolean
}

const ICON_SIZE = 16
const NOTE_TYPE_CONFIG: Record<NoteType, { icon: React.ReactNode; label: string; color: string }> = {
  concept: { icon: <Brain size={ICON_SIZE} />, label: '概念', color: '#6366f1' },
  reading: { icon: <BookOpen size={ICON_SIZE} />, label: '读书笔记', color: '#0ea5e9' },
  practice: { icon: <FlaskConical size={ICON_SIZE} />, label: '实践', color: '#22c55e' },
  idea: { icon: <Lightbulb size={ICON_SIZE} />, label: '想法', color: '#f59e0b' },
  card: { icon: <StickyNote size={ICON_SIZE} />, label: '卡片', color: '#ec4899' },
  tutorial: { icon: <Lightbulb size={ICON_SIZE} />, label: '教程', color: '#8b5cf6' },
  project: { icon: <StickyNote size={ICON_SIZE} />, label: '项目', color: '#06b6d4' },
  other: { icon: <FileText size={ICON_SIZE} />, label: '其他', color: '#64748b' },
}

// Fallback for undefined note types
const DEFAULT_NOTE_TYPE = { icon: <FileText size={ICON_SIZE} />, label: '笔记', color: '#64748b' }

// Safe config getter with fallback
const getNoteTypeConfig = (type: NoteType) => {
  return NOTE_TYPE_CONFIG[type] || DEFAULT_NOTE_TYPE
}

const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 7) return `${days} 天前`
  return new Date(timestamp).toLocaleDateString('zh-CN')
}

// Format deletion date and remaining days for trash view
const formatDeletionInfo = (deletedAt: number): string => {
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
  const expiresAt = deletedAt + thirtyDaysMs
  const remainingDays = Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000))
  
  if (remainingDays <= 0) return '即将永久删除'
  if (remainingDays === 1) return '明天删除'
  return `${remainingDays} 天后删除`
}

// Save status types
type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error' | 'offline'

export const CenterPanel: React.FC<CenterPanelProps> = ({
  notes,
  selectedNote,
  viewMode,
  onNoteSelect,
  onViewModeChange,
  onNoteChange,
  onNoteTypeChange,
  onTogglePin,
  onToggleStar,
  onDeleteNote,
  onRestoreNote,
  onPermanentDelete,
  onCreateNote,
  noteListCollapsed = false,
  onNoteListToggle,
  leftNavCollapsed = false,
  isTrashView = false,
}) => {
  const [editorMode, setEditorMode] = useState<EditorMode>('rich')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  

  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [showTypeDropdown, setShowTypeDropdown] = useState(false)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showFindReplace, setShowFindReplace] = useState(false)
  const [showCreateDropdown, setShowCreateDropdown] = useState(false)
  const createDropdownRef = useRef<HTMLDivElement>(null)
  const saveTimeoutRef = useRef<number | null>(null)
  const pendingNoteRef = useRef<Note | null>(null)
  const editorRef = useRef<TipTapEditorHandle>(null)

  // Auto-save function - only saves to DB, parent already notified by handleNoteUpdate
  const autoSave = useCallback(async (note: Note) => {
    if (!note) return
    
    setSaveStatus('saving')
    try {
      await initDB.putNote(note)
      pendingNoteRef.current = null
      setSaveStatus('saved')
      setLastSavedAt(Date.now())
      // Parent already notified by handleNoteUpdate, no need to notify again
    } catch (error) {
      console.error('Auto-save failed:', error)
      setSaveStatus('error')
    }
  }, [])

  // Debounced save on note change
  useEffect(() => {
    if (!selectedNote) return
    
    // If note changed significantly, mark as unsaved
    if (pendingNoteRef.current?.id === selectedNote.id) {
      if (JSON.stringify(pendingNoteRef.current) !== JSON.stringify(selectedNote)) {
        setSaveStatus('unsaved')
      }
    }
  }, [selectedNote])

  // Handle note updates from editor
  const handleNoteUpdate = useCallback((updatedNote: Note) => {
    // Mark as pending
    pendingNoteRef.current = updatedNote
    setSaveStatus('unsaved')
    
    // Notify parent immediately for UI responsiveness
    if (onNoteChange) {
      onNoteChange(updatedNote)
    }
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    // Auto-save after 1 second of inactivity
    saveTimeoutRef.current = window.setTimeout(() => {
      autoSave(updatedNote)
    }, 1000)
  }, [autoSave, onNoteChange])

  // Save on unmount or note change
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      // Save pending note on unmount
      if (pendingNoteRef.current) {
        autoSave(pendingNoteRef.current)
      }
    }
  }, [autoSave])

  // Listen for online/offline
  useEffect(() => {
    const handleOnline = () => setSaveStatus('unsaved')
    const handleOffline = () => setSaveStatus('offline')
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    if (!navigator.onLine) {
      setSaveStatus('offline')
    }
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Keyboard shortcuts - Ctrl+F for find/replace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setShowFindReplace(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Get save status display
  const getSaveStatusDisplay = () => {
    switch (saveStatus) {
      case 'saved':
        return {
          icon: <Check size={14} />,
          text: '已保存',
          className: 'kb-save-status--saved'
        }
      case 'saving':
        return {
          icon: <Loader2 size={14} className="kb-save-status__spinner" />,
          text: '保存中...',
          className: 'kb-save-status--saving'
        }
      case 'unsaved':
        return {
          icon: <Cloud size={14} />,
          text: '未保存',
          className: 'kb-save-status--unsaved'
        }
      case 'error':
        return {
          icon: <CloudOff size={14} />,
          text: '保存失败',
          className: 'kb-save-status--error'
        }
      case 'offline':
        return {
          icon: <CloudOff size={14} />,
          text: '离线',
          className: 'kb-save-status--offline'
        }
    }
  }

  const saveStatusDisplay = getSaveStatusDisplay()

  const bothPanelsCollapsed = leftNavCollapsed && noteListCollapsed

  return (
    <main className={`kb-center ${bothPanelsCollapsed ? 'kb-center--expanded' : ''}`}>
      {/* Header */}
      <header className="kb-center__header">
        <div className="kb-center__title">
          <h2>笔记</h2>
          <span className="kb-center__count">{notes.length} 条笔记</span>
        </div>
        <div className="kb-center__actions">
          {/* Inline Toolbar for Rich Mode - In Header */}
          {selectedNote && editorMode === 'rich' && (
            <div className="kb-inline-toolbar kb-inline-toolbar--header">
              <button className="kb-inline-toolbar__btn" title="撤销 (Ctrl+Z)" onClick={() => editorRef.current?.undo()}>
                <Undo size={15} />
              </button>
              <button className="kb-inline-toolbar__btn" title="重做 (Ctrl+Y)" onClick={() => editorRef.current?.redo()}>
                <Redo size={15} />
              </button>
              <div className="kb-inline-toolbar__divider" />
              <button className="kb-inline-toolbar__btn" title="一级标题" onClick={() => editorRef.current?.toggleHeading(1)}>H1</button>
              <button className="kb-inline-toolbar__btn" title="二级标题" onClick={() => editorRef.current?.toggleHeading(2)}>H2</button>
              <button className="kb-inline-toolbar__btn" title="三级标题" onClick={() => editorRef.current?.toggleHeading(3)}>H3</button>
              <div className="kb-inline-toolbar__divider" />
              <button className="kb-inline-toolbar__btn" title="加粗 (Ctrl+B)" onClick={() => editorRef.current?.toggleBold()}>
                <Bold size={15} />
              </button>
              <button className="kb-inline-toolbar__btn" title="斜体 (Ctrl+I)" onClick={() => editorRef.current?.toggleItalic()}>
                <Italic size={15} />
              </button>
              <button className="kb-inline-toolbar__btn" title="下划线 (Ctrl+U)" onClick={() => editorRef.current?.toggleUnderline()}>
                <UnderlineIcon size={15} />
              </button>
              <button className="kb-inline-toolbar__btn" title="删除线" onClick={() => editorRef.current?.toggleStrike()}>
                <Strikethrough size={15} />
              </button>
              <button className="kb-inline-toolbar__btn" title="高亮" onClick={() => editorRef.current?.toggleHighlight()}>
                <Highlighter size={15} />
              </button>
              {/* Text Color Picker - 预设颜色 */}
              <ColorPicker
                type="text"
                onColorSelect={(color) => editorRef.current?.setTextColor(color)}
                onClear={() => editorRef.current?.unsetTextColor()}
              />
              {/* Highlight Color Picker - 预设颜色 */}
              <ColorPicker
                type="highlight"
                onColorSelect={(color) => editorRef.current?.toggleHighlightWithColor(color)}
                onClear={() => editorRef.current?.toggleHighlight()}
              />
              <button className="kb-inline-toolbar__btn" title="行内代码" onClick={() => editorRef.current?.toggleCode()}>
                <Code size={15} />
              </button>
              <div className="kb-inline-toolbar__divider" />
              <button className="kb-inline-toolbar__btn" title="左对齐" onClick={() => editorRef.current?.setTextAlign('left')}>
                <AlignLeft size={15} />
              </button>
              <button className="kb-inline-toolbar__btn" title="居中" onClick={() => editorRef.current?.setTextAlign('center')}>
                <AlignCenter size={15} />
              </button>
              <button className="kb-inline-toolbar__btn" title="右对齐" onClick={() => editorRef.current?.setTextAlign('right')}>
                <AlignRight size={15} />
              </button>
              <div className="kb-inline-toolbar__divider" />
              <button className="kb-inline-toolbar__btn" title="无序列表" onClick={() => editorRef.current?.toggleBulletList()}>
                <List size={15} />
              </button>
              <button className="kb-inline-toolbar__btn" title="有序列表" onClick={() => editorRef.current?.toggleOrderedList()}>
                <ListOrdered size={15} />
              </button>
              <button className="kb-inline-toolbar__btn" title="引用" onClick={() => editorRef.current?.toggleBlockquote()}>
                <Quote size={15} />
              </button>
              <button className="kb-inline-toolbar__btn" title="代码块" onClick={() => editorRef.current?.toggleCodeBlock()}>
                <CodeSquare size={15} />
              </button>
              <div className="kb-inline-toolbar__divider" />
              <button className="kb-inline-toolbar__btn" title="插入链接" onClick={() => editorRef.current?.setLink()}>
                <Link2Icon size={15} />
              </button>
              <button className="kb-inline-toolbar__btn" title="插入文件" onClick={() => editorRef.current?.openAttachmentPicker()}>
                <Paperclip size={15} />
              </button>
              <button className="kb-inline-toolbar__btn" title="历史版本" onClick={() => setShowVersionHistory(true)}>
                <History size={15} />
              </button>
              <button className="kb-inline-toolbar__btn" title="分隔线" onClick={() => editorRef.current?.setHorizontalRule()}>
                <Minus size={15} />
              </button>
              <div className="kb-inline-toolbar__divider" />
              <button className="kb-inline-toolbar__btn" title="查找替换 (Ctrl+F)" onClick={() => setShowFindReplace(true)}>
                <Search size={15} />
              </button>
            </div>
          )}

          {/* Editor Mode Toggle - Icon Only */}
          {selectedNote && (
            <div className="kb-editor-mode-toggle">
              <button
                className={`kb-editor-mode-btn ${editorMode === 'rich' ? 'kb-editor-mode-btn--active' : ''}`}
                onClick={() => setEditorMode('rich')}
                title="富文本模式"
              >
                <Edit3 size={14} />
              </button>
              <button
                className={`kb-editor-mode-btn ${editorMode === 'markdown' ? 'kb-editor-mode-btn--active' : ''}`}
                onClick={() => setEditorMode('markdown')}
                title="Markdown 模式"
              >
                <FileText size={14} />
              </button>
            </div>
          )}

          {/* Save Status */}
          {selectedNote && (
            <div className={`kb-save-status ${saveStatusDisplay?.className || ''}`}>
              {saveStatusDisplay?.icon}
              <span>{saveStatusDisplay?.text}</span>
            </div>
          )}
          
          {/* View Toggle - Edit/Preview only */}
          <div className="kb-view-toggle">
            <button
              className={`kb-view-toggle__btn ${viewMode === 'edit' ? 'active' : ''}`}
              onClick={() => onViewModeChange('edit')}
              title="编辑模式"
            >
              <Edit3 size={16} />
            </button>
            <button
              className={`kb-view-toggle__btn ${viewMode === 'preview' ? 'active' : ''}`}
              onClick={() => onViewModeChange('preview')}
              title="预览模式"
            >
              <Eye size={16} />
            </button>
          </div>
          <div className="kb-create-dropdown-wrapper">
            <button 
              className="ke-btn ke-btn--primary ke-btn--sm" 
              onClick={() => setShowCreateDropdown(!showCreateDropdown)}
            >
              <Plus size={16} />
              <span>新建</span>
              <ChevronDown size={14} />
            </button>
            {showCreateDropdown && (
              <div className="kb-create-dropdown">
                <div className="kb-create-dropdown__title">选择笔记类型</div>
                {Object.entries(NOTE_TYPE_CONFIG).map(([type, config]) => (
                  <button
                    key={type}
                    className="kb-create-dropdown__item"
                    onClick={() => {
                      onCreateNote?.(type as NoteType)
                      setShowCreateDropdown(false)
                    }}
                  >
                    <span className="kb-create-dropdown__icon" style={{ color: config.color }}>
                      {config.icon}
                    </span>
                    <span className="kb-create-dropdown__label">{config.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="kb-center__content">
        {/* Note List - Collapsible */}
        <div className={`kb-note-list-wrapper ${noteListCollapsed ? 'kb-note-list-wrapper--collapsed' : ''} ${leftNavCollapsed ? 'kb-note-list-wrapper--expanded' : ''}`}>
          <div className="kb-note-list">
            {!noteListCollapsed && (
            <>
              {notes.length === 0 ? (
                <div className="kb-note-list__empty">
                  <FileText size={48} strokeWidth={1} />
                  <p>暂无笔记</p>
                  <p className="kb-note-list__empty-hint">点击上方按钮创建第一条笔记</p>
                </div>
              ) : (
                notes.map(note => {
                  const config = getNoteTypeConfig(note.type)
                  return (
                    <button
                      key={note.id}
                      className={`kb-note-item ${selectedNote?.id === note.id ? 'kb-note-item--selected' : ''}`}
                      onClick={() => onNoteSelect(note)}
                      >
                      <div className="kb-note-item__header">
                        <span className="kb-note-item__type" style={{ color: config.color }}>
                          {config.icon}
                        </span>
                        <span className="kb-note-item__title">
                          {note.pinned && <Pin size={12} className="kb-note-item__pin" />}
                          {note.title}
                        </span>

                      </div>
                      <div className="kb-note-item__meta">
                        {isTrashView ? (
                          <>
                            <span className="kb-note-item__type-label kb-note-item__type-label--trash">
                              {note.deletedAt && formatDeletionInfo(note.deletedAt)}
                            </span>
                            <span className="kb-note-item__time">
                              <Clock size={12} />
                              删除于 {formatRelativeTime(note.deletedAt!)}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="kb-note-item__type-label">{config.label}</span>
                            <span className="kb-note-item__time">
                              <Clock size={12} />
                              {formatRelativeTime(note.updatedAt)}
                            </span>
                          </>
                        )}
                        {/* Note item actions */}
                        {!isTrashView && onTogglePin && (
                          <button 
                            className={`kb-note-item__action ${note.pinned ? 'kb-note-item__action--active' : ''}`}
                            onClick={(e) => { e.stopPropagation(); onTogglePin(note) }}
                            title={note.pinned ? '取消置顶' : '置顶'}
                          >
                            <Pin size={12} />
                          </button>
                        )}
                        {!isTrashView && onToggleStar && (
                          <button 
                            className={`kb-note-item__action ${note.starred ? 'kb-note-item__action--starred' : ''}`}
                            onClick={(e) => { e.stopPropagation(); onToggleStar(note) }}
                            title={note.starred ? '取消星标' : '添加星标'}
                          >
                            <Star size={12} fill={note.starred ? 'currentColor' : 'none'} />
                          </button>
                        )}
                        {!isTrashView && onDeleteNote && (
                          <button 
                            className="kb-note-item__action"
                            onClick={(e) => { e.stopPropagation(); onDeleteNote(note) }}
                            title="移到回收站"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                        {isTrashView && onRestoreNote && (
                          <button 
                            className="kb-note-item__action"
                            onClick={(e) => { e.stopPropagation(); onRestoreNote(note) }}
                            title="恢复笔记"
                          >
                            <RotateCcw size={12} />
                          </button>
                        )}
                        {isTrashView && onPermanentDelete && (
                          <button 
                            className="kb-note-item__action kb-note-item__action--danger"
                            onClick={(e) => { e.stopPropagation(); onPermanentDelete(note) }}
                            title="永久删除"
                          >
                            <Trash size={12} />
                          </button>
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </>
            )}
          </div>
          
          {/* Note List Toggle Button - Inside wrapper */}
          <button 
            className={`kb-panel-toggle kb-panel-toggle--right ${noteListCollapsed ? 'kb-panel-toggle--visible' : ''}`}
            onClick={onNoteListToggle}
            title={noteListCollapsed ? '展开笔记列表' : '折叠笔记列表'}
          >
            {noteListCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Editor Area */}
        <div className="kb-editor-area">
          {selectedNote ? (
            <>
              {/* Note Header - Shimo/Notion style */}
              <div className="kb-editor__header">
                <div className="kb-editor__meta-row">
                  {/* Clickable Note Type Badge */}
                  <div className="kb-editor__type-badge-wrapper">
                    <button 
                      className="kb-editor__type-badge" 
                      style={{ 
                        backgroundColor: `${getNoteTypeConfig(selectedNote.type).color}15`,
                        color: getNoteTypeConfig(selectedNote.type).color 
                      }}
                      onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                    >
                      {getNoteTypeConfig(selectedNote.type).icon}
                      <span>{getNoteTypeConfig(selectedNote.type).label}</span>
                      <ChevronDown size={12} />
                    </button>
                    
                    {/* Type Dropdown */}
                    {showTypeDropdown && (
                      <div className="kb-type-dropdown">
                        {Object.entries(NOTE_TYPE_CONFIG).map(([type, config]) => (
                          <button
                            key={type}
                            className={`kb-type-dropdown__item ${selectedNote.type === type ? 'kb-type-dropdown__item--active' : ''}`}
                            onClick={() => {
                              onNoteTypeChange?.(selectedNote.id, type as NoteType)
                              setShowTypeDropdown(false)
                            }}
                            style={{ color: config.color }}
                          >
                            {config.icon}
                            <span>{config.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <span className="kb-editor__status-badge">
                    {selectedNote.status === 'organized' ? (
                      <><Archive size={12} /> 已整理</>
                    ) : (
                      <><Inbox size={12} /> 待整理</>
                    )}
                  </span>
                  
                  {/* Must Read Toggle */}
                  <button
                    className={`kb-editor__must-read ${selectedNote.mustRead ? 'kb-editor__must-read--active' : ''}`}
                    onClick={() => {
                      // Use pending ref if available (for rapid clicks), otherwise use prop
                      const currentNote = pendingNoteRef.current?.id === selectedNote.id 
                        ? pendingNoteRef.current 
                        : selectedNote
                      handleNoteUpdate({
                        ...currentNote,
                        mustRead: !currentNote?.mustRead,
                        mustReadDate: !currentNote?.mustRead ? Date.now() : undefined
                      })
                    }}
                    title={selectedNote.mustRead ? '从今日必看中移除' : '加入今日必看'}
                  >
                    <span className="kb-editor__must-read-icon">📌</span>
                    <span>今日必看</span>
                  </button>
                  
                  {/* Custom Review Days */}
                  <div className="kb-editor__review-days">
                    <span className="kb-editor__review-days-label">回顾:</span>
                    <select
                      className="kb-editor__review-days-select"
                      value={selectedNote.customReviewDays || ''}
                      onChange={(e) => {
                        const days = e.target.value ? parseInt(e.target.value) : undefined
                        const updatedNote = {
                          ...selectedNote,
                          customReviewDays: days,
                          nextReviewAt: days ? Date.now() + days * 24 * 60 * 60 * 1000 : selectedNote.nextReviewAt
                        }
                        handleNoteUpdate(updatedNote)
                      }}
                      title="设置自定义回顾天数"
                    >
                      <option value="">系统默认</option>
                      <option value="1">1天后</option>
                      <option value="3">3天后</option>
                      <option value="7">7天后</option>
                      <option value="14">14天后</option>
                      <option value="30">30天后</option>
                      <option value="90">90天后</option>
                    </select>
                  </div>
                </div>
                
                <h1 className="kb-editor__title">{selectedNote.title}</h1>
                
                <div className="kb-editor__info-row">
                  <span className="kb-editor__time">
                    <Clock size={13} />
                    {formatRelativeTime(selectedNote.updatedAt)}
                  </span>
                  {/* Editable Tags */}
                  <div className="kb-editor__tags-container">
                    <div className="kb-editor__tags">
                      {selectedNote.tags.map(tag => (
                        <span key={tag} className="kb-tag kb-tag--editable">
                          {tag}
                          <button 
                            className="kb-tag__remove"
                            onClick={(e) => {
                              e.stopPropagation()
                              const updatedTags = selectedNote.tags.filter(t => t !== tag)
                              handleNoteUpdate({
                                ...selectedNote,
                                tags: updatedTags,
                                updatedAt: Date.now()
                              })
                            }}
                            title="删除标签"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                    {/* Add Tag Input */}
                    <div className="kb-editor__tag-input-wrapper">
                      <input
                        type="text"
                        className="kb-editor__tag-input"
                        placeholder="+ 添加标签"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const input = e.target as HTMLInputElement
                            const newTag = input.value.trim()
                            if (newTag && !selectedNote.tags.includes(newTag)) {
                              handleNoteUpdate({
                                ...selectedNote,
                                tags: [...selectedNote.tags, newTag],
                                updatedAt: Date.now()
                              })
                              input.value = ''
                            }
                          }
                        }}
                        onBlur={(e) => {
                          const newTag = e.target.value.trim()
                          if (newTag && !selectedNote.tags.includes(newTag)) {
                            handleNoteUpdate({
                              ...selectedNote,
                              tags: [...selectedNote.tags, newTag],
                              updatedAt: Date.now()
                            })
                            e.target.value = ''
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Editor - Edit/Preview modes only */}
              <div className="kb-editor__content">
                <TipTapEditor
                  ref={editorRef}
                  note={selectedNote}
                  notes={notes}
                  onChange={handleNoteUpdate}
                  onSave={() => {}}
                  viewMode={viewMode}
                  editorMode={editorMode}
                  onEditorModeChange={setEditorMode}
                />
              </div>
            </>
          ) : (
            <div className="kb-editor__empty">
              <FileText size={64} strokeWidth={1} />
              <p>选择一条笔记开始阅读或编辑</p>
              <p className="kb-editor__empty-hint">或者创建新的笔记</p>
            </div>
          )}
        </div>
      </div>

      {/* Version History Panel */}
      {showVersionHistory && selectedNote && (
        <VersionHistoryPanel
          note={selectedNote}
          onClose={() => setShowVersionHistory(false)}
          onRestore={(snapshot) => {
            if (snapshot) {
              handleNoteUpdate({
                ...selectedNote,
                content: snapshot.content,
                contentMarkdown: snapshot.contentMarkdown,
                updatedAt: Date.now(),
              })
              setShowVersionHistory(false)
            }
          }}
        />
      )}

      {/* Find Replace Modal */}
      <FindReplaceModal
        isOpen={showFindReplace}
        onClose={() => setShowFindReplace(false)}
        editorContent={selectedNote?.content || ''}
        attachments={selectedNote?.attachments?.map(id => ({ id, name: id, type: 'other' })) || []}
        onFind={(query) => {
          // 查找功能 - 可以在这里实现高亮匹配文本
          console.log('查找:', query)
        }}
        onReplace={(query, replacement) => {
          // 替换功能
          if (selectedNote && editorRef.current) {
            const newContent = selectedNote.content.replace(new RegExp(query, 'g'), replacement)
            handleNoteUpdate({
              ...selectedNote,
              content: newContent,
              updatedAt: Date.now(),
            })
          }
        }}
        onReplaceAll={(query, replacement) => {
          // 全部替换功能
          if (selectedNote && editorRef.current) {
            const newContent = selectedNote.content.replace(new RegExp(query, 'gi'), replacement)
            handleNoteUpdate({
              ...selectedNote,
              content: newContent,
              updatedAt: Date.now(),
            })
          }
        }}
      />
    </main>
  )
}

export default CenterPanel
