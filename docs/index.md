# OpenStory Documentation

This index is the entry point for OpenStory documentation. Use it to find setup notes, API references, current design docs, and implementation plans.

## Start Here

| Document | Use it for |
|---|---|
| [README](../README.md) | Project overview, local setup, commands, runtime notes, and major conventions. |
| [API Reference](api.md) | tRPC routers, procedures, input/output shapes, streaming chat endpoint, and common error behavior. |
| [Current AI System Design](superpowers/specs/2026-05-08-openstory-ai-novel-tool-design.md) | The main design reference for the AI novel-writing workspace. |
| [Coding Guidelines](../Coding%20Guidelines.md) | Repository-level coding practices and review expectations. |

## Product And Architecture

| Document | Status | Notes |
|---|---|---|
| [OpenStory AI Novel Tool Design](superpowers/specs/2026-05-08-openstory-ai-novel-tool-design.md) | Current | System-level architecture for the writing workspace and AI assistant. |
| [Open Source Runnable Demo Design](superpowers/specs/2026-05-09-open-source-runnable-demo-design.md) | Historical | Demo-focused design notes from the runnable local app milestone. |
| [AI Inline Revision Proposals Design](superpowers/specs/2026-05-12-ai-inline-revision-proposals-design.md) | Current | Design for AI-generated chapter revision proposals and inline diff review. |
| [AI Session Message Storage](superpowers/specs/2026-05-16-ai-session-message-storage.md) | Current | Append-only AI chat history storage, legacy JSON compatibility, and maintenance guidance. |

## API And Runtime Reference

| Document | Covers |
|---|---|
| [API Reference](api.md) | All protected tRPC routers, the streaming chat route, ownership rules, TipTap content handling, LLM config behavior, and error codes. |
| [README: Setup](../README.md#setup) | Required environment variables, local user mode, model services, database initialization, and development server startup. |
| [README: Commands](../README.md#commands) | npm scripts for development, builds, database work, checks, and tests. |

## Implementation Plans

Plans are detailed working documents for major milestones. They are useful when reconstructing design intent or understanding why a feature landed in its current shape.

| Plan | Topic |
|---|---|
| [2026-05-09 Open Source Runnable Demo](superpowers/plans/2026-05-09-open-source-runnable-demo.md) | Local runnable demo, setup path, and repository readiness. |
| [2026-05-10 Story Bible Workspace](superpowers/plans/2026-05-10-story-bible-workspace.md) | Characters, outlines, world notes, and workspace interaction model. |
| [2026-05-12 Full AI Writing Assistant](superpowers/plans/2026-05-12-full-ai-writing-assistant.md) | AI tools, chat, context assembly, and revision workflow. |
| [2026-05-14 Agent Findings Consistency](superpowers/plans/2026-05-14-agent-findings-consistency.md) | Background consistency findings and chapter-level surfacing. |
| [2026-05-15 AI Session Turn Module](superpowers/plans/2026-05-15-ai-session-turn-module.md) | Session send/stream behavior and message persistence. |

## Maintainer Notes

- Update [API Reference](api.md) when adding or changing tRPC routers, procedures, Route Handlers, inputs, outputs, or error behavior.
- Update this index when adding a new durable document under `docs/`.
- Keep design specs in `docs/superpowers/specs/` and milestone execution plans in `docs/superpowers/plans/`.
- Keep setup and daily workflow instructions in [README](../README.md), then link deeper details from here.
