# Starhelm for OpenCode

A local OpenCode V2 plugin for resilient model retries, chunked context compaction, and hierarchical goals.

## Load

The plugin is discovered automatically from `.opencode/plugins/starhelm` when OpenCode runs in this project. It targets OpenCode `2.3.2`.

Install the development dependencies to run checks:

```sh
npm install
npm run typecheck
npm test
```

## Retry behavior

The plugin marks rate limits, transient server errors, timeouts, and common connection failures as retryable, using the provider's retry delay when available and exponential backoff with jitter otherwise. OpenCode still enforces its own hard retry limit, so the plugin cannot provide literal infinite retries. Authentication and malformed-request failures are not retried.

## Chunked compaction

Compaction serializes the transcript into bounded chunks, summarizes them sequentially, and recursively reduces the intermediate summaries. If the plugin summarizer fails, it leaves compaction to OpenCode's built-in summary path.

## Goals

Use `/goals` to inspect the current session tree. `/goal` accepts these operations:

```text
/goal add <title>
/goal child <parent-id> <title>
/goal start <id>
/goal complete <id>
/goal reject <id> <reason>
```

The hierarchy is limited to three levels. Add acceptance criteria when creating goals with the `starhelm_goal_add` tool. The main model accepts a goal using `starhelm_goal_accept`, with a rationale, only after it is completed and all of its children are accepted. Subagents can add goals and report progress, but cannot accept them. Goal state is stored against the root session, so subagents in the same session tree share the goal tree and active goal context.
