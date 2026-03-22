/**
 * Writing Assistant / Smart Hints System
 * 
 * Provides contextual suggestions to improve notes:
 * - Example suggestions
 * - Link recommendations
 * - Content splitting
 * - Content expansion
 */

import { parseWikiLinks, findLinkSuggestions } from './backlinks'

// Hint types
export type HintType = 'example' | 'link' | 'split' | 'expand'

// A writing hint with relevance score
export interface WritingHint {
  id: string
  type: HintType
  title: string
  description: string
  action?: {
    label: string
    handler: () => void
  }
  score: number  // 0-1, higher = more relevant
}

// Note with minimal fields
interface HintNote {
  id: string
  title: string
  content: string
  type: 'concept' | 'reading' | 'practice' | 'idea' | 'card'
}

// Content analysis result
interface ContentAnalysis {
  wordCount: number
  sentenceCount: number
  paragraphCount: number
  hasExamples: boolean
  hasLinks: boolean
  averageSentenceLength: number
  isTooLong: boolean  // Should be split
  isTooShort: boolean  // Should be expanded
  dominantTopic?: string
}

/**
 * Analyze note content for hint generation
 */
export function analyzeContent(content: string, plainText: string): ContentAnalysis {
  // Strip HTML for text analysis
  const text = plainText || content.replace(/<[^>]+>/g, ' ').trim()
  
  // Count words
  const words = text.split(/\s+/).filter(w => w.length > 0)
  const wordCount = words.length
  
  // Count sentences (rough)
  const sentences = text.split(/[.!?。！？]+/).filter(s => s.trim().length > 0)
  const sentenceCount = sentences.length
  
  // Count paragraphs
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0)
  const paragraphCount = paragraphs.length
  
  // Check for examples indicators
  const exampleIndicators = [
    '例如', '比如', '比如', '举个例子', '如', '比方说',
    'example', 'for instance', 'such as', 'like',
  ]
  const hasExamples = exampleIndicators.some(ind => text.toLowerCase().includes(ind.toLowerCase()))
  
  // Check for links
  const links = parseWikiLinks(content)
  const hasLinks = links.length > 0
  
  // Calculate average sentence length
  const averageSentenceLength = sentenceCount > 0 ? wordCount / sentenceCount : 0
  
  // Determine if content should be split (too long)
  const isTooLong = paragraphCount > 5 || averageSentenceLength > 40
  
  // Determine if content should be expanded (too short)
  const isTooShort = wordCount < 50 && paragraphCount <= 1
  
  return {
    wordCount,
    sentenceCount,
    paragraphCount,
    hasExamples,
    hasLinks,
    averageSentenceLength,
    isTooLong,
    isTooShort,
  }
}

/**
 * Generate writing hints based on content analysis
 */
export function generateWritingHints(
  note: HintNote,
  allNotes: HintNote[]
): WritingHint[] {
  const hints: WritingHint[] = []
  const plainText = note.content.replace(/<[^>]+>/g, ' ')
  const analysis = analyzeContent(note.content, plainText)
  
  // 1. Example suggestion (if missing)
  if (!analysis.hasExamples && analysis.wordCount > 30) {
    hints.push({
      id: 'hint_example',
      type: 'example',
      title: '添加具体例子',
      description: '添加一个具体的例子可以帮助理解和记忆这个概念',
      action: {
        label: '添加例子',
        handler: () => {},  // UI will implement
      },
      score: 0.8,
    })
  }
  
  // 2. Link suggestion (if missing)
  if (!analysis.hasLinks) {
    const suggestions = findLinkSuggestions('', allNotes, note.id, 3)
    if (suggestions.length > 0) {
      hints.push({
        id: 'hint_link',
        type: 'link',
        title: '建立知识连接',
        description: `建议连接到: ${suggestions.map(s => s.title).join(', ')}`,
        action: {
          label: '查看推荐',
          handler: () => {},
        },
        score: 0.9,
      })
    }
  }
  
  // 3. Split suggestion (if too long)
  if (analysis.isTooLong) {
    hints.push({
      id: 'hint_split',
      type: 'split',
      title: '考虑拆分内容',
      description: `这段内容较长 (${analysis.paragraphCount} 段落)，考虑拆分成多个相关笔记`,
      action: {
        label: '拆分建议',
        handler: () => {},
      },
      score: 0.7,
    })
  }
  
  // 4. Expand suggestion (if too short)
  if (analysis.isTooShort) {
    hints.push({
      id: 'hint_expand',
      type: 'expand',
      title: '补充更多内容',
      description: `这个笔记比较简短 (${analysis.wordCount} 字)，建议补充背景、定义或细节`,
      action: {
        label: '扩展内容',
        handler: () => {},
      },
      score: 0.85,
    })
  }
  
  // 5. Type-specific hints
  if (note.type === 'concept') {
    hints.push({
      id: 'hint_concept_def',
      type: 'example',
      title: '添加定义说明',
      description: '概念笔记可以补充: 定义、特点、与其他概念的区分',
      score: 0.6,
    })
  }
  
  if (note.type === 'practice') {
    hints.push({
      id: 'hint_practice_result',
      type: 'expand',
      title: '记录实践结果',
      description: '实践笔记可以补充: 过程、结果、反思、下一步',
      score: 0.65,
    })
  }
  
  // Sort by score
  return hints.sort((a, b) => b.score - a.score)
}

/**
 * Get relevance score for a hint type
 */
export function getHintTypePriority(
  hintType: HintType,
  noteType: string
): number {
  // Base priorities
  const basePriority: Record<HintType, number> = {
    link: 0.9,      // Links are always valuable
    example: 0.8,
    expand: 0.7,
    split: 0.5,
  }
  
  // Type-specific adjustments
  const typeModifiers: Record<string, Partial<Record<HintType, number>>> = {
    concept: {
      example: 0.1,  // Examples especially important for concepts
    },
    idea: {
      expand: 0.1,  // Ideas often need more detail
    },
    practice: {
      expand: 0.15, // Practice notes benefit from thoroughness
    },
  }
  
  const base = basePriority[hintType]
  const modifier = typeModifiers[noteType]?.[hintType] || 0
  
  return Math.min(1, base + modifier)
}

/**
 * Calculate overall writing quality score
 */
export function calculateWritingScore(
  content: string,
  noteType: string
): {
  score: number
  breakdown: {
    length: number
    structure: number
    connections: number
    completeness: number
  }
} {
  const analysis = analyzeContent(content, '')
  
  // Length score (optimal: 100-500 words)
  let lengthScore = 0
  if (analysis.wordCount < 20) lengthScore = 0.2
  else if (analysis.wordCount < 50) lengthScore = 0.4
  else if (analysis.wordCount < 100) lengthScore = 0.6
  else if (analysis.wordCount < 300) lengthScore = 0.9
  else if (analysis.wordCount < 500) lengthScore = 0.8
  else lengthScore = 0.5
  
  // Structure score (sentences and paragraphs)
  const structureScore = Math.min(1, analysis.paragraphCount * 0.2 + analysis.sentenceCount * 0.02)
  
  // Connections score
  const connectionsScore = analysis.hasLinks ? 0.8 : 0.3
  
  // Completeness score (based on type)
  let completenessScore = 0.5
  if (noteType === 'concept' && analysis.hasExamples) completenessScore += 0.2
  if (noteType === 'practice' && analysis.wordCount > 100) completenessScore += 0.2
  if (analysis.hasLinks) completenessScore += 0.15
  completenessScore = Math.min(1, completenessScore)
  
  // Weighted total
  const score = (
    lengthScore * 0.25 +
    structureScore * 0.15 +
    connectionsScore * 0.3 +
    completenessScore * 0.3
  )
  
  return {
    score: Math.round(score * 100) / 100,
    breakdown: {
      length: Math.round(lengthScore * 100) / 100,
      structure: Math.round(structureScore * 100) / 100,
      connections: Math.round(connectionsScore * 100) / 100,
      completeness: Math.round(completenessScore * 100) / 100,
    },
  }
}

/**
 * Get suggestion text for a hint type
 */
export function getHintSuggestion(type: HintType): string {
  const suggestions: Record<HintType, string> = {
    example: '💡 建议添加具体的例子或案例来支持这个观点',
    link: '🔗 考虑与其他笔记建立连接，形成知识网络',
    split: '✂️ 内容较长，可以考虑拆分为多个相关笔记',
    expand: '📝 内容较少，建议补充更多细节或背景信息',
  }
  return suggestions[type]
}

/**
 * Quick hint for real-time display
 */
export interface QuickHint {
  type: HintType
  icon: string
  message: string
  priority: number
}

/**
 * Get real-time quick hints based on current cursor context
 */
export function getQuickHints(
  note: HintNote,
  allNotes: HintNote[],
  cursorContext?: string
): QuickHint[] {
  const hints: QuickHint[] = []
  
  // Check if user just typed [[ (link suggestion)
  if (cursorContext?.endsWith('[[')) {
    hints.push({
      type: 'link',
      icon: '🔗',
      message: '正在创建链接...',
      priority: 100,
    })
  }
  
  // Check for question words (might need expansion)
  if (cursorContext) {
    const questionWords = ['为什么', '如何', '什么是', '怎么样', 'why', 'how', 'what']
    if (questionWords.some(q => cursorContext.toLowerCase().includes(q))) {
      hints.push({
        type: 'expand',
        icon: '💭',
        message: '尝试回答这个问题',
        priority: 80,
      })
    }
  }
  
  // Generate general hints
  const generalHints = generateWritingHints(note, allNotes)
  generalHints.slice(0, 2).forEach(h => {
    const iconMap: Record<HintType, string> = {
      example: '📝',
      link: '🔗',
      split: '✂️',
      expand: '💡',
    }
    hints.push({
      type: h.type,
      icon: iconMap[h.type],
      message: h.title,
      priority: Math.round(h.score * 70),
    })
  })
  
  // Sort by priority
  return hints.sort((a, b) => b.priority - a.priority)
}
