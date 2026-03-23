import React, { useState } from 'react'
import { Inbox, Star, Folder, Tag, Globe, Calendar, Trash2, Plus, PanelLeftClose, PanelLeft, X, Check } from 'lucide-react'
import type { Folder as FolderType, LeftNavSection } from '../types'

interface LeftNavProps {
  folders: FolderType[]
  tags: string[]
  tagCounts?: Record<string, number>
  mustReadNotes?: { id: string; title: string }[]
  inboxCount: number
  trashCount?: number
  selectedNav: LeftNavSection | string
  selectedFolderId: string
  onNavSelect: (nav: string) => void
  onFolderSelect: (id: string) => void
  onFolderCreate?: (name: string) => void
  onTagClick: (tag: string) => void
  onMustReadClick?: (noteId: string) => void
  onGraphClick: () => void
  onTimelineClick: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}

const ICON_SIZE = 18

interface NavItemProps {
  icon: React.ReactNode
  label: string
  badge?: number
  active?: boolean
  onClick: () => void
  collapsed?: boolean
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, badge, active, onClick, collapsed }) => (
  <button
    className={`kb-nav-item ${active ? 'kb-nav-item--active' : ''}`}
    onClick={onClick}
  >
    <span className="kb-nav-item__icon">{icon}</span>
    {!collapsed && <span className="kb-nav-item__label">{label}</span>}
    {badge !== undefined && badge > 0 && (
      <span className="kb-nav-item__badge">{badge}</span>
    )}
  </button>
)

interface FolderItemProps {
  folder: FolderType
  active?: boolean
  onClick: () => void
  collapsed?: boolean
}

const FolderItem: React.FC<FolderItemProps> = ({ folder, active, onClick, collapsed }) => (
  <button
    className={`kb-folder-item ${active ? 'kb-folder-item--active' : ''}`}
    onClick={onClick}
  >
    <span className="kb-folder-item__icon">
      <Folder size={ICON_SIZE} color={active ? 'var(--ke-primary)' : 'var(--ke-text-secondary)'} />
    </span>
    {!collapsed && <span className="kb-folder-item__name">{folder.name}</span>}
  </button>
)

export const LeftNav: React.FC<LeftNavProps> = ({
  folders,
  tags,
  tagCounts = {},
  mustReadNotes = [],
  inboxCount,
  trashCount = 0,
  selectedNav,
  selectedFolderId,
  onNavSelect,
  onFolderSelect,
  onFolderCreate,
  onTagClick,
  onMustReadClick,
  onGraphClick,
  onTimelineClick,
  collapsed,
  onToggleCollapse,
}) => {
  // Sort folders by creation time (newest first)
  const sortedFolders = [...folders].sort((a, b) => {
    const aTime = a.createdAt || parseInt(a.id.replace(/\D/g, '')) || 0
    const bTime = b.createdAt || parseInt(b.id.replace(/\D/g, '')) || 0
    return bTime - aTime
  })
  
  const mainFolders = sortedFolders.filter(f => !f.parentId || f.parentId === 'root')
  
  // Sort tags by frequency (descending)
  const sortedTags = tags
    .map(tag => ({ tag, count: tagCounts[tag] || 0 }))
    .sort((a, b) => b.count - a.count)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const handleCreateFolder = () => {
    if (newFolderName.trim() && onFolderCreate) {
      onFolderCreate(newFolderName.trim())
      setNewFolderName('')
      setIsCreatingFolder(false)
    }
  }

  const handleCancelCreate = () => {
    setNewFolderName('')
    setIsCreatingFolder(false)
  }

  return (
    <div className="kb-left-nav-container">
      <aside className={`kb-left-nav ${collapsed ? 'kb-left-nav--collapsed' : ''}`}>
        {/* Main Navigation */}
        <div className="kb-left-nav__content">
          <div className="kb-left-nav__section">
            <NavItem
              icon={<Inbox size={ICON_SIZE} color={selectedNav === 'inbox' ? 'var(--ke-primary)' : 'var(--ke-text-secondary)'} />}
              label="草稿箱"
              badge={inboxCount}
              active={selectedNav === 'inbox'}
              onClick={() => onNavSelect('inbox')}
              collapsed={collapsed}
            />
            <NavItem
              icon={<Star size={ICON_SIZE} color={selectedNav === 'starred' ? 'var(--ke-primary)' : 'var(--ke-text-secondary)'} />}
              label="星标笔记"
              active={selectedNav === 'starred'}
              onClick={() => onNavSelect('starred')}
              collapsed={collapsed}
            />
          </div>
        </div>

        {/* Today Must-Read Section */}
        {mustReadNotes.length > 0 && (
          <div className="kb-left-nav__section">
            <div className="kb-left-nav__header">
              <span className={`kb-left-nav__header-text ${collapsed ? 'kb-left-nav__header-text--hidden' : ''}`}>
                <span>📌</span>
                <span>今日必读</span>
              </span>
              <span className="kb-left-nav__badge">{mustReadNotes.length}</span>
            </div>
            <div className="kb-must-read-list">
              {mustReadNotes.map(note => (
                <button
                  key={note.id}
                  className="kb-must-read-item"
                  onClick={() => onMustReadClick?.(note.id)}
                  title={note.title}
                >
                  <span className="kb-must-read-item__title">{note.title || '无标题'}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tags - Moved up with frequency sorting and scrollbar */}
        <div className="kb-left-nav__section">
          <div className="kb-left-nav__header">
            <span className={`kb-left-nav__header-text ${collapsed ? 'kb-left-nav__header-text--hidden' : ''}`}>
              <Tag size={14} />
              <span>标签</span>
            </span>
          </div>
          <div className="kb-tag-cloud kb-tag-cloud--scrollable">
            {sortedTags.map(({ tag, count }) => (
              <button
                key={tag}
                className="kb-tag kb-tag--clickable kb-tag--with-count"
                onClick={() => onTagClick(tag)}
                title={`${tag} (${count} 条笔记)`}
              >
                <span className="kb-tag__name">{tag}</span>
                <span className="kb-tag__count">{count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Folders - Below starred notes with creation time sorting */}
        <div className="kb-left-nav__section">
          <div className="kb-left-nav__header">
            <span className={`kb-left-nav__header-text ${collapsed ? 'kb-left-nav__header-text--hidden' : ''}`}>
              <Folder size={14} />
              <span>文件夹</span>
            </span>
            <button 
              className="kb-left-nav__add-btn" 
              title="新建文件夹"
              onClick={() => setIsCreatingFolder(true)}
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="kb-folder-list">
            {isCreatingFolder ? (
              <div className="kb-folder-create">
                <input
                  type="text"
                  className="kb-folder-create__input"
                  placeholder="文件夹名称"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateFolder()
                    if (e.key === 'Escape') handleCancelCreate()
                  }}
                  autoFocus
                />
                <button className="kb-folder-create__btn" onClick={handleCreateFolder} title="确认">
                  <Check size={14} />
                </button>
                <button className="kb-folder-create__btn kb-folder-create__btn--cancel" onClick={handleCancelCreate} title="取消">
                  <X size={14} />
                </button>
              </div>
            ) : null}
            {mainFolders.map(folder => (
              <FolderItem
                key={folder.id}
                folder={folder}
                collapsed={collapsed}
                active={selectedNav === 'folders' && selectedFolderId === folder.id}
                onClick={() => onFolderSelect(folder.id)}
              />
            ))}
          </div>
        </div>

        {/* Views */}
        <div className="kb-left-nav__section">
          <div className="kb-left-nav__header">
            <span className="kb-left-nav__header-text">视图</span>
          </div>
          <NavItem
            icon={<Globe size={ICON_SIZE} color={selectedNav === 'network' ? 'var(--ke-primary)' : 'var(--ke-text-secondary)'} />}
            label="知识网络"
            active={selectedNav === 'network'}
            onClick={onGraphClick}
            collapsed={collapsed}
          />
          <NavItem
            icon={<Calendar size={ICON_SIZE} color={selectedNav === 'timeline' ? 'var(--ke-primary)' : 'var(--ke-text-secondary)'} />}
            label="时间轴"
            active={selectedNav === 'timeline'}
            onClick={onTimelineClick}
            collapsed={collapsed}
          />
        </div>

        {/* Bottom */}
        <div className="kb-left-nav__section kb-left-nav__section--bottom">
          <NavItem
            icon={<Trash2 size={ICON_SIZE} color={selectedNav === 'trash' ? 'var(--ke-primary)' : 'var(--ke-text-secondary)'} />}
            label="回收站"
            badge={trashCount}
            active={selectedNav === 'trash'}
            onClick={() => onNavSelect('trash')}
            collapsed={collapsed}
          />
        </div>
      </aside>
      
      {/* Collapse Toggle Button - Right Side */}
      <button 
        className={`kb-panel-toggle kb-panel-toggle--left ${collapsed ? 'kb-panel-toggle--visible' : ''}`}
        onClick={onToggleCollapse}
        title={collapsed ? '展开导航' : '折叠导航'}
      >
        {collapsed ? <PanelLeft size={14} /> : <PanelLeftClose size={14} />}
      </button>
    </div>
  )
}

export default LeftNav
