import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("prisma/schema.prisma", "utf8");

function modelBlock(name: string): string {
	const match = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`));
	assert.ok(match, `Expected model ${name} to exist`);
	return match[1] ?? "";
}

function fieldPattern(text: string): RegExp {
	return new RegExp(
		text
			.trim()
			.split(/\s+/)
			.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
			.join("\\s+"),
	);
}

test("LLMConfig stores encrypted in-app model service configuration", () => {
	const llmConfig = modelBlock("LLMConfig");

	for (const field of [
		"name",
		"providerType",
		"apiKeyEncrypted",
		"baseUrl",
		"model",
		"availableModels",
		"modelsUpdatedAt",
		"isActive",
		"createdAt",
		"updatedAt",
	]) {
		assert.match(llmConfig, new RegExp(`\\b${field}\\b`));
	}

	assert.doesNotMatch(llmConfig, /\bapiKey\s+String/);
	assert.match(llmConfig, /@@index\(\[userId, isActive\]\)/);
});

test("AgentFinding stores background agent findings for projects and chapters", () => {
	const project = modelBlock("Project");
	const chapter = modelBlock("Chapter");
	const agentFinding = modelBlock("AgentFinding");

	assert.match(project, /\bagentFindings\s+AgentFinding\[\]/);
	assert.match(chapter, /\bagentFindings\s+AgentFinding\[\]/);

	for (const field of [
		"id String @id @default(cuid())",
		"projectId String",
		"chapterId String?",
		"type String",
		"category String",
		"severity String",
		"title String",
		"description String",
		"locations Json?",
		'status String @default("open")',
		'source String @default("background_agent")',
		"createdAt DateTime @default(now())",
		"updatedAt DateTime @updatedAt",
	]) {
		assert.match(agentFinding, fieldPattern(field));
	}

	assert.match(
		agentFinding,
		fieldPattern(
			"project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)",
		),
	);
	assert.match(
		agentFinding,
		fieldPattern(
			"chapter Chapter? @relation(fields: [chapterId], references: [id], onDelete: Cascade)",
		),
	);
	assert.match(agentFinding, /@@index\(\[projectId, chapterId, status\]\)/);
	assert.match(agentFinding, /@@index\(\[projectId, type, status\]\)/);
});
