

function splitParagraphs(text) {
  return text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean)
}

function splitLargeChunk(text, size = 500, overlap = 100) {
  const chunks = []
  let start = 0

  while (start < text.length) {
    const end = start + size
    chunks.push(text.slice(start, end))
    start += size - overlap
  }

  return chunks
}

function hybridChunk(text) {
  const paragraphs = splitParagraphs(text)
  const results = []

  for (const p of paragraphs) {
    if (p.length <= 500) {
      results.push(p)
    } else {
      results.push(...splitLargeChunk(p))
    }
  }

  return results
}