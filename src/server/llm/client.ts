import "server-only";
import type { PrismaClient } from "@prisma/client";
import type { ModelMessage, ToolSet } from "ai";
import {
	generateObject as aiGenerateObject,
	generateText,
	streamText,
} from "ai";
import type { z } from "zod";
import { routeModel } from "./model-router";
import { getProviderFactory } from "./provider-registry";
import { defaultRateLimiter } from "./rate-limiter";
import type { TaskType } from "./types";

async function resolveModel(db: PrismaClient, userId: string, task: TaskType) {
	const config = await routeModel(db, userId, task);
	const factory = getProviderFactory(config.providerType);
	const model = factory({ apiKey: config.apiKey, baseUrl: config.baseUrl })(
		config.model,
	);
	await defaultRateLimiter.acquire();
	return model;
}

export function createLLMClient(opts: { db: PrismaClient; userId: string }) {
	return {
		async generate(params: {
			task: TaskType;
			messages: ModelMessage[];
			tools?: ToolSet;
			maxTokens?: number;
			temperature?: number;
		}) {
			const model = await resolveModel(opts.db, opts.userId, params.task);
			return generateText({
				model,
				messages: params.messages,
				tools: params.tools,
				maxOutputTokens: params.maxTokens,
				temperature: params.temperature,
			});
		},

		async stream(params: {
			task: TaskType;
			messages: ModelMessage[];
			tools?: ToolSet;
			maxTokens?: number;
			temperature?: number;
		}) {
			const model = await resolveModel(opts.db, opts.userId, params.task);
			return streamText({
				model,
				messages: params.messages,
				tools: params.tools,
				maxOutputTokens: params.maxTokens,
				temperature: params.temperature,
			});
		},

		async generateObject<T extends z.ZodType>(params: {
			task: TaskType;
			messages: ModelMessage[];
			schema: T;
			temperature?: number;
		}) {
			const model = await resolveModel(opts.db, opts.userId, params.task);
			return aiGenerateObject({
				model,
				messages: params.messages,
				schema: params.schema,
				temperature: params.temperature,
			});
		},
	};
}
