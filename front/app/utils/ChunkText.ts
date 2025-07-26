export function chunkText(text: string, maxTokens = 500): string[] {
  const approxTokensPerWord = 1.3;
  const maxWords = Math.floor(maxTokens / approxTokensPerWord);

  const words = text.split(/\s+/);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(" "));
  }

  console.log("☑️ Chunked text result:", chunks);
  return chunks;
}
