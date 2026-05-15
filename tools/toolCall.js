import { log } from 'node:console';

export async function toolCall(toolJson) {
    if (!toolJson || typeof toolJson !== 'string') {
        return 'Invalid tool call: no input provided';
    }

    let parsed;
    try {
        parsed = JSON.parse(toolJson);
    } catch (error) {
        return `Invalid JSON in tool call: ${error.message}`;
    }

    if (!parsed.tool || !parsed.input) {
        return 'Invalid tool call: missing tool or input property';
    }

    const tool = parsed.tool.trim();
    const input = parsed.input.trim();

    if (process.env.DEBUG === 'true') {
        console.log('Tool Call - tool:', tool);
        console.log('Tool Call - Input:', input);
    }

    if (tool === 'bash') {
        const { bash } = await import('./bash.js');
        try {
            const result = await bash(input);
            return result.stdout || result.stderr || 'Command executed with no output';
        } catch (error) {
            return `Error executing bash command: ${error.message}`;
        }
    }

    log(`Unknown tool requested: ${tool}`);
    return `Unknown tool or tool call input: ${tool}`;
}
