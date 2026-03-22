import create from 'zustand'
import { initDB, getAllNotes, getInboxNotes, getNotesForReview, generateId } from './db/indexeddb'
import type { Note } from './db/indexeddb'

type Folder = { id: string; name: string; parentId?: string }
type Tag = { id: string; name: string; count: number }

type State = {
  notes: Note[];
  inboxNotes: Note[];
  reviewNotes: Note[];
  folders: Folder[];
  tags: Tag[];
  selectedNoteId?: string | null;
  loading: boolean;
  
  // Actions
  initIfNeeded: () => Promise<void>;
  setSelectedNoteId: (id?: string|null) => void;
  
  // Note operations
  addNote: (n: Note) => void;
  updateNote: (n: Note) => void;
  deleteNote: (id: string) => void;
  createInboxNote: (content: string) => Promise<Note>;
  toggleStar: (id: string) => void;
  moveToFolder: (noteId: string, folderId?: string) => void;
  
  // Tag operations
  addTag: (noteId: string, tag: string) => void;
  removeTag: (noteId: string, tag: string) => void;
  
  // Review operations
  refreshReviewNotes: () => Promise<void>;
  
  // Getters
  getNote: (id: string) => Note | undefined;
  getInboxCount: () => number;
  getStarredNotes: () => Note[];
  getNotesByFolder: (folderId?: string) => Note[];
  getNotesByTag: (tag: string) => Note[];
}

export const useStore = create<State>((set, get) => ({
  notes: [],
  inboxNotes: [],
  reviewNotes: [],
  folders: [],
  tags: [],
  selectedNoteId: null,
  loading: false,
  
  initIfNeeded: async () => {
    if (get().loading) return
    set({ loading: true })
    
    try {
      const allNotes = await getAllNotes()
      const inbox = allNotes.filter(n => n.status === 'inbox')
      const review = allNotes.filter(n => n.nextReviewAt && n.nextReviewAt <= Date.now())
      const tags = getTagCounts(allNotes)
      
      set({ 
        notes: allNotes, 
        inboxNotes: inbox,
        reviewNotes: review,
        tags,
        loading: false 
      })
    } catch (err) {
      console.error('Failed to load notes:', err)
      set({ loading: false })
    }
  },
  
  setSelectedNoteId: (id) => set({ selectedNoteId: id ?? null }),
  
  addNote: (n) => set((s) => ({ notes: [n, ...s.notes] })),
  
  updateNote: (n) => set((s) => {
    const idx = s.notes.findIndex((x) => x.id === n.id)
    if (idx < 0) return s
    const next = [...s.notes]
    next[idx] = n
    
    // Update inbox/review lists if needed
    const inboxNotes = next.filter(x => x.status === 'inbox')
    const reviewNotes = next.filter(x => x.nextReviewAt && x.nextReviewAt <= Date.now())
    
    return { notes: next, inboxNotes, reviewNotes }
  }),
  
  deleteNote: (id) => set((s) => {
    const notes = s.notes.filter(n => n.id !== id)
    return { 
      notes,
      inboxNotes: notes.filter(n => n.status === 'inbox'),
      reviewNotes: notes.filter(n => n.nextReviewAt && n.nextReviewAt <= Date.now()),
    }
  }),
  
  createInboxNote: async (content) => {
    const now = Date.now()
    const note: Note = {
      id: generateId('n'),
      title: content.slice(0, 50).replace(/<[^>]+>/g, ''),
      content: `<p>${content}</p>`,
      type: 'idea',
      status: 'inbox',
      createdAt: now,
      updatedAt: now,
      tags: [],
      reviewCount: 0,
      nextReviewAt: now + 24 * 60 * 60 * 1000,
      easeFactor: 2.5,
      interval: 1,
    }
    
    await initDB.putNote(note)
    set((s) => ({ notes: [note, ...s.notes], inboxNotes: [note, ...s.inboxNotes] }))
    
    return note
  },
  
  toggleStar: (id) => {
    const notes = get().notes.map(n => {
      if (n.id !== id) return n
      return { ...n, starred: !n.starred }
    })
    set({ notes })
  },
  
  moveToFolder: (noteId, folderId) => {
    const notes = get().notes.map(n => {
      if (n.id !== noteId) return n
      return { ...n, folderId, status: 'organized' as const }
    })
    set({ notes })
  },
  
  addTag: (noteId, tag) => {
    const notes = get().notes.map(n => {
      if (n.id !== noteId) return n
      if (n.tags?.includes(tag)) return n
      return { ...n, tags: [...(n.tags || []), tag] }
    })
    set({ notes, tags: getTagCounts(notes) })
  },
  
  removeTag: (noteId, tag) => {
    const notes = get().notes.map(n => {
      if (n.id !== noteId) return n
      return { ...n, tags: (n.tags || []).filter(t => t !== tag) }
    })
    set({ notes, tags: getTagCounts(notes) })
  },
  
  refreshReviewNotes: async () => {
    const notes = get().notes
    const reviewNotes = notes.filter(n => n.nextReviewAt && n.nextReviewAt <= Date.now())
    set({ reviewNotes })
  },
  
  getNote: (id) => get().notes.find(n => n.id === id),
  
  getInboxCount: () => get().inboxNotes.length,
  
  getStarredNotes: () => get().notes.filter(n => n.starred),
  
  getNotesByFolder: (folderId) => {
    const notes = get().notes
    if (!folderId || folderId === 'root') return notes
    return notes.filter(n => n.folderId === folderId)
  },
  
  getNotesByTag: (tag) => get().notes.filter(n => n.tags?.includes(tag)),
}))

// Helper to calculate tag counts
function getTagCounts(notes: Note[]): Tag[] {
  const counts: Record<string, number> = {}
  notes.forEach(n => {
    n.tags?.forEach(t => {
      counts[t] = (counts[t] || 0) + 1
    })
  })
  return Object.entries(counts)
    .map(([name, count]) => ({ id: name, name, count }))
    .sort((a, b) => b.count - a.count)
}

export default useStore
