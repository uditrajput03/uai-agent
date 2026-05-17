import { log } from 'node:console';
import { keys } from '../config/keys.js';

export async function toolCall(parsed) {
    if (!parsed || typeof parsed !== 'object') {
        return 'Invalid tool call: no input provided';
    }

    const tool = parsed.tool.trim();
    const input = parsed.input;

    if (keys.DEBUG === 'true') {
        console.log('Tool Call - tool:', tool);
        console.log('Tool Call - Input:', input);
    }

    if (tool === 'bash') {
        const { bash } = await import('./bash.js');
        try {
            const result = await bash(input?.command);
            return result.stdout || result.stderr;
        } catch (error) {
            return `Error executing bash command: ${error.message}`;
        }
    } else if (tool === 'read') {
        const { readFile } = await import('./fsOps.js');
        if (!input?.filePath) {
            return 'Error: filePath is required for read tool';
        }
        return readFile(input?.filePath);
    } else if (tool === 'write') {
        const { writeFile } = await import('./fsOps.js');
        if (!input?.filePath || !input?.content) {
            return 'Error: filePath and content are required for write tool';
        }
        return writeFile(input?.filePath, input?.content);
    }

    log(`Unknown tool requested: ${tool}`);
    return `Unknown tool or tool call input: ${tool}`;
}
