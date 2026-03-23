import React, { useState, useEffect, useRef } from 'react'
import Header from '../components/layout/Header'
import LeftNav from './components/LeftNav'
import CenterPanel from './components/CenterPanel'
import RightWidgets from './components/RightWidgets'
import { ChevronLeft, ChevronRight, PanelLeftClose, PanelLeft, Search } from 'lucide-react'
import type { Note, Folder, ReviewQueue, LeftNavSection, ViewMode } from './types'
import { getAllNotes, generateId, initDB } from '../db/indexeddb'
import './KnowledgeBase.css'

interface KBMainProps {
  onBackToDashboard: () => void
  onNavigate?: (view: string, noteId?: string) => void
  selectedNoteId?: string
  notes?: Note[]
  onNotesChange?: (notes: Note[]) => void
  onCapture?: (content: string) => void
  onSettingsClick?: () => void
  onAuthClick?: () => void
  currentUser?: { email?: string } | null
  syncStatus?: 'local' | 'syncing' | 'synced'
}

const initialFolders: Folder[] = [
  { id: 'root', name: '📁 知识库', icon: '📁', parentId: undefined },
  { id: 'work', name: '💼 工作', icon: '💼', parentId: 'root' },
  { id: 'study', name: '📚 学习', icon: '📚', parentId: 'root' },
  { id: 'life', name: '🌱 生活', icon: '🌱', parentId: 'root' },
]

const mockTags = ['AI', '学习方法', '读书笔记', '工具', '项目管理', '设计']

// 生成样例笔记作为功能说明书
const generateSampleNotes = (): Note[] => {
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
<li>🗑️ <strong>回收站</strong>：删除的笔记30天内可恢复</li>
<li>📎 <strong>文件上传</strong>：支持在笔记中嵌入图片、PDF、音视频等文件</li>
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
      tags: ['guide', 'tutorial', 'guide'],
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
<p>当我们无法用简单的语言解释一个概念时，说明我们还没有真正理解它。这个方法强迫我们深入思考，而不是停留在表面。</p>
<h3>应用场景</h3>
<ul>
<li>学习新技术栈</li>
<li>准备考试</li>
<li>向非专业人士解释专业问题</li>
</ul>`,
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
<table>
<tr><td>第1周</td><td>完成率 60%</td><td>主要障碍：起床困难</td></tr>
<tr><td>第2周</td><td>完成率 75%</td><td>开始适应</td></tr>
<tr><td>第3周</td><td>完成率 85%</td><td>形成初步习惯</td></tr>
<tr><td>第4周</td><td>完成率 95%</td><td>基本稳定</td></tr>
</table>
<h3>关键发现</h3>
<p>设置多个闹钟、提前准备第二天衣物、避免晚上刷手机是关键成功因素。</p>
<h3>下一步</h3>
<p>增加晨间运动 20 分钟。</p>`,
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
<h4>大语言模型最新进展</h4>
<p>多模态模型成为主流，GPT-5 和 Claude 4 的发布预告。</p>
<h4>RAG 技术实践</h4>
<p>企业级 RAG 架构的最佳实践分享。</p>
<h3>Networking 收获</h3>
<p>认识了3位同行业的技术负责人，建立了后续合作联系。</p>
<h3>Action Items</h3>
<ul>
<li>在团队中推广 RAG 技术</li>
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
    {
      id: 'sample-reading',
      title: '📖 《深度工作》读书笔记',
      content: `<h2>《深度工作》读书笔记</h2>
<p><strong>作者</strong>：Cal Newport<br><strong>出版社</strong>：人民邮电出版社<br><strong>阅读时间</strong>：2024年2月</p>
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
<li>排除工作中的干扰</li>
</ol>
<h3>我的行动</h3>
<p>每天上午10点前不查看社交媒体，专注于深度工作。</p>`,
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
  ]
}

const KBMain: React.FC<KBMainProps> = ({
  onBackToDashboard,
  onNavigate,
  selectedNoteId,
  notes: externalNotes = [],
  onNotesChange,
  onCapture,
  onSettingsClick,
  onAuthClick,
  currentUser,
  syncStatus,
}) => {
  // 优先使用外部传入的 notes，其次自己加载
  const [notes, setNotes] = useState<Note[]>(externalNotes.length > 0 ? externalNotes : [])
  
  // 从笔记派生 inboxNotes（status === 'inbox' 的笔记）
  const inboxNotes = notes.filter(n => n.status === 'inbox' && !n.deletedAt)
  const starredIds = notes.filter(n => n.starred && !n.deletedAt).map(n => n.id)
  const trashCount = notes.filter(n => n.deletedAt).length
  
  // 从笔记派生复习队列
  const now = Date.now()
  const reviewNotes = notes.filter(n => n.nextReviewAt && n.nextReviewAt <= now)
  const mockReviewQueue: ReviewQueue = {
    today: reviewNotes.slice(0, 3).map(n => ({ id: n.id, title: n.title, dueCount: 1 })),
    recommend: notes.slice(0, 3).map(n => ({ id: n.id, title: n.title })),
    explore: notes.slice(0, 1).map(n => ({ id: n.id, title: n.title })),
  }
  
  const [selectedNav, setSelectedNav] = useState<LeftNavSection>('folders')
  const [selectedFolderId, setSelectedFolderId] = useState<string>('root')
  const [selectedNote, setSelectedNote] = useState<Note | undefined>(undefined)
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [captureOpen, setCaptureOpen] = useState(false)
  const [quickSearchOpen, setQuickSearchOpen] = useState(false)
  const [quickSearchQuery, setQuickSearchQuery] = useState('')
  const quickSearchRef = useRef<HTMLDivElement>(null)
  // Collapsible left navigation state
  const [leftNavCollapsed, setLeftNavCollapsed] = useState(false)
  const [noteListCollapsed, setNoteListCollapsed] = useState(false)
  // Folders state
  const [folders, setFolders] = useState<Folder[]>(initialFolders)

  // 同步外部 notes
  useEffect(() => {
    if (externalNotes.length > 0) {
      setNotes(externalNotes)
    }
  }, [externalNotes])

  // 同步 selectedNoteId
  useEffect(() => {
    if (selectedNoteId && notes.length > 0) {
      const found = notes.find(n => n.id === selectedNoteId)
      if (found) setSelectedNote(found)
    }
  }, [selectedNoteId, notes])

  // 加载笔记
  useEffect(() => {
    if (notes.length === 0) {
      const loadNotes = async () => {
        try {
          const dbNotes = await getAllNotes()
          if (dbNotes && dbNotes.length > 0) {
            setNotes(dbNotes)
            onNotesChange?.(dbNotes)
            if (!selectedNote) setSelectedNote(dbNotes[0])
          } else {
            // 如果没有笔记，生成样例笔记作为功能说明书
            const sampleNotes = generateSampleNotes()
            for (const note of sampleNotes) {
              await initDB.putNote(note)
            }
            setNotes(sampleNotes)
            onNotesChange?.(sampleNotes)
            if (!selectedNote) setSelectedNote(sampleNotes[0])
          }
        } catch {
          // Use mock data
        }
      }
      loadNotes()
    }
  }, [])

  const getFilteredNotes = (): Note[] => {
    // Get non-deleted notes
    const activeNotes = notes.filter(n => !n.deletedAt)
    const deletedNotes = notes.filter(n => n.deletedAt)
    
    let result: Note[] = []
    switch (selectedNav) {
      case 'inbox': 
        result = activeNotes.filter(n => n.status === 'inbox')
        break
      case 'starred': 
        result = activeNotes.filter(n => n.starred)
        break
      case 'trash': 
        result = deletedNotes.sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0))
        break
      case 'folders':
      default:
        if (selectedFolderId === 'root') {
          result = activeNotes
        } else {
          result = activeNotes.filter(n => n.folderId === selectedFolderId)
        }
    }
    
    // Sort: pinned first, then by updatedAt
    return result.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return b.updatedAt - a.updatedAt
    })
  }

  const handleNoteSelect = (note: Note) => {
    setSelectedNote(note)
  }

  // Create new note
  const handleCreateNote = (type: Note['type'] = 'concept') => {
    const now = Date.now()
    const newNote: Note = {
      id: 'n' + now,
      title: '',
      content: '',
      type: type,
      status: 'inbox',
      folderId: selectedFolderId === 'root' ? undefined : selectedFolderId,
      tags: [],
      links: [],
      createdAt: now,
      updatedAt: now,
      reviewCount: 0,
      nextReviewAt: now,
      easeFactor: 2.5,
      interval: 1,
    }
    
    // Add to notes and select it
    const updated = [newNote, ...notes]
    setNotes(updated)
    onNotesChange?.(updated)
    setSelectedNote(newNote)
    
    // Save to IndexedDB
    initDB.putNote(newNote).catch(console.error)
  }

  // Pin/Unpin note
  const handleTogglePin = (note: Note) => {
    const updated = notes.map(n => 
      n.id === note.id ? { ...n, pinned: !n.pinned, updatedAt: Date.now() } : n
    )
    setNotes(updated)
    onNotesChange?.(updated)
    if (selectedNote?.id === note.id) {
      setSelectedNote({ ...selectedNote, pinned: !selectedNote.pinned })
    }
  }

  // Star/Unstar note
  const handleToggleStar = (note: Note) => {
    const updated = notes.map(n => 
      n.id === note.id ? { ...n, starred: !n.starred, updatedAt: Date.now() } : n
    )
    setNotes(updated)
    onNotesChange?.(updated)
    if (selectedNote?.id === note.id) {
      setSelectedNote({ ...selectedNote, starred: !selectedNote.starred })
    }
  }

  // Move note to trash
  const handleDeleteNote = (note: Note) => {
    const updated = notes.map(n => 
      n.id === note.id ? { ...n, deletedAt: Date.now(), updatedAt: Date.now() } : n
    )
    setNotes(updated)
    onNotesChange?.(updated)
    if (selectedNote?.id === note.id) {
      setSelectedNote(undefined)
    }
  }

  // Restore note from trash
  const handleRestoreNote = (note: Note) => {
    const updated = notes.map(n => 
      n.id === note.id ? { ...n, deletedAt: undefined, updatedAt: Date.now() } : n
    )
    setNotes(updated)
    onNotesChange?.(updated)
  }

  // Permanently delete note
  const handlePermanentDelete = (note: Note) => {
    const updated = notes.filter(n => n.id !== note.id)
    setNotes(updated)
    onNotesChange?.(updated)
    if (selectedNote?.id === note.id) {
      setSelectedNote(undefined)
    }
  }

  // Change note type
  const handleNoteTypeChange = (noteId: string, type: NoteType) => {
    const updated = notes.map(n => 
      n.id === noteId ? { ...n, type, updatedAt: Date.now() } : n
    )
    setNotes(updated)
    onNotesChange?.(updated)
    if (selectedNote?.id === noteId) {
      setSelectedNote({ ...selectedNote, type })
    }
  }

  const handleTagClick = (_tag: string) => {
    setSelectedNav('folders')
    setSelectedFolderId('root')
  }

  const handleInternalCapture = (content: string) => {
    const newNote: Note = {
      id: generateId('n'),
      title: content.slice(0, 50) || '新笔记',
      content: `<p>${content}</p>`,
      type: 'idea',
      status: 'inbox',
      folderId: undefined,
      tags: [],
      links: [],
      reviewCount: 0,
      nextReviewAt: 0,
      easeFactor: 2.5,
      interval: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const updated = [newNote, ...notes]
    setNotes(updated)
    onNotesChange?.(updated)
    onCapture?.(content)
    setCaptureOpen(false)
  }

  const displayedNotes = getFilteredNotes()

  return (
    <div className="kb-app">
      <Header
        onCapture={() => setCaptureOpen(true)}
        showBack
        onBack={onBackToDashboard}
        onLogoClick={onBackToDashboard}
        onSettingsClick={onSettingsClick}
        onAuthClick={onAuthClick}
        currentUser={currentUser}
        syncStatus={syncStatus}
      />

      <div className="kb-body">
        <LeftNav
          folders={folders}
          tags={mockTags}
          inboxCount={inboxNotes.length}
          trashCount={trashCount}
          selectedNav={selectedNav}
          selectedFolderId={selectedFolderId}
          collapsed={leftNavCollapsed}
          onToggleCollapse={() => setLeftNavCollapsed(v => !v)}
          onNavSelect={(nav) => setSelectedNav(nav as LeftNavSection)}
          onFolderSelect={(id) => {
            setSelectedFolderId(id)
            setSelectedNav('folders')
          }}
          onFolderCreate={(name) => {
            const newFolder = { id: 'f' + Date.now(), name, icon: '📁' }
            setFolders(prev => [...prev, newFolder])
          }}
          onTagClick={handleTagClick}
          onGraphClick={() => onNavigate?.('graph')}
          onTimelineClick={() => onNavigate?.('timeline')}
        />

        <CenterPanel
          notes={displayedNotes}
          selectedNote={selectedNote}
          viewMode={viewMode}
          onNoteSelect={handleNoteSelect}
          onViewModeChange={setViewMode}
          onNoteChange={(updatedNote) => {
            setNotes(prev => prev.map(n => n.id === updatedNote.id ? updatedNote : n))
            // Also update selectedNote if it's the one being edited
            if (selectedNote?.id === updatedNote.id) {
              setSelectedNote(updatedNote)
            }
          }}
          onNoteTypeChange={handleNoteTypeChange}
          onTogglePin={handleTogglePin}
          onToggleStar={handleToggleStar}
          onDeleteNote={handleDeleteNote}
          onRestoreNote={handleRestoreNote}
          onPermanentDelete={handlePermanentDelete}
          onCreateNote={handleCreateNote}
          noteListCollapsed={noteListCollapsed}
          onNoteListToggle={() => setNoteListCollapsed(v => !v)}
          leftNavCollapsed={leftNavCollapsed}
          isTrashView={selectedNav === 'trash'}
        />

        <RightWidgets
          tags={mockTags}
          reviewQueue={mockReviewQueue}
          onTagClick={handleTagClick}
          onReviewStart={() => onNavigate?.('review')}
          onNoteClick={(id) => {
            const note = notes.find(n => n.id === id)
            if (note) handleNoteSelect(note)
          }}
        />
      </div>

      {/* Floating Action Buttons */}
      {!captureOpen && (
        <div className="ke-fab-group">
          {/* Quick Search Button */}
          <button
            className="ke-fab ke-fab--secondary"
            onClick={() => setQuickSearchOpen(true)}
            title="快速搜索 (Ctrl+K)"
            aria-label="快速搜索"
          >
            <Search size={18} />
          </button>
          {/* Capture Button */}
          <button
            className="ke-fab"
            onClick={() => setCaptureOpen(true)}
            title="快速捕获 (Ctrl+Shift+K)"
            aria-label="快速捕获"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
        </div>
      )}

      {/* Quick Search Modal */}
      {quickSearchOpen && (
        <>
          <div className="ke-modal-overlay" onClick={() => setQuickSearchOpen(false)} />
          <div className="ke-modal ke-modal--search">
            <div className="ke-modal__header">
              <div className="ke-modal__search-input-wrapper">
                <Search size={18} />
                <input
                  type="text"
                  className="ke-modal__search-input"
                  placeholder="搜索笔记..."
                  value={quickSearchQuery}
                  onChange={(e) => setQuickSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>
              <button className="ke-modal__close" onClick={() => setQuickSearchOpen(false)}>✕</button>
            </div>
            <div className="ke-modal__body">
              <div className="ke-search-results">
                {quickSearchQuery.trim() ? (
                  notes
                    .filter(n => 
                      !n.deletedAt && (
                        n.title.toLowerCase().includes(quickSearchQuery.toLowerCase()) ||
                        n.content.toLowerCase().includes(quickSearchQuery.toLowerCase())
                      )
                    )
                    .slice(0, 8)
                    .map(note => (
                      <div
                        key={note.id}
                        className="ke-search-result"
                        onClick={() => {
                          handleNoteSelect(note)
                          setQuickSearchOpen(false)
                          setQuickSearchQuery('')
                        }}
                      >
                        <span className="ke-search-result__title">{note.title}</span>
                        <span className="ke-search-result__type">{note.type}</span>
                      </div>
                    ))
                ) : (
                  <div className="ke-search-empty">输入关键词搜索笔记</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {captureOpen && (
        <>
          <div className="ke-modal-overlay" onClick={() => setCaptureOpen(false)} />
          <div className="ke-modal ke-modal--capture">
            <div className="ke-modal__header">
              <span className="ke-modal__title">📥 快速捕获</span>
              <button className="ke-modal__close" onClick={() => setCaptureOpen(false)}>✕</button>
            </div>
            <div className="ke-modal__body">
              <textarea
                className="ke-capture-textarea"
                placeholder="快速记录想法... 输入后自动保存到草稿箱"
                autoFocus
              />
              <div className="ke-capture-hints">
                <span>💡 按 <kbd>Enter</kbd> 换行</span>
                <span>📝 使用 [[ ]] 创建双链</span>
              </div>
            </div>
            <div className="ke-modal__footer">
              <button className="ke-btn ke-btn--outline" onClick={() => setCaptureOpen(false)}>取消</button>
              <button className="ke-btn ke-btn--primary" onClick={() => {
                const textarea = document.querySelector('.ke-capture-textarea') as HTMLTextAreaElement
                if (textarea?.value) handleInternalCapture(textarea.value)
              }}>保存到草稿箱</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default KBMain
