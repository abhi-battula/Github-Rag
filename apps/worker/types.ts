export type filesType = { fileName: string; content: string; }[]
export type chunkType = { fileId: string, content: string, startLine: number, endLine: number}[];