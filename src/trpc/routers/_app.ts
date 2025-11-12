import { z } from 'zod';
import { protectProcedure, createTRPCRouter } from '../init';
export const appRouter = createTRPCRouter({
    hello: protectProcedure
        .input(
            z.object({
                text: z.string(),
            }),
        )
        .query(async (opts) => {
            console.log({ dbUser: opts.ctx.user });
            return {
                greeting: `hello ${opts.input.text}`,
            };
        }),
});
// expor type definition of API
export type AppRouter = typeof appRouter;