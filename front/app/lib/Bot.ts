import { Bot } from "grammy";
import { isBaseMessageSchema } from "../utils/Validation";
import { isMyChatMemberUpdateSchema } from "../utils/Validation";

if (!process.env.BOT_TOKEN) {
  throw new Error("Bot token missing");
}

export const afina = new Bot(String(process.env.BOT_TOKEN));

export async function afiOnlyCreator(update: any) {
  // $ лично только с создателем $
  if (isBaseMessageSchema(update.message)) {
    if (
      update.message.chat.type === "private" &&
      update.message.from.id !== 726008803
    ) {
      console.log({
        status: "ignored",
        message: "Attempt to privately communicate",
        code: "ATTEMPT_PRIVATE",
      });
      const chatId = update.message.chat.id;
      const name = update.message.chat.first_name;
      afina.api.sendMessage(
        chatId,
        `Прости, ${name}, но лично могу общаться только с создателем💔`
      );
      return false;
    } 
    return true;
  }

  // $ добавлять в чат может только создатель $
  if (isMyChatMemberUpdateSchema(update)) {
    if (update.my_chat_member) {
      const chat = update.my_chat_member.chat;
      const from = update.my_chat_member.from;

      if (from.id !== 726008803) {
        console.log({
          status: "info",
          message: "Attempt to add to group chat",
          code: "INVITE_IN_CHAT",
          chatId: chat.id,
          addedBy: from?.username || from?.id,
        });

        if (
          chat.type === "group" ||
          chat.type === "supergroup" ||
          chat.type === "channel"
        ) {
          const newStatus = update.my_chat_member.new_chat_member.status;
          if (newStatus === "member" || newStatus === "administrator") {
            try {
              // Отправляем сообщение в чат
              await afina.api.sendMessage(
                chat.id,
                "Не хочу никого обидеть, но я ухожу отсюда 👀"
              );

              // Выходим из чата
              await afina.api.leaveChat(chat.id);

              console.log(`Bot left chat ${chat.id}`);
            } catch (e) {
              console.error(
                "Ошибка при отправке сообщения или выходе из чата",
                e
              );
            }
          }
        }
        return false;
      }
    }

    return true;
  }
}

export async function afiUnsupportedType(chatId: number) {
  await afina.api.sendMessage(chatId, "Прости, но я не поддерживаю такой тип данных 💩")
}

export function checkMention(text: string) {
  const mentionRegex = /(afina|афина|afi|афи)/i;
  return mentionRegex.test(text);
}

export function removeMention(text: string): string {
  const mentionRegex = /\b(afina|афина|afi|афи)\b[\s,:;]*?/i;
  return text.replace(mentionRegex, '').trim();
}

