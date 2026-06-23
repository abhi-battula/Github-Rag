import { Router } from "express";
import { asyncHandler, validate } from "./util";
import { repositorySchema } from "./types";
import { createRepositoryController, repositoryStatusController } from "./controller";

export const router = Router();

// router.post("/repositories",validate("repositorySchema"),asyncHandler(customController))

router.post("/repositories",validate(repositorySchema),asyncHandler(createRepositoryController))
router.get("/repositories/:id",asyncHandler(repositoryStatusController))