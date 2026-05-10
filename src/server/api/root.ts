import { env } from "~/env";
import { chapterRouter } from "~/server/api/routers/chapter";
import { characterRouter } from "~/server/api/routers/character";
import { createLLMConfigRouter } from "~/server/api/routers/llm-config";
import { outlineRouter } from "~/server/api/routers/outline";
import { projectRouter } from "~/server/api/routers/project";
import { searchRouter } from "~/server/api/routers/search";
import { sessionRouter } from "~/server/api/routers/session";
import {
	createCallerFactory,
	createTRPCRouter,
	protectedProcedure,
} from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
	project: projectRouter,
	chapter: chapterRouter,
	character: characterRouter,
	outline: outlineRouter,
	search: searchRouter,
	session: sessionRouter,
	llmConfig: createLLMConfigRouter({
		createTRPCRouter,
		env,
		protectedProcedure,
	}),
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
