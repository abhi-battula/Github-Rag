import Express, { type Errback, type ErrorRequestHandler, type NextFunction, type Request, type Response } from "express";
import { router } from "./router";

const app = Express();
app.use(Express.json())

app.get("/health",(req,res)=>{
    console.log("inside health endpoint");
    return res.send("cool , i am working")
})

app.use(router)



const globalErrorMiddleWare = (err:Error,req:Request,res:Response,next:NextFunction)=>{
    res.status(500).json({
        success:false,
        msg:err.message || "internal server error"
    })
}
app.use(globalErrorMiddleWare)

app.listen(3000,()=>{
    console.log("listening on port 3000");
    
})

console.log("Hello via Bun!");

