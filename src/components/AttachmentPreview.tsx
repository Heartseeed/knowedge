import React, { useState } from 'react'
import { X, Download, ExternalLink, Image, FileText, Music, Video, Paperclip, Loader2 } from 'lucide-react'
import type { Attachment, AttachmentType } from '../kb/types'
import { getFileIcon } from '../kb/types'
import { deleteAttachment } from '../db/indexeddb'

interface AttachmentPreviewProps {
  attachment: Attachment
  onDelete?: (id: string) => void
  onClick?: (attachment: Attachment) => void
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const getTypeIcon = (type: AttachmentType, size: number = 16) => {
  const iconProps = { size }
  switch (type) {
    case 'image':
      return <Image {...iconProps} />
    case 'pdf':
    case 'word':
    case 'excel':
      return <FileText {...iconProps} />
    case 'audio':
      return <Music {...iconProps} />
    case 'video':
      return <Video {...iconProps} />
    default:
      return <Paperclip {...iconProps} />
  }
}

const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({
  attachment,
  onDelete,
  onClick,
}) => {
  const [isDeleting, setIsDeleting] = useState(false)
  const [showLightbox, setShowLightbox] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsDeleting(true)
    try {
      await deleteAttachment(attachment.id)
      onDelete?.(attachment.id)
    } catch (err) {
      console.error('Failed to delete attachment:', err)
    }
    setIsDeleting(false)
  }

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (attachment.localUrl) {
      const a = document.createElement('a')
      a.href = attachment.localUrl
      a.download = attachment.name
      a.click()
    }
  }

  const isImage = attachment.type === 'image'
  const canPreview = isImage && attachment.localUrl

  return (
    <>
      <div
        className={`ke-attachment-preview ke-attachment-preview--${attachment.type}`}
        onClick={() => {
          if (canPreview) {
            setShowLightbox(true)
          }
          onClick?.(attachment)
        }}
      >
        {/* Preview */}
        {canPreview ? (
          <div className="ke-attachment-preview__image">
            <img src={attachment.localUrl} alt={attachment.name} />
          </div>
        ) : (
          <div className="ke-attachment-preview__icon">
            {getTypeIcon(attachment.type, 32)}
            <span className="ke-attachment-preview__type-icon">
              {getFileIcon(attachment.type)}
            </span>
          </div>
        )}

        {/* Info */}
        <div className="ke-attachment-preview__info">
          <span className="ke-attachment-preview__name" title={attachment.name}>
            {attachment.name}
          </span>
          <span className="ke-attachment-preview__meta">
            {formatFileSize(attachment.size)}
            {attachment.status === 'uploading' && ' · 上传中'}
            {attachment.status === 'failed' && ' · 上传失败'}
          </span>
        </div>

        {/* Actions */}
        <div className="ke-attachment-preview__actions">
          {attachment.localUrl && (
            <button
              className="ke-attachment-preview__action"
              onClick={handleDownload}
              title="下载"
            >
              <Download size={14} />
            </button>
          )}
          <button
            className="ke-attachment-preview__action ke-attachment-preview__action--delete"
            onClick={handleDelete}
            disabled={isDeleting}
            title="删除"
          >
            {isDeleting ? <Loader2 size={14} className="ke-attachment-spinner" /> : <X size={14} />}
          </button>
        </div>
      </div>

      {/* Lightbox for images */}
      {showLightbox && attachment.localUrl && (
        <div className="ke-lightbox" onClick={() => setShowLightbox(false)}>
          <div className="ke-lightbox__content" onClick={e => e.stopPropagation()}>
            <img src={attachment.localUrl} alt={attachment.name} />
            <div className="ke-lightbox__info">
              <span>{attachment.name}</span>
              <span>{formatFileSize(attachment.size)}</span>
            </div>
          </div>
          <button
            className="ke-lightbox__close"
            onClick={() => setShowLightbox(false)}
          >
            <X size={24} />
          </button>
        </div>
      )}
    </>
  )
}

interface AttachmentListProps {
  attachments: Attachment[]
  onDelete?: (id: string) => void
  onAttachmentClick?: (attachment: Attachment) => void
}

export const AttachmentList: React.FC<AttachmentListProps> = ({
  attachments,
  onDelete,
  onAttachmentClick,
}) => {
  if (attachments.length === 0) {
    return null
  }

  return (
    <div className="ke-attachment-list">
      <div className="ke-attachment-list__header">
        <Paperclip size={14} />
        <span>{attachments.length} 个附件</span>
      </div>
      <div className="ke-attachment-list__items">
        {attachments.map(attachment => (
          <AttachmentPreview
            key={attachment.id}
            attachment={attachment}
            onDelete={onDelete}
            onClick={onAttachmentClick}
          />
        ))}
      </div>
    </div>
  )
}

export default AttachmentPreview
