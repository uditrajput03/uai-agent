import { log } from 'node:console';
import { keys } from '../config/keys.js';
import { readFile, writeFile } from './fsOps.js';
import { bash } from './bash.js';
import { redact } from './redact.js';

export async function toolCall(finalToolCalls) {
    if (!finalToolCalls || !Array.isArray(finalToolCalls) || finalToolCalls.length === 0) {
        return 'Invalid tool call: no input provided';
    }
    const results = [];
    for (let i = 0; i < finalToolCalls.length; i++) {
        const call = finalToolCalls[i];
        const tool = call.function.name;
        
        let input = {};
        try {
            if (call.function.arguments) {
                input = JSON.parse(call.function.arguments);
            }
        } catch (e) {
            console.error(`Error parsing args for tool ${tool}:`, e.message);
            results.push({ role: "tool", tool_call_id: call.id, content: "Error: Invalid JSON arguments returned by model." });
            continue;
        }

        let output = '';
        if (keys.DEBUG === 'true') {
            console.log('Tool Call - tool:', tool);
            console.log('Tool Call - Input:', input);
        }
        if (tool === 'bash') {
            try {
                const result = await bash(input?.command);
                output = result.stdout || result.stderr;
            } catch (error) {
                output = `Error executing bash command: ${error.message}`;
            }
        } else if (tool === 'read') {
            if (!input?.filePath) {
                output = 'Error: filePath is required for read tool';
                continue;
            }
            output = readFile(input?.filePath);
        } else if (tool === 'write') {
            if (!input?.filePath || !input?.content) {
                output = 'Error: filePath and content are required for write tool';
                continue;
            }
            output = writeFile(input?.filePath, input?.content);
        }
        else {
            console.log(`Unknown tool requested: ${tool}`);
            output = `Unknown tool or tool call input: ${tool}`;
        }

        //Redact output
        output = redact(output);
        results.push({ role: "tool", tool_call_id: call.id, content: output });
    }
    return results;
}
