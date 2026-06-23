import { client } from "./redis";

console.log("Hello via Bun!");



async function loop(){
    while(true){
        const event = await client.brPop('be-worker',2)
        console.log("event------>",event);
        if(event?.element) console.log("JSON-->",JSON.parse(event.element));
        
        
    }
}

loop();
console.log();
