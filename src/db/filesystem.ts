/**
 * File-based Storage Adapter
 * 
 * This module provides an alternative storage option that saves notes as
 * individual .md files in a local folder, similar to Obsidian.
 * 
 * NOTE: This requires the app to run with additional permissions or as a desktop app.
 * For web-based deployment, you can use:
 * - Electron with node fs API
 * - Tauri with Rust fs API
 * - File System Access API (browser-native, requires user permission)
 * 
 * The File System Access API is used here for browser-based deployments.
 */

import type { Note } from './indexeddb'

export type StorageBackend = 'indexeddb' | 'filesystem'

export interface StorageConfig {
  backend: StorageBackend
  basePath?: string // For filesystem backend
}

export interface FileNote {
  id: string
  title: string
  content: string // Markdown content
  type: string
  status?: string
  tags?: string[]
  createdAt: number
  updatedAt: number
  folderId?: string
}

// Frontmatter for storing metadata
const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/

/**
 * FileSystemStorage - Handles saving notes as .md files
 */
export class FileSystemStorage {
  private basePath: string = ''
  private handle: FileSystemDirectoryHandle | null = null

  async init(basePath?: string): Promise<void> {
    this.basePath = basePath || 'KnowEdge'
    
    // Try to get directory handle
    try {
      if ('showDirectoryPicker' in window) {
        this.handle = await (window as any).showDirectoryPicker({
          mode: 'readwrite',
          startIn: 'documents',
        })
      }
    } catch (err) {
      console.warn('File System Access API not available:', err)
    }
  }

  async isAvailable(): Promise<boolean> {
    return 'showDirectoryPicker' in window
  }

  /**
   * Export a note to a .md file
   */
  async saveNote(note: Note): Promise<void> {
    const content = this.noteToMarkdown(note)
    const filename = this.sanitizeFilename(note.title) + '.md'
    
    if (this.handle) {
      // Use File System Access API
      const fileHandle = await this.handle.getFileHandle(filename, { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(content)
      await writable.close()
    } else if ('download' in document.createElement('a')) {
      // Fallback: Download as file
      this.downloadFile(filename, content)
    }
  }

  /**
   * Import a .md file as a note
   */
  async loadNote(file: File): Promise<FileNote | null> {
    try {
      const content = await file.text()
      return this.markdownToNote(content, file.name)
    } catch (err) {
      console.error('Failed to load note:', err)
      return null
    }
  }

  /**
   * Export all notes as individual .md files
   */
  async exportAllNotes(notes: Note[]): Promise<void> {
    if (!this.handle) {
      console.warn('Directory handle not available')
      return
    }

    for (const note of notes) {
      await this.saveNote(note)
    }
  }

  /**
   * Convert a Note to Markdown with YAML frontmatter
   */
  private noteToMarkdown(note: Note): string {
    const frontmatter = {
      id: note.id,
      type: note.type,
      status: note.status || 'inbox',
      tags: note.tags || [],
      createdAt: new Date(note.createdAt).toISOString(),
      updatedAt: new Date(note.updatedAt).toISOString(),
      folderId: note.folderId,
    }

    const fm = Object.entries(frontmatter)
      .filter(([_, v]) => v !== undefined)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join('\n')

    // Extract plain text from HTML content for Markdown
    const plainContent = note.contentMarkdown || note.content.replace(/<[^>]+>/g, '')

    return `---\n${fm}\n---\n\n# ${note.title}\n\n${plainContent}`
  }

  /**
   * Parse Markdown with frontmatter back to Note
   */
  private markdownToNote(content: string, filename: string): FileNote | null {
    const match = content.match(FRONTMATTER_REGEX)
    
    if (match) {
      try {
        const fm: Record<string, any> = {}
        match[1].split('\n').forEach(line => {
          const [key, ...valueParts] = line.split(':')
          if (key && valueParts.length) {
            const value = valueParts.join(':').trim()
            try {
              fm[key.trim()] = JSON.parse(value)
            } catch {
              fm[key.trim()] = value
            }
          }
        })
        
        return {
          id: fm.id || this.generateId(),
          title: this.extractTitle(match[2]) || filename.replace('.md', ''),
          content: match[2],
          type: fm.type || 'note',
          status: fm.status,
          tags: fm.tags || [],
          createdAt: fm.createdAt ? new Date(fm.createdAt).getTime() : Date.now(),
          updatedAt: fm.updatedAt ? new Date(fm.updatedAt).getTime() : Date.now(),
          folderId: fm.folderId,
        }
      } catch (err) {
        console.error('Failed to parse frontmatter:', err)
      }
    }

    // No frontmatter - treat entire content as note
    return {
      id: this.generateId(),
      title: filename.replace('.md', ''),
      content: content,
      type: 'note',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
  }

  private extractTitle(content: string): string {
    const match = content.match(/^#\s+(.+)$/m)
    return match ? match[1].trim() : ''
  }

  private sanitizeFilename(title: string): string {
    return title
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 100)
  }

  private generateId(): string {
    return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  }

  private downloadFile(filename: string, content: string): void {
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
}

/**
 * Storage Factory - Creates appropriate storage based on config
 */
export function createStorage(config: StorageConfig): FileSystemStorage | null {
  if (config.backend === 'filesystem') {
    return new FileSystemStorage()
  }
  return null
}

/**
 * Export notes as JSON (backup)
 */
export async function exportAsJson(notes: Note[]): Promise<void> {
  const data = JSON.stringify(notes, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `knowedge-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Import notes from JSON backup
 */
export async function importFromJson(file: File): Promise<Note[]> {
  const text = await file.text()
  return JSON.parse(text)
}
