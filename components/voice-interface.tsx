"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { generateLiveKitToken } from "@/app/actions/livekit"
import { FlipHorizontal } from "lucide-react"

type Transcription = {
  speaker: "user" | "agent"
  text: string
  timestamp: number
}

export function VoiceInterface() {
  const [isConnected, setIsConnected] = useState(false)
  const [isRoomReady, setIsRoomReady] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<string>("Initializing...")
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment")
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([])
  const [retryCount, setRetryCount] = useState(0)
  const roomRef = useRef<any>(null)
  const localParticipantRef = useRef<any>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const transcriptionRef = useRef<HTMLDivElement>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const playAudioFeedback = useCallback((message: string) => {
    const utterance = new SpeechSynthesisUtterance(message)
    utterance.rate = 1.1
    utterance.pitch = 1.0
    utterance.volume = 1.0
    window.speechSynthesis.speak(utterance)
  }, [])

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }
          setCurrentLocation(location)
        },
        (error) => {
          console.error("Error getting location:", error)
        },
        { enableHighAccuracy: true },
      )

      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          })
        },
        (error) => {
          console.error("Error watching location:", error)
        },
        { enableHighAccuracy: true, maximumAge: 10000 },
      )

      return () => navigator.geolocation.clearWatch(watchId)
    }
  }, [])

  const initializeCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
      }
      setCameraError(null)
    } catch (error) {
      console.error("Error accessing camera:", error)
      setCameraError("Unable to access camera")
      playAudioFeedback("Unable to access camera. Please grant camera permissions.")
    }
  }, [facingMode, playAudioFeedback])

  const flipCamera = useCallback(() => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"))
    playAudioFeedback(facingMode === "environment" ? "Switching to front camera" : "Switching to back camera")
  }, [facingMode, playAudioFeedback])

  const sendFrameToAgent = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !isRoomReady || !roomRef.current) {
      return
    }

    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext("2d")

      if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
        return
      }

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      canvas.toBlob(
        async (blob) => {
          if (blob && localParticipantRef.current) {
            const arrayBuffer = await blob.arrayBuffer()
            const uint8Array = new Uint8Array(arrayBuffer)

            try {
              await localParticipantRef.current.publishData(uint8Array, {
                reliable: true,
                destinationIdentities: [],
                topic: "camera-frame",
              })
            } catch (error) {
              console.error("Error sending frame:", error)
            }
          }
        },
        "image/jpeg",
        0.8,
      )
    } catch (error) {
      console.error("Error capturing frame:", error)
    }
  }, [isRoomReady])

  const connectToRoom = useCallback(async () => {
    try {
      setConnectionStatus("Connecting to LookOut...")

      const { Room, RoomEvent } = await import("livekit-client")

      const result = await generateLiveKitToken("lookout-room", "user-" + Math.random().toString(36).substring(7))

      if (!result.success || !result.token) {
        throw new Error(result.error || "Failed to get token")
      }

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      })

      roomRef.current = room

      room.on(RoomEvent.Connected, () => {
        console.log("Room connected successfully")
        setIsRoomReady(true)
        setIsConnected(true)
        setConnectionStatus("Connected")
        setRetryCount(0)
        playAudioFeedback("LookOut is ready")

        frameIntervalRef.current = setInterval(() => {
          sendFrameToAgent()
        }, 2000)

        if (currentLocation) {
          room.localParticipant.publishData(
            new TextEncoder().encode(JSON.stringify({ type: "location", data: currentLocation })),
            { reliable: true, topic: "user-location" },
          )
        }
      })

      room.on(RoomEvent.Disconnected, (reason) => {
        console.log("Room disconnected:", reason)
        setIsRoomReady(false)
        setIsConnected(false)
        setConnectionStatus("Disconnected")

        if (frameIntervalRef.current) {
          clearInterval(frameIntervalRef.current)
          frameIntervalRef.current = null
        }

        if (retryCount < 5) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 10000)
          setConnectionStatus(`Reconnecting in ${delay / 1000}s...`)
          reconnectTimeoutRef.current = setTimeout(() => {
            setRetryCount((prev) => prev + 1)
            setIsConnected(false)
          }, delay)
        } else {
          setConnectionStatus("Connection failed. Please refresh the page.")
          playAudioFeedback("Connection lost. Please refresh the page and ensure the agent is running.")
        }
      })

      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        console.log("Track subscribed:", track.kind, participant.identity)
        if (track.kind === "audio") {
          const audioElement = track.attach()
          document.body.appendChild(audioElement)
          audioElement.play()

          if (participant.identity.includes("agent")) {
            console.log("Agent audio track subscribed")
          }
        }
      })

      room.on(RoomEvent.TranscriptionReceived, (transcriptions, participant) => {
        console.log("Transcription received:", transcriptions, participant?.identity)
        transcriptions.forEach((transcription) => {
          if (transcription.text && transcription.text.trim()) {
            const isAgent = participant?.identity?.includes("agent") || false
            setTranscriptions((prev) => [
              ...prev.slice(-4),
              {
                speaker: isAgent ? "agent" : "user",
                text: transcription.text,
                timestamp: Date.now(),
              },
            ])
          }
        })
      })

      room.on(RoomEvent.DataReceived, (payload, participant) => {
        try {
          const decoder = new TextDecoder()
          const data = decoder.decode(payload)
          const parsed = JSON.parse(data)

          console.log("Data received:", parsed)

          if (parsed.type === "agent-speech" && parsed.text) {
            setTranscriptions((prev) => [
              ...prev.slice(-4),
              {
                speaker: "agent",
                text: parsed.text,
                timestamp: Date.now(),
              },
            ])
          }
        } catch (error) {
          // Not JSON data, ignore
        }
      })

      await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, result.token)

      localParticipantRef.current = room.localParticipant

      await room.localParticipant.setMicrophoneEnabled(true)
    } catch (error) {
      console.error("Error connecting to room:", error)
      setConnectionStatus("Connection failed")

      if (retryCount < 5) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000)
        setConnectionStatus(`Retrying in ${delay / 1000}s... (Make sure agent is running)`)
        reconnectTimeoutRef.current = setTimeout(() => {
          setRetryCount((prev) => prev + 1)
          setIsConnected(false)
        }, delay)
      } else {
        setConnectionStatus("Failed to connect. Is the agent running?")
        playAudioFeedback("Failed to connect. Please make sure the Python agent is running.")
      }
    }
  }, [playAudioFeedback, sendFrameToAgent, currentLocation, retryCount])

  useEffect(() => {
    if (currentLocation && isRoomReady && roomRef.current) {
      roomRef.current.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ type: "location", data: currentLocation })),
        { reliable: true, topic: "user-location" },
      )
    }
  }, [currentLocation, isRoomReady])

  useEffect(() => {
    initializeCamera()
  }, [facingMode, initializeCamera])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current)
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isConnected) {
      connectToRoom()
    }

    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect()
        setIsRoomReady(false)
      }
    }
  }, [isConnected, connectToRoom])

  useEffect(() => {
    if (transcriptionRef.current) {
      transcriptionRef.current.scrollTop = transcriptionRef.current.scrollHeight
    }
  }, [transcriptions])

  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        aria-hidden="true"
      />

      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      <div className="absolute top-6 right-6 z-10 flex items-center gap-2 px-4 py-2 bg-black/60 backdrop-blur-md rounded-full border border-white/10">
        <div className={`w-2 h-2 rounded-full ${isRoomReady ? "bg-emerald-400 animate-pulse" : "bg-yellow-400"}`} />
        <span className="text-xs text-white font-medium tracking-wide">
          {isRoomReady ? "LIVE" : connectionStatus.toUpperCase()}
        </span>
      </div>

      <button
        onClick={flipCamera}
        className="absolute top-6 right-48 z-10 p-3 bg-black/60 backdrop-blur-md rounded-full border border-white/10 hover:bg-black/80 transition-colors active:scale-95"
        aria-label={`Switch to ${facingMode === "environment" ? "front" : "back"} camera`}
      >
        <FlipHorizontal className="w-5 h-5 text-white" />
      </button>

      {cameraError && (
        <div className="absolute top-20 left-6 right-6 z-10 p-4 bg-red-500/90 backdrop-blur-sm rounded-xl border border-red-400/50">
          <p className="text-white text-center font-medium">{cameraError}</p>
        </div>
      )}

      {!isRoomReady && retryCount >= 3 && (
        <div className="absolute top-32 left-6 right-6 z-10 p-4 bg-yellow-500/90 backdrop-blur-sm rounded-xl border border-yellow-400/50">
          <p className="text-white text-center font-medium text-sm">
            Make sure the Python agent is running:{" "}
            <code className="bg-black/30 px-2 py-1 rounded">cd agent && python main.py dev</code>
          </p>
        </div>
      )}

      {transcriptions.length > 0 && (
        <div
          ref={transcriptionRef}
          className="absolute bottom-0 left-0 right-0 z-20 max-h-48 overflow-y-auto bg-gradient-to-t from-black/90 via-black/80 to-transparent backdrop-blur-sm px-6 py-4 space-y-2"
        >
          {transcriptions.map((transcription, index) => (
            <div
              key={`${transcription.timestamp}-${index}`}
              className="flex items-start gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <span
                className={`text-xs font-bold uppercase tracking-wider flex-shrink-0 ${
                  transcription.speaker === "agent" ? "text-emerald-400" : "text-blue-400"
                }`}
              >
                {transcription.speaker === "agent" ? "LookOut" : "You"}:
              </span>
              <p className="text-sm text-white/95 leading-relaxed font-medium text-balance">{transcription.text}</p>
            </div>
          ))}
        </div>
      )}

      <div className="sr-only" role="status" aria-live="polite">
        {isRoomReady ? "LookOut navigation assistant is active and listening" : connectionStatus}
      </div>
    </div>
  )
}
