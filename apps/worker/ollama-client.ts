import OpenAI from "openai";

export const ollamaClient = new OpenAI({
    apiKey:"ollama",
    baseURL:"http://localhost:11434/v1",
    // CPU embedding can be slow, but without a cap a pathological input hangs the
    // worker forever. Fail the request after 60s and retry twice instead.
    timeout: 60_000,
    maxRetries: 2,
})

// 768-dim model, matches the vector(768) column in the Chunk table
export const EMBEDDING_MODEL = "nomic-embed-text";