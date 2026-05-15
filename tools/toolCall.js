import { log } from 'node:console';

export async function toolCall(toolJson) {
    let parsed = JSON.parse(toolJson);
    const tool = parsed.tool.trim();
    const input = parsed.input.trim();
    if (process.env.DEBUG === 'true') {
        console.log("Tool Call - tool: ", tool);
        console.log("Tool Call - Input: ", input);
    }
    if (tool === 'bash') {
        // log(`Executing bash command: ${input}`);
        const { bash } = await import('./bash.js');
        try {
            const result = await bash(input);
            // log(`Bash command output: ${result.stdout || result.stderr}`);
            return result.stdout;
        } catch (error) {
            return `Error executing bash command: ${error.message}`;
        }
    } else {
        log(`Unknown tool requested: ${tool}`);
        return `Unknown tool or tool call input: ${tool}`;
    }
}