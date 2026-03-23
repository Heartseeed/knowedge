import React, { useState, useMemo, useEffect, useRef } from 'react'
import Header from '../components/layout/Header'
import { BrandHero } from '../components/dashboard/BrandLogo'
import TodayActions from '../components/dashboard/TodayActions'
import RecentNotes from '../components/dashboard/RecentNotes'
import KnowledgeFlow from '../components/dashboard/KnowledgeFlow'
import SmartReview from '../components/dashboard/SmartReview'
import ActivityHeatmap from '../components/dashboard/ActivityHeatmap'
import QuickAccess from '../components/dashboard/QuickAccess'
import FloatingCapture from '../components/dashboard/FloatingCapture'
import CtaBanner from '../components/dashboard/CtaBanner'
import { initDB, type Note } from '../db/indexeddb'
import { addNote, generateId } from '../db/indexeddb'
import SimpleSearch from '../search'

type SearchDim = 'all' | 'title' | 'content' | 'tag' | 'folder' | 'category'

interface DashboardProps {
  onNavigate?: (view: string, noteId?: string) => void
  notes?: Note[]
  onNoteSelect?: (noteId: string, note?: Note) => void
  onCapture?: (content: string) => void
  onShowSearch?: () => void
  onOpenSettings?: () => void
  syncStatus?: 'local' | 'syncing' | 'synced'
  onAuthClick?: () => void
  currentUser?: { email?: string } | null
}

// Compute heatmap data from notes (last 365 days)
const computeHeatmapData = (notes: Note[]) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dataMap: Record<string, number> = {}
  
  // Initialize last 30 days with at least some sample data if empty
  for (let i = 0; i < 30; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    dataMap[dateStr] = 0
  }
  
  // Count notes per day from real data
  notes.forEach(note => {
    const d = new Date(note.updatedAt)
    d.setHours(0, 0, 0, 0)
    const dateStr = d.toISOString().split('T')[0]
    if (dataMap[dateStr] !== undefined) {
      dataMap[dateStr]++
    }
  })
  
  return Object.entries(dataMap).map(([date, count]) => ({ date, count }))
}

const NOTE_TYPE_ICONS: Record<string, string> = {
  concept: '🧠', reading: '📘', practice: '🧪', idea: '💡', card: '📌', note: '📝',
}

const formatRelativeTime = (ts: number): string => {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  const hr = Math.floor(diff / 3600000)
  const day = Math.floor(diff / 86400000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  if (hr < 24) return `${hr} 小时前`
  return `${day} 天前`
}

// Folder name mapping for search
const FOLDER_NAMES: Record<string, string> = {
  'root': '知识库',
  'work': '工作',
  'study': '学习',
  'life': '生活',
}

// Category/type name mapping for search
const CATEGORY_NAMES: Record<string, string> = {
  'concept': '概念',
  'reading': '读书笔记',
  'practice': '实践',
  'idea': '想法',
  'card': '卡片',
  'tutorial': '教程',
  'project': '项目',
}

function filterByDim(notes: Note[], query: string, dim: SearchDim): Note[] {
  const q = query.toLowerCase().trim()
  if (!q) return []
  return notes.filter(note => {
    switch (dim) {
      case 'title': 
        return note.title.toLowerCase().includes(q)
      case 'content': {
        const text = (note.content || '').replace(/<[^>]+>/g, '').toLowerCase()
        return text.includes(q)
      }
      case 'tag': 
        return (note.tags || []).some(t => t.toLowerCase().includes(q))
      case 'folder': {
        const folderId = note.folderId || 'root'
        const folderName = FOLDER_NAMES[folderId] || folderId
        return folderName.toLowerCase().includes(q) || folderId.toLowerCase().includes(q)
      }
      case 'category': {
        const typeName = CATEGORY_NAMES[note.type] || note.type
        return typeName.toLowerCase().includes(q) || note.type.toLowerCase().includes(q)
      }
      default:
        return (
          note.title.toLowerCase().includes(q) ||
          (note.content || '').replace(/<[^>]+>/g, '').toLowerCase().includes(q) ||
          (note.tags || []).some(t => t.toLowerCase().includes(q))
        )
    }
  })
}

const Dashboard: React.FC<DashboardProps> = ({
  onNavigate,
  notes: externalNotes = [],
  onNoteSelect,
  onCapture,
  onOpenSettings,
  syncStatus,
  onAuthClick,
  currentUser,
}) => {
  const [allNotes, setAllNotes] = useState<Note[]>(externalNotes)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchDim, setSearchDim] = useState<SearchDim>('all')
  const [searchResults, setSearchResults] = useState<Note[]>([])
  const [showResults, setShowResults] = useState(false)
  const [captureOpen, setCaptureOpen] = useState(false)
  const [showDimDropdown, setShowDimDropdown] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const dimDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (externalNotes.length > 0) setAllNotes(externalNotes) }, [externalNotes])

  useEffect(() => {
    const load = async () => {
      try {
        await initDB.init()
        const all = await initDB.getAllNotes()
        if (all && all.length > 0) { setAllNotes(all); SimpleSearch.build(all) }
      } catch { /* use empty */ }
    }
    load()
  }, [])

  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      setSearchResults(filterByDim(allNotes, searchQuery, searchDim))
      setShowResults(true)
    } else {
      setSearchResults([])
      setShowResults(false)
    }
  }, [searchQuery, searchDim, allNotes])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false)
      if (dimDropdownRef.current && !dimDropdownRef.current.contains(e.target as Node)) setShowDimDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        if (e.shiftKey) { e.preventDefault(); setCaptureOpen(true) }
        else {
          e.preventDefault()
          const input = document.querySelector('.ke-hero__search-input') as HTMLInputElement
          input?.focus()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) { setShowResults(false); onNavigate?.('knowledge-base', searchQuery) }
  }

  const handleResultClick = (noteId: string) => {
    setShowResults(false); setSearchQuery('')
    if (onNoteSelect) onNoteSelect(noteId)
    else onNavigate?.('knowledge-base', noteId)
  }

  const handleTopicSearch = (tag: string) => {
    // 导航到知识库并传递标签参数
    onNavigate?.('knowledge-base', `tag:${tag}`)
  }

  const handleCapture = async (content: string) => {
    try {
      const now = Date.now()
      const newNoteId = generateId('n')
      const newNote: Note = {
        id: newNoteId,
        title: content.slice(0, 50).replace(/<[^>]+>/g, '') || '新笔记',
        content: `<p>${content}</p>`,
        type: 'idea', status: 'inbox',
        createdAt: now, updatedAt: now,
        tags: [], links: [],
        reviewCount: 0, nextReviewAt: 0, easeFactor: 2.5, interval: 1,
      }
      await addNote(newNote)
      const all = await initDB.getAllNotes()
      setAllNotes(all || [])
      // Navigate to knowledge base with the new note
      onNoteSelect?.(newNoteId)
      onNavigate?.('knowledge-base')
    } catch { /* silently fail */ }
    setCaptureOpen(false)
    onCapture?.(content)
  }

  const recentNotes = useMemo(() => [...allNotes]
    .filter(n => !n.deletedAt)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 5), [allNotes])
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    allNotes.forEach(n => n.tags?.forEach(t => { counts[t] = (counts[t] || 0) + 1 }))
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [allNotes])
  const heatmapData = useMemo(() => computeHeatmapData(allNotes), [allNotes])
  const now = Date.now()
  const reviewStats = useMemo(() => ({
    todayCount: allNotes.filter(n => n.nextReviewAt && n.nextReviewAt > now && n.nextReviewAt <= now + 86400000).length,
    overdueCount: allNotes.filter(n => n.nextReviewAt && n.nextReviewAt < now).length,
    inboxCount: allNotes.filter(n => n.status === 'inbox').length,
  }), [allNotes])

  return (
    <div className="ke-app">
      <Header 
  onCapture={() => setCaptureOpen(true)} 
  onSettingsClick={onOpenSettings}
  onAuthClick={onAuthClick}
  currentUser={currentUser}
  syncStatus={syncStatus}
/>

      <main className="ke-main">
        <div className="ke-dashboard">
          <section className="ke-hero">
            <BrandHero iconSize={56} />

            <div className="ke-hero__search" ref={searchRef}>
              <form onSubmit={handleSearchSubmit}>
                <div className="ke-hero__search-row">
                  <svg className="ke-hero__search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  {/* Dimension Dropdown - After search icon */}
                  <div className="ke-hero__dim-dropdown" ref={dimDropdownRef}>
                    <button 
                      className="ke-hero__dim-btn"
                      onClick={() => setShowDimDropdown(!showDimDropdown)}
                      type="button"
                    >
                      <span>{searchDim === 'all' ? '全部' : searchDim === 'title' ? '标题' : searchDim === 'content' ? '内容' : searchDim === 'tag' ? '标签' : searchDim === 'folder' ? '文件夹' : '类别'}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </button>
                    {showDimDropdown && (
                      <div className="ke-hero__dim-menu">
                        {(['all', 'title', 'content', 'tag', 'folder', 'category'] as SearchDim[]).map(dim => (
                          <button
                            key={dim}
                            className={`ke-hero__dim-option ${searchDim === dim ? 'active' : ''}`}
                            onClick={() => { setSearchDim(dim); setShowDimDropdown(false); if (searchQuery.trim()) setShowResults(true) }}
                            type="button"
                          >
                            {dim === 'all' ? '全部' 
                             : dim === 'title' ? '标题' 
                             : dim === 'content' ? '内容' 
                             : dim === 'tag' ? '标签'
                             : dim === 'folder' ? '文件夹'
                             : '类别'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    className="ke-hero__search-input"
                    placeholder="搜索笔记、标签、内容..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onFocus={() => searchQuery.trim() && setShowResults(true)}
                  />
                  <button type="submit" className="ke-hero__search-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                    <span>搜索</span>
                  </button>
                </div>
              </form>

              {/* Search Results Dropdown */}
              {showResults && (
                <div className="ke-hero__search-results">
                  {searchResults.length > 0 ? (
                    searchResults.slice(0, 8).map(note => {
                      // Highlight matching text
                      const query = searchQuery.toLowerCase().trim()
                      const highlightMatch = (text: string) => {
                        if (!query || !text) return text
                        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
                        return text.replace(regex, '<mark class="ke-hero__search-highlight">$1</mark>')
                      }
                      
                      // Get content excerpt with highlight
                      const getExcerpt = () => {
                        const contentText = (note.content || '').replace(/<[^>]+>/g, '')
                        if (searchDim === 'content' && contentText.toLowerCase().includes(query)) {
                          const index = contentText.toLowerCase().indexOf(query)
                          const start = Math.max(0, index - 30)
                          const end = Math.min(contentText.length, index + query.length + 30)
                          const excerpt = contentText.slice(start, end)
                          return (start > 0 ? '...' : '') + highlightMatch(excerpt) + (end < contentText.length ? '...' : '')
                        }
                        return contentText.slice(0, 60) + (contentText.length > 60 ? '...' : '')
                      }
                      
                      return (
                        <div
                          key={note.id}
                          className="ke-hero__search-result"
                          onClick={() => handleResultClick(note.id)}
                        >
                          <span className="ke-hero__result-icon">{NOTE_TYPE_ICONS[note.type] || '📝'}</span>
                          <div className="ke-hero__result-info">
                            <div 
                              className="ke-hero__result-title"
                              dangerouslySetInnerHTML={{ __html: highlightMatch(note.title) || '无标题' }}
                            />
                            <div className="ke-hero__result-meta">
                              <span dangerouslySetInnerHTML={{ __html: getExcerpt() }} />
                              <span className="ke-hero__result-separator">·</span>
                              <span>{formatRelativeTime(note.updatedAt)}</span>
                              {note.tags?.slice(0, 2).map(t => (
                                <span key={t} className="ke-hero__result-tag">#{t}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="ke-hero__search-empty">
                      <div>未找到与 "{searchQuery}" 相关的结果</div>
                      <div className="ke-hero__search-empty-hint">试试其他关键词或创建新笔记</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ========== SECTION 2: Today Actions ========== */}
          <TodayActions
            reviewCount={reviewStats.overdueCount + reviewStats.todayCount}
            draftCount={Math.max(0, allNotes.filter(n => n.status !== 'connected').length)}
            onReviewClick={() => onNavigate?.('review')}
            onDraftClick={() => onNavigate?.('inbox')}
            onNewNote={async () => {
              // Create a new note and navigate to knowledge base
              const newNoteId = 'n' + Date.now()
              const newNote: Note = {
                id: newNoteId,
                title: '新想法',
                content: '',
                type: 'idea',
                status: 'inbox',
                folderId: undefined,
                tags: [],
                links: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
                reviewCount: 0,
                nextReviewAt: Date.now(),
                easeFactor: 2.5,
                interval: 1,
              }
              try {
                // Add to notes
                await addNote(newNote)
                // Update local state
                setAllNotes(prev => [newNote, ...prev])
                // Navigate and select (pass note to parent)
                onNoteSelect?.(newNoteId, newNote)
                onNavigate?.('knowledge-base')
              } catch (error) {
                console.error('Failed to create note:', error)
              }
            }}
          />

          {/* ========== SECTION 3: Three Widgets ========== */}
          <div className="ke-dashboard__widgets">
            <RecentNotes
              notes={recentNotes.map(n => ({ id: n.id, title: n.title, updatedAt: n.updatedAt }))}
              onNoteClick={(id) => handleResultClick(id)}
              onViewAll={() => onNavigate?.('knowledge-base')}
            />
            <KnowledgeFlow
              topics={tagCounts.map(([name, count]) => ({ id: name, name, noteCount: count }))}
              recommendations={recentNotes.slice(0, 3).map(n => ({ id: n.id, title: n.title }))}
              onTopicClick={(id) => handleTopicSearch(id)}
              onLinkClick={(id) => handleResultClick(id)}
            />
            <SmartReview
              todayCount={reviewStats.todayCount}
              overdueCount={reviewStats.overdueCount}
              newUnreviewedCount={reviewStats.inboxCount}
              todayList={allNotes.filter(n => n.nextReviewAt && n.nextReviewAt > Date.now() && n.nextReviewAt <= Date.now() + 86400000).slice(0, 3).map(n => ({ id: n.id, title: n.title, dueCount: 1 }))}
              overdueList={allNotes.filter(n => n.nextReviewAt && n.nextReviewAt < Date.now()).slice(0, 2).map(n => ({ id: n.id, title: n.title }))}
              onStartReview={() => onNavigate?.('review')}
              onItemClick={(id) => handleResultClick(id)}
            />
          </div>

          {/* ========== SECTION 4: Heatmap ========== */}
          <ActivityHeatmap data={heatmapData} onDayClick={(date) => console.log('Day clicked:', date)} />

          {/* ========== SECTION 5: Quick Access ========== */}
          <QuickAccess
            onNewNote={async () => {
              // Create a new note and navigate to knowledge base
              const newNoteId = 'n' + Date.now()
              const newNote: Note = {
                id: newNoteId,
                title: '新笔记',
                content: '',
                type: 'note',
                status: 'inbox',
                folderId: undefined,
                tags: [],
                links: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
                reviewCount: 0,
                nextReviewAt: Date.now(),
                easeFactor: 2.5,
                interval: 1,
              }
              try {
                // Add to notes
                await addNote(newNote)
                // Update local state
                setAllNotes(prev => [newNote, ...prev])
                // Navigate and select (pass note to parent)
                onNoteSelect?.(newNoteId, newNote)
                onNavigate?.('knowledge-base')
              } catch (error) {
                console.error('Failed to create note:', error)
              }
            }}
            onInbox={() => onNavigate?.('inbox')}
            onGraph={() => onNavigate?.('graph')}
            onTimeline={() => onNavigate?.('timeline')}
          />

          {/* ========== SECTION 6: CTA Banner ========== */}
          <CtaBanner onNavigate={() => onNavigate?.('knowledge-base')} noteCount={allNotes.length} />
        </div>
      </main>

      <FloatingCapture 
        onCapture={handleCapture} 
        isOpen={captureOpen}
        onOpenChange={setCaptureOpen}
      />
    </div>
  )
}

export default Dashboard
                   
