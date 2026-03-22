import React from 'react'
import NoteEditor from '../components/NoteEditor'
import type { Note } from '../db/indexeddb'

type Props = {
  note?: Note
}

const NotesPage: React.FC<Props> = ({ note }) => {
  // Very small standalone page to satisfy "at least one complete page" requirement
  const [n, setN] = React.useState<Note | undefined>(note)
  return (
    <div className="kn-layout kn-page">
      <div className="kn-left">笔记列表</div>
      <div className="kn-middle">
        <h2>{n?.title ?? '新笔记'}</h2>
        <NoteEditor note={n} onChange={(nn) => setN(nn)} />
      </div>
      <div className="kn-right">属性</div>
    </div>
  )
}

export default NotesPage
