import React, { useState } from 'react'
import type { Note } from '../db/indexeddb'

interface InboxManagerProps {
  notes: Note[]
  folders: { id: string; name: string; icon?: string }[]
  tags: string[]
  onOrganize: (noteId: string, data: {
    folderId?: string
    tags: string[]
    type: Note['type']
    status: 'organized' | 'connected'
    title: string
  }) => void
  onDelete: (noteId: string) => void
  onEdit: (noteId: string) => void
  onBack: () => void
}

const InboxManager: React.FC<InboxManagerProps> = ({
  notes,
  folders,
  tags,
  onOrganize,
  onDelete,
  onEdit,
  onBack,
}) => {
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set())
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [filter, setFilter] = useState('')

  // Filter inbox notes
  const inboxNotes = notes.filter(n => n.status === 'inbox')
  const filteredNotes = filter
    ? inboxNotes.filter(n => 
        n.title.toLowerCase().includes(filter.toLowerCase()) ||
        n.content.toLowerCase().includes(filter.toLowerCase())
      )
    : inboxNotes

  // Toggle note selection
  const toggleSelect = (noteId: string) => {
    const newSet = new Set(selectedNotes)
    if (newSet.has(noteId)) {
      newSet.delete(noteId)
    } else {
      newSet.add(noteId)
    }
    setSelectedNotes(newSet)
  }

  // Select all
  const selectAll = () => {
    if (selectedNotes.size === filteredNotes.length) {
      setSelectedNotes(new Set())
    } else {
      setSelectedNotes(new Set(filteredNotes.map(n => n.id)))
    }
  }

  // Quick organize selected notes
  const quickOrganize = (folderId: string) => {
    selectedNotes.forEach(noteId => {
      const note = notes.find(n => n.id === noteId)
      if (note) {
        onOrganize(noteId, {
          folderId,
          tags: note.tags || [],
          type: note.type,
          status: 'organized',
          title: note.title,
        })
      }
    })
    setSelectedNotes(new Set())
  }

  // Format relative time
  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (minutes < 60) return `${minutes} 分钟前`
    if (hours < 24) return `${hours} 小时前`
    return `${days} 天前`
  }

  // Get plain content
  const getContent = (content: string) => {
    return content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  }

  return (
    <div className="ke-inbox-page">
      {/* Header */}
      <header className="ke-inbox-page__header">
        <button className="ke-inbox-page__back" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          <span>返回</span>
        </button>

        <div className="ke-inbox-page__title">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
            <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
          </svg>
          <span>草稿箱</span>
          <span className="ke-inbox-page__count">{inboxNotes.length}</span>
        </div>

        <div className="ke-inbox-page__actions">
          {selectedNotes.size > 0 && (
            <div className="ke-inbox-page__bulk">
              <span className="ke-inbox-page__selected">{selectedNotes.size} 已选</span>
              <div className="ke-inbox-page__folder-btns">
                {folders.map(f => (
                  <button
                    key={f.id}
                    className="ke-btn ke-btn--sm"
                    onClick={() => quickOrganize(f.id)}
                  >
                    移动到 {f.icon} {f.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Toolbar */}
      <div className="ke-inbox-page__toolbar">
        <div className="ke-inbox-page__search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="搜索草稿箱..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        {filteredNotes.length > 0 && (
          <label className="ke-inbox-page__select-all">
            <input
              type="checkbox"
              checked={selectedNotes.size === filteredNotes.length && filteredNotes.length > 0}
              onChange={selectAll}
            />
            <span>全选</span>
          </label>
        )}
      </div>

      {/* Note list */}
      <main className="ke-inbox-page__content">
        {filteredNotes.length === 0 ? (
          <div className="ke-inbox-page__empty">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
            </svg>
            <h3>草稿箱是空的</h3>
            <p>使用 📥 快速捕获来添加想法</p>
          </div>
        ) : (
          <div className="ke-inbox-list">
            {filteredNotes.map(note => (
              <div
                key={note.id}
                className={`ke-inbox-item ${selectedNotes.has(note.id) ? 'ke-inbox-item--selected' : ''}`}
              >
                {/* Selection checkbox */}
                <div className="ke-inbox-item__checkbox">
                  <input
                    type="checkbox"
                    checked={selectedNotes.has(note.id)}
                    onChange={() => toggleSelect(note.id)}
                  />
                </div>

                {/* Content */}
                <div 
                  className="ke-inbox-item__content"
                  onClick={() => setEditingNote(note)}
                >
                  <div className="ke-inbox-item__header">
                    <h3 className="ke-inbox-item__title">{note.title}</h3>
                    <span className="ke-inbox-item__time">{formatTime(note.updatedAt)}</span>
                  </div>
                  <p className="ke-inbox-item__excerpt">
                    {getContent(note.content).slice(0, 150)}
                    {getContent(note.content).length > 150 ? '...' : ''}
                  </p>
                  {note.tags && note.tags.length > 0 && (
                    <div className="ke-inbox-item__tags">
                      {note.tags.map(tag => (
                        <span key={tag} className="ke-inbox-item__tag">#{tag}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="ke-inbox-item__actions">
                  <button
                    className="ke-inbox-item__action"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingNote(note)
                    }}
                    title="整理"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button
                    className="ke-inbox-item__action ke-inbox-item__action--danger"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(note.id)
                    }}
                    title="删除"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Organize modal */}
      {editingNote && (
        <OrganizeModal
          note={editingNote}
          folders={folders}
          tags={tags}
          onSave={(data) => {
            onOrganize(editingNote.id, data)
            setEditingNote(null)
          }}
          onCancel={() => setEditingNote(null)}
        />
      )}
    </div>
  )
}

// Organize Modal Component
interface OrganizeModalProps {
  note: Note
  folders: { id: string; name: string; icon?: string }[]
  tags: string[]
  onSave: (data: {
    folderId?: string
    tags: string[]
    type: Note['type']
    status: 'organized' | 'connected'
    title: string
  }) => void
  onCancel: () => void
}

const OrganizeModal: React.FC<OrganizeModalProps> = ({
  note,
  folders,
  tags,
  onSave,
  onCancel,
}) => {
  const [title, setTitle] = useState(note.title)
  const [folderId, setFolderId] = useState<string | undefined>(note.folderId)
  const [selectedTags, setSelectedTags] = useState<string[]>(note.tags || [])
  const [type, setType] = useState<Note['type']>(note.type)
  const [newTag, setNewTag] = useState('')

  const noteTypes = [
    { value: 'idea', label: '💡 想法', desc: '灵感、创意、观点' },
    { value: 'concept', label: '🧠 概念', desc: '定义、原理、知识' },
    { value: 'practice', label: '🧪 实践', desc: '方法论、步骤、实验' },
    { value: 'reading', label: '📖 读书笔记', desc: '书籍、文章摘要' },
    { value: 'card', label: '📌 卡片', desc: '可回顾的知识点' },
    { value: 'tutorial', label: '📚 教程', desc: '学习指南、步骤' },
    { value: 'project', label: '🚀 项目', desc: '项目记录、进展' },
    { value: 'other', label: '📋 其他', desc: '其他内容' },
  ]

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag))
    } else {
      setSelectedTags([...selectedTags, tag])
    }
  }

  const addNewTag = () => {
    if (newTag.trim() && !selectedTags.includes(newTag.trim())) {
      setSelectedTags([...selectedTags, newTag.trim()])
      setNewTag('')
    }
  }

  const handleSave = () => {
    onSave({
      folderId,
      tags: selectedTags,
      type,
      status: folderId ? 'organized' : 'connected',
      title,
    })
  }

  return (
    <>
      <div className="ke-modal-overlay" onClick={onCancel} />
      <div className="ke-modal ke-modal--organize">
        <div className="ke-modal__header">
          <h3>整理笔记</h3>
          <button className="ke-modal__close" onClick={onCancel}>✕</button>
        </div>

        <div className="ke-modal__body">
          {/* Title */}
          <div className="ke-form-group">
            <label>标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="笔记标题"
            />
          </div>

          {/* Note Type */}
          <div className="ke-form-group">
            <label>类型</label>
            <div className="ke-type-selector">
              {noteTypes.map(t => (
                <button
                  key={t.value}
                  className={`ke-type-btn ${type === t.value ? 'ke-type-btn--active' : ''}`}
                  onClick={() => setType(t.value as Note['type'])}
                >
                  <span>{t.label}</span>
                  <span className="ke-type-btn__desc">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Folder */}
          <div className="ke-form-group">
            <label>文件夹</label>
            <div className="ke-folder-selector">
              <button
                className={`ke-folder-btn ${!folderId ? 'ke-folder-btn--active' : ''}`}
                onClick={() => setFolderId(undefined)}
              >
                📁 根目录
              </button>
              {folders.map(f => (
                <button
                  key={f.id}
                  className={`ke-folder-btn ${folderId === f.id ? 'ke-folder-btn--active' : ''}`}
                  onClick={() => setFolderId(f.id)}
                >
                  {f.icon} {f.name}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="ke-form-group">
            <label>标签</label>
            <div className="ke-tag-input">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addNewTag()}
                placeholder="添加标签后按 Enter"
              />
              <button onClick={addNewTag}>添加</button>
            </div>
            
            {selectedTags.length > 0 && (
              <div className="ke-tag-list">
                {selectedTags.map(tag => (
                  <span key={tag} className="ke-tag">
                    #{tag}
                    <button onClick={() => toggleTag(tag)}>×</button>
                  </span>
                ))}
              </div>
            )}

            {tags.filter(t => !selectedTags.includes(t)).length > 0 && (
              <div className="ke-tag-suggestions">
                <span>推荐：</span>
                {tags.filter(t => !selectedTags.includes(t)).slice(0, 5).map(tag => (
                  <button key={tag} onClick={() => setSelectedTags([...selectedTags, tag])}>
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="ke-modal__footer">
          <button className="ke-btn ke-btn--outline" onClick={onCancel}>取消</button>
          <button className="ke-btn ke-btn--primary" onClick={handleSave}>完成整理</button>
        </div>
      </div>
    </>
  )
}

export default InboxManager
