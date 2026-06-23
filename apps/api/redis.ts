import { createClient } from "redis";

export const client  = createClient().on('error',err=>console.log("redis client connection error"));
await client.connect();
