export type Note = {
  id: string
  title: string
  content: string
  type: 'concept' | 'reading' | 'practice' | 'idea' | 'card' | 'note' | 'tutorial' | 'project' | 'other'
  status?: 'inbox' | 'organized' | 'connected'
  createdAt: number
  updatedAt: number
  folderId?: string
  tags?: string[]
  links?: string[]
  contentMarkdown?: string
  // Spaced repetition fields
  reviewCount?: number
  nextReviewAt?: number
  easeFactor?: number
  interval?: number
  // UI preferences
  starred?: boolean
  pinned?: boolean
  deletedAt?: number
  // Sync fields
  isSynced?: boolean
  remoteId?: string
}

// Version history snapshot type
export type NoteSnapshot = {
  id: string
  noteId: string
  title: string
  content: string
  contentMarkdown?: string
  createdAt: number
  reason: 'auto' | 'manual' | 'restore'
}

// Version restore point presets
export type RestorePoint = {
  label: string
  icon: string
  getTimestamp: () => number | null
  isLastVisit?: boolean
}

type DBInit = { error?: string }

class IndexedDBWrapper {
  private db?: IDBDatabase
  private readonly dbName = 'knowedge'
  private readonly version = 2
  async init(): Promise<void> {
    if (this.db) return
    const req = indexedDB.open(this.dbName, this.version)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('notes')) {
        db.createObjectStore('notes', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('attachments')) {
        db.createObjectStore('attachments', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('snapshots')) {
        const store = db.createObjectStore('snapshots', { keyPath: 'id' })
        store.createIndex('noteId', 'noteId', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }
    this.db = await new Promise<IDBDatabase>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  private getStore(storeName: string, mode: IDBTransactionMode): IDBObjectStore {
    const tx = this.db!.transaction(storeName, mode)
    return tx.objectStore(storeName)
  }
  async putNote(note: Note): Promise<void> {
    await this.init()
    return new Promise<void>((resolve, reject) => {
      const store = this.getStore('notes', 'readwrite')
      const req = store.put(note)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }
  async getNote(id: string): Promise<Note | undefined> {
    await this.init()
    return new Promise<Note | undefined>((resolve, reject) => {
      const store = this.getStore('notes', 'readonly')
      const req = store.get(id)
      req.onsuccess = () => resolve(req.result as Note | undefined)
      req.onerror = () => reject(req.error)
    })
  }
  async getAllNotes(): Promise<Note[]> {
    await this.init()
    return new Promise<Note[]>((resolve, reject) => {
      const store = this.getStore('notes', 'readonly')
      const req = store.openCursor()
      const out: Note[] = []
      req.onsuccess = () => {
        const cursor = req.result
        if (cursor) {
          out.push(cursor.value as Note)
          cursor.continue()
        } else {
          resolve(out)
        }
      }
      req.onerror = () => reject(req.error)
    })
  }

  // Generate complete sample notes
  private generateCompleteSamples(): Note[] {
    const now = Date.now()
    return [
      {
        id: 'sample-welcome',
        title: '👋 欢迎使用 KnowEdge',
        content: `<h2>欢迎使用 KnowEdge - 你的第二大脑</h2>
<p>KnowEdge 是一款专注于<strong>知识管理</strong>和<strong>间隔复习</strong>的个人知识库。</p>
<h3>🎯 核心功能</h3>
<ul>
<li>📝 <strong>双模式编辑</strong>：支持富文本和 Markdown 两种编辑模式</li>
<li>📁 <strong>文件夹分类</strong>：使用文件夹整理你的知识</li>
<li>🏷️ <strong>标签系统</strong>：为笔记添加标签，方便检索</li>
<li>📌 <strong>笔记置顶</strong>：重要笔记可以置顶显示</li>
<li>🔄 <strong>间隔复习</strong>：基于遗忘曲线的智能复习提醒</li>
<li>🔗 <strong>双向链接</strong>：输入 [[ 快速建立笔记关联</li>
<li>📎 <strong>文件嵌入</strong>：支持图片、PDF、Word、Excel、音视频直接嵌入笔记</li>
<li>☁️ <strong>云端同步</strong>：笔记和文件自动同步到云端</li>
<li>🗑️ <strong>回收站</strong>：删除的笔记30天内可恢复</li>
</ul>
<h3>🚀 快速开始</h3>
<ol>
<li>点击左上角 <strong>+ 新建</strong> 创建笔记</li>
<li>使用工具栏<strong>加粗、斜体、列表</strong>等格式化文本</li>
<li>点击笔记类型徽章<strong>切换笔记分类</strong></li>
<li>按 <kbd>Ctrl+K</kbd> 快速搜索笔记</li>
</ol>
<h3>⌨️ 快捷键</h3>
<ul>
<li><kbd>Ctrl+K</kbd> - 快速搜索</li>
<li><kbd>Ctrl+B</kbd> - 加粗</li>
<li><kbd>Ctrl+I</kbd> - 斜体</li>
<li><kbd>Ctrl+U</kbd> - 下划线</li>
</ul>
<h3>💡 提示</h3>
<p>笔记会自动保存，无需手动操作。删除的笔记会在回收站保留30天后自动清除。</p>`,
        type: 'tutorial',
        status: 'organized',
        folderId: 'root',
        tags: ['welcome', 'tutorial'],
        links: [],
        reviewCount: 0,
        nextReviewAt: now + 86400000,
        easeFactor: 2.5,
        interval: 1,
        createdAt: now,
        updatedAt: now,
        pinned: true,
      },
      {
        id: 'sample-guide',
        title: '📚 使用指南：如何高效使用 KnowEdge',
        content: `<h2>KnowEdge 使用指南</h2>
<p>本指南将帮助你快速上手 KnowEdge，掌握高效知识管理的方法。</p>
<h3>📝 第一步：创建笔记</h3>
<p>点击左侧导航栏的 <strong>+ 新建</strong> 按钮创建你的第一篇笔记。你可以选择不同的笔记类型：</p>
<ul>
<li><strong>概念</strong>：记录学习到的新概念</li>
<li><strong>读书笔记</strong>：整理阅读心得</li>
<li><strong>实践</strong>：记录实践经验和方法</li>
<li><strong>想法</strong>：捕捉一闪而过的灵感</li>
</ul>
<h3>🔗 第二步：建立关联</h3>
<p>使用 <strong>[[双向链接]]</strong> 功能，输入两个方括号即可快速链接到其他笔记。比如输入 <code>[[费曼学习法]]</code> 就能链接到相关笔记。</p>
<h3>📎 第三步：添加附件</h3>
<p>点击编辑器工具栏的 <strong>📎 插入文件</strong> 按钮，可以上传：</p>
<ul>
<li>🖼️ 图片 (jpg, png, gif, webp)</li>
<li>📄 PDF 文档</li>
<li>📝 Word 文档 (doc, docx)</li>
<li>📊 Excel 表格 (xls, xlsx)</li>
<li>🎵 音频 (mp3, wav, ogg)</li>
<li>🎬 视频 (mp4, webm, mov)</li>
</ul>
<h3>🔄 第四步：间隔复习</h3>
<p>KnowEdge 内置<strong>间隔复习</strong>功能，基于遗忘曲线帮你科学安排复习时间。重要笔记会自动进入复习队列。</p>
<h3>💡 最佳实践</h3>
<ol>
<li><strong>每天捕获</strong>：遇到有价值的信息，立即记录</li>
<li><strong>定期整理</strong>：将草稿箱的笔记分类整理</li>
<li><strong>建立链接</strong>：让笔记形成知识网络</li>
<li><strong>主动复习</strong>：按照提醒定期复习重要内容</li>
</ol>
<p>祝你使用愉快！🎉</p>`,
        type: 'tutorial',
        status: 'organized',
        folderId: 'root',
        tags: ['guide', 'tutorial'],
        links: ['sample-welcome'],
        reviewCount: 0,
        nextReviewAt: now + 86400000,
        easeFactor: 2.5,
        interval: 1,
        createdAt: now - 1000,
        updatedAt: now - 1000,
        pinned: true,
      },
      {
        id: 'sample-idea',
        title: '💡 关于远程工作的思考',
        content: `<h2>远程工作的未来</h2>
<p>远程工作正在成为主流趋势，我有以下几个想法：</p>
<h3>优势</h3>
<ul>
<li>节省通勤时间，可以用于学习和自我提升</li>
<li>地理自由，可以选择自己喜欢的地方生活</li>
<li>更好的工作与生活平衡</li>
</ul>
<h3>挑战</h3>
<ul>
<li>需要更强的自律能力</li>
<li>团队协作需要更好的工具支持</li>
<li>容易产生孤独感</li>
</ul>
<h3>可能的解决方案</h3>
<p>建立固定的线上社交时间，使用异步沟通工具，减少不必要的会议。</p>`,
        type: 'idea',
        status: 'organized',
        folderId: 'life',
        tags: ['remote-work', 'productivity'],
        links: [],
        reviewCount: 0,
        nextReviewAt: now + 86400000,
        easeFactor: 2.5,
        interval: 1,
        createdAt: now - 86400000,
        updatedAt: now - 86400000,
      },
      {
        id: 'sample-concept',
        title: '🧠 费曼学习法',
        content: `<h2>费曼学习法 - 概念笔记</h2>
<p>费曼学习法是一种高效的学习技巧，核心思想是"用简单的话解释复杂的概念"。</p>
<h3>四个步骤</h3>
<ol>
<li><strong>选择一个概念</strong>：选择你想学习的任何概念</li>
<li><strong>教给别人</strong>：假装你要把这个概念教给一个小孩</li>
<li><strong>发现缺口</strong>：在解释过程中遇到困难时，回到原始材料</li>
<li><strong>简化类比</strong>：用更简单的语言和类比来重新解释</li>
</ol>
<h3>为什么有效</h3>
<p>当我们无法用简单的语言解释一个概念时，说明我们还没有真正理解它。这个方法强迫我们深入思考，而不是停留在表面。</p>`,
        type: 'concept',
        status: 'organized',
        folderId: 'study',
        tags: ['learning', 'method', 'concept'],
        links: ['sample-idea'],
        reviewCount: 0,
        nextReviewAt: now + 86400000,
        easeFactor: 2.5,
        interval: 1,
        createdAt: now - 86400000 * 2,
        updatedAt: now - 86400000,
      },
      {
        id: 'sample-practice',
        title: '🧪 我的晨间习惯实践记录',
        content: `<h2>晨间习惯养成实践</h2>
<p>这是我坚持了30天的晨间习惯记录。</p>
<h3>目标习惯</h3>
<ul>
<li>6:00 起床</li>
<li>冥想 10 分钟</li>
<li>阅读 30 分钟</li>
<li>写日记 15 分钟</li>
</ul>
<h3>执行情况</h3>
<p>第1周完成率60%，第2周75%，第3周85%，第4周95%。</p>
<h3>关键发现</h3>
<p>设置多个闹钟、提前准备第二天衣物、避免晚上刷手机是关键成功因素。</p>`,
        type: 'practice',
        status: 'organized',
        folderId: 'life',
        tags: ['habit', 'morning', 'self-improvement'],
        links: ['sample-concept'],
        reviewCount: 0,
        nextReviewAt: now + 86400000,
        easeFactor: 2.5,
        interval: 1,
        createdAt: now - 86400000 * 3,
        updatedAt: now - 86400000 * 2,
      },
      {
        id: 'sample-reading',
        title: '📖 《深度工作》读书笔记',
        content: `<h2>《深度工作》读书笔记</h2>
<p><strong>作者</strong>：Cal Newport</p>
<h3>核心观点</h3>
<p>在日益嘈杂的信息时代，能够进行深度工作的能力越来越稀缺，也越来越有价值。</p>
<h3>重要概念</h3>
<ul>
<li><strong>深度工作</strong>：在无干扰的状态下专注进行专业活动</li>
<li><strong>浮浅工作</strong>：非认知要求不高的事务性工作</li>
<li><strong>心流状态</strong>：高度专注的工作状态</li>
</ul>
<h3>实践建议</h3>
<ol>
<li>将深度工作放在一天中最重要的时间段</li>
<li>设定清晰的开始和结束时间</li>
<li>拥抱无聊，减少对手机的依赖</li>
</ol>`,
        type: 'reading',
        status: 'organized',
        folderId: 'study',
        tags: ['reading', 'deep-work', 'productivity'],
        links: ['sample-practice'],
        reviewCount: 0,
        nextReviewAt: now + 86400000,
        easeFactor: 2.5,
        interval: 1,
        createdAt: now - 86400000 * 7,
        updatedAt: now - 86400000 * 5,
      },
      {
        id: 'sample-other',
        title: '📋 2024年技术大会参会记录',
        content: `<h2>AI 技术大会参会总结</h2>
<p>参加 AI Technology Conference 2024 的笔记和收获。</p>
<h3>会议信息</h3>
<ul>
<li><strong>时间</strong>：2024年3月15-17日</li>
<li><strong>地点</strong>：北京国际会议中心</li>
<li><strong>参会人数</strong>：约5000人</li>
</ul>
<h3>重点演讲</h3>
<p>大语言模型最新进展，多模态模型成为主流。</p>
<h3>Action Items</h3>
<ul>
<li>在团队中推广新技术</li>
<li>评估新模型在产品中的可行性</li>
<li>订阅相关技术博客</li>
</ul>`,
        type: 'other',
        status: 'organized',
        folderId: 'work',
        tags: ['conference', 'AI', 'notes'],
        links: [],
        reviewCount: 0,
        nextReviewAt: now + 86400000,
        easeFactor: 2.5,
        interval: 1,
        createdAt: now - 86400000 * 5,
        updatedAt: now - 86400000 * 4,
      },
    ]
  }

  async insertSampleNotes(): Promise<void> {
    const samples = this.generateCompleteSamples()
    for (const n of samples) {
      await this.putNote(n)
    }
  }

  async getSampleNotes(): Promise<Note[]> {
    // If there are no notes, seed with complete samples
    const notes = await this.getAllNotes().catch(() => [])
    if (notes.length === 0) {
      await this.init()
      await this.insertSampleNotes()
      return this.getAllNotes()
    }
    return notes
  }
}

export const initDB = new IndexedDBWrapper()

// Lightweight API wrappers to facilitate interactive UI without coupling to internals
export async function addNote(note: Note): Promise<void> {
  await initDB.putNote(note)
}
export async function getAllNotes(): Promise<Note[]> {
  return initDB.getAllNotes()
}
export async function getSampleNotes(): Promise<Note[]> {
  return initDB.getSampleNotes()
}
export function generateId(prefix: string = 'n'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`
}

// ===== Extended CRUD Operations =====

/**
 * Delete a note by ID
 */
export async function deleteNote(id: string): Promise<void> {
  await initDB.init()
  return new Promise<void>((resolve, reject) => {
    const store = (initDB as any).getStore('notes', 'readwrite')
    const req = store.delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/**
 * Cleanup trash - permanently delete notes older than 30 days
 * @returns number of deleted notes
 */
export async function cleanupTrash(): Promise<number> {
  const allNotes = await getAllNotes()
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
  const notesToDelete = allNotes.filter(n => n.deletedAt && n.deletedAt < thirtyDaysAgo)
  
  for (const note of notesToDelete) {
    await deleteNote(note.id)
  }
  
  return notesToDelete.length
}

/**
 * Get notes by folder
 */
export async function getNotesByFolder(folderId: string | undefined): Promise<Note[]> {
  const allNotes = await getAllNotes()
  if (!folderId || folderId === 'root') return allNotes
  return allNotes.filter(n => n.folderId === folderId)
}

/**
 * Get inbox notes (status === 'inbox')
 */
export async function getInboxNotes(): Promise<Note[]> {
  const allNotes = await getAllNotes()
  return allNotes.filter(n => n.status === 'inbox')
}

/**
 * Get starred notes
 */
export async function getStarredNotes(): Promise<Note[]> {
  const allNotes = await getAllNotes()
  return allNotes.filter(n => n.starred)
}

/**
 * Get notes due for review
 */
export async function getNotesForReview(): Promise<Note[]> {
  const allNotes = await getAllNotes()
  const now = Date.now()
  return allNotes
    .filter(n => n.nextReviewAt && n.nextReviewAt <= now)
    .sort((a, b) => (a.nextReviewAt || 0) - (b.nextReviewAt || 0))
}

/**
 * Get notes by tag
 */
export async function getNotesByTag(tag: string): Promise<Note[]> {
  const allNotes = await getAllNotes()
  return allNotes.filter(n => n.tags?.includes(tag))
}

/**
 * Get all unique tags with counts
 */
export async function getAllTags(): Promise<Array<{ name: string; count: number }>> {
  const allNotes = await getAllNotes()
  const tagCounts: Record<string, number> = {}
  
  allNotes.forEach(note => {
    note.tags?.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1
    })
  })
  
  return Object.entries(tagCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Search notes by title or content
 */
export async function searchNotes(query: string): Promise<Note[]> {
  if (!query.trim()) return []
  
  const allNotes = await getAllNotes()
  const lowerQuery = query.toLowerCase()
  
  return allNotes.filter(n => 
    n.title.toLowerCase().includes(lowerQuery) ||
    n.content.toLowerCase().includes(lowerQuery) ||
    n.tags?.some(t => t.toLowerCase().includes(lowerQuery))
  )
}

/**
 * Update note with new review data
 */
export async function updateNoteReview(
  id: string,
  reviewData: {
    reviewCount: number
    nextReviewAt: number
    easeFactor: number
    interval: number
  }
): Promise<void> {
  const note = await initDB.getNote(id)
  if (!note) throw new Error(`Note ${id} not found`)
  
  await initDB.putNote({
    ...note,
    ...reviewData,
    updatedAt: Date.now(),
  })
}

/**
 * Toggle star status
 */
export async function toggleStar(id: string): Promise<boolean> {
  const note = await initDB.getNote(id)
  if (!note) throw new Error(`Note ${id} not found`)
  
  const newStarred = !note.starred
  await initDB.putNote({
    ...note,
    starred: newStarred,
    updatedAt: Date.now(),
  })
  
  return newStarred
}

/**
 * Move note to folder
 */
export async function moveNote(id: string, folderId: string | undefined): Promise<void> {
  const note = await initDB.getNote(id)
  if (!note) throw new Error(`Note ${id} not found`)
  
  await initDB.putNote({
    ...note,
    folderId,
    updatedAt: Date.now(),
  })
}

/**
 * Add tag to note
 */
export async function addTagToNote(id: string, tag: string): Promise<void> {
  const note = await initDB.getNote(id)
  if (!note) throw new Error(`Note ${id} not found`)
  
  const tags = note.tags || []
  if (!tags.includes(tag)) {
    await initDB.putNote({
      ...note,
      tags: [...tags, tag],
      updatedAt: Date.now(),
    })
  }
}

/**
 * Remove tag from note
 */
export async function removeTagFromNote(id: string, tag: string): Promise<void> {
  const note = await initDB.getNote(id)
  if (!note) throw new Error(`Note ${id} not found`)
  
  await initDB.putNote({
    ...note,
    tags: (note.tags || []).filter(t => t !== tag),
    updatedAt: Date.now(),
  })
}

/**
 * Get recent notes
 */
export async function getRecentNotes(limit: number = 10): Promise<Note[]> {
  const allNotes = await getAllNotes()
  return [...allNotes]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
}

/**
 * Create a new inbox note (quick capture)
 */
export async function createInboxNote(
  content: string,
  title?: string
): Promise<Note> {
  const now = Date.now()
  const note: Note = {
    id: generateId('n'),
    title: title || content.slice(0, 50).replace(/<[^>]+>/g, ''),
    content: `<p>${content}</p>`,
    type: 'idea',
    status: 'inbox',
    createdAt: now,
    updatedAt: now,
    tags: [],
    reviewCount: 0,
    nextReviewAt: now + 24 * 60 * 60 * 1000, // Review tomorrow
    easeFactor: 2.5,
    interval: 1,
  }
  
  await initDB.putNote(note)
  return note
}

// ===== Attachment Operations =====

export type Attachment = {
  id: string
  noteId: string
  name: string
  type: 'image' | 'pdf' | 'word' | 'excel' | 'audio' | 'video' | 'other'
  mimeType: string
  size: number
  status: 'pending' | 'uploading' | 'uploaded' | 'failed'
  localUrl?: string
  remoteUrl?: string
  previewUrl?: string
  createdAt: number
}

/**
 * Put attachment to IndexedDB
 */
export async function putAttachment(attachment: Attachment): Promise<void> {
  await initDB.init()
  return new Promise<void>((resolve, reject) => {
    const tx = (initDB as any).db.transaction('attachments', 'readwrite')
    const store = tx.objectStore('attachments')
    const req = store.put(attachment)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/**
 * Get attachment by ID
 */
export async function getAttachment(id: string): Promise<Attachment | undefined> {
  await initDB.init()
  return new Promise<Attachment | undefined>((resolve, reject) => {
    const tx = (initDB as any).db.transaction('attachments', 'readonly')
    const store = tx.objectStore('attachments')
    const req = store.get(id)
    req.onsuccess = () => resolve(req.result as Attachment | undefined)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Get all attachments for a note
 */
export async function getAttachmentsByNoteId(noteId: string): Promise<Attachment[]> {
  await initDB.init()
  return new Promise<Attachment[]>((resolve, reject) => {
    const tx = (initDB as any).db.transaction('attachments', 'readonly')
    const store = tx.objectStore('attachments')
    const req = store.getAll()
    req.onsuccess = () => {
      const all = req.result as Attachment[]
      resolve(all.filter(a => a.noteId === noteId))
    }
    req.onerror = () => reject(req.error)
  })
}

/**
 * Get all attachments
 */
export async function getAllAttachments(): Promise<Attachment[]> {
  await initDB.init()
  return new Promise<Attachment[]>((resolve, reject) => {
    const tx = (initDB as any).db.transaction('attachments', 'readonly')
    const store = tx.objectStore('attachments')
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result as Attachment[])
    req.onerror = () => reject(req.error)
  })
}

/**
 * Delete attachment by ID
 */
export async function deleteAttachment(id: string): Promise<void> {
  await initDB.init()
  return new Promise<void>((resolve, reject) => {
    const tx = (initDB as any).db.transaction('attachments', 'readwrite')
    const store = tx.objectStore('attachments')
    const req = store.delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/**
 * Delete all attachments for a note
 */
export async function deleteAttachmentsByNoteId(noteId: string): Promise<void> {
  const attachments = await getAttachmentsByNoteId(noteId)
  for (const att of attachments) {
    await deleteAttachment(att.id)
  }
}

/**
 * Update attachment status
 */
export async function updateAttachmentStatus(
  id: string,
  status: Attachment['status'],
  remoteUrl?: string
): Promise<void> {
  const attachment = await getAttachment(id)
  if (attachment) {
    await putAttachment({
      ...attachment,
      status,
      remoteUrl: remoteUrl || attachment.remoteUrl,
    })
  }
}

// ===== Snapshot Operations =====

/**
 * Create a snapshot of a note
 */
export async function createSnapshot(
  note: Note,
  reason: NoteSnapshot['reason'] = 'auto'
): Promise<NoteSnapshot> {
  await initDB.init()
  const snapshot: NoteSnapshot = {
    id: `snap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    noteId: note.id,
    title: note.title,
    content: note.content,
    contentMarkdown: note.contentMarkdown,
    createdAt: Date.now(),
    reason,
  }
  
  return new Promise<NoteSnapshot>((resolve, reject) => {
    const tx = (initDB as any).db.transaction('snapshots', 'readwrite')
    const store = tx.objectStore('snapshots')
    const req = store.put(snapshot)
    req.onsuccess = () => resolve(snapshot)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Get all snapshots for a note
 */
export async function getSnapshotsByNoteId(noteId: string): Promise<NoteSnapshot[]> {
  await initDB.init()
  return new Promise<NoteSnapshot[]>((resolve, reject) => {
    const tx = (initDB as any).db.transaction('snapshots', 'readonly')
    const store = tx.objectStore('snapshots')
    const index = store.index('noteId')
    const req = index.getAll(noteId)
    req.onsuccess = () => {
      const snapshots = (req.result as NoteSnapshot[]).sort((a, b) => b.createdAt - a.createdAt)
      resolve(snapshots)
    }
    req.onerror = () => reject(req.error)
  })
}

/**
 * Get snapshot by ID
 */
export async function getSnapshot(id: string): Promise<NoteSnapshot | undefined> {
  await initDB.init()
  return new Promise<NoteSnapshot | undefined>((resolve, reject) => {
    const tx = (initDB as any).db.transaction('snapshots', 'readonly')
    const store = tx.objectStore('snapshots')
    const req = store.get(id)
    req.onsuccess = () => resolve(req.result as NoteSnapshot | undefined)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Get the nearest snapshot before a given timestamp for a note
 */
export async function getSnapshotBefore(noteId: string, timestamp: number): Promise<NoteSnapshot | undefined> {
  const snapshots = await getSnapshotsByNoteId(noteId)
  return snapshots.find(s => s.createdAt <= timestamp)
}

/**
 * Delete old snapshots for a note (keep most recent N)
 */
export async function cleanupSnapshots(noteId: string, keepCount: number = 50): Promise<number> {
  const snapshots = await getSnapshotsByNoteId(noteId)
  if (snapshots.length <= keepCount) return 0
  
  const toDelete = snapshots.slice(keepCount)
  let deleted = 0
  
  for (const snap of toDelete) {
    await new Promise<void>((resolve, reject) => {
      const tx = (initDB as any).db.transaction('snapshots', 'readwrite')
      const store = tx.objectStore('snapshots')
      const req = store.delete(snap.id)
      req.onsuccess = () => { deleted++; resolve() }
      req.onerror = () => reject(req.error)
    })
  }
  
  return deleted
}

/**
 * Delete snapshots older than a certain age (in ms)
 */
export async function deleteSnapshotsOlderThan(maxAge: number): Promise<number> {
  await initDB.init()
  const cutoff = Date.now() - maxAge
  
  return new Promise<number>((resolve, reject) => {
    const tx = (initDB as any).db.transaction('snapshots', 'readwrite')
    const store = tx.objectStore('snapshots')
    const req = store.getAll()
    req.onsuccess = () => {
      const all = req.result as NoteSnapshot[]
      const toDelete = all.filter(s => s.createdAt < cutoff)
      let deleted = 0
      
      const deleteNext = (index: number) => {
        if (index >= toDelete.length) {
          resolve(deleted)
          return
        }
        const delReq = store.delete(toDelete[index].id)
        delReq.onsuccess = () => { deleted++; deleteNext(index + 1) }
        delReq.onerror = () => reject(delReq.error)
      }
      
      if (toDelete.length === 0) {
        resolve(0)
      } else {
        deleteNext(0)
      }
    }
    req.onerror = () => reject(req.error)
  })
}

/**
 * Delete all snapshots for a note
 */
export async function deleteSnapshotsByNoteId(noteId: string): Promise<void> {
  const snapshots = await getSnapshotsByNoteId(noteId)
  for (const snap of snapshots) {
    await new Promise<void>((resolve, reject) => {
      const tx = (initDB as any).db.transaction('snapshots', 'readwrite')
      const store = tx.objectStore('snapshots')
      const req = store.delete(snap.id)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }
}

// ===== Last Visit Tracking =====

const LAST_VISIT_KEY = 'knowedge_last_visit'

/**
 * Get last visit timestamp from localStorage
 */
export function getLastVisit(): number | null {
  const stored = localStorage.getItem(LAST_VISIT_KEY)
  return stored ? parseInt(stored, 10) : null
}

/**
 * Set current visit as last visit
 */
export function setLastVisit(): void {
  localStorage.setItem(LAST_VISIT_KEY, Date.now().toString())
}

/**
 * Get all available restore points for a note
 */
export function getRestorePoints(): RestorePoint[] {
  return [
    {
      label: '10分钟前',
      icon: '🕙',
      getTimestamp: () => Date.now() - 10 * 60 * 1000,
    },
    {
      label: '半小时前',
      icon: '🕝',
      getTimestamp: () => Date.now() - 30 * 60 * 1000,
    },
    {
      label: '1小时前',
      icon: '🕐',
      getTimestamp: () => Date.now() - 60 * 60 * 1000,
    },
    {
      label: '半天前',
      icon: '🕛',
      getTimestamp: () => Date.now() - 12 * 60 * 60 * 1000,
    },
    {
      label: '1天前',
      icon: '🕧',
      getTimestamp: () => Date.now() - 24 * 60 * 60 * 1000,
    },
    {
      label: '上次使用',
      icon: '📅',
      getTimestamp: getLastVisit,
      isLastVisit: true,
    },
  ]
}

