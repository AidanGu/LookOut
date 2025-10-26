# LookOut - AI Navigation Assistant

A voice-powered navigation assistant designed for blind and low-vision users, combining real-time computer vision with Google Maps navigation.

## Features

- **Full-Screen Camera View**: Live back camera feed for real-time environment awareness
- **Always-On Voice Interface**: No buttons - just speak naturally with turn detection
- **Personalized Greeting**: Agent introduces itself as "LookOut" and asks where you'd like to go
- **Real-time Vision**: Automatic camera frame analysis every 2 seconds for obstacle detection
- **Turn Detection**: Advanced conversation flow using LiveKit's turn detector plugin
- **Google Maps Integration**: AI-powered directions with function calling
- **Location Tracking**: Continuous GPS monitoring for accurate navigation
- **Mobile Optimized**: Designed specifically for iOS and mobile browsers
- **Accessibility First**: Built with blind and low-vision users in mind

## Setup

### Web App (Next.js)

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Set up environment variables in `.env.local`:
\`\`\`
NEXT_PUBLIC_LIVEKIT_URL=your_livekit_url
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
GOOGLE_API_KEY=your_google_api_key
GOOGLE_MAPS_API=your_google_maps_api_key
\`\`\`

3. Run the development server:
\`\`\`bash
npm run dev
\`\`\`

4. Open [http://localhost:3000](http://localhost:3000) on your mobile device

### Python Agent

1. Navigate to the agent directory:
\`\`\`bash
cd agent
\`\`\`

2. Install dependencies:
\`\`\`bash
pip install -r requirements.txt
\`\`\`

3. Download turn detector model weights:
\`\`\`bash
python main.py download-files
\`\`\`

4. Set up environment variables in `agent/.env`:
\`\`\`
LIVEKIT_URL=your_livekit_url
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
GOOGLE_API_KEY=your_google_api_key
GOOGLE_MAPS_API=your_google_maps_api_key
\`\`\`

5. Run the agent:
\`\`\`bash
python main.py dev
\`\`\`

## Usage

1. Open the web app on your mobile device
2. Grant camera, microphone, and location permissions
3. The back camera activates automatically with a clean, full-screen view
4. **LookOut greets you**: "Hi, my name is LookOut. I'm here to look out for you. Where would you like to go today?"
5. Simply speak naturally - the AI listens continuously and responds
6. The turn detector automatically manages conversation flow
7. Camera frames are sent to the agent every 2 seconds for vision analysis
8. Ask for directions: "How do I get to Starbucks?"
9. The AI uses your current location and Google Maps to provide guidance
10. **Continuous conversation**: LookOut keeps talking with you until you reach your destination or tell it to stop

## ⚠️ CRITICAL: Agent Must Be Running

**The web app will not work without the Python agent running!**

Before opening the web app, you MUST start the agent:

\`\`\`bash
cd agent
python main.py dev
\`\`\`

You should see output like:
\`\`\`
INFO:vision-assistant:Agent worker started
INFO:livekit:Connected to LiveKit server
\`\`\`

**Common Issues:**

1. **"Connection failed" or "ServerUnreachable"**: The agent is not running. Start it with `python main.py dev`
2. **"Negotiation timed out"**: Check that your LiveKit credentials match in both `.env.local` and `agent/.env`
3. **No voice/transcriptions**: Ensure the agent downloaded the turn detector model with `python main.py download-files`

## Architecture

- **Frontend**: Next.js 15 with React 19, optimized for mobile
- **Voice**: LiveKit for real-time audio streaming with turn detection
- **AI**: Google Gemini Realtime API with function calling
- **Vision**: Automatic camera frame capture and analysis
- **Navigation**: Google Maps API with AI function calling
- **Location**: Continuous GPS tracking with watchPosition

## Accessibility Features

- Full-screen camera view with no UI clutter
- Always-on voice interface (no buttons to find)
- Turn detector for natural conversation flow
- Haptic and audio feedback
- Screen reader compatible status indicators
- High contrast visual indicators for sighted helpers
- Voice-first interaction design
- Back camera only (environment-facing)
- Automatic connection and setup

## Safety Features

- Privacy-first: No identity inference or surveillance
- Conservative guidance for uncertain situations
- Clear spatial language using clock-face directions
- Real-time obstacle detection and avoidance
- Continuous location tracking for accurate navigation

## Technical Improvements

- **Function Calling**: Agent can call Google Maps API directly
- **Auto Frame Capture**: Camera frames sent every 2 seconds
- **Location Sync**: User location continuously updated to agent
- **Self-Contained**: No external props or manual configuration needed
- **Server Actions**: Secure token generation without API routes
- **Turn Detection**: Natural conversation without push-to-talk

## License

See LICENSE file for details.
