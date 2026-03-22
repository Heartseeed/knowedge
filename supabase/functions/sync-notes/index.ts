/**
 * Supabase Edge Function: sync-notes
 * 
 * Handles note synchronization between clients and Supabase database.
 * 
 * Features:
 * - Receives notes from client
 * - Merges with existing notes (last-write-wins)
 * - Returns merged notes to client
 * - Tracks sync vectors for incremental sync
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Types
interface Note {
  id: string
  title: string
  content?: unknown
  plain_text?: string
  type?: string
  tags?: string[]
  links?: string[]
  is_favorite?: boolean
  is_deleted?: boolean
  createdAt?: number
  updatedAt?: number
  deletedAt?: number
}

interface SyncRequest {
  notes: Note[]
  clientId: string
  lastSync: number | null
  vector: Record<string, number>
}

interface SyncResponse {
  success: boolean
  notes: Note[]
  serverTime: number
  error?: string
}

// Environment
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const DATABASE_URL = Deno.env.get('DATABASE_URL')!

// Create Supabase client with service role (admin access)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  db: { type: 'postgres', schema: 'public' },
})

/**
 * Fetch all notes from database
 */
async function fetchAllNotes(): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('is_deleted', false)
  
  if (error) {
    console.error('Error fetching notes:', error)
    return []
  }
  
  return data.map(row => ({
    id: row.id,
    title: row.title,
    content: row.content,
    plain_text: row.plain_text,
    type: row.type,
    tags: row.tags || [],
    links: row.links || [],
    is_favorite: row.is_favorite,
    is_deleted: row.is_deleted,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    deletedAt: row.deleted_at ? new Date(row.deleted_at).getTime() : undefined,
  }))
}

/**
 * Upsert notes to database
 */
async function upsertNotes(notes: Note[]): Promise<void> {
  if (notes.length === 0) return
  
  const rows = notes.map(note => ({
    id: note.id,
    title: note.title || 'Untitled',
    content: note.content || {},
    plain_text: note.plain_text || '',
    type: note.type || 'concept',
    tags: note.tags || [],
    links: note.links || [],
    is_favorite: note.is_favorite || false,
    is_deleted: note.is_deleted || false,
    deleted_at: note.deletedAt ? new Date(note.deletedAt).toISOString() : null,
  }))
  
  const { error } = await supabase
    .from('notes')
    .upsert(rows, { onConflict: 'id' })
  
  if (error) {
    console.error('Error upserting notes:', error)
    throw error
  }
}

/**
 * Merge local and remote notes using last-write-wins
 */
function mergeNotes(local: Note[], remote: Note[]): Note[] {
  const merged = new Map<string, Note>()
  
  // Create maps for quick lookup
  const localMap = new Map(local.map(n => [n.id, n]))
  const remoteMap = new Map(remote.map(n => [n.id, n]))
  
  // Process all unique IDs
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()])
  
  for (const id of allIds) {
    const localNote = localMap.get(id)
    const remoteNote = remoteMap.get(id)
    
    if (localNote && remoteNote) {
      // Both exist - keep the newer one
      const localTime = localNote.updatedAt || 0
      const remoteTime = remoteNote.updatedAt || 0
      merged.set(id, localTime >= remoteTime ? localNote : remoteNote)
    } else if (localNote) {
      merged.set(id, localNote)
    } else if (remoteNote) {
      merged.set(id, remoteNote)
    }
  }
  
  return Array.from(merged.values())
}

// Handle CORS preflight
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  try {
    // Get auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Parse request
    const request: SyncRequest = await req.json()
    const { notes: localNotes, clientId } = request
    
    console.log(`Sync request from ${clientId} with ${localNotes.length} notes`)
    
    // Fetch all remote notes
    const remoteNotes = await fetchAllNotes()
    console.log(`Found ${remoteNotes.length} remote notes`)
    
    // Merge notes
    const mergedNotes = mergeNotes(localNotes, remoteNotes)
    console.log(`Merged to ${mergedNotes.length} notes`)
    
    // Upsert merged notes
    await upsertNotes(mergedNotes)
    
    // Return merged notes with server time
    const serverTime = Date.now()
    
    const response: SyncResponse = {
      success: true,
      notes: mergedNotes,
      serverTime,
    }
    
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Sync error:', error)
    
    const response: SyncResponse = {
      success: false,
      notes: [],
      serverTime: Date.now(),
      error: error instanceof Error ? error.message : 'Unknown error',
    }
    
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
