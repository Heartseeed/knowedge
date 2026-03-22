/**
 * Supabase Client Setup
 * 
 * Initialize Supabase client for KnowEdge sync
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Environment variables (set in .env)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Device ID for identifying this browser
function getDeviceId(): string {
  let deviceId = localStorage.getItem('knowedge_device_id')
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
    localStorage.setItem('knowedge_device_id', deviceId)
  }
  return deviceId
}

// Create Supabase client
export function createSupabaseClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[Supabase] Missing environment variables. Sync disabled.')
    return null
  }
  
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false, // We use local storage for notes
      autoRefreshToken: false,
    },
  })
}

// Singleton instance
let supabaseInstance: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (!supabaseInstance) {
    supabaseInstance = createSupabaseClient()
  }
  return supabaseInstance
}

// Export device ID getter
export { getDeviceId }

// Check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY)
}
