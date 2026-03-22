import React, { useState } from 'react'
import { X, Mail, Lock, User, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { signIn, signUp, signOut, getCurrentUser, initAuth } from '../supabase/auth'
import { isSupabaseConfigured } from '../supabase/client'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onAuthSuccess?: () => void
}

type AuthMode = 'login' | 'register' | 'profile'

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const user = getCurrentUser()

  // Check if Supabase is configured
  if (!isSupabaseConfigured()) {
    return (
      isOpen && (
        <div className="ke-modal-overlay" onClick={onClose}>
          <div className="ke-modal ke-modal--auth" onClick={(e) => e.stopPropagation()}>
            <div className="ke-modal__header">
              <span className="ke-modal__title">账号管理</span>
              <button className="ke-modal__close" onClick={onClose}>
                <X size={18} />
              </button>
            </div>
            <div className="ke-modal__body">
              <div className="ke-auth-notice">
                <AlertCircle size={20} />
                <p>云端同步功能需要配置 Supabase。</p>
                <p>请在 .env 文件中添加 Supabase 配置。</p>
              </div>
            </div>
          </div>
        </div>
      )
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    // Validation
    if (!email.trim()) {
      setError('请输入邮箱')
      return
    }
    if (!password.trim()) {
      setError('请输入密码')
      return
    }
    if (mode === 'register') {
      if (password !== confirmPassword) {
        setError('两次输入的密码不一致')
        return
      }
      if (password.length < 6) {
        setError('密码至少需要6个字符')
        return
      }
    }

    setIsLoading(true)

    try {
      if (mode === 'login') {
        const { user, error } = await signIn(email, password)
        if (error) {
          setError(error)
        } else {
          setSuccess('登录成功！')
          setTimeout(() => {
            onAuthSuccess?.()
            onClose()
          }, 1000)
        }
      } else {
        const { user, error } = await signUp(email, password)
        if (error) {
          setError(error)
        } else {
          setSuccess('注册成功！请查收验证邮件。')
          setMode('login')
        }
      }
    } catch (err: any) {
      setError(err.message || '操作失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    setIsLoading(true)
    try {
      const { error } = await signOut()
      if (error) {
        setError(error)
      } else {
        setSuccess('已退出登录')
        setEmail('')
        setPassword('')
        onAuthSuccess?.()
      }
    } catch (err: any) {
      setError(err.message || '退出失败')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="ke-modal-overlay" onClick={onClose}>
      <div className="ke-modal ke-modal--auth" onClick={(e) => e.stopPropagation()}>
        <div className="ke-modal__header">
          <span className="ke-modal__title">
            {mode === 'profile' ? '账号信息' : mode === 'login' ? '登录账号' : '注册账号'}
          </span>
          <button className="ke-modal__close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="ke-modal__body">
          {/* Error message */}
          {error && (
            <div className="ke-auth-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Success message */}
          {success && (
            <div className="ke-auth-success">
              <CheckCircle size={16} />
              <span>{success}</span>
            </div>
          )}

          {/* User profile view */}
          {mode === 'profile' && user && (
            <div className="ke-auth-profile">
              <div className="ke-auth-profile__avatar">
                <User size={32} />
              </div>
              <div className="ke-auth-profile__info">
                <p className="ke-auth-profile__email">{user.email}</p>
                <p className="ke-auth-profile__id">ID: {user.id.slice(0, 8)}...</p>
              </div>
              <button
                className="ke-btn ke-btn--danger ke-auth-logout"
                onClick={handleLogout}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 size={16} className="ke-spin" /> : null}
                退出登录
              </button>
            </div>
          )}

          {/* Login/Register form */}
          {(mode === 'login' || mode === 'register') && (
            <form onSubmit={handleSubmit} className="ke-auth-form">
              <div className="ke-auth-field">
                <label className="ke-auth-label">
                  <Mail size={16} />
                  邮箱
                </label>
                <input
                  type="email"
                  className="ke-auth-input"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="ke-auth-field">
                <label className="ke-auth-label">
                  <Lock size={16} />
                  密码
                </label>
                <input
                  type="password"
                  className="ke-auth-input"
                  placeholder={mode === 'register' ? '至少6个字符' : '输入密码'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              {mode === 'register' && (
                <div className="ke-auth-field">
                  <label className="ke-auth-label">
                    <Lock size={16} />
                    确认密码
                  </label>
                  <input
                    type="password"
                    className="ke-auth-input"
                    placeholder="再次输入密码"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              )}

              <button
                type="submit"
                className="ke-btn ke-btn--primary ke-auth-submit"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 size={16} className="ke-spin" />
                ) : mode === 'login' ? (
                  '登录'
                ) : (
                  '注册'
                )}
              </button>

              <div className="ke-auth-switch">
                {mode === 'login' ? (
                  <p>
                    还没有账号？
                    <button type="button" onClick={() => setMode('register')}>
                      立即注册
                    </button>
                  </p>
                ) : (
                  <p>
                    已有账号？
                    <button type="button" onClick={() => setMode('login')}>
                      立即登录
                    </button>
                  </p>
                )}
              </div>
            </form>
          )}
        </div>

        {mode === 'profile' && (
          <div className="ke-modal__footer">
            <button className="ke-btn ke-btn--outline" onClick={() => setMode('login')}>
              返回登录
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default AuthModal
