export interface TranscriptChunk {
  index: number
  text: string
}

export interface TranscriptPlan {
  chunks: TranscriptChunk[]
  summarizedMessages: number
  preservedMessages: number
  preservedBytes: number
}

const MIN_SECTION_CHARS = 4_000
const utf8 = new TextEncoder()

export function transcriptText(message: unknown): string {
  try {
    return JSON.stringify(message)
  } catch {
    return String(message)
  }
}

function balancedSections(text: string, requestedSections: number): TranscriptChunk[] {
  if (!text) return []
  const sections = Math.min(
    Math.max(1, requestedSections),
    Math.max(1, Math.ceil(text.length / MIN_SECTION_CHARS)),
  )
  const chunks: TranscriptChunk[] = []
  let start = 0

  for (let index = 0; index < sections; index++) {
    const remainingSections = sections - index
    if (remainingSections === 1) {
      chunks.push({ index: index + 1, text: text.slice(start) })
      break
    }

    const target = start + Math.floor((text.length - start) / remainingSections)
    const allowance = Math.floor((text.length - start) / remainingSections * 0.2)
    const before = text.lastIndexOf("\n", target)
    const after = text.indexOf("\n", target)
    const candidates = [before + 1, after + 1].filter(
      (boundary) => boundary > start && boundary < text.length && Math.abs(boundary - target) <= allowance,
    )
    const boundary = candidates.length
      ? candidates.reduce((best, candidate) => Math.abs(candidate - target) < Math.abs(best - target) ? candidate : best)
      : target

    chunks.push({ index: index + 1, text: text.slice(start, boundary) })
    start = boundary
  }

  return chunks
}

export function planTranscript(
  messages: readonly unknown[],
  keepBytes: number,
  requestedSections = 4,
): TranscriptPlan {
  const entries = messages.map((message, index) => `Message ${index + 1}: ${transcriptText(message)}`)
  const keepBudget = Math.max(0, keepBytes)
  let prefixLength = entries.length
  let preservedBytes = 0

  // UTF-8 bytes conservatively bound token count and overlap OpenCode's native recent window.
  while (prefixLength > 0 && preservedBytes < keepBudget) {
    const entryBytes = utf8.encode(entries[prefixLength - 1]).length + 1
    if (preservedBytes + entryBytes > keepBudget) break
    prefixLength--
    preservedBytes += entryBytes
  }

  const olderTranscript = entries.slice(0, prefixLength).join("\n")
  return {
    chunks: balancedSections(olderTranscript, requestedSections),
    summarizedMessages: prefixLength,
    preservedMessages: entries.length - prefixLength,
    preservedBytes,
  }
}

export function splitOversizedChunk(text: string): [string, string] | undefined {
  if (text.length < 2_000) return undefined

  const middle = Math.floor(text.length / 2)
  const lower = Math.floor(text.length * 0.35)
  const upper = Math.ceil(text.length * 0.65)
  const before = text.lastIndexOf("\n", middle)
  const after = text.indexOf("\n", middle)
  const candidates = [before + 1, after + 1].filter((boundary) => boundary >= lower && boundary <= upper)
  const boundary = candidates.length
    ? candidates.reduce((best, candidate) => Math.abs(candidate - middle) < Math.abs(best - middle) ? candidate : best)
    : middle

  if (boundary <= 0 || boundary >= text.length) return undefined
  return [text.slice(0, boundary), text.slice(boundary)]
}

export function chunkSummaries(summaries: string[], chunkTokens: number): string[][] {
  const maxChars = Math.max(4_000, Math.floor(chunkTokens * 3.5))
  const groups: string[][] = []
  const parts = summaries.flatMap((summary) => {
    if (summary.length <= maxChars) return [summary]
    const split: string[] = []
    for (let offset = 0; offset < summary.length; offset += maxChars) split.push(summary.slice(offset, offset + maxChars))
    return split
  })
  let group: string[] = []
  let size = 0
  for (const summary of parts) {
    if (group.length && size + summary.length > maxChars) {
      groups.push(group)
      group = []
      size = 0
    }
    group.push(summary)
    size += summary.length + 1
  }
  if (group.length) groups.push(group)
  return groups
}
