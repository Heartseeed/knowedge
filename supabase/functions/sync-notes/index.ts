/**
 * Supabase Edge Function: sync-notes
 * 
 * Handles note synchronization with multi-user support.
 * - Authenticates users via JWT
 * - Filters notes by user_id
 * - Supports full sync and incremental sync
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface Note {
  id: string
  user_id?: string
  title: string
  content?: unknown
  plain_text?: string
  type?: string
  status?: string
  folderId?: string
  tags?: string[]
  links?: string[]
  starred?: boolean
  pinned?: boolean
  is_deleted?: boolean
  deletedAt?: number
  reviewCount?: number
  nextReviewAt?: number
  easeFactor?: number
  interval?: number
  createdAt?: number
  updatedAt?: number
}

interface SyncRequest {
  notes: Note[]
  userId: string
  lastSync: number | null
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

// Create Supabase client with service role (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  db: { type: 'postgres', schema: 'public' },
})

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Verify JWT token and extract user ID
 */
async function verifyToken(authHeader: string): Promise<string | null> {
  try {
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user.id
  } catch {
    return null
  }
}

/**
 * Fetch notes for a specific user
 */
async function fetchUserNotes(userId: string, lastSync: number | null): Promise<Note[]> {
  let query = supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .eq('is_deleted', false)

  if (lastSync) {
    query = query.gt('updated_at', new Date(lastSync).toISOString())
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching notes:', error)
    return []
  }

  return data.map(row => ({
    id: row.local_id || row.id,
    user_id: row.user_id,
    title: row.title,
    content: row.content,
    plain_text: row.plain_text,
    type: row.type,
    status: row.status,
    folderId: row.folder_id,
    tags: row.tags || [],
    links: row.links || [],
    starred: row.starred,
    pinned: row.pinned,
    is_deleted: row.is_deleted,
    deletedAt: row.deleted_at ? new Date(row.deleted_at).getTime() : undefined,
    reviewCount: row.review_count,
    nextReviewAt: row.next_review_at ? new Date(row.next_review_at).getTime() : undefined,
    easeFactor: row.ease_factor,
    interval: row.interval_days,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  }))
}

/**
 * Upsert notes to database
 */
async function upsertNotes(notes: Note[], userId: string): Promise<void> {
  if (notes.length === 0) return

  const rows = notes.map(note => ({
    id: note.id.startsWith('sample-') || note.id.startsWith('n_') || note.id.startsWith('local_')
      ? undefined  // Let DB generate new UUID
      : note.id,
    user_id: userId,
    local_id: note.id,
    title: note.title || 'Untitled',
    content: note.content || {},
    plain_text: note.plain_text || '',
    type: note.type || 'concept',
    status: note.status || 'inbox',
    folder_id: note.folderId || null,
    tags: note.tags || [],
    links: note.links || [],
    starred: note.starred || false,
    pinned: note.pinned || false,
    is_deleted: note.is_deleted || false,
    deleted_at: note.deletedAt ? new Date(note.deletedAt).toISOString() : null,
    review_count: note.reviewCount || 0,
    next_review_at: note.nextReviewAt ? new Date(note.nextReviewAt).toISOString() : null,
    ease_factor: note.easeFactor || 2.5,
    interval_days: note.interval || 1,
    updated_at: new Date(note.updatedAt || Date.now()).toISOString(),
  }))

  const { error } = await supabase
    .from('notes')
    .upsert(rows, { onConflict: 'local_id' })

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

  const localMap = new Map(local.map(n => [n.id, n]))
  const remoteMap = new Map(remote.map(n => [n.id, n]))

  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()])

  for (const id of allIds) {
    const localNote = localMap.get(id)
    const remoteNote = remoteMap.get(id)

    if (localNote && remoteNote) {
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify token and get user ID
    const userId = await verifyToken(authHeader)
    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const request: SyncRequest = await req.json()
    const { notes: localNotes, userId: requestUserId, lastSync } = request

    console.log(`Sync for user ${requestUserId}: ${localNotes.length} local notes, last sync: ${lastSync}`)

    // Fetch user's notes from server
    const remoteNotes = await fetchUserNotes(requestUserId, lastSync)
    console.log(`Found ${remoteNotes.length} remote notes`)

    // Merge notes
    const mergedNotes = mergeNotes(localNotes, remoteNotes)
    console.log(`Merged to ${mergedNotes.length} notes`)

    // Save merged notes to server
    await upsertNotes(mergedNotes, requestUserId)

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
