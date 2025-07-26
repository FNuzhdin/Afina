import { Pinecone } from "@pinecone-database/pinecone";

type Embedding = {
  id: string;
  embedding: number[];
};

export type Matches = {
  id: string;
  score: number | undefined;
};

if (!process.env.PINECONE_API_KEY) {
  throw new Error("Pinecone config missing");
}

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const index = pinecone.index("afina-llm-index"); // что за индекс

// загрузка embeddings в pinecone
export async function uploadEmbeddings(
  embeddings: Embedding[]
): Promise<{ success: true; upsertedCount: number }> {
  console.log("Upload to VDB started");

  if (embeddings.length === 0) {
    throw new Error("No embeddings to upload");
  }

  await index.upsert(
    embeddings.map((embedding) => ({
      id: embedding.id,
      values: embedding.embedding,
    }))
  );

  console.log("☑️ Upload to VDB: success");

  return { success: true, upsertedCount: embeddings.length };
}

// выполнить семантический поиск
export async function querySimilar(
  embeddings: number[][],
  topK: number = 1
): Promise<string[]> {
  const allMatchesIds: string[] = [];

  for (const embedding of embeddings) {
    const result = await index.query({
      vector: embedding,
      topK,
      includeMetadata: false,
    });

    const matches = result.matches.map((match) => 
      match.id
    );

    allMatchesIds.push(...matches);
  }

  console.log("☑️ Query similar embeddings: success");

  return allMatchesIds;
}
