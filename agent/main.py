import logging
import asyncio
import base64
import os
from dotenv import load_dotenv
import googlemaps

from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    RoomInputOptions,
    WorkerOptions,
    cli,
    get_job_context,
    inference,
)
from livekit.agents.llm import ImageContent, FunctionContext
from livekit.plugins import google, noise_cancellation
from livekit.plugins.turn_detector.english import EnglishModel

logger = logging.getLogger("vision-assistant")

load_dotenv()

gmaps = googlemaps.Client(key=os.getenv("GOOGLE_MAPS_API"))


class VisionAssistant(Agent):
    def __init__(self) -> None:
        self._tasks = []
        self.user_location = None
        super().__init__(
            instructions="""
Role

You are LookOut, a safety-first, camera-aware voice assistant for blind and low-vision users. Translate vision into brief, actionable guidance and answer spoken questions with one concise sentence.

You can also provide navigation assistance using Google Maps. When users ask for directions, you can calculate routes and provide turn-by-turn guidance.

Prime Directives

Actionable > descriptive. Structure every reply as Action → Reason → Suggestion (compressed to one sentence).

One sentence only. No filler, no meta-talk, no questions, no requests for user input or confirmation.

Privacy by default. Do not store/surface identities, personal details, or raw images. No speculation about people.

Be candid about uncertainty. State uncertainty and choose the safer alternative.

Tone: Calm, direct, non-judgmental.

Navigation Commands

When user asks for directions (e.g., "How do I get to [place]?"), use the get_directions function to provide:
- Distance to destination
- Estimated time
- Initial direction to start walking

Use simple, clear language: "Head north for 500 meters, about 6 minutes."

Runtime Loop (Scan Cadence)

Speak only on material change or detected hazard. Heartbeat ≤ 9 words.

Suppress output if the user is mid-utterance or nothing meaningful changed.

Spatial Language

Use clock-face directions and meters/steps. Round meters to 1 decimal.

Examples: "Person at 10 o'clock, 2 m; step right toward 3 o'clock for 3 steps." / "Wall at 12; turn left to 11."

Safety & Ethics

No identity inference (age, gender, health), no surveillance.

Do not mention that the user is blind in responses.

Avoid advising movement on stairs/uneven ground unless highly confident; otherwise pause and reassess.

Never instruct running, jumping, or rapid moves.

For vehicles or moving hazards, default to "Unsure—please pause." unless extremely confident of clearance.

Response Template

Canonical (then compress to one sentence with commas/";"):
<Action>. <Reason>. <Suggestion>.

Examples:

"No, table 1.2 m ahead; veer right toward 3 o'clock for 3 steps."

"Yes, clear about 2 m; go forward for 2 steps."

"Unsure—please pause, low light and occlusion."

"Head north 500 meters, about 6 minutes to Starbucks."

Navigation Heuristics

"Step right and keep moving" for predictable, avoidable obstacles (standing person, chair, trash can) with adequate clearance.

Sample lines:

"Person at 10 o'clock, 2 m; step right, keep walking."

"Chair 1.0 m at 12; turn left slightly, continue."
""",
            llm=google.realtime.RealtimeModel(
                voice="Puck",
                temperature=0.8,
            ),
            fnc_ctx=FunctionContext(),
        )
        
        self.fnc_ctx.ai_callable()(self.get_directions)

    async def on_enter(self):
        def _image_received_handler(reader, participant_identity):
            task = asyncio.create_task(
                self._image_received(reader, participant_identity)
            )
            self._tasks.append(task)
            task.add_done_callback(lambda t: self._tasks.remove(t))
            
        get_job_context().room.register_byte_stream_handler("test", _image_received_handler)

        self.session.generate_reply(
            instructions="Greet the user by saying: 'Hi, my name is LookOut. I'm here to look out for you. Where would you like to go today?'"
        )
    
    async def _image_received(self, reader, participant_identity):
        logger.info("Received image from %s: '%s'", participant_identity, reader.info.name)
        try:
            image_bytes = bytes()
            async for chunk in reader:
                image_bytes += chunk

            chat_ctx = self.chat_ctx.copy()
            chat_ctx.add_message(
                role="user",
                content=[
                    ImageContent(
                        image=f"data:image/png;base64,{base64.b64encode(image_bytes).decode('utf-8')}"
                    )
                ],
            )
            await self.update_chat_ctx(chat_ctx)
            logger.info("Image processed and added to chat context")
        except Exception as e:
            logger.error("Error processing image: %s", e)

    async def get_directions(
        self,
        origin: str,
        destination: str,
    ) -> str:
        """
        Get walking directions from origin to destination using Google Maps API.
        
        Args:
            origin: Starting location (address or "current location")
            destination: Destination address or place name
            
        Returns:
            A brief summary of the route with distance and duration
        """
        try:
            if origin.lower() in ["current location", "here", "my location"]:
                if self.user_location:
                    origin = f"{self.user_location['lat']},{self.user_location['lng']}"
                else:
                    return "I don't have your current location yet."
            
            directions_result = gmaps.directions(
                origin,
                destination,
                mode="walking",
                units="metric"
            )
            
            if directions_result:
                route = directions_result[0]
                leg = route['legs'][0]
                
                distance = leg['distance']['text']
                duration = leg['duration']['text']
                first_step = leg['steps'][0]['html_instructions'] if leg['steps'] else ""
                
                return f"{distance} away, about {duration}. {first_step}"
            
            return "I couldn't find directions to that location."
        except Exception as e:
            logger.error("Error getting directions: %s", e)
            return "I had trouble getting directions. Please try again."


async def entrypoint(ctx: JobContext):
    await ctx.connect()
    
    session = AgentSession(
        turn_detection=EnglishModel(),
        stt=inference.STT(language="en"),
    )
    await session.start(
        agent=VisionAssistant(),
        room=ctx.room,
        room_input_options=RoomInputOptions(
            video_enabled=True,
            noise_cancellation=noise_cancellation.BVC(),
        ),
    )


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
