/**
 * Strip Markdown / rich-text formatting for TTS.
 *
 * Designed to be safe for streaming chunks — removes syntax characters
 * individually rather than matching complete open/close patterns,
 * so partial markdown across chunks is handled correctly.
 * Plain text without markdown passes through unchanged.
 */
export function stripMarkdown(text: string): string {
  return (
    text
      // Code blocks (``` ... ```) — remove fences and content when complete
      .replace(/```[\s\S]*?```/g, '')
      // Remaining fences (incomplete code block in a chunk)
      .replace(/```/g, '')
      // Inline code backticks
      .replace(/`/g, '')
      // Images ![alt](url) — keep alt text
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Links [text](url) — keep text
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Bare URLs (https://...)
      .replace(/https?:\/\/\S+/g, '')
      // Heading markers
      .replace(/^#{1,6}\s*/gm, '')
      // Bold/italic/strikethrough markers (*, _, ~)
      .replace(/[*_~]+/g, '')
      // Blockquote markers
      .replace(/^>\s?/gm, '')
      // Horizontal rules (---, ***, ___)
      .replace(/^[-]{3,}\s*$/gm, '')
      // Unordered list markers (- / + at line start, * already removed above)
      .replace(/^[\s]*[-+]\s+/gm, '')
      // Ordered list markers (1. / 2. ...)
      .replace(/^[\s]*\d+\.\s+/gm, '')
      // HTML tags
      .replace(/<[^>]+>/g, '')
      // Collapse multiple spaces
      .replace(/ {2,}/g, ' ')
      // Collapse multiple blank lines
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}
