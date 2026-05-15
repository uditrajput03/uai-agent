import OpenAI from 'openai';
import 'dotenv/config';
import fs from 'fs';
import { askQuestion } from './tools/askQuestion.js';
import { toolCall } from './tools/toolCall.js';
import { models } from './models.js';
import { redact } from './tools/redact.js';

// const provider = 'cloudflare';
const provider = 'nvidia';
const model = 'glm';

console.log("Provider:", provider.toLowerCase());
console.log("Model:", model.toLowerCase());

const openai = new OpenAI({
    apiKey: models[provider].apiKey,
    baseURL: models[provider].baseURL,

})

const agentPrompt = fs.readFileSync('./config/system.md', 'utf-8');
const toolsPrompt = fs.readFileSync('./config/tools.md', 'utf-8');
const systemPrompt = agentPrompt + "\n\n" + toolsPrompt;
const msgArray = [
    { "role": "system", "content": systemPrompt }
]
if (process.env.DEBUG === 'true') {
    console.log("System Prompt: ", systemPrompt);
}
let isToolCall = false;
let toolResponse = '';
async function main() {
    let outmsg = ''
    let inputMsg = '';
    if (isToolCall) {
        toolResponse = redact(toolResponse.trim());
        isToolCall = false;
        console.log('Tool response: ', toolResponse);
        if (toolResponse) {
            const confirmation = await askQuestion("Enter to send (y/n):");
            if (confirmation.toLowerCase() === 'n') {
                toolResponse = "\nTool response not sent to agent.";
                console.log("Tool response not sent to agent.");
                return;
            }
        }
        inputMsg = toolResponse + '\n' + confirmation;
        toolResponse = '';
    }
    else {
        inputMsg = await askQuestion("Input:");
    }
    msgArray.push({ "role": "user", "content": inputMsg })
    if (process.env.DEBUG === 'true') {
        console.log("Message Array: ", msgArray);
    }
    try {
        const completion = await openai.chat.completions.create({
            ...models[provider][model],
            messages: msgArray,
            stream: true,

        })

        let isfirstChunk = true;
        for await (const chunk of completion) {
            let content = chunk.choices[0]?.delta?.content || ''
            let reasoning = chunk.choices[0]?.delta?.reasoning_content
            if (reasoning) {
                process.stdout.write(`.`)
                continue;
            }
            if (isfirstChunk && content.trim()) {
                process.stdout.write(`\n`)
                isfirstChunk = false;
            }
            outmsg += content
            process.stdout.write(content)
        }
    } catch (error) {
        console.error("Error during OpenAI API call: ", error);
        return;
    }
    msgArray.push({ "role": "assistant", "content": outmsg })
    if (outmsg.includes("```json")) {
        const regex = /```json\s*({"tool":[\s\S]*?)\s*```/
        const toolJson = outmsg.match(regex)?.[1]
        let parsed;
        if (!toolJson) {
            console.log("No tool call JSON found in the output.");
            return;
        }
        isToolCall = true;
        try {
            parsed = JSON.parse(toolJson);
        } catch (error) {
            console.log(`Invalid JSON in tool call: ${error.message}`);
            toolResponse = `Error parsing tool call JSON: ${error.message}`;
            return;
        }
        if (!parsed.tool || !parsed.input) {
            console.log('Invalid tool call: missing tool or input property');
            toolResponse = 'Invalid tool call: missing tool or input property';
            return;
        }

        const confirmation = await askQuestion(`Tool call detected (y/n): ${JSON.stringify(parsed)}`);
        if (confirmation.toLowerCase() === 'n') {
            toolResponse = "\nTool call cancelled by user.";
            console.log("\nTool call cancelled by user.");
        } else {
            try {
                const response = await toolCall(parsed);
                toolResponse = `\nTool call result: ${response}`;
            } catch (error) {
                toolResponse = `\nError executing tool call: ${error.message}`;
            }
        }
    }
}

while (true) {
    await main();
    console.log("\n\n");
}