/**
 * Supabase Sync Module
 * 
 * Provides cloud sync functionality using Supabase Edge Functions
 * Supports multi-user by including userId in sync requests
 */

import type { Note } from './indexeddb'
import { getSupabase, isSupabaseConfigured } from '../supabase/client'

// Sync status
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline' | 'disabled'

export interface SyncState {
  status: SyncStatus
  lastSync: number | null
  pendingChanges: number
  error?: string
  isConfigured: boolean
}

// Storage keys
const STORAGE_KEYS = {
  LAST_SYNC: 'knowedge_last_sync',
}

// ===== Sync Manager =====

export class SupabaseSyncManager {
  private listeners: Set<(state: SyncState) => void> = new Set()
  private state: SyncState = {
    status: 'idle',
    lastSync: null,
    pendingChanges: 0,
    isConfigured: isSupabaseConfigured(),
  }
  private userId: string | null = null
  private authToken: string | null = null

  async init(): Promise<void> {
    this.state.isConfigured = isSupabaseConfigured()
    
    const stored = localStorage.getItem(STORAGE_KEYS.LAST_SYNC)
    this.state.lastSync = stored ? parseInt(stored, 10) : null
    
    window.addEventListener('online', () => this.handleOnline())
    window.addEventListener('offline', () => this.handleOffline())
    
    if (!navigator.onLine) {
      this.state.status = 'offline'
    }
    
    this.notify()
  }

  /**
   * Set user credentials for sync
   */
  setUser(userId: string, authToken: string): void {
    this.userId = userId
    this.authToken = authToken
    if (userId) {
      localStorage.setItem('knowedge_sync_enabled', 'true')
      this.state.isConfigured = isSupabaseConfigured()
    }
  }

  /**
   * Clear user on logout
   */
  clearUser(): void {
    this.userId = null
    this.authToken = null
    this.updateState({ status: 'disabled' })
  }

  getState(): SyncState {
    return { ...this.state }
  }

  subscribe(listener: (state: SyncState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    const state = { ...this.state }
    this.listeners.forEach(l => l(state))
  }

  private updateState(partial: Partial<SyncState>): void {
    this.state = { ...this.state, ...partial }
    this.notify()
  }

  private handleOnline(): void {
    if (this.state.status === 'offline') {
      this.updateState({ status: 'idle' })
      if (this.userId) this.sync([])
    }
  }

  private handleOffline(): void {
    this.updateState({ status: 'offline' })
  }

  async enable(): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      this.updateState({ 
        status: 'error', 
        error: 'Supabase not configured',
        isConfigured: false 
      })
      return false
    }
    
    if (!this.userId) {
      console.log('[Sync] Cannot enable sync without user ID')
      return false
    }
    
    this.updateState({ status: 'idle', isConfigured: true })
    return true
  }

  async disable(): Promise<void> {
    await localStorage.setItem('knowedge_sync_enabled', 'false')
    this.updateState({ status: 'disabled' })
  }

  /**
   * Perform sync with the server
   * @param localNotes - Current notes from IndexedDB
   * @param saveCallback - Callback to save merged notes to IndexedDB
   */
  async sync(localNotes: Note[], saveCallback?: (notes: Note[]) => Promise<void>): Promise<{ 
    notes: Note[]
    merged: boolean
    conflictCount: number 
  }> {
    if (!isSupabaseConfigured()) {
      return { notes: localNotes, merged: false, conflictCount: 0 }
    }
    
    if (!this.userId || !this.authToken) {
      console.log('[Sync] Skipping sync: no user authenticated')
      return { notes: localNotes, merged: false, conflictCount: 0 }
    }
    
    if (!navigator.onLine) {
      this.updateState({ status: 'offline' })
      return { notes: localNotes, merged: false, conflictCount: 0 }
    }
    
    this.updateState({ status: 'syncing' })
    
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const functionUrl = `${supabaseUrl}/functions/v1/sync-notes`
      
      const lastSync = this.state.lastSync
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({
          notes: localNotes,
          userId: this.userId,
          lastSync,
        }),
      })
      
      if (!response.ok) {
        throw new Error(`Sync failed: ${response.statusText}`)
      }
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Sync failed')
      }
      
      // Merge notes
      const { merged, conflictCount } = mergeNotes(localNotes, result.notes)
      
      // Save merged notes back to IndexedDB
      if (saveCallback && merged.length > 0) {
        await saveCallback(merged)
      }
      
      // Update last sync time
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, String(result.serverTime))
      
      this.updateState({
        status: 'success',
        lastSync: result.serverTime,
        pendingChanges: 0,
      })
      
      return { notes: merged, merged: true, conflictCount }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed'
      console.error('[Sync] Error:', errorMessage)
      this.updateState({ status: 'error', error: errorMessage })
      return { notes: localNotes, merged: false, conflictCount: 0 }
    }
  }

  markPending(): void {
    this.updateState({ pendingChanges: this.state.pendingChanges + 1 })
  }
}

/**
 * Merge local and remote notes using last-write-wins strategy
 */
function mergeNotes(local: Note[], remote: Note[]): { merged: Note[]; conflictCount: number } {
  const merged = new Map<string, Note>()
  let conflictCount = 0
  
  const localMap = new Map(local.map(n => [n.id, n]))
  const remoteMap = new Map(remote.map(n => [n.id, n]))
  
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()])
  
  for (const id of allIds) {
    const localNote = localMap.get(id)
    const remoteNote = remoteMap.get(id)
    
    if (localNote && remoteNote) {
      const localTime = localNote.updatedAt || 0
      const remoteTime = remoteNote.updatedAt || 0
      
      if (localTime === remoteTime) {
        merged.set(id, localNote)
      } else {
        merged.set(id, localTime > remoteTime ? localNote : remoteNote)
        if (Math.abs(localTime - remoteTime) < 1000) {
          conflictCount++
        }
      }
    } else if (localNote) {
      merged.set(id, localNote)
    } else if (remoteNote) {
      merged.set(id, remoteNote)
    }
  }
  
  return { merged: Array.from(merged.values()), conflictCount }
}

// Singleton instance
export const supabaseSyncManager = new SupabaseSyncManager()

// Helper to get sync config
export async function getSyncConfig(): Promise<{ enabled: boolean }> {
  const enabled = localStorage.getItem('knowedge_sync_enabled') === 'true'
  return { enabled }
}
