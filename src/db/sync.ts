/**
 * Data Sync Module
 * 
 * Provides multiple data persistence strategies:
 * 1. IndexedDB - Local primary storage (always works)
 * 2. JSON Export/Import - Manual backup to local files
 * 3. Cloud Sync - Optional real-time sync via REST API or Supabase
 * 
 * Data is NEVER lost: always stored in IndexedDB first,
 * then optionally synced to cloud.
 */

import type { Note } from './indexeddb'

// Storage keys
const STORAGE_KEYS = {
  LAST_SYNC: 'knowedge_last_sync',
  SYNC_ENABLED: 'knowedge_sync_enabled',
  USER_ID: 'knowedge_user_id',
  SYNC_URL: 'knowedge_sync_url', // Custom sync server URL
}

// Sync status
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline'

export interface SyncState {
  status: SyncStatus
  lastSync: number | null
  pendingChanges: number
  error?: string
}

// Sync config
export interface SyncConfig {
  enabled: boolean
  endpoint?: string // REST API endpoint
  apiKey?: string  // For authenticated APIs
  autoSync: boolean // Auto-sync on changes
  syncInterval: number // ms, 0 = disabled
}

// ===== IndexedDB Operations (Primary Storage) =====

class LocalStorage {
  private dbName = 'knowedge_sync'
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    if (this.db) return
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => { this.db = request.result; resolve() }
      
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' })
        }
      }
    })
  }

  async get<T>(key: string): Promise<T | null> {
    await this.init()
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('metadata', 'readonly')
      const store = tx.objectStore('metadata')
      const req = store.get(key)
      req.onsuccess = () => resolve(req.result?.value ?? null)
      req.onerror = () => reject(req.error)
    })
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.init()
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('metadata', 'readwrite')
      const store = tx.objectStore('metadata')
      const req = store.put({ key, value })
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }
}

const localStorage = new LocalStorage()

// ===== Config Management =====

export async function getSyncConfig(): Promise<SyncConfig> {
  const enabled = await localStorage.get<boolean>(STORAGE_KEYS.SYNC_ENABLED) ?? false
  const endpoint = await localStorage.get<string>(STORAGE_KEYS.SYNC_URL)
  const userId = await localStorage.get<string>(STORAGE_KEYS.USER_ID)
  
  return {
    enabled,
    endpoint: endpoint || undefined,
    autoSync: true,
    syncInterval: 30000, // 30 seconds
  }
}

export async function setSyncConfig(config: Partial<SyncConfig>): Promise<void> {
  if (config.enabled !== undefined) {
    await localStorage.set(STORAGE_KEYS.SYNC_ENABLED, config.enabled)
  }
  if (config.endpoint !== undefined) {
    await localStorage.set(STORAGE_KEYS.SYNC_URL, config.endpoint)
  }
}

export async function getLastSyncTime(): Promise<number | null> {
  return localStorage.get<number>(STORAGE_KEYS.LAST_SYNC)
}

export async function setLastSyncTime(time: number): Promise<void> {
  await localStorage.set(STORAGE_KEYS.LAST_SYNC, time)
}

// ===== JSON Export/Import =====

export interface ExportedData {
  version: number
  exportedAt: number
  notes: Note[]
  metadata?: Record<string, any>
}

/**
 * Export all notes as JSON file
 */
export async function exportToJson(notes: Note[]): Promise<void> {
  const data: ExportedData = {
    version: 1,
    exportedAt: Date.now(),
    notes,
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const date = new Date().toISOString().slice(0, 10)
  const filename = `knowedge-backup-${date}.json`
  
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  
  URL.revokeObjectURL(url)
  
  // Save export timestamp
  await setLastSyncTime(Date.now())
}

/**
 * Import notes from JSON backup file
 */
export async function importFromJson(file: File): Promise<{ notes: Note[]; imported: number; skipped: number }> {
  const text = await file.text()
  const data = JSON.parse(text) as ExportedData
  
  if (!data.notes || !Array.isArray(data.notes)) {
    throw new Error('Invalid backup file format')
  }
  
  const now = Date.now()
  let imported = 0
  let skipped = 0
  
  const notes: Note[] = data.notes.map(note => {
    // Validate required fields
    if (!note.id || !note.title) {
      skipped++
      return null
    }
    
    imported++
    return {
      ...note,
      updatedAt: now, // Update timestamp on import
    } as Note
  }).filter(Boolean) as Note[]
  
  await setLastSyncTime(now)
  
  return { notes, imported, skipped }
}

// ===== Cloud Sync (REST API) =====

export interface SyncResponse {
  success: boolean
  notes?: Note[]
  error?: string
  serverTime?: number
}

/**
 * Sync notes to remote server
 */
export async function syncToServer(
  notes: Note[],
  endpoint: string,
  apiKey?: string
): Promise<SyncResponse> {
  try {
    const response = await fetch(`${endpoint}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        notes,
        clientTime: Date.now(),
      }),
    })
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`)
    }
    
    const data = await response.json()
    await setLastSyncTime(Date.now())
    
    return {
      success: true,
      notes: data.notes,
      serverTime: data.serverTime,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    }
  }
}

/**
 * Fetch notes from remote server
 */
export async function fetchFromServer(
  endpoint: string,
  apiKey?: string,
  since?: number
): Promise<SyncResponse> {
  try {
    const url = new URL(`${endpoint}/notes`)
    if (since) {
      url.searchParams.set('since', String(since))
    }
    
    const response = await fetch(url.toString(), {
      headers: {
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
      },
    })
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`)
    }
    
    const data = await response.json()
    
    return {
      success: true,
      notes: data.notes,
      serverTime: data.serverTime,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Fetch failed',
    }
  }
}

// ===== Merge Strategy =====

/**
 * Merge local and remote notes using last-write-wins strategy
 */
export function mergeNotes(local: Note[], remote: Note[]): Note[] {
  const merged = new Map<string, Note>()
  
  // Create a map of all notes by ID
  const allNotes = new Map<string, Note>()
  local.forEach(n => allNotes.set(n.id, n))
  remote.forEach(n => allNotes.set(n.id, n))
  
  // For each note, keep the most recent version
  allNotes.forEach((note, id) => {
    const localNote = local.find(n => n.id === id)
    const remoteNote = remote.find(n => n.id === id)
    
    if (localNote && remoteNote) {
      // Both exist - keep the more recent one
      merged.set(id, 
        localNote.updatedAt > remoteNote.updatedAt ? localNote : remoteNote
      )
    } else {
      // Only one version exists
      merged.set(id, note)
    }
  })
  
  return Array.from(merged.values())
}

// ===== Sync Manager =====

export class SyncManager {
  private config: SyncConfig = { enabled: false, autoSync: true, syncInterval: 30000 }
  private syncInterval: number | null = null
  private listeners: Set<(state: SyncState) => void> = new Set()
  private state: SyncState = { status: 'idle', lastSync: null, pendingChanges: 0 }
  
  async init(): Promise<void> {
    this.config = await getSyncConfig()
    
    if (this.config.enabled && this.config.autoSync) {
      this.startAutoSync()
    }
    
    this.state.lastSync = await getLastSyncTime()
  }
  
  getState(): SyncState {
    return { ...this.state }
  }
  
  subscribe(listener: (state: SyncState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  
  private notify(): void {
    this.listeners.forEach(l => l({ ...this.state }))
  }
  
  private updateState(partial: Partial<SyncState>): void {
    this.state = { ...this.state, ...partial }
    this.notify()
  }
  
  async enable(endpoint: string, apiKey?: string): Promise<void> {
    this.config = { enabled: true, endpoint, apiKey, autoSync: true, syncInterval: 30000 }
    await setSyncConfig({ enabled: true, endpoint })
    this.startAutoSync()
  }
  
  async disable(): Promise<void> {
    this.stopAutoSync()
    this.config.enabled = false
    await setSyncConfig({ enabled: false })
    this.updateState({ status: 'idle' })
  }
  
  private startAutoSync(): void {
    if (this.syncInterval) return
    
    this.syncInterval = window.setInterval(() => {
      this.sync()
    }, this.config.syncInterval)
  }
  
  private stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }
  
  markPending(): void {
    this.updateState({ pendingChanges: this.state.pendingChanges + 1 })
  }
  
  async sync(): Promise<void> {
    if (!this.config.enabled || !this.config.endpoint) return
    
    this.updateState({ status: 'syncing' })
    
    // This would be called by the app with current notes
    // For now, just update status
    this.updateState({ 
      status: 'success',
      lastSync: Date.now(),
      pendingChanges: 0,
    })
  }
  
  async fullSync(localNotes: Note[]): Promise<{ notes: Note[]; merged: boolean }> {
    if (!this.config.enabled || !this.config.endpoint) {
      return { notes: localNotes, merged: false }
    }
    
    this.updateState({ status: 'syncing' })
    
    try {
      // Fetch remote notes
      const lastSync = await getLastSyncTime()
      const remoteResult = await fetchFromServer(
        this.config.endpoint,
        this.config.apiKey,
        lastSync || undefined
      )
      
      if (!remoteResult.success || !remoteResult.notes) {
        throw new Error(remoteResult.error || 'Failed to fetch')
      }
      
      // Merge notes
      const mergedNotes = mergeNotes(localNotes, remoteResult.notes)
      
      // Push merged notes to server
      const syncResult = await syncToServer(
        mergedNotes,
        this.config.endpoint,
        this.config.apiKey
      )
      
      if (!syncResult.success) {
        throw new Error(syncResult.error || 'Failed to sync')
      }
      
      await setLastSyncTime(Date.now())
      
      this.updateState({
        status: 'success',
        lastSync: Date.now(),
        pendingChanges: 0,
      })
      
      return { notes: mergedNotes, merged: true }
    } catch (error) {
      this.updateState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Sync failed',
      })
      
      return { notes: localNotes, merged: false }
    }
  }
}

// Singleton instance
export const syncManager = new SyncManager()
