import { client } from "./redis";
import { pg } from "db";
import { ollamaClient, EMBEDDING_MODEL, CHAT_MODEL } from "./ollama-client";

export async function createRepositoryService(url:string){
    
    const repositoryId = crypto.randomUUID();
    console.log("inside create service with id --->",repositoryId);
    
    // add to queue and return id
    // const res = await client.xAdd('be-worker',"*",{repositoryId}); // this is for streams
    const payload = {
        [repositoryId]:url
    }
    
    const res = await client.lPush('be-worker',JSON.stringify(payload)) // this is for queue
    console.log("res---->",res);
    
    return repositoryId;
}

export async function queryService(query:string){
    const res = await ollamaClient.embeddings.create({
        model: EMBEDDING_MODEL,
        input:query
    })

    const embedding = res.data[0].embedding;
    const vectorStr = `[${embedding.join(',')}]`;
    console.log("vector srtring --------->",vectorStr);
    

    const relatedChunks = await pg.$queryRaw<{
        id: string;
        content: string;
        startLine: number;
        endLine: number;
        filePath: string;
        distance: number;
    }[]>`
        SELECT
            c.id,
            c.content,
            c."startLine",
            c."endLine",
            f.path AS "filePath",
            c.embedding <=> ${vectorStr}::vector AS distance
        FROM "Chunk" c
        JOIN "File" f ON c."fileId" = f.id
        ORDER BY distance ASC
        LIMIT 5
    `;

    const context = relatedChunks
        .map((chunk, i) =>
            `[${i + 1}] File: ${chunk.filePath} (lines ${chunk.startLine}-${chunk.endLine})\n${chunk.content}`
        )
        .join("\n\n");

    const llmRes = await ollamaClient.chat.completions.create({
        model: CHAT_MODEL,
        messages: [
            {
                role: "system",
                content: `You are a helpful code assistant. Answer the user's question using only the code context provided below. If the answer is not in the context, say so.\n\nContext:\n${context}`,
            },
            {
                role: "user",
                content: query,
            },
        ],
    });

    console.log("llm answer --------->",llmRes);
    
    return llmRes.choices[0].message.content;
}