import Express, { type Errback, type ErrorRequestHandler, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import type { ZodSchema } from "zod";

export function validate(schema: ZodSchema) {
    console.log("inside validate function");

    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body)
        if (!result.success) {
            return next(new Error("invalid inputs"))
        }
        next();
    }
}

export const asyncHandler = (fn: RequestHandler): RequestHandler =>
    async (req, res, next) => {
        try {
            await fn(req, res, next);
        } catch (err) {
            next(err);
        }
    };

