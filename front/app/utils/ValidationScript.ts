import { z } from "zod/v4";

export const BatchSchema = z.array(z.object({
    author: z.string(),
    text: z.string(),
    date: z.string(),
}))

export const isBatchSchema = (data: any): data is z.infer<typeof BatchSchema> => {
    return BatchSchema.safeParse(data).success;
}

