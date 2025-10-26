"use server"

import "server-only"
import { SignJWT } from "jose"

export async function generateLiveKitToken(roomName: string, participantName: string) {
  try {
    const apiKey = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET

    if (!apiKey || !apiSecret) {
      throw new Error("Missing LiveKit credentials")
    }

    if (!roomName || !participantName) {
      throw new Error("Missing required parameters")
    }

    // Create JWT token manually using jose library
    const token = await new SignJWT({
      video: {
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(participantName)
      .setIssuer(apiKey)
      .setExpirationTime("24h")
      .setIssuedAt()
      .sign(new TextEncoder().encode(apiSecret))

    return { success: true, token }
  } catch (error) {
    console.error("Error generating token:", error)
    return { success: false, error: "Failed to generate token" }
  }
}
