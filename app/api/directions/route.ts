import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { origin, destination } = await request.json()

    // This will be called by the agent, not directly by the client
    // The agent will use the Google Maps API to get directions

    return NextResponse.json({
      distance: "Calculating...",
      duration: "Calculating...",
    })
  } catch (error) {
    console.error("Error getting directions:", error)
    return NextResponse.json({ error: "Failed to get directions" }, { status: 500 })
  }
}
