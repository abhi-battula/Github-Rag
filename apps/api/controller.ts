import type { NextFunction, Request, Response } from "express";
import type { repositoryInput } from "./types";
import { createRepositoryService } from "./service";

export async function createRepositoryController(req:Request,res:Response,next:NextFunction){
    console.log("inside repository controller");
    
    const body = req.body as repositoryInput;
    const result = await createRepositoryService(body.repoUrl)

    return res.status(200).json({repositoryId:result});
}

export async function repositoryStatusController(req:Request,res:Response,next:NextFunction){
    const repoId = req.params["id"];
    console.log("id---=->",repoId);
    res.send("cool")
}