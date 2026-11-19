import assert from "node:assert/strict"
import test from "node:test"
import { chunkSummaries, planTranscript, splitOversizedChunk } from "../.opencode/plugins/starhelm/compaction.js"

test("recent messages are preserved and older history is balanced into four ordered sections", () => {
  const messages = Array.from({ length: 12 }, (_, index) => ({ role: "user", text: `${index}: ${"x".repeat(2_000)}` }))
  const plan = planTranscript(messages, 8_000, 4)
  const combined = plan.chunks.map((chunk) => chunk.text).join("")

  assert.equal(plan.chunks.length, 4)
  assert.equal(plan.preservedMessages, 3)
  assert.ok(plan.preservedBytes <= 8_000)
  assert.equal(plan.summarizedMessages, 9)
  assert.ok(combined.indexOf("Message 1") < combined.indexOf("Message 9"))
  assert.ok(combined.includes("Message 9"))
  assert.ok(!combined.includes("Message 10"))
  const sizes = plan.chunks.map((chunk) => chunk.text.length)
  assert.ok(Math.max(...sizes) - Math.min(...sizes) < 3_000)
})

test("oversized sections can be bisected without losing or reordering transcript text", () => {
  const text = `Message 1: ${"a".repeat(9_000)}\nMessage 2: ${"b".repeat(9_000)}`
  const halves = splitOversizedChunk(text)
  const groups = chunkSummaries(Array.from({ length: 8 }, (_, index) => `${index}:${"b".repeat(2_000)}`), 1_000)

  assert.ok(halves)
  assert.equal(halves[0] + halves[1], text)
  assert.ok(halves[0].length > text.length * 0.35)
  assert.ok(halves[0].length < text.length * 0.65)
  assert.ok(groups.length > 1)
  assert.ok(groups[0][0].startsWith("0:"))
  assert.ok(groups.at(-1)!.at(-1)!.startsWith("7:"))
})

test("recent-tail budget is measured conservatively for non-ASCII messages", () => {
  const messages = Array.from({ length: 12 }, (_, index) => ({ role: "user", text: `${index}: ${"近".repeat(300)}` }))
  const plan = planTranscript(messages, 3_000, 4)

  assert.ok(plan.preservedMessages > 0)
  assert.ok(plan.preservedBytes <= 3_000)
})
