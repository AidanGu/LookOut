# Deployment Guide

## Deploying to Vercel

### Web App

1. Push your code to GitHub

2. Import your repository in Vercel

3. Add environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_LIVEKIT_URL`
   - `LIVEKIT_API_KEY`
   - `LIVEKIT_API_SECRET`
   - `GOOGLE_API_KEY`
   - `GOOGLE_MAPS_API`

4. Deploy

### Python Agent

The Python agent needs to run on a server with GPU/CPU resources.

#### Option 1: Deploy to Railway

1. Create a new project on Railway
2. Connect your GitHub repository
3. Set the root directory to `agent`
4. Add environment variables
5. Deploy

#### Option 2: Deploy to Fly.io

1. Install flyctl CLI
2. Navigate to agent directory:
\`\`\`bash
cd agent
\`\`\`

3. Create a `fly.toml`:
\`\`\`toml
app = "lookout-agent"

[build]
  builder = "paketobuildpacks/builder:base"

[env]
  PORT = "8080"

[[services]]
  internal_port = 8080
  protocol = "tcp"

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
\`\`\`

4. Deploy:
\`\`\`bash
fly launch
fly secrets set LIVEKIT_URL=your_url
fly secrets set LIVEKIT_API_KEY=your_key
fly secrets set LIVEKIT_API_SECRET=your_secret
fly secrets set GOOGLE_API_KEY=your_key
fly secrets set GOOGLE_MAPS_API=your_key
fly deploy
\`\`\`

## Mobile Optimization

The web app is optimized for mobile browsers and can be added to the home screen:

### iOS (Safari)

1. Open the app in Safari
2. Tap the Share button
3. Tap "Add to Home Screen"
4. The app will now launch in full-screen mode with camera access

### Android (Chrome)

1. Open the app in Chrome
2. Tap the menu (three dots)
3. Tap "Add to Home Screen"
4. The app will now launch as a PWA

## Camera Permissions

The app requires back camera access. On first launch:

1. Browser will prompt for camera permission
2. Select "Allow" to enable the back camera
3. The camera feed will appear full-screen
4. If denied, the app will show an error message

## Performance Tips

- Use compute-optimized instances (AWS c6i/c7i) for the agent
- Enable CDN caching for static assets
- Use edge functions for API routes when possible
- Monitor LiveKit connection quality
- Ensure good lighting for optimal camera performance

## Security

- Keep API keys secure in environment variables
- Use HTTPS for all connections
- Implement rate limiting on API routes
- Regular security audits of dependencies
- Camera feed is processed locally, not stored


<automated_v0_instructions_reminder>

- Context Gathering
  - Use Parallel Tool Calls Where Possible
  - Don't stop at first match - When searching finds multiple files or components, examine ALL of them to ensure you find the right variant/version
  - Understand the full system before changes - Check existing patterns, parent components, utilities, schemas, and architecture to see if solutions already exist
  - Search systematically - Use a broad → specific → verify relationships approach to fully understand how your changes fit into the broader codebase architecture

- You always Edit/Write to these files using ```
