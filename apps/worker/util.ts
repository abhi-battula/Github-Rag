import { spawn } from 'node:child_process'
import path from 'node:path';
import fs, { writeFile } from 'node:fs'
import fsp from "node:fs/promises"
import { file } from 'bun';
import { rejects } from 'node:assert';
// import spawn from "child_process"
import { pg } from "db";
import type { chunkType, filesType } from './types';
import { appendFile } from 'node:fs/promises';
import { ollamaClient, EMBEDDING_MODEL } from './ollama-client';

export async function gitclone(url: string, repositoryId: string): Promise<void> {
  const targetPath = path.join(process.cwd(), "temp", repositoryId);
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['clone', url], {
      cwd: targetPath,
      stdio: 'inherit' //bcz we added this inherit , the stdout,stderr are not required
    })
    // child.stdout.on("data",(data)=>{
    //     console.log("data-------->",data.toString());
    // })
    // child.stderr.on("data",data=>{
    //     console.log("error---->",data.toString());
    // })
    child.on("close", code => {
      if (code === 0) {
        console.log("------------cloned successfully-------------");

        console.log("success --->", code);
        resolve();
      }
      else {
        console.log("failed---->", code);
        reject(new Error(`git clone failed withe the error--->${code}`))
      }

    })
  })
}

export function testSpawn() {
  // const child = spawn('dir',[],{
  //     shell:true
  // })
  // const child = spawn("cmd",['/c','dir'])
}

export async function listAllFiles(repoName: string, repositoryId: string) {
  const files: { fileName: string, content: string }[] = [];
  const repoPath = path.join(process.cwd(), "temp", repositoryId, repoName)
  await walk(repoPath, files)
  console.log("all files --->", files);
  return files
}

async function walk(dir: string, files: filesType) {
  const IGNORE_DIRS = ["node_modules", "dist", "build", ".git", ".next", "coverage", ".turbo"];

  // lock files are huge, machine-generated, and useless for RAG — skip by name
  // even though their extension (.json/.yaml) is allowed.
  const IGNORE_FILES = ["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lock", "bun.lockb"];

  const ALLOWED_EXTENSIONS = [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".md",
    ".json",
    ".yaml",
    ".yml",
    ".prisma",
  ];

  const entries = await fsp.readdir(dir, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.includes(entry.name)) {
        await walk(fullPath, files);
      }
      continue;
    }

    if (entry.isFile() && ALLOWED_EXTENSIONS.includes(path.extname(entry.name)) && !IGNORE_FILES.includes(entry.name)) {
      try {
        const content = await fsp.readFile(fullPath, { encoding: "utf8" })
        files.push({ fileName: fullPath, content });
      } catch (err) {
        console.log(`failed to read ${fullPath}`, err);

      }
    }
  }
}
// gitclone("https://github.com/abhi-battula/test-clone-git")

export async function storeFileAndChunks(files: filesType, repositoryId: string) {

  for (const file of files) {
    const chunks = createFileChunks(file.content);

    // a file may produce no chunks (e.g. empty content) — still store the file, just skip embedding
    if (chunks.length === 0) {
      await pg.file.create({ data: { content: file.content, path: file.fileName, repoId: repositoryId } });
      continue;
    }

    // generate embeddings BEFORE opening the transaction, so the network call
    // to ollama doesn't hold the db transaction open the whole time
    const embeddings = await embedChunks(chunks); // number[][]

    await pg.$transaction(async tx => {
      const fileRow = await tx.file.create({ data: { content: file.content, path: file.fileName, repoId: repositoryId } });

      for (let i = 0; i < chunks.length; i++) {
        // create the chunk row first so prisma generates the uuid + sets the fk
        const chunkRow = await tx.chunk.create({
          data: {
            fileId: fileRow.id,
            content: chunks[i]!,
            startLine: 0, // todo : do this later , "citation" depends on this , and also learn about this "citation"
            endLine: 0
          }
        });

        // prisma can't write the Unsupported("vector(768)") column, so set it with raw sql.
        // pgvector accepts the textual form '[a,b,c]' cast to ::vector
        const vectorLiteral = `[${embeddings[i]!.join(",")}]`;
        await tx.$executeRaw`UPDATE "Chunk" SET embedding = ${vectorLiteral}::vector WHERE id = ${chunkRow.id}`;
      }
    })
  }
}

// calls ollama's openai-compatible embeddings endpoint once for all chunks of a file.
// returns one number[] per chunk, in the same order as the input.
async function embedChunks(chunks: string[]): Promise<number[][]> {
  const res = await ollamaClient.embeddings.create({
    model: EMBEDDING_MODEL,
    input: chunks,
  });
  console.log("res from embedding---->",res);
  
  // sort by index defensively — the api returns an `index` per item that maps back to the input order
  return res.data
    .sort((a, b) => a.index - b.index)
    .map(item => item.embedding as number[]);
}

// const ans = await embedChunks(["the first chunk","the second chunk"]);
// console.log("ans------->",ans);


export async function storeRepository(url: string, repositoryId: string, repoName: string) {
  try {
    await pg.repository.create({
      data: {
        githubUrl: url,
        name: repoName,
        status: 'processing',
        id: repositoryId
      }
    })
  } catch (err) {
    console.log("error while creating repository row in pg");
    console.log(err);
    throw new Error("repo insertion error")
  }
}

// nomic-embed-text's context window (ollama default num_ctx) is 2048 tokens.
// ~4 chars/token, so cap a chunk well under that to leave headroom: ~1500 tokens.
const MAX_CHARS = 6000;
// overlap so context isn't lost at a hard cut — the tail of one window
// is repeated at the head of the next.
const CHUNK_OVERLAP = 600;

function createFileChunks(content: string): string[] {
  // first split semantically on function/class boundaries
  const semanticChunks = content.split(/(?=export\s+function|function\s+|class\s+)/g).filter(Boolean)

  // then enforce the size cap, sliding a window (with overlap) over any chunk
  // that's still too large — e.g. whole markdown/json files that have no
  // function/class keyword and so came through as one giant chunk.
  const sized: string[] = [];
  for (const chunk of semanticChunks) {
    if (chunk.length <= MAX_CHARS) {
      sized.push(chunk);
      continue;
    }
    const step = MAX_CHARS - CHUNK_OVERLAP;
    for (let start = 0; start < chunk.length; start += step) {
      sized.push(chunk.slice(start, start + MAX_CHARS));
      // last window already reached the end — stop so we don't emit a
      // tiny trailing slice that's just the overlap tail
      if (start + MAX_CHARS >= chunk.length) break;
    }
  }
  return sized;
}

// export function createChunks(files: filesType) {
//   const allChunks: chunkType = [];
//   files.forEach(async file => {
//     // the below regex , will only split "export functions", "function", "class"
//     const chunks = file.content.split(/(?=export\s+function|function\s+|class\s+)/g).filter(Boolean)
//     // console.log(`chunk of file : ${file}-------->`,chunk);
//     for (const chunk of chunks) {
//       console.log("inside for loop");

//       // writeFile(path.join(process.cwd(),"text.txt"),chunk,'utf8',(err)=>{console.log("error came bete",err);});
//       await appendFile(
//         path.join(process.cwd(), "text.txt"),
//         chunk + "\n\n" + "---------------------------------------------------"
//       );
//       allChunks.push({
//         fileId: '',
//         content: '',
//         startLine: 0,
//         endLine: 0
//       })
//     }
//   })
// }


// todo
// check whehter the text file is creating correctly or not.
// store chunks in db and before storing once confirm the code with gpt.

// pending : improve the way of chunking 