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

    if (entry.isFile() && ALLOWED_EXTENSIONS.includes(path.extname(entry.name))) {
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
    await pg.$transaction(async tx => {
      const fileRow = await tx.file.create({ data: { content: file.content, path: file.fileName, repoId: repositoryId } });
      const chunks = createFileChunks(fileRow.content);
      await tx.chunk.createMany({
        data: chunks.map(chunk => ({
          fileId: fileRow.id,
          content: chunk,
          startLine: 0, // todo : do this later , "citation" depends on this , and also learn about this "citation"
          endLine: 0
        }))
      })
    })
  }
}

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

function createFileChunks(content: string) {
  const chunks = content.split(/(?=export\s+function|function\s+|class\s+)/g).filter(Boolean)
  return chunks;
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