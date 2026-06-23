import OpenAI from "openai";

export const ollamaClient = new OpenAI({
    apiKey:"ollama",
    baseURL:"http://localhost:11434/v1"
})