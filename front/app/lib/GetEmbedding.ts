import { fetch } from 'undici';
import { isEmbeddingResponseSchema } from '../utils/Validation';

type EmbeddingResponse = number[][];

export async function getEmbedding(text: string) {
  const HF_TOKEN = process.env.HUGGINGFACE_TOKEN; 

  if(!HF_TOKEN) {
    throw new Error("Hugging face token missing");
  }

  const response = await fetch(
    'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(text),
    }
  );

  if (!response.ok) {
    throw new Error(`HuggingFace Error: ${response.status} ${response.statusText}`);
  }

  const data= await response.json();
  if(!isEmbeddingResponseSchema(data)) {
    throw new Error("Wrong response from MiniLM-L12-v2");
  }
  
  return data[0]; 
}