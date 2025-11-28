import { db } from "@/db";
import { videos } from "@/db/schema";
import { serve } from "@upstash/workflow/nextjs"
import { and, eq } from "drizzle-orm";
import { UTApi } from "uploadthing/server";

interface InputType {
    userId: string;
    videoId: string;
    prompt: string;
};

export const { POST } = serve(
    async (context) => {
        const utapi = new UTApi();
        const input = context.requestPayload as InputType;
        const { videoId, userId, prompt } = input;

        const video = await context.run("get-video", async () => {
            const [existingVideo] = await db
                .select()
                .from(videos)
                .where(and(
                    eq(videos.id, videoId),
                    eq(videos.userId, userId),
                ));
            
            if (!existingVideo) {
                throw new Error("Not Found");
            }

            return existingVideo;
        });

        await context.run("cleanup-thumbnail", async () => {
            if(video.thumbnailKey) {
                await utapi.deleteFiles(video.thumbnailKey);
                await db
                    .update(videos)
                    .set({ thumbnailKey: null, thumbnailUrl: null })
                    .where(and(
                        eq(videos.id, videoId),
                        eq(videos.userId, userId),
                    ));
            }
        });

        const imageUrl = await context.run("generate-thumbnail", async () => {
            const encodedPrompt = encodeURIComponent(`Professional YouTube thumbnail: ${prompt}, vibrant colors, eye-catching design, 16:9 aspect ratio`);
            const width = 1280;
            const height = 720;
            const seed = Math.floor(Math.random() * 1000000);
            
            return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&model=flux&nologo=true`;
        });

        console.log("🎨 Generated image URL:", imageUrl);

        const uploadedThumbnail = await context.run("upload-thumbnail", async () => {
            const response = await fetch(imageUrl);
            const imageBuffer = Buffer.from(await response.arrayBuffer());
            
            const file = new File([imageBuffer], "thumbnail.png", { type: "image/png" });
            const { data } = await utapi.uploadFiles(file);
            
            if(!data) {
                throw new Error("Failed to upload thumbnail");
            }

            return data;
        });

        await context.run("update-video", async () => {
            await db
                .update(videos)
                .set({
                    thumbnailKey: uploadedThumbnail.key,
                    thumbnailUrl: uploadedThumbnail.url,
                })
                .where(and(
                    eq(videos.id, video.id),
                    eq(videos.userId, video.userId),
                ))
        });
    }
);