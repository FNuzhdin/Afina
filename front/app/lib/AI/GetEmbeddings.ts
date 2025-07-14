import { fetch } from "undici";
import { isEmbeddingResponseSchema } from "../../utils/Validation";

export async function getEmbeddings(textsArray: string[]): Promise<number[][]> {
  const HF_TOKEN = process.env.HUGGINGFACE_TOKEN;

  if (!HF_TOKEN) {
    throw new Error("Hugging face token missing");
  }

  const response = await fetch(
    "https://api-inference.huggingface.co/models/intfloat/multilingual-e5-large",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: textsArray,
        options: {
          wait_for_model: true,
          use_cache: false
        }
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `HuggingFace Error: ${response.status} ${response.statusText}: ${errorText}`
    );
  }

  const data = await response.json();
  if (!isEmbeddingResponseSchema(data)) {
    throw new Error("Wrong response from embedding model");
  }

  return data;
}
