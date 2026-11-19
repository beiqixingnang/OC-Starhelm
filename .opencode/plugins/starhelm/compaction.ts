export interface TranscriptChunk {
  index: number
  text: string
}

export function transcriptText(message: unknown): string {
  try {
    return JSON.stringify(message)
  } catch {
    return String(message)
  }
}

export function chunkTranscript(messages: readonly unknown[], chunkTokens: number): TranscriptChunk[] {
  const maxChars = Math.max(4_000, Math.floor(chunkTokens * 3.5))
  const chunks: TranscriptChunk[] = []
  let current: string[] = []
  let currentLength = 0

  const flush = () => {
    if (!current.length) return
    chunks.push({ index: chunks.length + 1, text: current.join("\n") })
    current = []
    currentLength = 0
  }

  for (let index = 0; index < messages.length; index++) {
    const entry = `Message ${index + 1}: ${transcriptText(messages[index])}`
    if (entry.length > maxChars) {
      flush()
      const sliceLength = maxChars - 24
      for (let offset = 0; offset < entry.length; offset += sliceLength) {
        const continued = offset + sliceLength < entry.length ? "\n[continued message]" : ""
        chunks.push({ index: chunks.length + 1, text: `${entry.slice(offset, offset + sliceLength)}${continued}` })
      }
      continue
    }
    if (currentLength + entry.length > maxChars) flush()
    current.push(entry)
    currentLength += entry.length + 1
  }

  flush()
  return chunks
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
