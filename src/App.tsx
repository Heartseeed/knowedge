import React, { useState, useEffect, useCallback, useRef } from 'react'
import Dashboard from './pages/Dashboard'
import KBMain from './kb/KBMain'
import ReviewPage from './pages/Review'
import GraphPage from './pages/GraphPage'
import TimelinePage from './pages/TimelinePage'
import { KnowledgeBaseProvider } from './kb/KBProvider'
import SearchModal from './components/SearchModal'
import SettingsModal from './components/SettingsModal'
import AuthModal from './components/AuthModal'
import { initDB, type Note, getSampleNotes, cleanupTrash } from './db/indexeddb'
import { supabaseSyncManager, getSyncConfig } from './db/sync-supabase'
import { isSupabaseConfigured, getSupabase } from './supabase/client'
import { initAuth, getCurrentUser, onAuthChange, signOut } from './supabase/auth'
import { exportToJson, importFromJson } from './db/sync'
import './styles.css'

// View types
type View = 'dashboard' | 'knowledge-base' | 'note' | 'inbox' | 'graph' | 'timeline' | 'review'

// Generate ID helper
const generateId = (prefix: string = 'n'): string => {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

// Auth-gated wrapper component
const AuthGate: React.FC<{ children: React.ReactNode; onLoginClick: () => void; isConfigured: boolean }> = ({ children, onLoginClick, isConfigured }) => {
  return (
    <div className="ke-auth-gate">
      <div className="ke-auth-gate__content">
        <div className="ke-auth-gate__logo">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="30" stroke="#6366f1" strokeWidth="4"/>
            <path d="M20 32 L28 40 L44 24" stroke="#6366f1" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="ke-auth-gate__title">KnowEdge 知域</h1>
        <p className="ke-auth-gate__desc">请登录以继续使用</p>
        {isConfigured ? (
          <button className="ke-btn ke-btn--primary ke-btn--lg" onClick={onLoginClick}>
            登录 / 注册
          </button>
        ) : (
          <div className="ke-auth-gate__error">
            <p>云端同步功能未配置</p>
            <p>请联系管理员配置 Supabase</p>
          </div>
        )}
      </div>
    </div>
  )
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard')
  const [previousView, setPreviousView] = useState<View | null>(null)
  const [selectedNoteId, setSelectedNoteId] = useState<string | undefined>()
  const [showSearch, setShowSearch] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState<'local' | 'syncing' | 'synced'>('local')
  const [needsAuth, setNeedsAuth] = useState(false)
  const initDoneRef = useRef(false)

  const supabaseConfigured = isSupabaseConfigured()

  // Initialize database and sync on mount
  useEffect(() => {
    const init = async () => {
      try {
        // Initialize IndexedDB (always required)
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

        // Initialize Supabase sync (non-blocking)
        await supabaseSyncManager.init()
        
        // Initialize auth and listen for changes (non-blocking)
        const user = await initAuth()
        setCurrentUser(user)
        
        // If user exists, set up sync in background
        if (user) {
          const supabase = getSupabase()
          if (supabase) {
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.access_token) {
              supabaseSyncManager.setUser(user.id, session.access_token)
              await supabaseSyncManager.enable()
              setSyncStatus('synced')
              
              // Sync in background
              const config = await getSyncConfig()
              if (config.enabled && navigator.onLine) {
                const result = await supabaseSyncManager.sync(allNotes, async (merged) => {
                  // Save merged notes to IndexedDB
                  for (const note of merged) {
                    await initDB.putNote(note)
                  }
                  allNotes = merged
                })
                if (result.merged && result.notes.length > 0) {
                  allNotes = result.notes
                }
              }
            }
          }
        }
        
        // Subscribe to auth changes
        const unsubscribeAuth = onAuthChange(async (user) => {
          setCurrentUser(user)
          if (!user) {
            setSyncStatus('local')
            supabaseSyncManager.clearUser()
          } else {
            setSyncStatus('synced')
            const supabase = getSupabase()
            if (supabase) {
              const { data: { session } } = await supabase.auth.getSession()
              if (session?.access_token) {
                supabaseSyncManager.setUser(user.id, session.access_token)
                await supabaseSyncManager.enable()
                const currentNotes = await initDB.getAllNotes()
                const result = await supabaseSyncManager.sync(currentNotes, async (merged) => {
                  for (const note of merged) {
                    await initDB.putNote(note)
                  }
                })
                if (result.notes.length > 0) {
                  setNotes(result.notes)
                }
              }
            }
          }
        })

        setNotes(allNotes)
        setIsLoading(false)
        initDoneRef.current = true
        
        return () => {
          unsubscribeAuth?.()
        }
      } catch (err) {
        console.error('[App] Initialization error:', err)
        setIsLoading(false)
      }
    }
    init()
  }, [supabaseConfigured])

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
    if (view === 'graph' || view === 'timeline') {
      setPreviousView(currentView)
    }
    setCurrentView(view as View)
    if (noteId) setSelectedNoteId(noteId)
  }, [currentView])

  const handleNoteSelect = useCallback((noteId: string, note?: Note) => {
    setSelectedNoteId(noteId)
    setCurrentView('knowledge-base')
    // If a new note is provided, add it to the notes list
    if (note) {
      setNotes(prev => {
        // Check if note already exists
        const exists = prev.find(n => n.id === note.id)
        if (exists) {
          // Update existing note
          return prev.map(n => n.id === note.id ? note : n)
        }
        // Add new note to the beginning
        return [note, ...prev]
      })
    }
  }, [])

  // Handle review completion - update note with review data
  const handleReviewComplete = useCallback(async (noteId: string, reviewData: {
    reviewCount: number
    nextReviewAt: number
    easeFactor: number
    interval: number
  }) => {
    // Update note in state
    setNotes(prev => prev.map(n => {
      if (n.id === noteId) {
        return {
          ...n,
          ...reviewData,
          updatedAt: Date.now(),
        }
      }
      return n
    }))
    
    // Save to IndexedDB
    const note = notes.find(n => n.id === noteId)
    if (note) {
      const updatedNote = { ...note, ...reviewData, updatedAt: Date.now() }
      await initDB.putNote(updatedNote)
    }
    
    // Trigger sync if user is logged in
    if (currentUser) {
      supabaseSyncManager.markPending()
    }
  }, [notes, currentUser])

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
    
    // Trigger sync after creating note
    if (currentUser) {
      supabaseSyncManager.markPending()
      const config = await getSyncConfig()
      if (config.enabled) {
        const updatedNotes = await initDB.getAllNotes()
        await supabaseSyncManager.sync(updatedNotes)
      }
    }
  }, [currentUser])

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
      if (currentConfig.enabled && navigator.onLine && currentUser) {
        const result = await supabaseSyncManager.sync(notes, async (merged) => {
          for (const note of merged) {
            await initDB.putNote(note)
          }
          setNotes(merged)
        })
        if (result.notes.length > 0) {
          setNotes(result.notes)
        }
        return { success: true, message: '同步完成' }
      }
      return { success: false, message: '同步未启用或离线' }
    } catch (err) {
      console.error('[App] Sync error:', err)
      return { success: false, message: '同步失败' }
    }
  }, [notes, currentUser])

  // Handle successful auth
  const handleAuthSuccess = useCallback(async () => {
    const user = getCurrentUser()
    setCurrentUser(user)
    setNeedsAuth(false)
    
    if (user) {
      const supabase = getSupabase()
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          supabaseSyncManager.setUser(user.id, session.access_token)
          await supabaseSyncManager.enable()
          
          // Sync after login
          const currentNotes = await initDB.getAllNotes()
          const result = await supabaseSyncManager.sync(currentNotes, async (merged) => {
            for (const note of merged) {
              await initDB.putNote(note)
            }
          })
          if (result.notes.length > 0) {
            setNotes(result.notes)
          }
        }
      }
    }
  }, [])

  // Loading state
  if (isLoading) {
    return (
      <div className="ke-app ke-app--loading">
        <div className="ke-loading">
          <div className="ke-loading__spinner"></div>
          <p>加载中...</p>
        </div>
      </div>
    )
  }

  // Auth required state
  if (needsAuth && supabaseConfigured) {
    return (
      <div className="ke-app">
        <AuthGate onLoginClick={() => setShowAuth(true)} isConfigured={supabaseConfigured} />
        <AuthModal
          isOpen={showAuth}
          onClose={() => setShowAuth(false)}
          onAuthSuccess={handleAuthSuccess}
        />
      </div>
    )
  }

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
            syncStatus={syncStatus}
            onAuthClick={() => setShowAuth(true)}
            currentUser={currentUser}
          />
        ) : currentView === 'review' ? (
          <ReviewPage
            notes={notes}
            onBack={() => setCurrentView('dashboard')}
            onNoteClick={handleNoteSelect}
            onReviewComplete={handleReviewComplete}
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
        ) : currentView === 'knowledge-base' || currentView === 'note' || currentView === 'inbox' ? (
          <KBMain
            onBackToDashboard={() => setCurrentView('dashboard')}
            onNavigate={navigate}
            selectedNoteId={selectedNoteId?.startsWith('tag:') ? undefined : selectedNoteId}
            initialTag={selectedNoteId?.startsWith('tag:') ? selectedNoteId.slice(4) : undefined}
            notes={notes}
            onNotesChange={setNotes}
            onCapture={() => {}}
            onSettingsClick={() => setShowSettings(true)}
            onAuthClick={() => setShowAuth(true)}
            currentUser={currentUser}
            syncStatus={syncStatus}
          />
        ) : (
          <Dashboard
            onNavigate={navigate}
            notes={notes}
            onNoteSelect={handleNoteSelect}
            onCapture={() => {}}
            onShowSearch={() => setShowSearch(true)}
            onOpenSettings={() => setShowSettings(true)}
            syncStatus={syncStatus}
            onAuthClick={() => setShowAuth(true)}
            currentUser={currentUser}
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

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  )
}

export default App
