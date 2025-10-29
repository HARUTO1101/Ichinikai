import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser'
import { useEffect, useRef } from 'react'

interface QrScannerProps {
  active: boolean
  onResult: (value: string) => void
  onError?: (message: string) => void
  facingMode?: 'environment' | 'user'
}

export function QrScanner({
  active,
  onResult,
  onError,
  facingMode = 'environment',
}: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const controlsRef = useRef<IScannerControls | null>(null)

  useEffect(() => {
    if (!active) {
      controlsRef.current?.stop()
      controlsRef.current = null
      return
    }

    let isMounted = true
    const startScanner = async () => {
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function'
      ) {
        onError?.(
          'カメラを利用できません。HTTPSでアクセスしているか、Safariの設定でカメラ使用を許可してください。',
        )
        return
      }

      const codeReader = new BrowserQRCodeReader()
      try {
        controlsRef.current = await codeReader.decodeFromConstraints(
          { video: { facingMode } },
          videoRef.current!,
          (result, error, controls) => {
            if (!isMounted) return
            if (result) {
              onResult(result.getText())
              controls.stop()
              controlsRef.current = null
            } else if (error && error.name !== 'NotFoundException') {
              console.error(error)
              onError?.('QRコードの読み取りに失敗しました。カメラの位置を調整してください。')
            }
          },
        )
      } catch (err) {
        console.error(err)
        onError?.('カメラを利用できません。ブラウザの設定をご確認ください。')
      }
    }

    void startScanner()

    return () => {
      isMounted = false
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [active, facingMode, onError, onResult])

  return (
    <div className="qr-scanner">
      <video
        ref={videoRef}
        style={{ width: '100%', borderRadius: '12px' }}
        playsInline
        muted
        autoPlay
      />
    </div>
  )
}
