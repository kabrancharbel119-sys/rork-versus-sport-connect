import { createTRPCRouter } from "./create-context";

export const appRouter = createTRPCRouter({});

export type AppRouter = typeof appRouter;
