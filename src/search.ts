export type SearchDimension = 'all' | 'title' | 'content' | 'tag' | 'folder' | 'type'

export type Doc = {
  id: string
  title: string
  content: string
  tags?: string[]
  folderId?: string
  type?: string
}

export class SimpleSearch {
  private index: Map<string, string[]> = new Map()
  private docs: Map<string, Doc> = new Map()

  // Dimension-specific indexes
  private titleIndex: Map<string, string[]> = new Map()
  private contentIndex: Map<string, string[]> = new Map()
  private tagIndex: Map<string, string[]> = new Map()
  private folderIndex: Map<string, string[]> = new Map()
  private typeIndex: Map<string, string[]> = new Map()

  build(docs: Doc[]) {
    // Clear all indexes
    this.index.clear()
    this.docs.clear()
    this.titleIndex.clear()
    this.contentIndex.clear()
    this.tagIndex.clear()
    this.folderIndex.clear()
    this.typeIndex.clear()

    for (const d of docs) {
      this.docs.set(d.id, d)

      // Build main index
      const tokens = this.tokenize(`${d.title} ${d.content} ${(d.tags || []).join(' ')}`)
      for (const t of tokens) {
        const list = this.index.get(t) || []
        if (!list.includes(d.id)) list.push(d.id)
        this.index.set(t, list)
      }

      // Build title index
      const titleTokens = this.tokenize(d.title)
      for (const t of titleTokens) {
        const list = this.titleIndex.get(t) || []
        if (!list.includes(d.id)) list.push(d.id)
        this.titleIndex.set(t, list)
      }

      // Build content index
      const contentTokens = this.tokenize(d.content)
      for (const t of contentTokens) {
        const list = this.contentIndex.get(t) || []
        if (!list.includes(d.id)) list.push(d.id)
        this.contentIndex.set(t, list)
      }

      // Build tag index
      for (const tag of d.tags || []) {
        const tagTokens = this.tokenize(tag)
        for (const t of tagTokens) {
          const list = this.tagIndex.get(t) || []
          if (!list.includes(d.id)) list.push(d.id)
          this.tagIndex.set(t, list)
        }
      }

      // Build folder index (exact match)
      if (d.folderId) {
        const list = this.folderIndex.get(d.folderId) || []
        if (!list.includes(d.id)) list.push(d.id)
        this.folderIndex.set(d.folderId, list)
      }

      // Build type index (exact match)
      if (d.type) {
        const list = this.typeIndex.get(d.type) || []
        if (!list.includes(d.id)) list.push(d.id)
        this.typeIndex.set(d.type, list)
      }
    }
  }

  search(q: string, dimension: SearchDimension = 'all'): Doc[] {
    const tokens = this.tokenize(q)
    const resultIds = new Set<string>()

    if (tokens.length === 0) {
      // Return all docs when no query
      this.docs.forEach((d) => resultIds.add(d.id))
    } else {
      const targetIndex = this.getIndexForDimension(dimension)
      
      for (const t of tokens) {
        const ids = targetIndex.get(t)
        if (ids) ids.forEach((id) => resultIds.add(id))
      }
    }

    const res: Doc[] = []
    resultIds.forEach((id) => {
      const d = this.docs.get(id)
      if (d) res.push(d)
    })
    return res
  }

  private getIndexForDimension(dimension: SearchDimension): Map<string, string[]> {
    switch (dimension) {
      case 'title':
        return this.titleIndex
      case 'content':
        return this.contentIndex
      case 'tag':
        return this.tagIndex
      case 'folder':
        return this.folderIndex
      case 'type':
        return this.typeIndex
      case 'all':
      default:
        return this.index
    }
  }

  private tokenize(s: string) {
    return s.toLowerCase().split(/[^a-z0-9\u4e00-\u9fa5]+/).filter((w) => w.length > 0)
  }
}

export default new SimpleSearch()
