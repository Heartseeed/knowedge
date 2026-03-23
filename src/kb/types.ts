export type Folder = {
  id: string
  name: string
  icon?: string
  parentId?: string
  createdAt?: number
}

export type Tag = {
  id: string
  name: string
  count: number
}

export type NoteType = 'concept' | 'reading' | 'practice' | 'idea' | 'card' | 'tutorial' | 'project' | 'other'

export type NoteStatus = 'inbox' | 'organized' | 'connected'

export type ReviewLevel = 'easy' | 'medium' | 'hard'

export type Note = {
  id: string
  title: string
  content: string
  type: NoteType
  status: NoteStatus
  folderId?: string
  tags: string[]
  links: string[] // ids of linked notes
  createdAt: number
  updatedAt: number
  // Spaced repetition fields
  reviewCount: number
  nextReviewAt: number
  easeFactor: number // SM-2 algorithm
  interval: number // days
  // Custom review days (user-defined)
  customReviewDays?: number
  // Pin and trash
  pinned?: boolean
  deletedAt?: number // timestamp when moved to trash, undefined means not deleted
  // Today Must-Read feature
  mustRead?: boolean
  mustReadDate?: number // timestamp when marked as must-read
  // Sync fields
  isSynced?: boolean
  remoteId?: string // Supabase ID
  // Attachments
  attachments?: string[] // Attachment IDs
}

// Attachment types
export type AttachmentType = 'image' | 'pdf' | 'word' | 'excel' | 'audio' | 'video' | 'other'

export type AttachmentStatus = 'pending' | 'uploading' | 'uploaded' | 'failed'

export type Attachment = {
  id: string
  noteId: string
  name: string
  type: AttachmentType
  mimeType: string
  size: number // bytes
  status: AttachmentStatus
  localUrl?: string // Local blob URL
  remoteUrl?: string // Supabase Storage URL
  previewUrl?: string // Thumbnail URL for images
  createdAt: number
}

// Supported file types
export const SUPPORTED_FILE_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  pdf: ['application/pdf'],
  word: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  excel: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
}

export const FILE_TYPE_EXTENSIONS: Record<AttachmentType, string[]> = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
  pdf: ['pdf'],
  word: ['doc', 'docx'],
  excel: ['xls', 'xlsx'],
  audio: ['mp3', 'wav', 'ogg', 'm4a'],
  video: ['mp4', 'webm', 'mov'],
  other: [],
}

// File size limits
export const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB per file
export const MAX_TOTAL_SIZE = 150 * 1024 * 1024 // 150MB per note

// Helper function to get file type from MIME
export function getFileType(mimeType: string): AttachmentType {
  if (SUPPORTED_FILE_TYPES.image.includes(mimeType)) return 'image'
  if (SUPPORTED_FILE_TYPES.pdf.includes(mimeType)) return 'pdf'
  if (SUPPORTED_FILE_TYPES.word.includes(mimeType)) return 'word'
  if (SUPPORTED_FILE_TYPES.excel.includes(mimeType)) return 'excel'
  if (SUPPORTED_FILE_TYPES.audio.includes(mimeType)) return 'audio'
  if (SUPPORTED_FILE_TYPES.video.includes(mimeType)) return 'video'
  return 'other'
}

// Helper function to get file icon
export function getFileIcon(type: AttachmentType): string {
  const icons: Record<AttachmentType, string> = {
    image: '🖼️',
    pdf: '📄',
    word: '📝',
    excel: '📊',
    audio: '🎵',
    video: '🎬',
    other: '📎',
  }
  return icons[type]
}

export type ReviewItem = {
  note: Note
  isOverdue: boolean
  dueLabel: string
}

export type ReviewItemSimple = {
  id: string
  title: string
  dueCount?: number
}

export type ReviewQueue = {
  today: ReviewItemSimple[]
  recommend: ReviewItemSimple[]
  explore: ReviewItemSimple[]
}

export type GraphNode = {
  id: string
  label: string
  type: NoteType
  x?: number
  y?: number
}

export type GraphEdge = {
  from: string
  to: string
  type: 'causal' | 'extends' | 'contrast'
}

export type WritingHint = {
  type: 'example' | 'link' | 'split' | 'expand'
  text: string
  score: number
}

// UI State types
export type LeftNavSection = 'folders' | 'inbox' | 'starred' | 'trash' | 'network' | 'timeline'

export type ViewMode = 'edit' | 'preview' | 'split'
