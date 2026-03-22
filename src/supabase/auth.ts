/**
 * Supabase Auth Module
 * 
 * Handles user authentication: register, login, logout, session management
 */

import { getSupabase, isSupabaseConfigured } from './client'
import type { User, AuthError } from '@supabase/supabase-js'

// Auth state interface
export interface AuthState {
  user: User | null
  isLoading: boolean
  error: string | null
}

// Current auth state (reactive via event listeners)
let currentUser: User | null = null
let authListeners: ((user: User | null) => void)[] = []

// Initialize auth state from stored session
export async function initAuth(): Promise<User | null> {
  if (!isSupabaseConfigured()) {
    console.warn('[Auth] Supabase not configured, using local mode')
    return null
  }

  const supabase = getSupabase()
  if (!supabase) return null

  try {
    // Get current session
    const { data: { session } } = await supabase.auth.getSession()
    currentUser = session?.user ?? null
    
    // Listen for auth changes
    supabase.auth.onAuthStateChange((event, session) => {
      currentUser = session?.user ?? null
      notifyListeners(currentUser)
    })

    return currentUser
  } catch (error) {
    console.error('[Auth] Init error:', error)
    return null
  }
}

// Get current user
export function getCurrentUser(): User | null {
  return currentUser
}

// Subscribe to auth changes
export function onAuthChange(callback: (user: User | null) => void): () => void {
  authListeners.push(callback)
  return () => {
    authListeners = authListeners.filter(l => l !== callback)
  }
}

function notifyListeners(user: User | null) {
  authListeners.forEach(l => l(user))
}

// Sign up with email and password
export async function signUp(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { user: null, error: 'Supabase 未配置' }
  }

  const supabase = getSupabase()
  if (!supabase) return { user: null, error: '无法连接服务器' }

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      return { user: null, error: error.message }
    }

    currentUser = data.user
    notifyListeners(currentUser)
    return { user: data.user, error: null }
  } catch (error: any) {
    return { user: null, error: error.message || '注册失败' }
  }
}

// Sign in with email and password
export async function signIn(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { user: null, error: 'Supabase 未配置' }
  }

  const supabase = getSupabase()
  if (!supabase) return { user: null, error: '无法连接服务器' }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return { user: null, error: error.message }
    }

    currentUser = data.user
    notifyListeners(currentUser)
    return { user: data.user, error: null }
  } catch (error: any) {
    return { user: null, error: error.message || '登录失败' }
  }
}

// Sign out
export async function signOut(): Promise<{ error: string | null }> {
  const supabase = getSupabase()
  if (!supabase) return { error: null }

  try {
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      return { error: error.message }
    }

    currentUser = null
    notifyListeners(null)
    return { error: null }
  } catch (error: any) {
    return { error: error.message || '退出失败' }
  }
}

// Update user metadata (e.g., display name)
export async function updateUserMetadata(data: { data: { display_name?: string } }): Promise<{ error: string | null }> {
  const supabase = getSupabase()
  if (!supabase) return { error: '未连接' }

  try {
    const { error } = await supabase.auth.updateUser(data)
    if (error) {
      return { error: error.message }
    }
    return { error: null }
  } catch (error: any) {
    return { error: error.message || '更新失败' }
  }
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  return currentUser !== null
}

// Get user ID
export function getUserId(): string | null {
  return currentUser?.id ?? null
}

// Get user email
export function getUserEmail(): string | null {
  return currentUser?.email ?? null
}
