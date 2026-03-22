import React, { useState, useEffect } from 'react'
import { BrandCompact } from '../dashboard/BrandLogo'
import { User } from 'lucide-react'

type Theme = 'light' | 'beige' | 'dark'
const THEMES: Theme[] = ['light', 'beige', 'dark']

const THEME_ICONS: Record<Theme, React.ReactNode> = {
  light: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  ),
  beige: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  ),
  dark: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  ),
}

const THEME_LABELS: Record<Theme, string> = {
  light: '浅色',
  beige: '米色',
  dark: '暗色',
}

interface HeaderProps {
  onCapture?: () => void
  showBack?: boolean
  onBack?: () => void
  onLogoClick?: () => void
  onSettingsClick?: () => void
  onAuthClick?: () => void
  currentUser?: { email?: string } | null
}

const Header: React.FC<HeaderProps> = ({ onCapture, showBack, onBack, onLogoClick, onSettingsClick, onAuthClick, currentUser }) => {
  // 初始化时从 DOM 读取当前主题
  const [theme, setTheme] = useState<Theme>(() => {
    const current = document.documentElement.getAttribute('data-theme') as Theme
    return THEMES.includes(current) ? current : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const cycleTheme = () => {
    const idx = THEMES.indexOf(theme)
    const next = THEMES[(idx + 1) % THEMES.length]
    setTheme(next)
  }

  return (
    <header className="ke-header">
      {/* Left: Logo / Back */}
      <div className="ke-header__logo">
        {showBack && (
          <button className="ke-header__back-btn" onClick={onBack} title="返回首页">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
        )}
        <BrandCompact onClick={onLogoClick} />
      </div>

      {/* Right: Actions */}
      <div className="ke-header__actions">
        <button
          className="ke-header__action-btn ke-header__action-btn--primary"
          onClick={onCapture}
          title="快速捕获"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          <span>捕获</span>
        </button>

        {/* 三态主题切换 */}
        <button
          className="ke-header__theme-btn"
          onClick={cycleTheme}
          title={`当前：${THEME_LABELS[theme]}，点击切换`}
          aria-label={`切换主题，当前：${THEME_LABELS[theme]}`}
        >
          {THEME_ICONS[theme]}
          <span className="ke-header__theme-label">{THEME_LABELS[theme]}</span>
        </button>

        <button
          className={`ke-header__avatar ${currentUser ? 'ke-header__avatar--logged-in' : ''}`}
          onClick={onAuthClick || onSettingsClick}
          title={currentUser ? `已登录: ${currentUser.email}` : '点击登录账号'}
          aria-label="账号管理"
        >
          {currentUser ? (
            <span className="ke-header__user-email">
              {currentUser.email?.charAt(0).toUpperCase() || <User size={16} />}
            </span>
          ) : (
            <User size={16} />
          )}
        </button>
      </div>
    </header>
  )
}

export default Header
