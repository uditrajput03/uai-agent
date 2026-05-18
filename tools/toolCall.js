import { keys } from '../config/keys.js';
import { autoApprove } from '../config.js';
import { readFile, writeFile, editFile } from './fsOps.js';
import { bash, safeBashApproval } from './bash.js';
import { redact } from '../utils/redact.js';
import { safePathApproval } from '../utils/approval.js';

/**
 * Each handler is an async function that receives the parsed input and
 * returns a plain string (the tool's output to send back to the AI).
 *
 * To add a new tool, simply add a new entry to this Map — no need to
 * touch any other part of this file.
 */
const toolHandlers = new Map();

// ── bash ──
toolHandlers.set('bash', async (input) => {
    if (!input?.command) {
        return 'Error: command is required for bash tool';
    }

    // Skip approval check if autoApprove.default is set to 'allow'
    if (autoApprove.default !== 'allow') {
        const approval = await safeBashApproval(input.command);
        if (!approval.approved) {
            return approval.reason;
        }
    }

    try {
        const result = await bash(input.command);
        return result.stdout || result.stderr || 'Command executed with no output';
    } catch (error) {
        return `Error executing bash command: ${error.message}`;
    }
});

// ── read ──
toolHandlers.set('read', async (input) => {
    if (!input?.filePath) {
        return 'Error: filePath is required for read tool';
    }

    // Skip approval check if autoApprove.default is set to 'allow'
    if (autoApprove.default !== 'allow') {
        const approval = await safePathApproval(input.filePath);
        if (!approval.status) {
            return approval.reason;
        }
    }

    return readFile(input.filePath);
});

// ── write ──
toolHandlers.set('write', async (input) => {
    if (!input?.filePath || input?.content === undefined) {
        return 'Error: filePath and content are required for write tool';
    }

    // Skip approval check if autoApprove.default is set to 'allow'
    if (autoApprove.default !== 'allow') {
        const approval = await safePathApproval(input.filePath);
        if (!approval.status) {
            return approval.reason;
        }
    }

    return writeFile(input.filePath, input.content);
});

// ── edit ──
toolHandlers.set('edit', async (input) => {
    if (!input?.filePath || input?.oldContent === undefined || input?.newContent === undefined) {
        return 'Error: filePath, oldContent, and newContent are required for edit tool';
    }

    // Skip approval check if autoApprove.default is set to 'allow'
    if (autoApprove.default !== 'allow') {
        const approval = await safePathApproval(input.filePath);
        if (!approval.status) {
            return approval.reason;
        }
    }

    return editFile(input.filePath, input.oldContent, input.newContent);
});

function parseToolInput(call) {
    try {
        const input = call.function.arguments
            ? JSON.parse(call.function.arguments)
            : {};
        return { ok: true, input };
    } catch (e) {
        return { ok: false, error: `Error: Invalid JSON tool call arguments returned by model.` };
    }
}

async function executeSingleTool(call) {
    const toolName = call.function.name;

    // ── Parse input ──
    const { ok, input, error } = parseToolInput(call);
    if (!ok) {
        return { role: 'tool', tool_call_id: call.id, content: error };
    }

    // ── Debug logging ──
    if (keys.DEBUG === 'true') {
        console.log('Tool Call - tool:', toolName);
        console.log('Tool Call - Input:', input);
    }

    // ── Dispatch to handler ──
    const handler = toolHandlers.get(toolName);
    if (!handler) {
        console.log(`Unknown tool requested: ${toolName}`);
        return {
            role: 'tool',
            tool_call_id: call.id,
            content: `Unknown tool or tool call input: ${toolName}`
        };
    }

    const output = await handler(input);

    // ── Redact & return ──
    return {
        role: 'tool',
        tool_call_id: call.id,
        content: redact(output)
    };
}

/**
 * Execute one or more tool calls and return an array of tool-response
 * messages ready to push into the conversation array.
 *
 * @param {Array} finalToolCalls - Array of tool-call objects from the AI
 * @returns {Array|string} Array of { role, tool_call_id, content } objects
 */
export async function toolCall(finalToolCalls) {
    if (!finalToolCalls || !Array.isArray(finalToolCalls) || finalToolCalls.length === 0) {
        return 'Invalid tool call: no input provided';
    }

    const results = [];
    for (const call of finalToolCalls) {
        const result = await executeSingleTool(call);
        results.push(result);
    }

    return results;
}
