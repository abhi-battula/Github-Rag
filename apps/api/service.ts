import { client } from "./redis";

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