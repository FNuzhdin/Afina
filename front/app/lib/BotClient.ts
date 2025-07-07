import { Bot } from "grammy";

if (!process.env.BOT_TOKEN) {
  throw new Error("Bot token missing");
}

export const afina = new Bot(String(process.env.BOT_TOKEN));

// убрать можно 
// afina.on("my_chat_member", async (ctx) => {
//   const chat = ctx.chat;
//   const from = ctx.from;

//   console.log({
//     status: "info",
//     message: "Attempt to add to group chat",
//     code: "INVITE_IN_CHAT",
//     chatId: chat.id,
//     addedBy: from?.username || from?.id,
//   });

//   if (chat.type === "group" || chat.type === "supergroup") {
//     try {
//       await ctx.reply("Не хочу никого обидеть, но я ухожу отсюда 👀");

//       await ctx.leaveChat();

//       console.log(`Bot left chat ${chat.id}`);
//     } catch (e) {
//       console.error("Send message error or leave chat error");
//     }
//   }
// });
