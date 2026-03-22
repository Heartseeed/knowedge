/**
 * SM-2 Spaced Repetition Algorithm Implementation
 * Based on the SuperMemo 2 algorithm by Piotr Wozniak
 * 
 * Reference: https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
 */

// Review quality grades (0-5)
export type ReviewGrade = 0 | 1 | 2 | 3 | 4 | 5

export interface SM2Result {
  easeFactor: number      // EF - Easiness Factor (difficulty modifier)
  interval: number        // I - Interval in days
  repetitions: number     // n - Number of successful reviews
  nextReviewAt: number   // Timestamp for next review
}

// Review level categories for UI
export type ReviewLevel = 'easy' | 'medium' | 'hard'

/**
 * Maps UI review levels to SM-2 grades
 */
export function levelToGrade(level: ReviewLevel): ReviewGrade {
  switch (level) {
    case 'easy': return 5
    case 'medium': return 3
    case 'hard': return 1
  }
}

/**
 * Default values for a new note
 */
export const DEFAULT_SM2_PARAMS = {
  easeFactor: 2.5,      // Default EF, can be adjusted based on note type
  interval: 1,           // Start with 1 day interval
  repetitions: 0,       // No successful reviews yet
  nextReviewAt: Date.now(), // Review immediately
}

/**
 * Calculate the next review parameters based on SM-2 algorithm
 * 
 * @param currentEF - Current ease factor (minimum 1.3)
 * @param currentInterval - Current interval in days
 * @param repetitions - Number of successful reviews
 * @param grade - Review quality (0-5)
 * @returns New SM2 parameters
 */
export function calculateSM2(
  currentEF: number,
  currentInterval: number,
  repetitions: number,
  grade: ReviewGrade
): SM2Result {
  // Calculate new ease factor
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  let newEF = currentEF + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
  
  // Ensure EF doesn't fall below 1.3
  newEF = Math.max(1.3, newEF)
  
  let newInterval: number
  let newRepetitions: number
  
  if (grade < 3) {
    // Failed review - reset
    newRepetitions = 0
    newInterval = 1
  } else {
    // Successful review
    newRepetitions = repetitions + 1
    
    if (newRepetitions === 1) {
      newInterval = 1
    } else if (newRepetitions === 2) {
      newInterval = 6
    } else {
      newInterval = Math.round(currentInterval * newEF)
    }
  }
  
  // Calculate next review timestamp
  const nextReviewAt = Date.now() + newInterval * 24 * 60 * 60 * 1000
  
  return {
    easeFactor: newEF,
    interval: newInterval,
    repetitions: newRepetitions,
    nextReviewAt,
  }
}

/**
 * Check if a note is due for review
 */
export function isDue(nextReviewAt: number): boolean {
  return Date.now() >= nextReviewAt
}

/**
 * Get overdue days count
 */
export function getOverdueDays(nextReviewAt: number): number {
  const diff = Date.now() - nextReviewAt
  return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)))
}

/**
 * Format interval for display
 */
export function formatInterval(days: number): string {
  if (days < 1) return '今天'
  if (days === 1) return '1天'
  if (days < 7) return `${days}天`
  if (days < 30) {
    const weeks = Math.floor(days / 7)
    return `${weeks}周`
  }
  if (days < 365) {
    const months = Math.floor(days / 30)
    return `${months}月`
  }
  const years = Math.floor(days / 365)
  return `${years}年`
}

/**
 * Get review priority score (higher = more urgent)
 */
export function getReviewPriority(
  nextReviewAt: number,
  easeFactor: number,
  reviewCount: number
): number {
  const daysUntilDue = (nextReviewAt - Date.now()) / (24 * 60 * 60 * 1000)
  const overdueDays = Math.max(0, -daysUntilDue)
  
  // Factors that increase priority:
  // 1. Overdue days (exponential decay)
  // 2. Lower ease factor (harder notes need more frequent review)
  // 3. Lower review count (new notes need more attention)
  
  const overdueScore = overdueDays * 10
  const difficultyScore = (2.5 - easeFactor) * 5
  const noveltyScore = Math.max(0, 5 - reviewCount) * 2
  
  return overdueScore + difficultyScore + noveltyScore
}

/**
 * Sort notes by review priority
 */
export function sortByPriority<T extends { 
  nextReviewAt: number
  easeFactor: number 
  reviewCount: number 
}>(notes: T[]): T[] {
  return [...notes].sort((a, b) => 
    getReviewPriority(b.nextReviewAt, b.easeFactor, b.reviewCount) -
    getReviewPriority(a.nextReviewAt, a.easeFactor, a.reviewCount)
  )
}

/**
 * Get recommended review intervals for each difficulty level
 */
export function getRecommendedIntervals(ef: number): Record<ReviewLevel, number> {
  return {
    easy: Math.round(ef * ef * 2),     // Long interval for easy
    medium: Math.round(ef * 1.5),       // Medium interval
    hard: 1,                              // Review soon for hard
  }
}
