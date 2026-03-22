import { Node, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export interface WikiLinkOptions {
  HTMLAttributes: Record<string, any>
  onLinkClick?: (noteId: string, title: string) => void
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wikiLink: {
      setWikiLink: (attributes: { title: string; noteId?: string }) => ReturnType
      unsetWikiLink: () => ReturnType
    }
  }
}

const WikiLinkPluginKey = new PluginKey('wikiLink')

export const WikiLink = Node.create<WikiLinkOptions>({
  name: 'wikiLink',

  group: 'inline',

  inline: true,

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'ke-wiki-link',
      },
      onLinkClick: undefined,
    }
  },

  addAttributes() {
    return {
      title: {
        default: null,
        parseHTML: element => element.getAttribute('data-title'),
        renderHTML: attributes => {
          return { 'data-title': attributes.title }
        },
      },
      noteId: {
        default: null,
        parseHTML: element => element.getAttribute('data-note-id'),
        renderHTML: attributes => {
          if (!attributes.noteId) return {}
          return { 'data-note-id': attributes.noteId }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-wiki-link]',
      },
      {
        tag: 'a.ke-wiki-link',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(
        { 'data-wiki-link': 'true' },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
      0,
    ]
  },

  addCommands() {
    return {
      setWikiLink:
        attributes =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
            content: [{ type: 'text', text: attributes.title }],
          })
        },
      unsetWikiLink:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name)
        },
    }
  },

  addProseMirrorPlugins() {
    const options = this.options

    return [
      new Plugin({
        key: WikiLinkPluginKey,
        props: {
          handleClick(view, pos, event) {
            const target = event.target as HTMLElement
            if (target.tagName === 'SPAN' && target.hasAttribute('data-wiki-link')) {
              const title = target.getAttribute('data-title')
              const noteId = target.getAttribute('data-note-id')
              if (options.onLinkClick && title) {
                options.onLinkClick(noteId || title, title)
                return true
              }
            }
            return false
          },
        },
      }),
    ]
  },
})

// Input rule to convert typed [[text]] into wiki links
export const wikiLinkInputRule = (onLinkCreated?: (title: string) => void) => {
  return new Plugin({
    key: new PluginKey('wikiLinkInput'),
    props: {
      handleTextInput(view, from, to, text) {
        // Check if we just typed the second ]
        if (text === ']') {
          const { state } = view
          const $from = state.doc.resolve(from)
          const textBefore = $from.parent.textContent.slice(0, $from.parentOffset)
          
          // Find the last [[ before cursor
          const lastBracket = textBefore.lastIndexOf('[[')
          if (lastBracket !== -1) {
            const between = textBefore.slice(lastBracket + 2)
            // Check there's no ]] between
            if (!between.includes(']]') && !between.includes('[')) {
              // Get the link title (everything typed between [[ and ]])
              const linkTitle = between
              
              if (linkTitle.length > 0) {
                // Delete the typed characters and insert a wiki link node
                const tr = state.tr
                
                // We need to delete from lastBracket to current position and insert the node
                tr.delete(lastBracket + state.doc.resolve(lastBracket).start(), to + 1)
                
                // Insert the wiki link as HTML span
                const linkHtml = `<span data-wiki-link data-title="${escapeHtml(linkTitle)}" class="ke-wiki-link">${escapeHtml(linkTitle)}</span>`
                
                // Use insertContent with HTML
                const fromPos = lastBracket + state.doc.resolve(lastBracket).start()
                tr.insertText(linkTitle, fromPos)
                
                // Apply the mark
                const docSize = tr.doc.content.size
                if (fromPos >= 0 && fromPos < docSize) {
                  tr.addMark(fromPos, fromPos + linkTitle.length, 
                    view.state.schema.marks.underline.create()
                  )
                }
                
                view.dispatch(tr)
                
                // Trigger callback
                if (onLinkCreated) {
                  onLinkCreated(linkTitle)
                }
                
                return true
              }
            }
          }
        }
        return false
      },
    },
  })
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
