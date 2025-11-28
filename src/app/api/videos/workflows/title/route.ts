import { db } from "@/db";
import { videos } from "@/db/schema";
import { serve } from "@upstash/workflow/nextjs";
import { and, eq } from "drizzle-orm";

interface InputType {
    userId: string;
    videoId: string;
};

const TITLE_SYSTEM_PROMPT = `Your task is to generate an SEO-focused title for a YouTube video based on its transcript. Please follow these guidelines:
- Be concise but descriptive, using relevant keywords to improve discoverability.
- Highlight the most compelling or unique aspect of the video content.
- Avoid jargon or overly complex language unless it directly supports searchability.
- Use action-oriented phrasing or clear value propositions where applicable.
- Ensure the title is 3-8 words long and no more than 100 characters.
- ONLY return the title as plain text. Do not add quotes or any additional formatting.`;

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
        const generatedTitle = await context.run("generate-title", async () => {
            const prompt = `${TITLE_SYSTEM_PROMPT}\n\nTranscript:\n${transcript.slice(0, 2000)}`; // Limit transcript length
            const encodedPrompt = encodeURIComponent(prompt);
            
            const response = await fetch(
                `https://text.pollinations.ai/${encodedPrompt}?model=openai&seed=${Date.now()}`
            );

            if (!response.ok) {
                throw new Error(`Pollinations API error: ${response.status}`);
            }

            const title = await response.text();
            
            if (!title || title.trim().length === 0) {
                throw new Error("Failed to generate title");
            }

            return title.trim();
        });

        console.log("📝 Generated title:", generatedTitle);

        await context.run("update-video", async () => {
            await db
                .update(videos)
                .set({
                    title: generatedTitle,
                    updatedAt: new Date(),
                })
                .where(and(
                    eq(videos.id, videoId),
                    eq(videos.userId, userId),
                ));
        });
    }
);