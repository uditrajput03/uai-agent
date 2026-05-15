import { log } from 'node:console';

export async function toolCall(parsed) {
    if (!parsed || typeof parsed !== 'object') {
        return 'Invalid tool call: no input provided';
    }

    const tool = parsed.tool.trim();
    const input = parsed.input;

    if (process.env.DEBUG === 'true') {
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
    }

    log(`Unknown tool requested: ${tool}`);
    return `Unknown tool or tool call input: ${tool}`;
}
