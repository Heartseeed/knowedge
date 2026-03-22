import { initDB, getAllNotes, generateId } from '../db/indexeddb'

export interface KBDBAdapter {
  open(): Promise<void>
  getFolders(): Promise<{ id: string; name: string; icon?: string; parentId?: string }[]>
  getNotesInFolder(folderId?: string): Promise<any[]>
  getNote(id: string): Promise<any | null>
  saveNote(note: any): Promise<void>
  createNoteInFolder(folderId?: string, data?: any): Promise<string>
  getAllTags(): Promise<{ name: string; count: number }[]>
  getNotesForReview(): Promise<any[]>
}

// Default folders
const DEFAULT_FOLDERS = [
  { id: 'root', name: '📁 知识库', icon: '📁', parentId: undefined },
  { id: 'work', name: '💼 工作', icon: '💼', parentId: 'root' },
  { id: 'study', name: '📚 学习', icon: '📚', parentId: 'root' },
  { id: 'life', name: '🌱 生活', icon: '🌱', parentId: 'root' },
]

export class IndexedDBAdapter implements KBDBAdapter {
  async open(): Promise<void> {
    await initDB.init()
  }

  async getFolders(): Promise<{ id: string; name: string; icon?: string; parentId?: string }[]> {
    return DEFAULT_FOLDERS
  }

  async getNotesInFolder(folderId?: string): Promise<any[]> {
    await initDB.init()
    const allNotes = await getAllNotes()
    
    if (!folderId || folderId === 'root') {
      return allNotes
    }
    
    return allNotes.filter(note => note.folderId === folderId)
  }

  async getNote(id: string): Promise<any | null> {
    await initDB.init()
    const allNotes = await getAllNotes()
    return allNotes.find(note => note.id === id) || null
  }

  async saveNote(note: any): Promise<void> {
    await initDB.init()
    await initDB.putNote(note)
  }

  async createNoteInFolder(folderId?: string, data?: any): Promise<string> {
    await initDB.init()
    const id = generateId('n')
    const note = {
      id,
      title: data?.title || '新笔记',
      content: data?.content || '<p></p>',
      type: data?.type || 'idea',
      status: data?.status || 'inbox',
      folderId: folderId,
      tags: data?.tags || [],
      links: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      reviewCount: 0,
      nextReviewAt: Date.now(),
      easeFactor: 2.5,
      interval: 1,
    }
    await initDB.putNote(note)
    return id
  }

  async getAllTags(): Promise<{ name: string; count: number }[]> {
    await initDB.init()
    const allNotes = await getAllNotes()
    const tagCounts: Record<string, number> = {}
    
    allNotes.forEach(note => {
      note.tags?.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      })
    })
    
    return Object.entries(tagCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }

  async getNotesForReview(): Promise<any[]> {
    await initDB.init()
    const allNotes = await getAllNotes()
    const now = Date.now()
    
    return allNotes
      .filter(note => note.nextReviewAt && note.nextReviewAt <= now)
      .sort((a, b) => (a.nextReviewAt || 0) - (b.nextReviewAt || 0))
  }
}
