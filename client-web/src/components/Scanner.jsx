import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import jsQR from 'jsqr'
import { api } from '../api'

export default function Scanner() {
  const navigate = useNavigate()
  const location = useLocation()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(true)

  useEffect(() => {
    let stream = null
    let animId = null

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (videoRef.current) videoRef.current.srcObject = stream
        scan()
      } catch (e) {
        setError('Camera access denied. Please allow camera permissions.')
      }
    }

    const scan = () => {
      if (!videoRef.current || !canvasRef.current) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (video.readyState !== video.HAVE_ENOUGH_DATA) { animId = requestAnimationFrame(scan); return }

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height)

      if (code) {
        handleCode(code.data)
        return
      }
      animId = requestAnimationFrame(scan)
    }

    start()
    return () => {
      if (animId) cancelAnimationFrame(animId)
      if (stream) stream.getTracks().forEach(t => t.stop())
    }
  }, [])

  const handleCode = async (data) => {
    if (loading) return
    setScanning(false)
    setLoading(true)
    try {
      let parsed
      try { parsed = JSON.parse(data) } catch { parsed = { code: data } }
      const code = parsed.code || data
      const pos = await new Promise((res) => {
        navigator.geolocation.getCurrentPosition(
          (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => res({ lat: 0, lng: 0 }),
          { enableHighAccuracy: true, timeout: 10000 }
        )
      })
      const returnTo = location.state?.returnTo || '/home'
      await api.punchIn(code, pos.lat, pos.lng)
      navigate(returnTo)
    } catch (err) {
      setError(err.message || 'Punch failed. Try again.')
      setScanning(true)
      setLoading(false)
    }
  }

  const handleBack = () => navigate(-1)

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="relative flex-1">
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />

        {/* Scanner Overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-64 h-64">
            <div className="absolute inset-0 border-2 border-blue-400/60 rounded-xl" />
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-blue-400 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-blue-400 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-blue-400 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-blue-400 rounded-br-lg" />
            {scanning && <div className="absolute left-2 right-2 h-0.5 bg-blue-400/80 rounded-full animate-scan-line" />}
          </div>
        </div>

        {loading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="text-white text-center">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <div className="text-sm">Processing...</div>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute bottom-20 left-4 right-4 bg-red-500/90 text-white text-sm rounded-lg p-3 text-center">
            {error}
            <button onClick={() => { setError(''); setScanning(true) }} className="block mx-auto mt-2 underline text-xs">Try Again</button>
          </div>
        )}

        <button onClick={handleBack} className="absolute top-12 left-4 w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
      </div>
      <div className="p-4 text-center text-white/60 text-xs">Point the camera at the QR code</div>
    </div>
  )
}
