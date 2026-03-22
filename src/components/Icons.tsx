import React from 'react'
import {
  Inbox,
  Star,
  Folder,
  Tag,
  Globe,
  Calendar,
  Trash2,
  Plus,
  Brain,
  BookOpen,
  FlaskConical,
  Lightbulb,
  StickyNote,
  FileText,
  Eye,
  Columns,
  Edit3,
  Clock,
  CheckCircle2,
  Archive,
  Sparkles,
  ChevronRight,
  Dice5,
  Rocket,
  Link2,
  BarChart3,
  Timer,
  Search,
  ArrowLeft,
  Menu,
  X,
  MoreHorizontal,
  ChevronDown,
} from 'lucide-react'

// Note type icons
export const NoteTypeIcon: Record<string, React.FC<{ size?: number; className?: string }>> = {
  concept: Brain,
  reading: BookOpen,
  practice: FlaskConical,
  idea: Lightbulb,
  card: StickyNote,
}

// Navigation icons
export const NavIcons = {
  inbox: Inbox,
  starred: Star,
  folder: Folder,
  tags: Tag,
  network: Globe,
  timeline: Calendar,
  trash: Trash2,
  add: Plus,
}

// Action icons
export const ActionIcons = {
  edit: Edit3,
  preview: Eye,
  split: Columns,
  save: CheckCircle2,
  archive: Archive,
  search: Search,
  back: ArrowLeft,
  menu: Menu,
  close: X,
  more: MoreHorizontal,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
}

// Status icons
export const StatusIcons = {
  connected: CheckCircle2,
  organized: Archive,
  inbox: Inbox,
}

// Feature icons
export const FeatureIcons = {
  sparkles: Sparkles,
  arrow: ChevronRight,
  dice: Dice5,
  rocket: Rocket,
  link: Link2,
  chart: BarChart3,
  timer: Timer,
  clock: Clock,
}

// Icon wrapper component with consistent styling
interface IconProps {
  icon: React.FC<{ size?: number; className?: string }>
  size?: number
  className?: string
}

export const Icon: React.FC<IconProps> = ({ icon: IconComponent, size = 18, className = '' }) => (
  <IconComponent size={size} className={className} />
)

// Convenience component for note types
interface NoteTypeIconProps {
  type: string
  size?: number
  className?: string
}

export const NoteTypeIconComponent: React.FC<NoteTypeIconProps> = ({ type, size = 18, className = '' }) => {
  const IconComponent = NoteTypeIcon[type] || FileText
  return <IconComponent size={size} className={className} />
}
