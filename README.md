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

Automatic compaction uses this flow when OpenCode reaches its normal threshold. The plugin conservatively leaves up to the most recent 15,000 UTF-8 bytes out of summary generation. OpenCode separately retains its native recent-message window (about 15,000 tokens by default); the overlap avoids a gap because the plugin has no provider-specific tokenizer. Older history is balanced into up to four chronological sections, summarized sequentially, then merged. If a section exceeds the provider's context limit, only that section is recursively split. Other summarizer failures fall back to OpenCode's built-in summary path.

The recent byte budget, initial section count, and merge chunk size use the plugin options `summaryKeepBytes` (15,000), `summarySections` (4), and `summaryMergeChunkTokens` (6,000).

To test compaction immediately, find the session ID and request a manual compaction:

```sh
opencode session list --max-count 10 --format json
opencode api post /api/session/ses_example/compact --data '{}'
```

Replace `ses_example` with the current session ID. The request is applied at the next safe point in that session.

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
