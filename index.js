import OpenAI from 'openai';
import 'dotenv/config';
import fs from 'fs';
import { askQuestion } from './tools/askQuestion.js';
import { toolCall } from './tools/toolCall.js';
import { log } from 'console';
const openai = new OpenAI({
    apiKey: process.env.NVIDIA_API_KEY,
    baseURL: 'https://integrate.api.nvidia.com/v1',
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
        console.log('Tool response: ', toolResponse);
        const confirmation = await askQuestion("Press Enter to send Tool Response to Agent...");
        if (confirmation.toLowerCase() === 'n') {
            console.log("Tool response not sent to agent.");
            return;
        }
        else {
            inputMsg = toolResponse;
        }
        toolResponse = '';
        isToolCall = false;
    }
    else {
        inputMsg = await askQuestion("Input:");
    }
    msgArray.push({ "role": "user", "content": inputMsg })
    if (process.env.DEBUG === 'true') {
        console.log("Message Array: ", msgArray);
    }
    const completion = await openai.chat.completions.create({
        model: "minimaxai/minimax-m2.7",
        messages: msgArray,
        temperature: 1,
        top_p: 0.95,
        max_tokens: 8192,
        stream: true
    })

    for await (const chunk of completion) {
        let content = chunk.choices[0]?.delta?.content || ''
        outmsg += content
        process.stdout.write(content)
    }
    if (outmsg.includes("TOOL_CALL:")) {
        isToolCall = true;
        const toolJson = outmsg.split("TOOL_CALL:")[1].trim();
        const confirmation = await askQuestion(`Tool call detected: ${toolJson}. Do you want to execute this command? (N/n for no) `);
        if (confirmation.toLowerCase() === 'n') {
            toolResponse = "\nTool call cancelled by user.";
            console.log("\nTool call cancelled by user.");
        } else {
            try {
                const response = await toolCall(toolJson);
                toolResponse = `\nTool call result: ${response}`;
            } catch (error) {
                toolResponse = `\nError executing tool call: ${error.message}`;
            }
        }
        msgArray.push({ "role": "assistant", "content": outmsg })
        outmsg = '';
        // console.log("Completion: ", outmsg);

    }
}

while (true) {
    await main();
    console.log("\n\n");
}