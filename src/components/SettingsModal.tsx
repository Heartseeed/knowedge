import React, { useState, useEffect, useCallback } from 'react'
import { 
  exportToJson, 
  importFromJson, 
  syncManager, 
  getSyncConfig, 
  setSyncConfig,
  type SyncConfig,
  type SyncState 
} from '../db/sync'
import { 
  supabaseSyncManager,
  type SyncState as SupabaseSyncState
} from '../db/sync-supabase'
import { isSupabaseConfigured } from '../supabase/client'
import type { Note } from '../db/indexeddb'

interface SettingsModalProps {
  notes: Note[]
  isOpen: boolean
  onClose: () => void
  onNotesImported: (notes: Note[]) => void
  onSyncTrigger?: (notes: Note[]) => Promise<void>
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  notes,
  isOpen,
  onClose,
  onNotesImported,
  onSyncTrigger,
}) => {
  const [activeTab, setActiveTab] = useState<'data' | 'sync' | 'about'>('data')
  const [syncType, setSyncType] = useState<'none' | 'supabase' | 'custom'>('none')
  const [syncConfig, setSyncConfigState] = useState<SyncConfig>({ enabled: false, autoSync: true, syncInterval: 30000 })
  const [syncState, setSyncState] = useState<SyncState>({ status: 'idle', lastSync: null, pendingChanges: 0 })
  const [supabaseState, setSupabaseState] = useState<SupabaseSyncState>({ status: 'disabled', lastSync: null, pendingChanges: 0, isConfigured: false })
  const [syncEndpoint, setSyncEndpoint] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadConfig()
      const unsubscribe1 = syncManager.subscribe(setSyncState)
      const unsubscribe2 = supabaseSyncManager.subscribe(setSupabaseState)
      return () => {
        unsubscribe1()
        unsubscribe2()
      }
    }
  }, [isOpen])

  const loadConfig = async () => {
    const config = await getSyncConfig()
    setSyncConfigState(config)
    setSyncEndpoint(config.endpoint || '')
    setSyncType(config.enabled ? 'custom' : 'none')
  }

  const handleExport = async () => {
    await exportToJson(notes)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    setImportResult(null)

    try {
      const result = await importFromJson(file)
      setImportResult(result)
      if (result.notes.length > 0) {
        onNotesImported(result.notes)
      }
    } catch (err) {
      alert('导入失败: ' + (err instanceof Error ? err.message : '未知错误'))
    } finally {
      setImporting(false)
    }
  }

  const handleSyncEnable = async () => {
    if (!syncEndpoint.trim()) {
      alert('请输入同步服务器地址')
      return
    }
    
    await syncManager.enable(syncEndpoint.trim())
    await setSyncConfig({ enabled: true, endpoint: syncEndpoint.trim() })
    setSyncConfigState({ enabled: true, endpoint: syncEndpoint, autoSync: true, syncInterval: 30000 })
    setSyncType('custom')
  }

  const handleSyncDisable = async () => {
    await syncManager.disable()
    setSyncConfigState({ enabled: false, autoSync: true, syncInterval: 30000 })
    setSyncType('none')
  }

  const handleSyncNow = async () => {
    if (syncType === 'supabase' && onSyncTrigger) {
      await onSyncTrigger(notes)
    } else {
      await syncManager.fullSync(notes)
    }
  }

  const handleSupabaseEnable = async () => {
    const success = await supabaseSyncManager.enable()
    if (success) {
      setSyncType('supabase')
    }
  }

  const handleSupabaseDisable = async () => {
    await supabaseSyncManager.disable()
    setSyncType('none')
  }

  const formatLastSync = (timestamp: number | null) => {
    if (!timestamp) return '从未同步'
    const diff = Date.now() - timestamp
    const min = Math.floor(diff / 60000)
    if (min < 1) return '刚刚'
    if (min < 60) return `${min}分钟前`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr}小时前`
    return new Date(timestamp).toLocaleDateString('zh-CN')
  }

  if (!isOpen) return null

  return (
    <>
      <div className="ke-modal-overlay" onClick={onClose} />
      <div className="ke-modal ke-modal--settings">
        <div className="ke-modal__header">
          <h3>⚙️ 设置</h3>
          <button className="ke-modal__close ke-modal__close--absolute" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div className="ke-settings__tabs">
          <button 
            className={`ke-settings__tab ${activeTab === 'data' ? 'active' : ''}`}
            onClick={() => setActiveTab('data')}
          >
            📦 数据管理
          </button>
          <button 
            className={`ke-settings__tab ${activeTab === 'sync' ? 'active' : ''}`}
            onClick={() => setActiveTab('sync')}
          >
            ☁️ 同步设置
          </button>
          <button 
            className={`ke-settings__tab ${activeTab === 'about' ? 'active' : ''}`}
            onClick={() => setActiveTab('about')}
          >
            ℹ️ 关于
          </button>
        </div>

        <div className="ke-modal__body ke-settings__body">
          {/* Data Management Tab */}
          {activeTab === 'data' && (
            <div className="ke-settings__section">
              <div className="ke-settings__card">
                <h4>📤 导出数据</h4>
                <p>将所有笔记导出为 JSON 文件，可在任何时候恢复数据。</p>
                <div className="ke-settings__stats">
                  <span>当前笔记数: <strong>{notes.length}</strong></span>
                </div>
                <button className="ke-btn ke-btn--primary" onClick={handleExport}>
                  导出备份文件
                </button>
              </div>

              <div className="ke-settings__card">
                <h4>📥 导入数据</h4>
                <p>从备份文件恢复笔记数据。</p>
                <label className="ke-btn ke-btn--outline ke-settings__import-btn">
                  {importing ? '导入中...' : '选择备份文件'}
                  <input 
                    type="file" 
                    accept=".json" 
                    onChange={handleImport}
                    style={{ display: 'none' }}
                    disabled={importing}
                  />
                </label>
                {importResult && (
                  <div className="ke-settings__import-result">
                    <span>✅ 成功导入 {importResult.imported} 条笔记</span>
                    {importResult.skipped > 0 && (
                      <span>⚠️ 跳过 {importResult.skipped} 条无效数据</span>
                    )}
                  </div>
                )}
              </div>

              <div className="ke-settings__card ke-settings__card--warning">
                <h4>🗄️ 存储位置</h4>
                <p>您的笔记存储在浏览器的 <strong>IndexedDB</strong> 中。</p>
                <ul className="ke-settings__info-list">
                  <li>✅ 数据保存在本地设备</li>
                  <li>✅ 无需登录账号</li>
                  <li>⚠️ 清除浏览器缓存会删除数据</li>
                  <li>💡 建议定期导出备份</li>
                </ul>
              </div>
            </div>
          )}

          {/* Sync Tab */}
          {activeTab === 'sync' && (
            <div className="ke-settings__section">
              {/* Supabase Sync Option */}
              <div className="ke-settings__card">
                <h4>☁️ Supabase 云同步 (推荐)</h4>
                <p>免费且易于设置，支持多设备同步和离线使用。</p>
                
                {!supabaseState.isConfigured ? (
                  <div className="ke-settings__supabase-setup">
                    <div className="ke-settings__supabase-status ke-settings__supabase-status--warning">
                      ⚠️ 需要配置 .env 文件
                    </div>
                    <p className="ke-settings__tip">
                      在项目根目录创建 <code>.env</code> 文件，添加：
                    </p>
                    <pre className="ke-settings__code">
{`VITE_SUPABASE_URL=你的项目URL
VITE_SUPABASE_ANON_KEY=你的ANON_KEY`}
                    </pre>
                    <p className="ke-settings__tip">
                      然后在 Supabase SQL Editor 运行 <code>src/supabase/schema.sql</code> 中的代码。
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="ke-settings__sync-status">
                      <div className={`ke-settings__sync-indicator ke-settings__sync-indicator--${supabaseState.status}`}>
                        <span className="ke-settings__sync-dot"></span>
                        <span>
                          {supabaseState.status === 'idle' && '未同步'}
                          {supabaseState.status === 'syncing' && '同步中...'}
                          {supabaseState.status === 'success' && '已同步'}
                          {supabaseState.status === 'error' && '同步失败'}
                          {supabaseState.status === 'offline' && '离线'}
                          {supabaseState.status === 'disabled' && '已禁用'}
                        </span>
                      </div>
                      <span className="ke-settings__sync-time">
                        上次同步: {formatLastSync(supabaseState.lastSync)}
                      </span>
                    </div>

                    {syncType !== 'supabase' ? (
                      <button 
                        className="ke-btn ke-btn--primary"
                        onClick={handleSupabaseEnable}
                      >
                        启用 Supabase 同步
                      </button>
                    ) : (
                      <div className="ke-settings__sync-actions">
                        <button className="ke-btn ke-btn--primary" onClick={handleSyncNow}>
                          立即同步
                        </button>
                        <button className="ke-btn ke-btn--outline" onClick={handleSupabaseDisable}>
                          关闭同步
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Custom Server Option */}
              <div className="ke-settings__card">
                <h4>🔧 自建同步服务器</h4>
                <p>使用您自己的 REST API 服务器进行同步。</p>
                
                <div className="ke-settings__sync-status">
                  <div className={`ke-settings__sync-indicator ke-settings__sync-indicator--${syncState.status}`}>
                    <span className="ke-settings__sync-dot"></span>
                    <span>
                      {syncState.status === 'idle' && '未连接'}
                      {syncState.status === 'syncing' && '同步中...'}
                      {syncState.status === 'success' && '已同步'}
                      {syncState.status === 'error' && '同步失败'}
                      {syncState.status === 'offline' && '离线'}
                    </span>
                  </div>
                  <span className="ke-settings__sync-time">
                    上次同步: {formatLastSync(syncState.lastSync)}
                  </span>
                </div>

                {syncType !== 'custom' ? (
                  <div className="ke-settings__sync-form">
                    <input
                      type="url"
                      className="ke-settings__input"
                      placeholder="输入同步服务器地址..."
                      value={syncEndpoint}
                      onChange={(e) => setSyncEndpoint(e.target.value)}
                    />
                    <button 
                      className="ke-btn ke-btn--outline"
                      onClick={handleSyncEnable}
                      disabled={!syncEndpoint.trim()}
                    >
                      启用自定义同步
                    </button>
                  </div>
                ) : (
                  <div className="ke-settings__sync-actions">
                    <button className="ke-btn ke-btn--outline" onClick={handleSyncNow}>
                      立即同步
                    </button>
                    <button className="ke-btn ke-btn--secondary" onClick={handleSyncDisable}>
                      关闭
                    </button>
                  </div>
                )}
                
              </div>

              {/* About Tab */}
            </div>
          )}
          {activeTab === 'about' && (
            <div className="ke-settings__section">
              <div className="ke-settings__card">
                <h4>📚 KnowEdge 知域</h4>
                <p className="ke-settings__version">版本 0.1.0</p>
                <p>个人知识管理系统 - 捕获、组织、回顾你的知识。</p>
              </div>

              <div className="ke-settings__card">
                <h4>⌨️ 快捷键</h4>
                <ul className="ke-settings__shortcuts">
                  <li><kbd>Ctrl</kbd> + <kbd>K</kbd> 搜索</li>
                  <li><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>K</kbd> 快速捕获</li>
                  <li><kbd>Ctrl</kbd> + <kbd>S</kbd> 保存笔记</li>
                  <li><kbd>Esc</kbd> 关闭弹窗</li>
                </ul>
              </div>

              <div className="ke-settings__card">
                <h4>🔒 隐私说明</h4>
                <ul className="ke-settings__info-list">
                  <li>✅ 所有数据存储在本地浏览器</li>
                  <li>✅ 不经过任何第三方服务器</li>
                  <li>✅ 可完全离线使用</li>
                  <li>☁️ 启用云同步后，数据会上传到您指定的服务器</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default SettingsModal
