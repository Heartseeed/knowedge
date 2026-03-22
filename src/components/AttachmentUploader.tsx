import React, { useCallback, useState, useRef } from 'react'
import { Upload, X, File, Image, Music, Video, FileText, Loader2 } from 'lucide-react'
import type { Attachment, AttachmentStatus } from '../kb/types'
import { 
  SUPPORTED_FILE_TYPES, 
  MAX_FILE_SIZE, 
  getFileType,
  getFileIcon,
  FILE_TYPE_EXTENSIONS 
} from '../kb/types'
import { putAttachment, generateId } from '../db/indexeddb'

interface AttachmentUploaderProps {
  noteId: string
  onUploadComplete?: (attachment: Attachment) => void
  onUploadError?: (error: string) => void
}

interface UploadingFile {
  id: string
  file: File
  progress: number
  status: AttachmentStatus
  error?: string
}

// Merge all supported MIME types
const ALL_SUPPORTED_TYPES = Object.values(SUPPORTED_FILE_TYPES).flat()
const ACCEPT_STRING = ALL_SUPPORTED_TYPES.join(',')

const AttachmentUploader: React.FC<AttachmentUploaderProps> = ({
  noteId,
  onUploadComplete,
  onUploadError,
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Validate file
  const validateFile = useCallback((file: File): string | null => {
    // Check size
    if (file.size > MAX_FILE_SIZE) {
      return `文件 ${file.name} 超过 25MB 限制`
    }

    // Check type
    if (!ALL_SUPPORTED_TYPES.includes(file.type)) {
      return `不支持的文件类型: ${file.type}`
    }

    return null
  }, [])

  // Process a single file
  const processFile = useCallback(async (file: File) => {
    const id = generateId('att')
    const now = Date.now()
    
    // Create local URL
    const localUrl = URL.createObjectURL(file)
    
    // Determine type
    const fileType = getFileType(file.type)
    
    // Create attachment record
    const attachment: Attachment = {
      id,
      noteId,
      name: file.name,
      type: fileType,
      mimeType: file.type,
      size: file.size,
      status: 'pending',
      localUrl,
      createdAt: now,
    }
    
    // Save to IndexedDB
    await putAttachment(attachment)
    
    // Return attachment
    onUploadComplete?.(attachment)
    
    // For now, just mark as uploaded locally
    // In production, would upload to Supabase Storage here
    attachment.status = 'uploaded'
    await putAttachment(attachment)
    
    return attachment
  }, [noteId, onUploadComplete])

  // Handle file selection
  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const fileArray = Array.from(files)
    
    for (const file of fileArray) {
      const error = validateFile(file)
      
      if (error) {
        onUploadError?.(error)
        continue
      }

      const uploadingFile: UploadingFile = {
        id: generateId('up'),
        file,
        progress: 0,
        status: 'pending',
      }

      setUploadingFiles(prev => [...prev, uploadingFile])

      try {
        uploadingFile.status = 'uploading'
        uploadingFile.progress = 50
        setUploadingFiles(prev => prev.map(f => 
          f.id === uploadingFile.id ? { ...f, progress: 50 } : f
        ))

        await processFile(file)

        uploadingFile.status = 'uploaded'
        uploadingFile.progress = 100
        setUploadingFiles(prev => prev.map(f => 
          f.id === uploadingFile.id ? { ...f, status: 'uploaded', progress: 100 } : f
        ))
      } catch (err) {
        uploadingFile.status = 'failed'
        uploadingFile.error = err instanceof Error ? err.message : '上传失败'
        setUploadingFiles(prev => prev.map(f => 
          f.id === uploadingFile.id ? { ...f, status: 'failed', error: uploadingFile.error } : f
        ))
        onUploadError?.(`上传 ${file.name} 失败`)
      }
    }
  }, [validateFile, processFile, onUploadError])

  // Drag handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  // Remove completed/failed upload from list
  const removeUpload = useCallback((id: string) => {
    setUploadingFiles(prev => prev.filter(f => f.id !== id))
  }, [])

  return (
    <div className="ke-attachment-uploader">
      {/* Drop zone */}
      <div
        className={`ke-attachment-dropzone ${isDragging ? 'ke-attachment-dropzone--active' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_STRING}
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          style={{ display: 'none' }}
        />
        <Upload size={24} />
        <p>拖拽文件或点击上传</p>
        <span className="ke-attachment-hint">
          支持：图片、PDF、Word、Excel、音频、视频
        </span>
      </div>

      {/* Uploading files list */}
      {uploadingFiles.length > 0 && (
        <div className="ke-attachment-uploading">
          {uploadingFiles.map(uploadingFile => (
            <div 
              key={uploadingFile.id} 
              className={`ke-attachment-item ke-attachment-item--${uploadingFile.status}`}
            >
              <div className="ke-attachment-item__icon">
                {uploadingFile.status === 'uploading' ? (
                  <Loader2 size={16} className="ke-attachment-spinner" />
                ) : uploadingFile.status === 'failed' ? (
                  <X size={16} />
                ) : (
                  <File size={16} />
                )}
              </div>
              <div className="ke-attachment-item__info">
                <span className="ke-attachment-item__name">{uploadingFile.file.name}</span>
                {uploadingFile.status === 'uploading' && (
                  <span className="ke-attachment-item__progress">
                    上传中... {uploadingFile.progress}%
                  </span>
                )}
                {uploadingFile.status === 'failed' && (
                  <span className="ke-attachment-item__error">{uploadingFile.error}</span>
                )}
              </div>
              <button
                className="ke-attachment-item__remove"
                onClick={(e) => {
                  e.stopPropagation()
                  removeUpload(uploadingFile.id)
                }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Supported formats hint */}
      <div className="ke-attachment-formats">
        <span>支持的格式：</span>
        <span className="ke-attachment-format">🖼️ 图片 (jpg, png, gif, webp, svg)</span>
        <span className="ke-attachment-format">📄 PDF</span>
        <span className="ke-attachment-format">📝 Word (doc, docx)</span>
        <span className="ke-attachment-format">📊 Excel (xls, xlsx)</span>
        <span className="ke-attachment-format">🎵 音频 (mp3, wav, ogg, m4a)</span>
        <span className="ke-attachment-format">🎬 视频 (mp4, webm, mov)</span>
      </div>
    </div>
  )
}

export default AttachmentUploader
