"use client";

import { trpc } from "@/trpc/client";

export const PageClient = () => {
    const [data] = trpc.hello.useSuspenseQuery({
        text: "Shivam"
    });

    return (
        <div>
            Page Client Says: {data.greeting}
        </div>
    )
} 