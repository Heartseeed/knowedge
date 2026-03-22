/**
 * Backlinks and Wiki-link System
 * 
 * Supports [[wiki-style links]] with autocomplete and bidirectional linking
 */

// Regex pattern for wiki-links: [[link text]] or [[link|id]]
const WIKI_LINK_REGEX = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

export interface WikiLink {
  fullMatch: string      // [[full match]]
  target: string         // The target note identifier or title
  displayText: string    // The display text (after |)
  startIndex: number     // Start position in content
  endIndex: number       // End position in content
}

export interface Backlink {
  sourceNoteId: string   // Note that contains the link
  sourceNoteTitle: string
  targetNoteId: string    // Note being linked to
  displayText: string    // How the link appears in source
  context: string        // Surrounding text for preview
}

export interface LinkSuggestion {
  id: string
  title: string
  excerpt: string        // Content snippet
  matchScore: number    // Relevance score for fuzzy search
}

/**
 * Parse wiki-links from content string
 */
export function parseWikiLinks(content: string): WikiLink[] {
  const links: WikiLink[] = []
  let match: RegExpExecArray | null
  
  // Reset regex state
  WIKI_LINK_REGEX.lastIndex = 0
  
  while ((match = WIKI_LINK_REGEX.exec(content)) !== null) {
    links.push({
      fullMatch: match[0],
      target: match[1].trim(),
      displayText: (match[2] || match[1]).trim(),
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    })
  }
  
  return links
}

/**
 * Extract all unique link targets from content
 */
export function extractLinkTargets(content: string): string[] {
  const links = parseWikiLinks(content)
  const targets = links.map(l => l.target)
  return [...new Set(targets)]
}

/**
 * Convert wiki-link to HTML anchor tag
 */
export function wikiLinkToHtml(
  link: WikiLink,
  noteIdMap: Map<string, string>, // title -> id mapping
  className: string = 'ke-wiki-link'
): string {
  const noteId = noteIdMap.get(link.target) || link.target
  const displayText = escapeHtml(link.displayText)
  
  return `<a href="#" class="${className}" data-note-id="${escapeHtml(noteId)}">${displayText}</a>`
}

/**
 * Transform all wiki-links in content to HTML
 */
export function transformWikiLinksToHtml(
  content: string,
  noteIdMap: Map<string, string>
): string {
  return content.replace(WIKI_LINK_REGEX, (match, target, displayText) => {
    const noteId = noteIdMap.get(target.trim()) || target.trim()
    const text = (displayText || target).trim()
    return `<a href="#" class="ke-wiki-link" data-note-id="${escapeHtml(noteId)}">${escapeHtml(text)}</a>`
  })
}

/**
 * Note with minimal fields for search
 */
interface SearchableNote {
  id: string
  title: string
  content: string
  updatedAt?: number
}

/**
 * Fuzzy search for link suggestions
 */
export function findLinkSuggestions(
  query: string,
  notes: SearchableNote[],
  excludeId?: string,
  limit: number = 10
): LinkSuggestion[] {
  if (!query.trim()) {
    // Return recent notes if no query
    return notes
      .filter(n => n.id !== excludeId)
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
      .slice(0, limit)
      .map(n => ({
        id: n.id,
        title: n.title,
        excerpt: getContentExcerpt(n.content, 50),
        matchScore: 1,
      }))
  }
  
  const lowerQuery = query.toLowerCase()
  
  // Score each note
  const scored = notes
    .filter(n => n.id !== excludeId)
    .map(note => {
      const titleLower = note.title.toLowerCase()
      const contentLower = note.content.toLowerCase()
      
      let score = 0
      
      // Exact title match
      if (titleLower === lowerQuery) score += 100
      // Title starts with query
      else if (titleLower.startsWith(lowerQuery)) score += 50
      // Title contains query
      else if (titleLower.includes(lowerQuery)) score += 30
      // Content contains query
      else if (contentLower.includes(lowerQuery)) score += 10
      
      // Fuzzy match bonus
      if (fuzzyMatch(lowerQuery, titleLower)) score += 20
      
      return {
        ...note,
        matchScore: score,
      }
    })
    .filter(n => n.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit)
  
  return scored.map(n => ({
    id: n.id,
    title: n.title,
    excerpt: getContentExcerpt(n.content, 50),
    matchScore: n.matchScore,
  }))
}

/**
 * Note with minimal fields for backlink building
 */
interface BacklinkNote {
  id: string
  title: string
  content: string
}

/**
 * Build bidirectional link map
 */
export function buildBacklinkMap(
  notes: BacklinkNote[]
): Map<string, Backlink[]> {
  const noteTitleToId = new Map<string, string>()
  notes.forEach(n => noteTitleToId.set(n.title.toLowerCase(), n.id))
  
  const backlinkMap = new Map<string, Backlink[]>()
  
  // Initialize empty arrays for all notes
  notes.forEach(n => backlinkMap.set(n.id, []))
  
  notes.forEach(sourceNote => {
    const links = parseWikiLinks(sourceNote.content)
    
    links.forEach(link => {
      const targetId = noteTitleToId.get(link.target.toLowerCase()) || link.target
      
      if (backlinkMap.has(targetId)) {
        const context = getLinkContext(sourceNote.content, link.startIndex)
        
        backlinkMap.get(targetId)!.push({
          sourceNoteId: sourceNote.id,
          sourceNoteTitle: sourceNote.title,
          targetNoteId: targetId,
          displayText: link.displayText,
          context,
        })
      }
    })
  })
  
  return backlinkMap
}

/**
 * Get backlinks for a specific note
 */
export function getBacklinks(
  noteId: string,
  notes: BacklinkNote[]
): Backlink[] {
  const backlinkMap = buildBacklinkMap(notes)
  return backlinkMap.get(noteId) || []
}

/**
 * Check if two notes are directly linked
 */
export function areLinked(note1Id: string, note2Id: string, notes: ConnectedNote[]): boolean {
  const note1 = notes.find(n => n.id === note1Id)
  if (!note1) return false
  
  const links = parseWikiLinks(note1.content)
  return links.some(l => l.target === note2Id)
}

/**
 * Note with id and content for connection checking
 */
interface ConnectedNote {
  id: string
  title: string
  content: string
}

/**
 * Get all notes connected (directly or indirectly) to a note
 */
export function getConnectedNotes(
  noteId: string,
  notes: ConnectedNote[],
  maxDepth: number = 2
): Set<string> {
  const connected = new Set<string>()
  const queue: Array<{ id: string; depth: number }> = [{ id: noteId, depth: 0 }]
  
  while (queue.length > 0) {
    const { id, depth } = queue.shift()!
    
    if (depth >= maxDepth) continue
    
    const note = notes.find(n => n.id === id)
    if (!note) continue
    
    const links = parseWikiLinks(note.content)
    
    links.forEach(link => {
      const linkedId = notes.find(n => n.title.toLowerCase() === link.target.toLowerCase())?.id || link.target
      
      if (!connected.has(linkedId) && linkedId !== noteId) {
        connected.add(linkedId)
        queue.push({ id: linkedId, depth: depth + 1 })
      }
    })
    
    // Also check incoming links
    notes.forEach(n => {
      if (n.id === id || connected.has(n.id)) return
      const links = parseWikiLinks(n.content)
      if (links.some(l => l.target === note.title || l.target === note.id)) {
        connected.add(n.id)
        queue.push({ id: n.id, depth: depth + 1 })
      }
    })
  }
  
  return connected
}

// ===== Helper Functions =====

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }
  return text.replace(/[&<>"']/g, m => map[m])
}

function getContentExcerpt(content: string, maxLength: number): string {
  // Remove HTML tags
  const text = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  
  if (text.length <= maxLength) return text
  
  // Try to break at word boundary
  const truncated = text.slice(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')
  
  return (lastSpace > maxLength * 0.7 ? truncated.slice(0, lastSpace) : truncated) + '...'
}

function getLinkContext(content: string, linkIndex: number): string {
  const contextRadius = 50
  const start = Math.max(0, linkIndex - contextRadius)
  const end = Math.min(content.length, linkIndex + contextRadius)
  
  let context = content.slice(start, end)
  
  if (start > 0) context = '...' + context
  if (end < content.length) context = context + '...'
  
  // Clean up HTML for display
  return context.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

function fuzzyMatch(query: string, text: string): boolean {
  let queryIdx = 0
  
  for (let i = 0; i < text.length && queryIdx < query.length; i++) {
    if (text[i] === query[queryIdx]) {
      queryIdx++
    }
  }
  
  return queryIdx === query.length
}
