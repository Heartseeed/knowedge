import React, { useEffect, useState, useContext, useCallback, useMemo } from 'react'
import type { Folder, Tag, LeftNavSection, ReviewItem } from './types'
import { IndexedDBAdapter } from './db'
import { initDB, generateId } from '../db/indexeddb'
import type { Note as NoteType } from '../db/indexeddb'

// Re-export Note type
export type Note = NoteType

type KBContextValue = {
  folders: Folder[]
  notes: Note[]
  tags: Tag[]
  reviewItems: ReviewItem[]
  activeSection: LeftNavSection
  selectedFolderId: string | null
  selectedNoteId: string | null
  setActiveSection: (s: LeftNavSection) => void
  selectFolder: (id: string | null) => void
  selectNote: (id: string | null) => void
  saveNote: (note: Note) => void
  createNote: (folderId?: string) => void
  deleteNote: (id: string) => void
  toggleStar: (id: string) => void
  selectedNote: Note | null
  filteredNotes: Note[]
  inboxCount: number
}

const KBContext = React.createContext<KBContextValue | undefined>(undefined)

const now = Date.now()
const day = 86400000

const SEED_FOLDERS: Folder[] = [
  { id: 'f1', name: '工作', icon: '💼' },
  { id: 'f2', name: '学习', icon: '📚' },
  { id: 'f3', name: '生活', icon: '🏠' },
]

const SEED_NOTES: Note[] = [
  {
    id: 'n1', title: '认知负载理论', content: '认知负载理论认为人类工作记忆容量有限...',
    type: 'concept', status: 'connected', folderId: 'f2', tags: ['认知', '学习'],
    links: ['n2'], createdAt: now - 2 * day, updatedAt: now - 3 * 60 * 1000,
    reviewCount: 3, nextReviewAt: now + day, easeFactor: 2.5, interval: 7,
  },
  {
    id: 'n2', title: '费曼学习法', content: '选择一个概念，用简单的话解释它...',
    type: 'practice', status: 'connected', folderId: 'f2', tags: ['学习', '方法'],
    links: ['n1', 'n3'], createdAt: now - 5 * day, updatedAt: now - day,
    reviewCount: 5, nextReviewAt: now - 1 * day, easeFactor: 2.8, interval: 14,
  },
  {
    id: 'n3', title: 'AI 助手使用技巧', content: '用清晰的任务描述...',
    type: 'reading', status: 'organized', folderId: 'f1', tags: ['AI', '工具'],
    links: [], createdAt: now - 3 * day, updatedAt: now - 2 * day,
    reviewCount: 1, nextReviewAt: now + 3 * day, easeFactor: 2.3, interval: 3,
  },
  {
    id: 'n4', title: '番茄工作法实践', content: '设定25分钟专注工作...',
    type: 'practice', status: 'connected', folderId: 'f3', tags: ['效率'],
    links: ['n2'], createdAt: now - 7 * day, updatedAt: now - 4 * day,
    reviewCount: 8, nextReviewAt: now - 2 * day, easeFactor: 3.0, interval: 30,
  },
  {
    id: 'n5', title: '知识图谱构建思路', content: '双链笔记的核心价值在于...',
    type: 'idea', status: 'organized', folderId: 'f2', tags: ['知识管理', 'AI'],
    links: ['n1'], createdAt: now - 1 * day, updatedAt: now - 30 * 60 * 1000,
    reviewCount: 0, nextReviewAt: now + 1 * day, easeFactor: 2.5, interval: 1,
  },
  {
    id: 'n6', title: '随手记：关于主动回忆', content: '主动回忆比被动阅读效果好3倍...',
    type: 'card', status: 'inbox', folderId: undefined, tags: [],
    links: [], createdAt: now - 2 * 60 * 60 * 1000, updatedAt: now - 2 * 60 * 60 * 1000,
    reviewCount: 0, nextReviewAt: now, easeFactor: 2.5, interval: 1,
  },
  {
    id: 'n7', title: '待整理：学习方法对比', content: '间隔重复 vs 集中练习...',
    type: 'card', status: 'inbox', folderId: undefined, tags: [],
    links: [], createdAt: now - 4 * 60 * 60 * 1000, updatedAt: now - 4 * 60 * 60 * 1000,
    reviewCount: 0, nextReviewAt: now, easeFactor: 2.5, interval: 1,
  },
]

export const KnowledgeBaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [folders] = useState<Folder[]>(SEED_FOLDERS)
  const [notes, setNotes] = useState<Note[]>(SEED_NOTES)
  const [activeSection, setActiveSection] = useState<LeftNavSection>('folders')
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)

  const adapter = useMemo(() => new IndexedDBAdapter(), [])
  useEffect(() => { adapter.open() }, [adapter])

  const selectFolder = useCallback((id: string | null) => {
    setSelectedFolderId(id)
    setActiveSection('folders')
  }, [])

  const selectNote = useCallback((id: string | null) => {
    setSelectedNoteId(id)
  }, [])

  const saveNote = useCallback((note: Note) => {
    setNotes((prev: Note[]) => {
      const idx = prev.findIndex((n: Note) => n.id === note.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...note, updatedAt: Date.now() }
        return next
      }
      return [{ ...note, createdAt: Date.now(), updatedAt: Date.now() }, ...prev]
    })
  }, [])

  const createNote = useCallback((folderId?: string) => {
    const id = 'n' + Date.now()
    const note: Note = {
      id, title: '新笔记', content: '', type: 'concept', status: 'inbox',
      folderId: folderId, tags: [], links: [],
      createdAt: Date.now(), updatedAt: Date.now(),
      reviewCount: 0, nextReviewAt: Date.now(), easeFactor: 2.5, interval: 1,
    }
    setNotes((prev: Note[]) => [note, ...prev])
    setSelectedNoteId(id)
  }, [])

  const deleteNote = useCallback((id: string) => {
    setNotes((prev: Note[]) => prev.filter((n: Note) => n.id !== id))
    if (selectedNoteId === id) setSelectedNoteId(null)
  }, [selectedNoteId])

  const toggleStar = useCallback((id: string) => {
    setNotes((prev: Note[]) => prev.map((n: Note) => n.id === id ? { ...n, updatedAt: Date.now() } : n))
  }, [])

  const selectedNote = useMemo<Note | null>(() =>
    notes.find((n: Note) => n.id === selectedNoteId) || null,
    [notes, selectedNoteId]
  )

  const filteredNotes = useMemo<Note[]>(() => {
    switch (activeSection) {
      case 'inbox': return notes.filter((n: Note) => n.status === 'inbox')
      case 'starred': return notes.filter((n: Note) => n.starred && !n.deletedAt)
      case 'trash': return []
      case 'network': return notes
      case 'timeline': return [...notes].sort((a: Note, b: Note) => b.updatedAt - a.updatedAt)
      default:
        return selectedFolderId
          ? notes.filter((n: Note) => n.folderId === selectedFolderId)
          : notes
    }
  }, [notes, activeSection, selectedFolderId])

  const inboxCount = useMemo(() =>
    notes.filter((n: Note) => n.status === 'inbox').length,
    [notes]
  )

  const tags = useMemo<Tag[]>(() => {
    const map = new Map<string, number>()
    notes.forEach((n: Note) => {
      n.tags.forEach((t: string) => map.set(t, (map.get(t) || 0) + 1))
    })
    return Array.from(map.entries())
      .map(([name, count]: [string, number]) => ({ id: name, name, count }))
      .sort((a: Tag, b: Tag) => b.count - a.count)
  }, [notes])

  const reviewItems = useMemo<ReviewItem[]>(() => {
    const today = now
    return notes
      .filter((n: Note) => n.nextReviewAt <= today + day)
      .map((n: Note) => ({
        note: n,
        isOverdue: n.nextReviewAt < today,
        dueLabel: n.nextReviewAt < today ? '逾期' : '今日',
      }))
      .sort((a: ReviewItem, b: ReviewItem) => a.note.nextReviewAt - b.note.nextReviewAt)
  }, [notes])

  const value: KBContextValue = {
    folders, notes, tags, reviewItems,
    activeSection, selectedFolderId, selectedNoteId,
    setActiveSection, selectFolder, selectNote, saveNote, createNote, deleteNote, toggleStar,
    selectedNote, filteredNotes, inboxCount,
  }

  return <KBContext.Provider value={value}>{children}</KBContext.Provider>
}

export const useKB = () => {
  const ctx = useContext(KBContext)
  if (!ctx) throw new Error('useKB must be used within KnowledgeBaseProvider')
  return ctx
}
