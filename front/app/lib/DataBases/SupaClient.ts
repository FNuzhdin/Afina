// import { createClient } from "@supabase/supabase-js";

// if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
//   throw new Error("Supabase config error");
// }

// export interface Database {
//   public: {
//     Tables: {
//       messages: {
//         Row: {
//           id: bigint;
//           updateId: bigint;
//           messageId: bigint;
//           chatId: bigint;
//           userId: bigint;
//           username: string;
//           firstName: string;
//           lastName: string;
//           text: string;
//           date: Date;
//           messageType: string;
//         };
//         Insert: {
//           updateId: bigint;
//           messageId: bigint;
//           chatId: bigint;
//           userId: bigint;
//           username: string;
//           firstName: string;
//           lastName: string;
//           text: string;
//           date: Date;
//           messageType: string;
//         };
//         Update: {
//           updateId?: bigint;
//           messageId?: bigint;
//           chatId?: bigint;
//           userId?: bigint;
//           username?: string;
//           firstName?: string;
//           lastName?: string;
//           text?: string;
//           date?: Date;
//           messageType?: string;
//         }
//       };
//     };
//   };
// }

// // также можно использовать дженерик для типа клиента
// // об этом нужно узнать побольше
// export const supaClient = createClient<Database>(
//   process.env.SUPABASE_URL,
//   process.env.SUPABASE_SERVICE_ROLE_KEY
// );
