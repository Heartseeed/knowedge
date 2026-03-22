/**
 * Supabase Storage Upload Utility
 * Handles file uploads to Supabase Storage bucket
 */

import { getSupabase, getDeviceId, isSupabaseConfigured } from '../supabase/client'
import type { Attachment, AttachmentType } from '../kb/types'
import { putAttachment, generateId } from '../db/indexeddb'

const STORAGE_BUCKET = 'attachments'

// Get file extension from filename
function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : ''
}

// Get file type category
export function getFileTypeFromMime(mimeType: string): AttachmentType {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType.includes('word') || mimeType.includes('document')) return 'word'
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'excel'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.startsWith('video/')) return 'video'
  return 'other'
}

// Generate storage path
function generateStoragePath(noteId: string, filename: string): string {
  const deviceId = getDeviceId()
  const timestamp = Date.now()
  const ext = getFileExtension(filename)
  const baseName = filename.replace(`.${ext}`, '').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
  return `${deviceId}/${noteId}/${timestamp}_${baseName}.${ext}`
}

// Check if Supabase Storage is configured
export function isStorageConfigured(): boolean {
  return isSupabaseConfigured()
}

export interface UploadProgress {
  progress: number
  status: 'pending' | 'uploading' | 'uploaded' | 'failed'
  error?: string
}

export interface UploadResult {
  success: boolean
  attachment?: Attachment
  error?: string
  localUrl?: string // Fallback URL if cloud upload fails
}

/**
 * Upload file to Supabase Storage and create attachment record
 */
export async function uploadFile(
  file: File,
  noteId: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  const id = generateId('att')
  const now = Date.now()
  const fileType = getFileTypeFromMime(file.type)
  
  // Create local blob URL for immediate preview
  const localUrl = URL.createObjectURL(file)
  
  onProgress?.({ progress: 10, status: 'uploading' })
  
  // Create local attachment record first (offline-first)
  const attachment: Attachment = {
    id,
    noteId,
    name: file.name,
    type: fileType,
    mimeType: file.type,
    size: file.size,
    status: 'pending',
    localUrl,
    createdAt: now,
  }
  
  await putAttachment(attachment)
  
  // Try cloud upload
  const supabase = getSupabase()
  
  if (!supabase) {
    // No Supabase configured, use local storage only
    attachment.status = 'uploaded'
    await putAttachment(attachment)
    onProgress?.({ progress: 100, status: 'uploaded' })
    return {
      success: true,
      attachment,
      localUrl,
    }
  }
  
  try {
    const storagePath = generateStoragePath(noteId, file.name)
    
    onProgress?.({ progress: 30, status: 'uploading' })
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      })
    
    if (error) {
      throw error
    }
    
    onProgress?.({ progress: 90, status: 'uploading' })
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path)
    
    // Update attachment with remote URL
    attachment.status = 'uploaded'
    attachment.remoteUrl = urlData.publicUrl
    await putAttachment(attachment)
    
    onProgress?.({ progress: 100, status: 'uploaded' })
    
    return {
      success: true,
      attachment,
      localUrl,
    }
  } catch (err) {
    // Cloud upload failed, keep local version
    console.error('[Upload] Cloud upload failed, using local storage:', err)
    
    attachment.status = 'uploaded' // Local upload succeeded
    await putAttachment(attachment)
    
    onProgress?.({ 
      progress: 100, 
      status: 'uploaded',
      error: err instanceof Error ? err.message : 'Cloud upload failed, saved locally'
    })
    
    return {
      success: true,
      attachment,
      localUrl,
      error: 'Cloud upload failed, saved locally',
    }
  }
}

/**
 * Delete file from Supabase Storage
 */
export async function deleteFileFromCloud(attachment: Attachment): Promise<boolean> {
  const supabase = getSupabase()
  if (!supabase || !attachment.remoteUrl) return false
  
  try {
    // Extract path from URL
    const url = new URL(attachment.remoteUrl)
    const pathParts = url.pathname.split('/')
    const bucketIndex = pathParts.indexOf(STORAGE_BUCKET)
    if (bucketIndex === -1) return false
    
    const storagePath = pathParts.slice(bucketIndex + 1).join('/')
    
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([storagePath])
    
    if (error) {
      console.error('[Upload] Delete from cloud failed:', error)
      return false
    }
    
    return true
  } catch (err) {
    console.error('[Upload] Delete from cloud error:', err)
    return false
  }
}

/**
 * Generate HTML for inserting attachment into editor
 */
export function generateAttachmentHtml(attachment: Attachment): string {
  const { type, name, localUrl, remoteUrl, size } = attachment
  const url = remoteUrl || localUrl || ''
  
  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  
  switch (type) {
    case 'image':
      return `<img src="${url}" alt="${name}" data-attachment-id="${attachment.id}" style="max-width: 100%; height: auto; border-radius: 8px; margin: 12px 0;" />`
    
    case 'video':
      return `<video controls data-attachment-id="${attachment.id}" style="max-width: 100%; border-radius: 8px; margin: 12px 0;">
        <source src="${url}" type="${attachment.mimeType}">
        您的浏览器不支持视频播放
      </video>`
    
    case 'audio':
      return `<audio controls data-attachment-id="${attachment.id}" style="width: 100%; margin: 12px 0;">
        <source src="${url}" type="${attachment.mimeType}">
        您的浏览器不支持音频播放
      </audio>`
    
    case 'pdf':
      return `<div class="ke-attachment ke-attachment--pdf" data-attachment-id="${attachment.id}">
        <div class="ke-attachment__icon">📄</div>
        <div class="ke-attachment__info">
          <span class="ke-attachment__name">${name}</span>
          <span class="ke-attachment__size">${formatSize(size)}</span>
        </div>
        <a href="${url}" target="_blank" class="ke-attachment__action" title="打开">↗</a>
        <a href="${url}" download="${name}" class="ke-attachment__action" title="下载">⬇</a>
      </div>`
    
    case 'word':
    case 'excel':
      const icon = type === 'word' ? '📝' : '📊'
      return `<div class="ke-attachment ke-attachment--${type}" data-attachment-id="${attachment.id}">
        <div class="ke-attachment__icon">${icon}</div>
        <div class="ke-attachment__info">
          <span class="ke-attachment__name">${name}</span>
          <span class="ke-attachment__size">${formatSize(size)}</span>
        </div>
        <a href="${url}" target="_blank" class="ke-attachment__action" title="打开">↗</a>
        <a href="${url}" download="${name}" class="ke-attachment__action" title="下载">⬇</a>
      </div>`
    
    default:
      return `<div class="ke-attachment ke-attachment--file" data-attachment-id="${attachment.id}">
        <div class="ke-attachment__icon">📎</div>
        <div class="ke-attachment__info">
          <span class="ke-attachment__name">${name}</span>
          <span class="ke-attachment__size">${formatSize(size)}</span>
        </div>
        <a href="${url}" download="${name}" class="ke-attachment__action" title="下载">⬇</a>
      </div>`
  }
}
