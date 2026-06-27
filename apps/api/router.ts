import { Router } from "express";
import { asyncHandler, validate } from "./util";
import { repositorySchema } from "./types";
import { createRepositoryController, queryController, repositoryStatusController } from "./controller";

export const router = Router();

// router.post("/repositories",validate("repositorySchema"),asyncHandler(customController))

router.post("/repositories",validate(repositorySchema),asyncHandler(createRepositoryController))
router.get("/repositories/:id",asyncHandler(repositoryStatusController))
//todo : try to add chatId so that we can have conversational msg and store them for later, also add a schema for this as well
router.post("/:repoId/query",asyncHandler(queryController))