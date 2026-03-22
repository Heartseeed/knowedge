import React, { useState, useEffect, useCallback, useRef } from 'react'
import Dashboard from './pages/Dashboard'
import KBMain from './kb/KBMain'
import ReviewPage from './pages/Review'
import GraphPage from './pages/GraphPage'
import TimelinePage from './pages/TimelinePage'
import { KnowledgeBaseProvider } from './kb/KBProvider'
import SearchModal from './components/SearchModal'
import SettingsModal from './components/SettingsModal'
import { initDB, type Note, getSampleNotes, cleanupTrash } from './db/indexeddb'
import { supabaseSyncManager, getSyncConfig } from './db/sync-supabase'
import { isSupabaseConfigured } from './supabase/client'
import { exportToJson, importFromJson } from './db/sync'
import './styles.css'

// View types
type View = 'dashboard' | 'knowledge-base' | 'note' | 'inbox' | 'graph' | 'timeline' | 'review'

// Generate ID helper
const generateId = (prefix: string = 'n'): string => {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard')
  const [previousView, setPreviousView] = useState<View | null>(null)
  const [selectedNoteId, setSelectedNoteId] = useState<string | undefined>()
  const [showSearch, setShowSearch] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const initDoneRef = useRef(false)

  // Initialize database and sync on mount
  useEffect(() => {
    const init = async () => {
      try {
        // Initialize IndexedDB
        await initDB.init()
        let allNotes = await initDB.getAllNotes()

        // Cleanup trash - delete notes older than 30 days
        const deletedCount = await cleanupTrash()
        if (deletedCount > 0) {
          console.log(`[App] Cleaned up ${deletedCount} old deleted notes`)
        }

        // Generate sample notes if database is empty
        if (allNotes.length === 0) {
          const sampleNotes = await getSampleNotes()
          allNotes = sampleNotes
        }

        // Initialize Supabase sync
        await supabaseSyncManager.init()

        // Subscribe to sync state changes (UI indicator removed; keep background sync)
        const unsubscribe = supabaseSyncManager.subscribe(() => {
          // no UI sync indicator; keep background sync alive
        })

        const config = await getSyncConfig()
        if (isSupabaseConfigured() && !config.enabled) {
          await supabaseSyncManager.enable()
        }
        const currentConfig = await getSyncConfig()
        if (currentConfig.enabled && navigator.onLine) {
          const result = await supabaseSyncManager.sync(allNotes, (merged) => {
            // no-op: background sync handled by manager
          })
          if (result.merged && result.notes.length > 0) {
            allNotes = result.notes
          }
        }
        setNotes(allNotes)
        setIsLoading(false)
        initDoneRef.current = true
        return () => {
          unsubscribe()
        }
      } catch (err) {
        console.error('[App] Initialization error:', err)
        setIsLoading(false)
      }
    }
    init()
  }, [])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(true)
      }
      if (e.key === 'Escape') {
        if (showSearch) setShowSearch(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showSearch])

  const navigate = useCallback((view: string, noteId?: string) => {
    // Track previous view for navigation back
    if (view === 'graph' || view === 'timeline') {
      setPreviousView(currentView)
    }
    setCurrentView(view as View)
    if (noteId) setSelectedNoteId(noteId)
  }, [currentView])

  const handleNoteSelect = useCallback((noteId: string) => {
    setSelectedNoteId(noteId)
    setCurrentView('knowledge-base')
  }, [])

  const handleCreateNote = useCallback(async (title: string) => {
    const now = Date.now()
    const newNote: Note = {
      id: generateId('n'),
      title: title || '新笔记',
      content: '<p></p>',
      type: 'idea',
      status: 'inbox',
      createdAt: now,
      updatedAt: now,
      tags: [],
      reviewCount: 0,
      nextReviewAt: now,
      easeFactor: 2.5,
      interval: 1,
    }
    await initDB.putNote(newNote)
    setNotes(prev => [newNote, ...prev])
    setSelectedNoteId(newNote.id)
    setCurrentView('knowledge-base')
    setShowSearch(false)
  }, [])

  // Export / Import helpers
  const handleExport = useCallback(async () => {
    await exportToJson(notes)
  }, [notes])

  const handleImport = useCallback(async (importedNotes: Note[]) => {
    for (const note of importedNotes) {
      await initDB.putNote(note)
    }
    const allNotes = await initDB.getAllNotes()
    setNotes(allNotes)
  }, [])

  // Sync trigger from settings
  const handleSync = useCallback(async () => {
    try {
      const currentConfig = await getSyncConfig()
      if (currentConfig.enabled && navigator.onLine) {
        const result = await supabaseSyncManager.sync(notes, (merged) => {
          if (merged) {
            setNotes(merged)
          }
        })
        if (result.merged && result.notes.length > 0) {
          setNotes(result.notes)
        }
        return { success: true, message: '同步完成' }
      }
      return { success: false, message: '同步未启用或离线' }
    } catch (err) {
      console.error('[App] Sync error:', err)
      return { success: false, message: '同步失败' }
    }
  }, [notes])

  return (
    <div className="ke-app">
      <KnowledgeBaseProvider>
        {currentView === 'dashboard' ? (
          <Dashboard
            onNavigate={navigate}
            notes={notes}
            onNoteSelect={handleNoteSelect}
            onCapture={() => {}}
            onShowSearch={() => setShowSearch(true)}
            onOpenSettings={() => setShowSettings(true)}
          />
        ) : currentView === 'review' ? (
          <ReviewPage
            notes={notes}
            onBack={() => setCurrentView('dashboard')}
            onNoteClick={handleNoteSelect}
            onReviewComplete={() => {}}
          />
        ) : currentView === 'graph' ? (
          <GraphPage
            notes={notes}
            onBack={() => setCurrentView(previousView || 'dashboard')}
            onNodeClick={handleNoteSelect}
          />
        ) : currentView === 'timeline' ? (
          <TimelinePage
            notes={notes}
            onBack={() => setCurrentView(previousView || 'dashboard')}
            onNoteClick={handleNoteSelect}
          />
        ) : (
          <KBMain
            onBackToDashboard={() => setCurrentView('dashboard')}
            onNavigate={navigate}
            selectedNoteId={selectedNoteId}
            notes={notes}
            onNotesChange={setNotes}
            onCapture={() => {}}
            onSettingsClick={() => setShowSettings(true)}
          />
        )}
      </KnowledgeBaseProvider>

      {/* Global Search Modal */}
      <SearchModal
        notes={notes}
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        onSelectNote={handleNoteSelect}
        onCreateNote={handleCreateNote}
      />

      {/* Settings Modal */}
      <SettingsModal
        notes={notes}
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onNotesImported={handleImport}
        onSyncTrigger={handleSync}
      />
    </div>
  )
}

export default App
