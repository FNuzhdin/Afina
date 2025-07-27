import "dotenv/config";

import { supaClient } from "@/app/lib/DataBases/RelationalDB"; // укажи правильный путь к клиенту

async function updateChatId() {
  const oldChatId = "2197468235";
  const newChatId = "-1002197468235";

  const { data, error } = await supaClient
    .from("summaries")
    .update({ chat_id: newChatId })
    .eq("chat_id", oldChatId);

  if (error) {
    console.error("Ошибка при обновлении chat_id:", error);
    process.exit(1);
  }

  console.log("Обновленные записи:", data);
  process.exit(0);
}

updateChatId();
