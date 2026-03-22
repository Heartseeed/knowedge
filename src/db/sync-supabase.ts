/**
 * Supabase Sync Module
 * 
 * Provides cloud sync functionality using Supabase Edge Functions
 * 
 * Features:
 * - Full sync: Upload all local notes, download all remote notes, merge
 * - Incremental sync: Only sync notes changed since last sync
 * - Offline-first: Always works with IndexedDB, syncs when online
 */

import type { Note } from './indexeddb'
import { getSupabase, isSupabaseConfigured, getDeviceId } from '../supabase/client'

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
  LAST_SYNC_VECTOR: 'knowedge_last_sync_vector', // For incremental sync
}

// ===== Config Management =====

export async function getSyncConfig(): Promise<{ enabled: boolean; endpoint?: string }> {
  const enabled = localStorage.getItem('knowedge_sync_enabled') === 'true'
  const endpoint = localStorage.getItem('knowedge_sync_endpoint') || undefined
  return { enabled, endpoint }
}

export async function setSyncEnabled(enabled: boolean): Promise<void> {
  localStorage.setItem('knowedge_sync_enabled', String(enabled))
}

export async function setSyncEndpoint(endpoint: string): Promise<void> {
  localStorage.setItem('knowedge_sync_endpoint', endpoint)
}

// ===== Sync Vector (for incremental sync) =====

interface SyncVector {
  [deviceId: string]: number // Last synced timestamp for each device
}

async function getSyncVector(): Promise<SyncVector> {
  const stored = localStorage.getItem(STORAGE_KEYS.LAST_SYNC_VECTOR)
  return stored ? JSON.parse(stored) : {}
}

async function updateSyncVector(deviceId: string, timestamp: number): Promise<void> {
  const vector = await getSyncVector()
  vector[deviceId] = timestamp
  localStorage.setItem(STORAGE_KEYS.LAST_SYNC_VECTOR, JSON.stringify(vector))
}

async function getLastSyncTime(): Promise<number | null> {
  const stored = localStorage.getItem(STORAGE_KEYS.LAST_SYNC)
  return stored ? parseInt(stored, 10) : null
}

async function setLastSyncTime(time: number): Promise<void> {
  localStorage.setItem(STORAGE_KEYS.LAST_SYNC, String(time))
}

// ===== Remote API (Edge Function) =====

interface SyncRequest {
  notes: Note[]
  clientId: string
  lastSync: number | null
  vector: SyncVector
}

interface SyncResponse {
  success: boolean
  notes: Note[]
  serverTime: number
  error?: string
}

/**
 * Call the sync Edge Function
 */
async function callSyncFunction(request: SyncRequest): Promise<SyncResponse> {
  const supabase = getSupabase()
  if (!supabase) {
    throw new Error('Supabase not configured')
  }
  
  // Get the Edge Function URL from environment
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const functionUrl = `${supabaseUrl}/functions/v1/sync-notes`
  
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify(request),
  })
  
  if (!response.ok) {
    throw new Error(`Sync failed: ${response.statusText}`)
  }
  
  return response.json()
}

// ===== Merge Strategy =====

/**
 * Merge local and remote notes using last-write-wins strategy
 */
function mergeNotes(local: Note[], remote: Note[]): { merged: Note[]; conflictCount: number } {
  const merged = new Map<string, Note>()
  let conflictCount = 0
  
  // Create maps for quick lookup
  const localMap = new Map(local.map(n => [n.id, n]))
  const remoteMap = new Map(remote.map(n => [n.id, n]))
  
  // Process all unique IDs
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()])
  
  for (const id of allIds) {
    const localNote = localMap.get(id)
    const remoteNote = remoteMap.get(id)
    
    if (localNote && remoteNote) {
      // Both exist - check timestamps
      const localTime = localNote.updatedAt || 0
      const remoteTime = remoteNote.updatedAt || 0
      
      if (localTime === remoteTime) {
        // Same timestamp - prefer local (user's current session)
        merged.set(id, localNote)
      } else {
        // Different timestamps - keep the newer one
        merged.set(id, localTime > remoteTime ? localNote : remoteNote)
        if (Math.abs(localTime - remoteTime) < 1000) {
          conflictCount++ // Count as conflict if within 1 second
        }
      }
    } else if (localNote) {
      // Only local exists
      merged.set(id, localNote)
    } else if (remoteNote) {
      // Only remote exists
      merged.set(id, remoteNote)
    }
  }
  
  return { merged: Array.from(merged.values()), conflictCount }
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
  
  async init(): Promise<void> {
    this.state.isConfigured = isSupabaseConfigured()
    this.state.lastSync = await getLastSyncTime()
    
    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline())
    window.addEventListener('offline', () => this.handleOffline())
    
    if (!navigator.onLine) {
      this.state.status = 'offline'
    }
    
    this.notify()
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
      this.sync()
    }
  }
  
  private handleOffline(): void {
    this.updateState({ status: 'offline' })
  }
  
  async enable(): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      this.updateState({ 
        status: 'error', 
        error: 'Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env',
        isConfigured: false 
      })
      return false
    }
    
    await setSyncEnabled(true)
    this.updateState({ status: 'idle', isConfigured: true })
    
    // Perform initial sync
    await this.sync()
    return true
  }
  
  async disable(): Promise<void> {
    await setSyncEnabled(false)
    this.updateState({ status: 'disabled' })
  }
  
  /**
   * Perform a full sync with the server
   * @param localNotes - Current notes from IndexedDB
   * @param saveCallback - Callback to save merged notes to IndexedDB
   */
  async sync(localNotes?: Note[], saveCallback?: (notes: Note[]) => Promise<void>): Promise<{ 
    notes: Note[]
    merged: boolean
    conflictCount: number 
  }> {
    const config = await getSyncConfig()
    
    if (!config.enabled || !isSupabaseConfigured()) {
      return { notes: localNotes || [], merged: false, conflictCount: 0 }
    }
    
    if (!navigator.onLine) {
      this.updateState({ status: 'offline' })
      return { notes: localNotes || [], merged: false, conflictCount: 0 }
    }
    
    this.updateState({ status: 'syncing' })
    
    try {
      const clientId = getDeviceId()
      const lastSync = await getLastSyncTime()
      const vector = await getSyncVector()
      
      // Call Edge Function
      const response = await callSyncFunction({
        notes: localNotes || [],
        clientId,
        lastSync,
        vector,
      })
      
      if (!response.success) {
        throw new Error(response.error || 'Sync failed')
      }
      
      // Merge notes
      const { merged, conflictCount } = mergeNotes(
        localNotes || [],
        response.notes
      )
      
      // Save merged notes back to IndexedDB
      if (saveCallback && merged.length > 0) {
        await saveCallback(merged)
      }
      
      // Update sync vector
      await updateSyncVector(clientId, response.serverTime)
      await setLastSyncTime(response.serverTime)
      
      this.updateState({
        status: 'success',
        lastSync: response.serverTime,
        pendingChanges: 0,
      })
      
      return { notes: merged, merged: true, conflictCount }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed'
      this.updateState({ status: 'error', error: errorMessage })
      return { notes: localNotes || [], merged: false, conflictCount: 0 }
    }
  }
  
  /**
   * Mark that there are pending local changes
   */
  markPending(): void {
    this.updateState({ pendingChanges: this.state.pendingChanges + 1 })
  }
}

// Singleton instance
export const supabaseSyncManager = new SupabaseSyncManager()
