import React, { useState, useEffect, useCallback } from 'react'
import { Clock, RotateCcw, X, ChevronRight } from 'lucide-react'
import type { Note, NoteSnapshot, RestorePoint } from '../db/indexeddb'
import {
  getSnapshotsByNoteId,
  getSnapshotBefore,
  createSnapshot,
  getRestorePoints,
  deleteSnapshotsByNoteId,
} from '../db/indexeddb'

interface VersionHistoryPanelProps {
  note: Note
  onClose: () => void
  onRestore: (snapshot: NoteSnapshot) => void
}

export const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({
  note,
  onClose,
  onRestore,
}) => {
  const [snapshots, setSnapshots] = useState<NoteSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRestore, setSelectedRestore] = useState<RestorePoint | null>(null)
  const [previewSnapshot, setPreviewSnapshot] = useState<NoteSnapshot | null>(null)
  const [restoreMode, setRestoreMode] = useState<'snapshots' | 'restore'>('snapshots')

  const restorePoints = getRestorePoints()

  // Load snapshots
  const loadSnapshots = useCallback(async () => {
    setLoading(true)
    try {
      const snaps = await getSnapshotsByNoteId(note.id)
      setSnapshots(snaps)
    } catch (err) {
      console.error('Failed to load snapshots:', err)
    } finally {
      setLoading(false)
    }
  }, [note.id])

  useEffect(() => {
    loadSnapshots()
  }, [loadSnapshots])

  // Format timestamp to readable string
  const formatTime = (timestamp: number): string => {
    const now = Date.now()
    const diff = now - timestamp
    const minute = 60 * 1000
    const hour = 60 * minute
    const day = 24 * hour

    if (diff < minute) return '刚刚'
    if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
    if (diff < day) return `${Math.floor(diff / hour)} 小时前`
    if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`

    const date = new Date(timestamp)
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Handle restore from a specific time
  const handleRestoreFromTime = async (point: RestorePoint) => {
    const timestamp = point.getTimestamp()
    if (!timestamp) {
      alert(point.isLastVisit ? '没有上次访问记录' : '无法获取时间戳')
      return
    }

    try {
      const snapshot = await getSnapshotBefore(note.id, timestamp)
      if (snapshot) {
        onRestore(snapshot)
        onClose()
      } else {
        alert(`找不到 ${point.label} 的版本`)
      }
    } catch (err) {
      console.error('Failed to restore:', err)
      alert('恢复失败')
    }
  }

  // Handle restore from snapshot list
  const handleRestoreSnapshot = (snapshot: NoteSnapshot) => {
    onRestore(snapshot)
    onClose()
  }

  // Handle manual snapshot creation
  const handleCreateSnapshot = async () => {
    try {
      await createSnapshot(note, 'manual')
      await loadSnapshots()
    } catch (err) {
      console.error('Failed to create snapshot:', err)
    }
  }

  // Handle delete all snapshots
  const handleDeleteAll = async () => {
    if (!confirm('确定要删除所有历史版本吗？此操作不可恢复。')) return
    try {
      await deleteSnapshotsByNoteId(note.id)
      setSnapshots([])
    } catch (err) {
      console.error('Failed to delete snapshots:', err)
    }
  }

  return (
    <div className="ke-version-history">
      {/* Header */}
      <div className="ke-version-history__header">
        <div className="ke-version-history__title">
          <Clock size={18} />
          <span>版本历史</span>
        </div>
        <button className="ke-version-history__close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {/* Mode Tabs */}
      <div className="ke-version-history__tabs">
        <button
          className={`ke-version-history__tab ${restoreMode === 'restore' ? 'ke-version-history__tab--active' : ''}`}
          onClick={() => setRestoreMode('restore')}
        >
          时钟
        </button>
        <button
          className={`ke-version-history__tab ${restoreMode === 'snapshots' ? 'ke-version-history__tab--active' : ''}`}
          onClick={() => setRestoreMode('snapshots')}
        >
          历史列表
        </button>
      </div>

      {/* Restore by Time */}
      {restoreMode === 'restore' && (
        <div className="ke-version-history__content">
          <div className="ke-version-history__section-title">恢复到指定时间点</div>
          <div className="ke-version-history__restore-points">
            {restorePoints.map((point) => {
              const timestamp = point.getTimestamp()
              return (
                <button
                  key={point.label}
                  className="ke-version-history__restore-point"
                  onClick={() => handleRestoreFromTime(point)}
                  disabled={!timestamp}
                >
                  <span className="ke-version-history__restore-icon">{point.icon}</span>
                  <span className="ke-version-history__restore-label">{point.label}</span>
                  <ChevronRight size={16} className="ke-version-history__restore-arrow" />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Snapshot List */}
      {restoreMode === 'snapshots' && (
        <div className="ke-version-history__content">
          {/* Actions */}
          <div className="ke-version-history__actions">
            <button className="ke-version-history__action-btn" onClick={handleCreateSnapshot}>
              <Clock size={14} />
              创建快照
            </button>
            {snapshots.length > 0 && (
              <button className="ke-version-history__action-btn ke-version-history__action-btn--danger" onClick={handleDeleteAll}>
                清空
              </button>
            )}
          </div>

          {/* Snapshot List */}
          {loading ? (
            <div className="ke-version-history__loading">加载中...</div>
          ) : snapshots.length === 0 ? (
            <div className="ke-version-history__empty">
              <Clock size={32} strokeWidth={1} />
              <p>暂无历史版本</p>
              <span>编辑笔记时会自动保存版本</span>
            </div>
          ) : (
            <div className="ke-version-history__list">
              {snapshots.map((snapshot) => (
                <div
                  key={snapshot.id}
                  className="ke-version-history__item"
                  onClick={() => handleRestoreSnapshot(snapshot)}
                >
                  <div className="ke-version-history__item-time">
                    {formatTime(snapshot.createdAt)}
                    {snapshot.reason === 'manual' && (
                      <span className="ke-version-history__item-badge">手动</span>
                    )}
                  </div>
                  <div className="ke-version-history__item-preview">
                    {snapshot.title || '无标题'}
                  </div>
                  <div className="ke-version-history__item-action">
                    <RotateCcw size={14} />
                    <span>恢复</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="ke-version-history__footer">
        <span>自动保存间隔: 1 分钟</span>
      </div>
    </div>
  )
}

export default VersionHistoryPanel
