import "dotenv/config";

import fs from "fs";
import path from "path";
import { summariesText } from "@/app/lib/AI/LLM";
import { saveSummaryRDB } from "@/app/lib/DataBases/RelationalDB";
import { getEmbeddings } from "@/app/lib/AI/GetEmbeddings";
import { uploadEmbeddings } from "@/app/lib/DataBases/VectorVDB";
import { isBatchSchema } from "@/app/utils/ValidationScript";

// npx tsx scripts/seedChat.ts

const CHAT_ID = "2197468235";

async function main() {
  const filePath = path.join(__dirname, "../data/chat.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const json = JSON.parse(raw);

  const messages = json.messages;

  const allowedNames = ["Фёдор", "Кристина", "Радж", "Алсу", "Соня", "Лена"];

  const parsed = messages
    .filter(
      (msg: any) =>
        msg.text &&
        msg.from &&
        allowedNames.some((name) => msg.from.includes(name))
    )
    .map((msg: any) => {
      const name =
        allowedNames.find((name) => msg.from.includes(name)) || "Неизвестно";

      const textContent =
        typeof msg.text === "string"
          ? msg.text
          : Array.isArray(msg.text)
          ? msg.text.map((t: any) => t.text || t).join(" ")
          : "";

      return {
        author: name,
        text: `${name}: ${textContent}`,
        date: new Date(Number(msg.date_unixtime) * 1000).toISOString(),
      };
    });

  console.log(`Всего подходящих сообщений: ${parsed.length}`);
  console.log(`Пример`, parsed[0], parsed[parsed.length - 1]);

  const batchSize = 100;
  const batches = [];
  for (let i = 0; i < parsed.length; i += batchSize) {
    batches.push(parsed.slice(i, i + batchSize));
  }

  console.log(`Всего батчей по 100: ${batches.length}`);

  for (const [index, batch] of batches.entries()) {
    console.log(`=== Обработка батча ${index + 1} ===`);

    if (!isBatchSchema(batch)) {
      throw new Error("Isn't batch");
    }
    const texts = batch.map((item) => item.text);

    const dateFrom = batch[0].date;
    const dateTo = batch[batch.length - 1].date;

    const participants = Array.from(
      new Set(batch.map((item) => item.author))
    ).join(", ");

    const summaryText = await summariesText(texts);

    const summaryPayload = {
      chat_id: CHAT_ID,
      participants,
      text: summaryText,
      date_from: dateFrom,
      date_to: dateTo,
      created_at: new Date().toISOString(),
      message_count: batch.length,
    };

    console.log(`Summary payload:`, summaryPayload);

    const summaryId = await saveSummaryRDB(summaryPayload);
    console.log(`Summary saved with ID: ${summaryId}`);

    const embeddingsArray = await getEmbeddings([summaryText]);

    const embeddingsToUpload = embeddingsArray.map((vector) => ({
      id: summaryId,
      embedding: vector,
    }));

    const uploadResult = await uploadEmbeddings(embeddingsToUpload);

    console.log(`Embeddings uploaded: ${uploadResult.upsertedCount}`);
  }

  console.log("✅ Все батчи обработаны!");
}

main().catch((err) => {
  console.error("Ошибка при выполнении скрипта:", err);
  process.exit(1);
});
