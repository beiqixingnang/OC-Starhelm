import assert from "node:assert/strict"
import test from "node:test"
import { chunkSummaries, chunkTranscript } from "../.opencode/plugins/starhelm/compaction.js"

test("transcript chunking preserves message order and bounds ordinary chunks", () => {
  const messages = Array.from({ length: 12 }, (_, index) => ({ role: "user", text: `${index}: ${"x".repeat(2_000)}` }))
  const chunks = chunkTranscript(messages, 1_000)
  const combined = chunks.map((chunk) => chunk.text).join("\n")

  assert.ok(chunks.length > 1)
  assert.ok(chunks.every((chunk) => chunk.text.length <= 3_500))
  assert.ok(combined.indexOf("Message 1") < combined.indexOf("Message 12"))
})

test("oversized messages are split and summary groups retain order", () => {
  const chunks = chunkTranscript([{ text: "a".repeat(9_000) }], 1_000)
  const groups = chunkSummaries(Array.from({ length: 8 }, (_, index) => `${index}:${"b".repeat(2_000)}`), 1_000)

  assert.ok(chunks.length > 1)
  assert.ok(groups.length > 1)
  assert.ok(groups[0][0].startsWith("0:"))
  assert.ok(groups.at(-1)!.at(-1)!.startsWith("7:"))
})
