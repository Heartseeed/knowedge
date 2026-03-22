import React from 'react'
import type { Note } from '../db/indexeddb'

type Props = {
  note: Note
  onClick?: () => void
}

const NoteCard: React.FC<Props> = ({ note, onClick }) => {
  const excerpt = note.content?.replace(/<[^>]+>/g, '').slice(0, 120) || ''
  return (
    <div className="kn-note-card" onClick={onClick} title={note.title}>
      <div className="kn-note-title">{note.title}</div>
      <div className="kn-note-excerpt">{excerpt}</div>
      <div className="kn-note-meta">{new Date(note.createdAt).toLocaleDateString()}</div>
    </div>
  )
}

export default NoteCard
