import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef, useRef } from 'react'
import { EditorContent, useEditor, Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import type { Note, NoteSnapshot } from '../db/indexeddb'
import { createSnapshot } from '../db/indexeddb'
import LinkAutocomplete from './LinkAutocomplete'
import { uploadFile, generateAttachmentHtml, type UploadProgress } from '../utils/upload'
import { Paperclip, Upload, Loader2, X, Image, FileText, Music, Video, Plus, Clock } from 'lucide-react'
import { SUPPORTED_FILE_TYPES, MAX_FILE_SIZE } from '../kb/types'
import type { Attachment } from '../kb/types'
import WritingHintPanel from './WritingHintPanel'
import { generateWritingHints, type WritingHint } from '../writing-hints'
import { VersionHistoryPanel } from './VersionHistoryPanel'

type EditorMode = 'rich' | 'markdown'

// Merge all supported MIME types for file input
const ALL_SUPPORTED_TYPES = Object.values(SUPPORTED_FILE_TYPES).flat()
const ACCEPT_STRING = ALL_SUPPORTED_TYPES.join(',')

// Expose editor commands via ref
export interface TipTapEditorHandle {
  toggleBold: () => void
  toggleItalic: () => void
  toggleUnderline: () => void
  toggleStrike: () => void
  toggleHighlight: () => void
  toggleCode: () => void
  toggleHeading: (level: 1 | 2 | 3) => void
  setTextAlign: (align: 'left' | 'center' | 'right') => void
  toggleBulletList: () => void
  toggleOrderedList: () => void
  toggleBlockquote: () => void
  toggleCodeBlock: () => void
  setLink: () => void
  setHorizontalRule: () => void
  undo: () => void
  redo: () => void
  focus: () => void
  insertWikiLink: (title: string) => void
  insertAttachment: (attachment: Attachment) => void
  openAttachmentPicker: () => void
}

interface TipTapEditorProps {
  note?: Note
  notes: Note[]
  onChange: (note: Note) => void
  onSave?: () => void
  viewMode?: 'edit' | 'preview' | 'split'
  editorMode?: EditorMode
  onEditorModeChange?: (mode: EditorMode) => void
  onWikiLinkClick?: (title: string, noteId?: string) => void
}

// Create TipTap editor component with ref exposure
const TipTapEditor = forwardRef<TipTapEditorHandle, TipTapEditorProps>(({
  note,
  notes,
  onChange,
  onSave,
  viewMode = 'split',
  editorMode = 'rich',
  onEditorModeChange,
  onWikiLinkClick,
}, ref) => {
  const [markdownContent, setMarkdownContent] = useState('')
  const [showLinkPopup, setShowLinkPopup] = useState(false)
  const [linkPopupPosition, setLinkPopupPosition] = useState({ top: 0, left: 0 })
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Upload state
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  
  // Writing hints state
  const [writingHints, setWritingHints] = useState<WritingHint[]>([])
  
  // Version history state
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const lastSnapshotTimeRef = useRef<number>(0)
  const snapshotDebounceRef = useRef<NodeJS.Timeout>()
  const previousContentRef = useRef<string>('')
  
  // Build title to note map for wiki link resolution
  const titleToNoteMap = useCallback(() => {
    const map = new Map<string, string>()
    notes.forEach(n => {
      map.set(n.title.toLowerCase(), n.id)
    })
    return map
  }, [notes])

  // Create TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: {
          HTMLAttributes: {
            class: 'code-block',
          },
        },
      }),
      Placeholder.configure({
        placeholder: '开始写作... 输入 [[ 插入双向链接',
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'ke-wiki-link',
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Highlight.configure({
        multicolor: true,
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'ke-tiptap-editor',
      },
      handleClick(view, pos, event) {
        const target = event.target as HTMLElement
        // Handle wiki link clicks
        if (target.tagName === 'SPAN' && target.hasAttribute('data-wiki-link')) {
          const title = target.getAttribute('data-title')
          const noteId = target.getAttribute('data-note-id')
          if (title && onWikiLinkClick) {
            event.preventDefault()
            onWikiLinkClick(title, noteId || undefined)
            return true
          }
        }
        return false
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      const markdown = htmlToMarkdown(html)
      setMarkdownContent(markdown)
      
      onChange({
        ...note!,
        content: html,
        contentMarkdown: markdown,
        updatedAt: Date.now(),
      })
      
      // Check for [[ trigger in editor
      checkForWikiLinkTrigger(editor)
      
      // Generate writing hints
      if (note) {
        const hints = generateWritingHints(
          { id: note.id, title: note.title, content: html, type: note.type },
          notes.map(n => ({ id: n.id, title: n.title, content: n.content, type: n.type }))
        )
        setWritingHints(hints)
      }
      
      // Auto-snapshot: create snapshot if content changed significantly
      // and at least 1 minute has passed since last snapshot
      if (note && html !== previousContentRef.current) {
        const now = Date.now()
        if (now - lastSnapshotTimeRef.current >= 60000) { // 1 minute minimum interval
          // Clear any pending debounced snapshot
          if (snapshotDebounceRef.current) {
            clearTimeout(snapshotDebounceRef.current)
          }
          // Debounce snapshot creation
          snapshotDebounceRef.current = setTimeout(async () => {
            try {
              await createSnapshot(note, 'auto')
              lastSnapshotTimeRef.current = Date.now()
            } catch (err) {
              console.error('Failed to create auto snapshot:', err)
            }
          }, 2000) // 2 second debounce after last edit
        }
        previousContentRef.current = html
      }
    },
  })

  // Check for [[ trigger
  const checkForWikiLinkTrigger = useCallback((editorInstance: Editor) => {
    const { state } = editorInstance
    const { selection } = state
    const { $from } = selection
    
    // Get text content before cursor
    const textBefore = $from.parent.textContent.slice(0, $from.parentOffset)
    
    // Check for [[ without ]]
    const lastBracket = textBefore.lastIndexOf('[[')
    if (lastBracket !== -1) {
      const between = textBefore.slice(lastBracket + 2)
      if (!between.includes(']]')) {
        // Show link popup near cursor
        const coords = editorInstance.view.coordsAtPos(selection.from)
        setLinkPopupPosition({
          top: coords.bottom + 8,
          left: coords.left,
        })
        setShowLinkPopup(true)
        return
      }
    }
    
    setShowLinkPopup(false)
  }, [])

  // Helper function to escape HTML
  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  // Insert attachment HTML into editor
  const insertAttachmentToEditor = useCallback((attachment: Attachment) => {
    if (!editor) return
    const html = generateAttachmentHtml(attachment)
    editor.chain().focus().insertContent(html).run()
  }, [editor])

  // Open file picker
  const openAttachmentPicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  // Expose editor commands via ref
  useImperativeHandle(ref, () => ({
    toggleBold: () => editor?.chain().focus().toggleBold().run(),
    toggleItalic: () => editor?.chain().focus().toggleItalic().run(),
    toggleUnderline: () => editor?.chain().focus().toggleUnderline().run(),
    toggleStrike: () => editor?.chain().focus().toggleStrike().run(),
    toggleHighlight: () => editor?.chain().focus().toggleHighlight().run(),
    toggleCode: () => editor?.chain().focus().toggleCode().run(),
    toggleHeading: (level: 1 | 2 | 3) => editor?.chain().focus().toggleHeading({ level }).run(),
    setTextAlign: (align: 'left' | 'center' | 'right') => editor?.chain().focus().setTextAlign(align).run(),
    toggleBulletList: () => editor?.chain().focus().toggleBulletList().run(),
    toggleOrderedList: () => editor?.chain().focus().toggleOrderedList().run(),
    toggleBlockquote: () => editor?.chain().focus().toggleBlockquote().run(),
    toggleCodeBlock: () => editor?.chain().focus().toggleCodeBlock().run(),
    setLink: () => {
      const url = window.prompt('输入链接地址:')
      if (url) {
        editor?.chain().focus().setLink({ href: url }).run()
      }
    },
    setHorizontalRule: () => editor?.chain().focus().setHorizontalRule().run(),
    undo: () => editor?.chain().focus().undo().run(),
    redo: () => editor?.chain().focus().redo().run(),
    focus: () => editor?.chain().focus().run(),
    insertWikiLink: (title: string) => {
      if (!editor) return
      
      // Find and replace [[title]] or insert new link
      const { state } = editor
      const { selection } = state
      const { $from } = selection
      const textBefore = $from.parent.textContent.slice(0, $from.parentOffset)
      const lastBracket = textBefore.lastIndexOf('[[')
      
      if (lastBracket !== -1) {
        const between = textBefore.slice(lastBracket + 2)
        if (!between.includes(']]')) {
          // Delete the [[ and everything after cursor position
          const deleteFrom = lastBracket + $from.start()
          const deleteTo = selection.from
          editor.chain()
            .focus()
            .deleteRange({ from: deleteFrom, to: deleteTo })
            .insertContent(`<span data-wiki-link data-title="${escapeHtml(title)}" class="ke-wiki-link">${escapeHtml(title)}</span>`)
            .run()
          return
        }
      }
      
      // Just insert the wiki link
      editor.chain()
        .focus()
        .insertContent(`<span data-wiki-link data-title="${escapeHtml(title)}" class="ke-wiki-link">${escapeHtml(title)}</span>`)
        .run()
    },
    insertAttachment: insertAttachmentToEditor,
    openAttachmentPicker,
  }), [editor, insertAttachmentToEditor, openAttachmentPicker])

  // Initialize content from note
  useEffect(() => {
    if (note && editor) {
      const content = note.contentMarkdown || note.content
      
      if (content.includes('<')) {
        editor.commands.setContent(note.content)
        setMarkdownContent(htmlToMarkdown(note.content))
      } else {
        setMarkdownContent(content)
        editor.commands.setContent(markdownToHtml(content))
      }
    }
  }, [note?.id, editor])

  // Markdown to HTML converter with wiki link support
  const markdownToHtml = useCallback((md: string): string => {
    if (!md) return ''
    
    let html = md
      .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/___(.+?)___/g, '<strong><em>$1</em></strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      .replace(/~~(.+?)~~/g, '<s>$1</s>')
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, target, display) => {
        const title = (display || target).trim()
        const noteId = titleToNoteMap().get(title.toLowerCase())
        return `<span data-wiki-link data-title="${escapeHtml(title)}" ${noteId ? `data-note-id="${noteId}"` : ''} class="ke-wiki-link">${escapeHtml(title)}</span>`
      })
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/^---$/gm, '<hr>')
      .replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
      .replace(/\n\n/g, '</p><p>')
    
    if (!html.includes('<h') && !html.includes('<pre') && !html.includes('<blockquote')) {
      html = `<p>${html}</p>`
    }
    
    html = html.replace(/<p>\s*<\/p>/g, '')
    html = html.replace(/<p><br\s*\/?><\/p>/g, '')
    
    return html
  }, [notes])

  // HTML to Markdown converter with wiki link support
  const htmlToMarkdown = useCallback((html: string): string => {
    if (!html) return ''
    
    let md = html
      .replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, '```\n$1```\n')
      .replace(/<h3>(.+?)<\/h3>/g, '### $1\n')
      .replace(/<h2>(.+?)<\/h2>/g, '## $1\n')
      .replace(/<h1>(.+?)<\/h1>/g, '# $1\n')
      .replace(/<strong><em>(.+?)<\/em><\/strong>/g, '***$1***')
      .replace(/<strong>(.+?)<\/strong>/g, '**$1**')
      .replace(/<em>(.+?)<\/em>/g, '*$1*')
      .replace(/<s>(.+?)<\/s>/g, '~~$1~~')
      .replace(/<span data-wiki-link[^>]*data-title="([^"]+)"[^>]*>(.*?)<\/span>/g, '[[$1]]')
      .replace(/<span[^>]*class="ke-wiki-link"[^>]*data-title="([^"]+)"[^>]*>(.*?)<\/span>/g, '[[$1]]')
      .replace(/<a class="ke-wiki-link"[^>]*>(.+?)<\/a>/g, '[[$1]]')
      .replace(/<a href="(.+?)">(.+?)<\/a>/g, '[$2]($1)')
      .replace(/<code>(.+?)<\/code>/g, '`$1`')
      .replace(/<hr\s*\/?>/g, '\n---\n')
      .replace(/<blockquote><p>(.+?)<\/p><\/blockquote>/g, '> $1\n')
      .replace(/<li>(.+?)<\/li>/g, '- $1\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
    
    return md.trim()
  }, [])

  // Handle markdown mode changes
  const handleMarkdownChange = useCallback((md: string) => {
    setMarkdownContent(md)
    
    const html = markdownToHtml(md)
    editor?.commands.setContent(html)
    
    onChange({
      ...note!,
      content: html,
      contentMarkdown: md,
      updatedAt: Date.now(),
    })
  }, [note, onChange, editor, markdownToHtml])

  // Insert wiki link
  const handleInsertWikiLink = useCallback((linkTitle: string) => {
    if (!editor) return
    
    // Find and replace [[...]] or insert at cursor
    const { state } = editor
    const { selection } = state
    const { $from } = selection
    const textBefore = $from.parent.textContent.slice(0, $from.parentOffset)
    const lastBracket = textBefore.lastIndexOf('[[')
    
    if (lastBracket !== -1) {
      const between = textBefore.slice(lastBracket + 2)
      if (!between.includes(']]')) {
        const deleteFrom = lastBracket + $from.start()
        const deleteTo = selection.from
        editor.chain()
          .focus()
          .deleteRange({ from: deleteFrom, to: deleteTo })
          .insertContent(`<span data-wiki-link data-title="${escapeHtml(linkTitle)}" class="ke-wiki-link">${escapeHtml(linkTitle)}</span>`)
          .run()
        setShowLinkPopup(false)
        return
      }
    }
    
    editor.chain()
      .focus()
      .insertContent(`<span data-wiki-link data-title="${escapeHtml(linkTitle)}" class="ke-wiki-link">${escapeHtml(linkTitle)}</span>`)
      .run()
    setShowLinkPopup(false)
  }, [editor])

  // Get current query from [[ to cursor
  const getWikiLinkQuery = useCallback((): string => {
    if (!editor) return ''
    const { state } = editor
    const { selection } = state
    const { $from } = selection
    const textBefore = $from.parent.textContent.slice(0, $from.parentOffset)
    const lastBracket = textBefore.lastIndexOf('[[')
    if (lastBracket !== -1) {
      const between = textBefore.slice(lastBracket + 2)
      if (!between.includes(']]')) {
        return between
      }
    }
    return ''
  }, [editor])

  // Handle file upload
  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0 || !note || !editor) return
    
    const file = files[0]
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setUploadError(`文件超过 ${MAX_FILE_SIZE / (1024 * 1024)}MB 限制`)
      setTimeout(() => setUploadError(null), 3000)
      return
    }
    
    // Validate file type
    if (!ALL_SUPPORTED_TYPES.includes(file.type)) {
      setUploadError('不支持的文件类型')
      setTimeout(() => setUploadError(null), 3000)
      return
    }
    
    setIsUploading(true)
    setUploadProgress(0)
    setUploadError(null)
    
    try {
      const result = await uploadFile(file, note.id, (progress: UploadProgress) => {
        setUploadProgress(progress.progress)
      })
      
      if (result.success && result.attachment) {
        // Insert attachment into editor
        const html = generateAttachmentHtml(result.attachment)
        editor.chain().focus().insertContent(html).run()
        
        // Trigger save
        const newContent = editor.getHTML()
        const markdown = htmlToMarkdown(newContent)
        onChange({
          ...note,
          content: newContent,
          contentMarkdown: markdown,
          updatedAt: Date.now(),
        })
      }
      
      if (result.error) {
        setUploadError(result.error)
        setTimeout(() => setUploadError(null), 3000)
      }
    } catch (err) {
      console.error('[TipTapEditor] Upload failed:', err)
      setUploadError('上传失败')
      setTimeout(() => setUploadError(null), 3000)
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }, [note, editor, onChange, htmlToMarkdown])

  if (!note) {
    return (
      <div className="ke-editor ke-editor--empty">
        <div className="ke-editor__empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <p>选择一个笔记开始编辑</p>
        </div>
      </div>
    )
  }

  return (
    <div className="ke-editor">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_STRING}
        onChange={(e) => handleFileUpload(e.target.files)}
        style={{ display: 'none' }}
      />
      
      {/* Upload progress indicator */}
      {isUploading && (
        <div className="ke-editor__upload-indicator">
          <Loader2 size={16} className="ke-editor__upload-spinner" />
          <span>上传中... {uploadProgress}%</span>
        </div>
      )}
      
      {/* Upload error */}
      {uploadError && (
        <div className="ke-editor__upload-error">
          <X size={14} />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Rich Text Mode */}
      {editorMode === 'rich' && (
        <div className="ke-editor__content">
          <EditorContent editor={editor} />
          <div className="ke-editor__markdown-stats">
            {markdownContent.replace(/<[^>]+>/g, '').length} 字符 · {markdownContent.replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean).length} 词
          </div>
        </div>
      )}

      {/* Markdown Mode */}
      {editorMode === 'markdown' && (
        <div className="ke-editor__markdown">
          <textarea
            ref={textareaRef}
            className="ke-editor__markdown-textarea"
            value={markdownContent}
            onChange={(e) => handleMarkdownChange(e.target.value)}
            placeholder="# 开始使用 Markdown&#10;&#10;支持以下语法：&#10;&#10;## 标题&#10;**加粗** *斜体* ~~删除线~~&#10;&#10;- 列表项&#10;1. 有序列表&#10;&#10;[链接文字](url)&#10;&#10;```代码块```&#10;&#10;> 引用&#10;&#10;[[双向链接]]"
            spellCheck={false}
          />
          <div className="ke-editor__markdown-stats">
            {markdownContent.length} 字符 · {markdownContent.split(/\s+/).filter(Boolean).length} 词
          </div>
        </div>
      )}

      {/* Wiki link autocomplete popup */}
      {showLinkPopup && editorMode === 'rich' && (
        <div 
          className="ke-link-popup-wrapper"
          style={{
            position: 'fixed',
            top: linkPopupPosition.top,
            left: linkPopupPosition.left,
            zIndex: 1000,
          }}
        >
          <LinkAutocomplete
            editorRef={{ current: textareaRef.current } as any}
            notes={notes}
            currentNoteId={note.id}
            onInsert={handleInsertWikiLink}
            query={getWikiLinkQuery()}
          />
        </div>
      )}

      {/* Writing Hints Panel */}
      <WritingHintPanel hints={writingHints} />
    </div>
  )
})

export default TipTapEditor
