import { useEffect, useCallback } from 'react'

export default function MediaPreviewModal({ url, mimeType, messageType, name, onClose }) {
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const mime = mimeType || ''
  const type = messageType || ''

  const isImage = type === 'image' || mime.startsWith('image/')
  const isVideo = type === 'video' || mime.startsWith('video/')
  const isAudio = type === 'audio' || mime.startsWith('audio/')
  const isPdf = type === 'document' && (mime.includes('pdf') || name?.endsWith('.pdf'))

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 16, right: 16, zIndex: 10,
          width: 36, height: 36, borderRadius: '50%',
          border: 'none', background: 'rgba(255,255,255,0.2)',
          color: '#fff', fontSize: 20, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ✕
      </button>

      <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90%', maxHeight: '90%', cursor: 'default' }}>
        {isImage && (
          <img
            src={url}
            alt=""
            style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 8, display: 'block' }}
          />
        )}

        {isVideo && (
          <video src={url} controls autoPlay style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 8 }} />
        )}

        {isAudio && (
          <div style={{ padding: 24, background: '#fff', borderRadius: 12, minWidth: 320 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#111827' }}>🎵 Audio</div>
            <audio src={url} controls style={{ width: '100%' }} />
          </div>
        )}

        {isPdf && (
          <iframe
            src={url}
            style={{ width: '90vw', height: '90vh', border: 'none', borderRadius: 8, background: '#fff' }}
            title="Document preview"
          />
        )}

        {!isImage && !isVideo && !isAudio && !isPdf && (
          <div style={{ padding: 24, background: '#fff', borderRadius: 12, textAlign: 'center', minWidth: 300 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 8 }}>{name || 'Document'}</div>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block', padding: '10px 24px',
                background: '#25D366', color: '#fff',
                borderRadius: 8, textDecoration: 'none',
                fontSize: 13, fontWeight: 600,
              }}
            >
              Open in new tab
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
