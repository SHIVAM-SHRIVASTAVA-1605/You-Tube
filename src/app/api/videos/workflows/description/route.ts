import { db } from "@/db";
import { videos } from "@/db/schema";
import { serve } from "@upstash/workflow/nextjs";
import { and, eq } from "drizzle-orm";

interface InputType {
    userId: string;
    videoId: string;
};

const DESCRIPTION_SYSTEM_PROMPT = `Your task is to generate an SEO-optimized YouTube video description based on its transcript. Please follow these guidelines:
- Write a compelling 2-3 paragraph description (150-300 words)
- Include relevant keywords naturally for better discoverability
- Highlight the main topics and key takeaways from the video
- Use an engaging tone that encourages viewers to watch
- Add relevant hashtags at the end (3-5 hashtags)
- ONLY return the description as plain text. Do not add extra formatting.`;

export const { POST } = serve(
    async (context) => {
        const input = context.requestPayload as InputType;
        const { videoId, userId } = input;

        const video = await context.run("get-video", async () => {
            const [existingVideo] = await db
                .select()
                .from(videos)
                .where(and(
                    eq(videos.id, videoId),
                    eq(videos.userId, userId),
                ));

            if (!existingVideo) {
                throw new Error("Video not found");
            }

            return existingVideo;
        });

        const transcript = await context.run("get-transcript", async () => {
            const trackUrl = `https://stream.mux.com/${video.muxPlaybackId}/text/${video.muxTrackId}.txt`;
            const response = await fetch(trackUrl);
            const text = await response.text();

            if (!text) {
                throw new Error("Transcript not found");
            }

            return text;
        });

        // Use Pollinations.AI for FREE text generation (no API key needed)
        const generatedDescription = await context.run("generate-description", async () => {
            const prompt = `${DESCRIPTION_SYSTEM_PROMPT}\n\nVideo Title: ${video.title}\n\nTranscript:\n${transcript.slice(0, 3000)}`; // Limit transcript length
            const encodedPrompt = encodeURIComponent(prompt);
            
            const response = await fetch(
                `https://text.pollinations.ai/${encodedPrompt}?model=openai&seed=${Date.now()}`
            );

            if (!response.ok) {
                throw new Error(`Pollinations API error: ${response.status}`);
            }

            const description = await response.text();
            
            if (!description || description.trim().length === 0) {
                throw new Error("Failed to generate description");
            }

            return description.trim();
        });

        console.log("📝 Generated description:", generatedDescription);

        await context.run("update-video", async () => {
            await db
                .update(videos)
                .set({
                    description: generatedDescription,
                    updatedAt: new Date(),
                })
                .where(and(
                    eq(videos.id, videoId),
                    eq(videos.userId, userId),
                ));
        });
    }
);