import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(__dirname, "../../packages/db/.env"),
});
import { gitclone, listAllFiles, storeFileAndChunks, storeRepository } from "./util";

export async function ingestion(url:string,repositoryId:string){ // async function with no return types will return promise.resolve(undefeind) immediately
    console.log("WORKER DATABASE_URL =", process.env.DATABASE_URL);
    const repoName = url.split("/").pop()?.replace(".git", "");
    if(!repoName){throw new Error("wrong url format"); return}
    // add repo in to db,
    await storeRepository(url,repositoryId,repoName)
    // git clone using spawn
    await gitclone(url,repositoryId);
    console.log("clone done after mehtod");
    
    // recurssively call all files
    const files = await listAllFiles(repoName!,repositoryId)
    // store all files and its content in the db
    await storeFileAndChunks(files,repositoryId);
    console.log("---------------end--------");
    
    // create chunks and print them
    // const chunks = createChunks(files)

}
ingestion("https://github.com/abhi-battula/Muzi","123456789")
console.log(process.cwd());


//todo : 
// file name and content is getting store in files 
// so next is store them in pg , before storing migrate the db 
// after storing files in db , create chunks with regex
// embed those chunks and store in db in chunks table