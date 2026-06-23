import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";
import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(__dirname, "../../packages/db/.env"),
});

const adapter = new PrismaPg({connectionString:process.env.DATABASE_URL});
export const pg = new PrismaClient({adapter})
console.log("DATABASE_URL =", process.env.DATABASE_URL);


console.log("Hello via Bun!");