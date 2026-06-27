import type { NextFunction, Request, Response } from "express";
import type { repositoryInput } from "./types";
import { createRepositoryService, queryService } from "./service";
import { pg } from "db";

export async function createRepositoryController(req:Request,res:Response,next:NextFunction){
    console.log("inside repository controller");

    const body = req.body as repositoryInput;
    const result = await createRepositoryService(body.repoUrl)

    return res.status(200).json({repositoryId:result});
}

export async function repositoryStatusController(req:Request,res:Response,next:NextFunction){
    const repoId = req.params["id"];
    if (!repoId || typeof repoId !== "string") {
        return res.status(400).json({ error: "Invalid repository ID" });
    }
    

    const repo = await pg.repository.findUnique({ where: { id: repoId } });
    if (!repo) {
        return res.status(404).json({ error: "Repository not found" });
    }

    return res.status(200).json({
        id: repo.id,
        name: repo.name,
        status: repo.status,
        githubUrl: repo.githubUrl,
    });
}

export async function queryController(req:Request,res:Response,next:NextFunction){
    const repoId = req.params["repoId"];
    const query = req.body.query;
    console.log("query from congtroller ------->",query);
    
    if(!repoId || typeof repoId !== "string"){
        return res.status(404).json({ error: "Repository not found" });
    }
    const embeddings = await queryService(query)
    res.send(embeddings)
}
