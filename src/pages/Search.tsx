import React, { useEffect, useState } from 'react'
import SimpleSearch from '../search'
import { initDB } from '../db/indexeddb'

const SearchPage: React.FC = () => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  useEffect(() => {
    const load = async () => {
      const notes = await initDB.getAllNotes()
      SimpleSearch.build(notes as any)
    }
    load()
  }, [])
  const doSearch = () => {
    const r = SimpleSearch.search(query)
    setResults(r)
  }
  return (
    <div className="kn-search">
      <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="搜索笔记..." />
      <button onClick={doSearch}>搜索</button>
      <div className="kn-results">
        {results.map((r)=> (
          <div key={r.id} className="kn-result-item">{r.title}</div>
        ))}
      </div>
    </div>
  )
}

export default SearchPage
