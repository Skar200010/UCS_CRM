import { useRef, useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import jsQR from 'jsqr'
import { api } from '../api'

export default function Scanner() {
  const navigate = useNavigate()
  const location = useLocation()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const frameSkip = useRef(0)
  const streamRef = useRef(null)
  const animRef = useRef(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [started, setStarted] = useState(false)
  const [scanning, setScanning] = useState(false)

  const stopCamera = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const startCamera = useCallback(async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { min: 640, ideal: 1920 },
          height: { min: 480, ideal: 1080 },
        }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadeddata = () => {
          setStarted(true)
          setScanning(true)
          scanLoop()
        }
      }
    } catch (e) {
      setError(e.name === 'NotAllowedError'
        ? 'Camera access denied. Please allow camera permissions in your device settings, then refresh.'
        : e.name === 'NotFoundError'
        ? 'No camera found on this device.'
        : 'Could not access camera: ' + e.message)
    }
  }, [])

  const scanLoop = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      animRef.current = requestAnimationFrame(scanLoop)
      return
    }

    frameSkip.current = (frameSkip.current + 1) % 3
    if (frameSkip.current !== 0) { animRef.current = requestAnimationFrame(scanLoop); return }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    const d = imageData.data
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      const adj = gray > 128 ? Math.min(255, gray * 1.3) : Math.max(0, gray * 0.7)
      d[i] = d[i + 1] = d[i + 2] = adj
    }

    const code = jsQR(imageData.data, imageData.width, imageData.height)
    if (code) { handleCode(code.data); return }

    animRef.current = requestAnimationFrame(scanLoop)
  }

  const handleCode = async (data) => {
    if (loading) return
    setScanning(false)
    setLoading(true)
    stopCamera()
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
      setScanning(false)
      setLoading(false)
    }
  }

  const handleBack = () => { stopCamera(); navigate(-1) }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="relative flex-1">
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />

        {/* Start Screen — before camera permission is requested */}
        {!started && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
            <div className="w-20 h-20 mb-6 rounded-2xl bg-white/10 flex items-center justify-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                <path d="M2 8V6a2 2 0 012-2h2" /><path d="M2 16v2a2 2 0 002 2h2" />
                <path d="M18 4h2a2 2 0 012 2v2" /><path d="M18 20h2a2 2 0 002-2v-2" />
                <rect x="9" y="9" width="6" height="6" rx="1" />
              </svg>
            </div>
            <h2 className="text-white text-lg font-semibold mb-2">Scan QR Code</h2>
            <p className="text-white/50 text-sm mb-8 text-center px-8">Position the QR code within the frame to punch in</p>
            <button onClick={startCamera}
              className="px-8 py-3 rounded-xl bg-white text-black font-semibold text-sm active:scale-95 transition-transform">
              Start Camera
            </button>
          </div>
        )}

        {/* Scanner Overlay — shown when camera is active */}
        {started && (
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
        )}

        {/* Processing overlay */}
        {loading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="text-white text-center">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <div className="text-sm">Processing...</div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-white text-center px-6 max-w-sm">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-7 h-7 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              </div>
              <p className="text-sm text-white/80 mb-6">{error}</p>
              <div className="flex gap-3 justify-center">
                <button onClick={handleBack} className="px-5 py-2 rounded-lg bg-white/10 text-white text-sm">Go Back</button>
                <button onClick={startCamera} className="px-5 py-2 rounded-lg bg-white text-black text-sm font-semibold">Try Again</button>
              </div>
            </div>
          </div>
        )}

        {/* Back button */}
        <button onClick={handleBack} className="absolute top-12 left-4 w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
      </div>

      {started && !loading && (
        <div className="p-4 text-center text-white/60 text-xs">Point the camera at the QR code</div>
      )}
    </div>
  )
}
