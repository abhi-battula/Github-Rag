import z from "zod";

export const repositorySchema = z.object({
    repoUrl:z.string()
})

export type repositoryInput = z.infer<typeof repositorySchema>;

// type scheams = repositorySchema