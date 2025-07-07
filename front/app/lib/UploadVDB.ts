import { Pinecone } from '@pinecone-database/pinecone';

if(!process.env.PINECONE_API_KEY) {
    throw new Error("Pinecone config missing");
}

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const index = pinecone.index("afina-llm-index"); // что за индекс

// загрузка embeddings в pinecone
export async function upsertEmbedding(
  id: string,
  embedding: number[],
  metadata?: Record<string, any>
) {
  await index.upsert([
    {
      id,
      values: embedding,
      metadata: metadata || {}, // мне не потребуется metadata,
      // ее можно убрать вообще 
    },
  ]);
}

// выполнить семантический поиск 
export async function querySimilar(
  embedding: number[],
  topK: number = 5
) {
  const result = await index.query({
    vector: embedding,
    topK,
    includeMetadata: true,
  });

  return result.matches.map((match) => ({
    id: match.id,
    score: match.score,
    metadata: match.metadata,
  }));
}