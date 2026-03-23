import React from 'react'

// KnowEdge Brand Logo — Custom SVG
// K icon: 5-lobe blue node structure + pink diagonal swoosh, transparent background
// Matches logo_icon.png style with exact blue #2563eb

const BRAND_BLUE = '#2563eb'
const BRAND_PINK = '#e05580'

// Hero 版：左侧 K 图标，右侧 KnowEdge + 中文
export const BrandHero: React.FC<{ iconSize?: number; wordWidth?: number }> = ({
  iconSize = 56,
  wordWidth = 200,
}) => {
  const s = iconSize / 48 // scale factor
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
      {/* K 图标 SVG */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 48 48"
        fill="none"
        style={{ flexShrink: 0 }}
      >
        {/* Blue K lobes — top arm */}
        <path
          d="M24 10 C20 10 17 13 17 17 C17 20.5 19.5 23.5 23 24"
          stroke={BRAND_BLUE} strokeWidth="2.5" strokeLinecap="round" fill="none"
        />
        {/* Blue K lobes — bottom arm */}
        <path
          d="M24 24 C19.5 24 17 27 17 31 C17 35 20 38 24 38"
          stroke={BRAND_BLUE} strokeWidth="2.5" strokeLinecap="round" fill="none"
        />
        {/* Blue K — horizontal bar */}
        <path
          d="M17 24 H31"
          stroke={BRAND_BLUE} strokeWidth="2.5" strokeLinecap="round"
        />
        {/* Blue K — vertical stem */}
        <path
          d="M24 10 V38"
          stroke={BRAND_BLUE} strokeWidth="2.5" strokeLinecap="round"
        />
        {/* Blue K — right arm top */}
        <path
          d="M24 24 L32 12"
          stroke={BRAND_BLUE} strokeWidth="2.5" strokeLinecap="round"
        />
        {/* Blue K — right arm bottom */}
        <path
          d="M24 24 L32 36"
          stroke={BRAND_BLUE} strokeWidth="2.5" strokeLinecap="round"
        />
        {/* Pink diagonal swoosh */}
        <path
          d="M12 38 C16 30 20 28 26 20 C30 14 36 8 40 6"
          stroke={BRAND_PINK} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.9"
        />
        {/* Node dots */}
        <circle cx="24" cy="10" r="2" fill={BRAND_BLUE} />
        <circle cx="17" cy="17" r="1.8" fill={BRAND_BLUE} />
        <circle cx="17" cy="31" r="1.8" fill={BRAND_BLUE} />
        <circle cx="24" cy="38" r="1.8" fill={BRAND_BLUE} />
        <circle cx="32" cy="12" r="1.8" fill={BRAND_BLUE} />
        <circle cx="32" cy="36" r="1.8" fill={BRAND_BLUE} />
        <circle cx="40" cy="6" r="1.5" fill={BRAND_PINK} />
      </svg>

      {/* 右侧：KnowEdge + 中文 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {/* KnowEdge 文字 */}
        <span
          style={{
            fontFamily: "'Inter', -apple-system, 'Segoe UI', system-ui, sans-serif",
            fontSize: '36px',
            fontWeight: 700,
            color: BRAND_BLUE,
            letterSpacing: '-0.5px',
            lineHeight: 1.1,
          }}
        >
          KnowEdge
        </span>
        <span
          style={{
            fontSize: '1rem',
            fontWeight: 500,
            color: 'var(--ke-text-muted)',
            letterSpacing: '1px',
          }}
        >
          知域·你的个人知识库
        </span>
      </div>
    </div>
  )
}

// Header 紧凑版：K 图标 + KnowEdge（可点击）
interface BrandCompactProps {
  onClick?: () => void
}
export const BrandCompact: React.FC<BrandCompactProps> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      title="返回首页"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        fontFamily: "'Inter', -apple-system, 'Segoe UI', system-ui, sans-serif",
      }}
    >
      <svg width="26" height="26" viewBox="0 0 48 48" fill="none">
        <path d="M24 10 C20 10 17 13 17 17 C17 20.5 19.5 23.5 23 24" stroke={BRAND_BLUE} strokeWidth="2.5" strokeLinecap="round" fill="none"/>
        <path d="M24 24 C19.5 24 17 27 17 31 C17 35 20 38 24 38" stroke={BRAND_BLUE} strokeWidth="2.5" strokeLinecap="round" fill="none"/>
        <path d="M17 24 H31" stroke={BRAND_BLUE} strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M24 10 V38" stroke={BRAND_BLUE} strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M24 24 L32 12" stroke={BRAND_BLUE} strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M24 24 L32 36" stroke={BRAND_BLUE} strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M12 38 C16 30 20 28 26 20 C30 14 36 8 40 6" stroke={BRAND_PINK} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.9"/>
        <circle cx="24" cy="10" r="2" fill={BRAND_BLUE}/>
        <circle cx="17" cy="17" r="1.8" fill={BRAND_BLUE}/>
        <circle cx="17" cy="31" r="1.8" fill={BRAND_BLUE}/>
        <circle cx="24" cy="38" r="1.8" fill={BRAND_BLUE}/>
        <circle cx="32" cy="12" r="1.8" fill={BRAND_BLUE}/>
        <circle cx="32" cy="36" r="1.8" fill={BRAND_BLUE}/>
        <circle cx="40" cy="6" r="1.5" fill={BRAND_PINK}/>
      </svg>
      <span
        style={{
          fontSize: '1rem',
          fontWeight: 700,
          color: 'var(--ke-text-primary)',
          letterSpacing: '-0.3px',
          fontFamily: "'Inter', -apple-system, 'Segoe UI', system-ui, sans-serif",
        }}
      >
        KnowEdge
      </span>
    </button>
  )
}

// 兼容旧接口
const BrandLogo: React.FC<{ size?: number; className?: string }> = () => null
const BrandWordmark: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = () => null

export { BrandLogo, BrandWordmark }
export default BrandLogo
