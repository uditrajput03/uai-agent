import { keys } from '../config/keys.js';
import { autoApprove } from '../config.js';
import { readFile, writeFile, editFile } from './fsOps.js';
import { bash, safeBashApproval } from './bash.js';
import { redact } from '../utils/redact.js';
import { safePathApproval } from '../utils/approval.js';
import type { FinalToolCall } from '../index.js';

/**
 * Each handler is an async function that receives the parsed input and
 * returns a plain string (the tool's output to send back to the AI).
 *
 * To add a new tool, simply add a new entry to this Map — no need to
 * touch any other part of this file.
 */
type ToolName = 'bash' | 'read' | 'write' | 'edit';
type ToolInput = Record<string, unknown>;
type ToolHandler = (input: ToolInput) => Promise<string>;

function isToolInput(input: unknown): input is ToolInput {
    return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function getStringField(input: ToolInput, field: string) {
    const value = input[field];
    return typeof value === 'string' ? value : undefined;
}

const toolHandlers = new Map<ToolName, ToolHandler>();

function isToolName(toolName: string | undefined): toolName is ToolName {
    return toolName === 'bash' || toolName === 'read' || toolName === 'write' || toolName === 'edit';
}

// ── bash ──
toolHandlers.set('bash', async (input) => {
    const command = getStringField(input, 'command');
    if (!command) {
        return 'Error: command is required for bash tool';
    }

    // Skip approval check if autoApprove.default is set to 'allow'
    if (autoApprove.default !== 'allow') {
        const approval = await safeBashApproval(command);
        if (!approval.approved) {
            return approval.reason || 'Command execution denied by user.';
        }
    }

    try {
        const result = await bash(command);
        return result.stdout || result.stderr || 'Command executed with no output';
    } catch (error) {
        if(error instanceof Error) {
            return `Error executing bash command: ${error.message}`;
        }
        else {
            throw error;
        }
    }
});

// ── read ──
toolHandlers.set('read', async (input) => {
    const filePath = getStringField(input, 'filePath');
    if (!filePath) {
        return 'Error: filePath is required for read tool';
    }

    // Skip approval check if autoApprove.default is set to 'allow'
    if (autoApprove.default !== 'allow') {
        const approval = await safePathApproval(filePath);
        if (!approval.status) {
            return approval.reason || 'Path approval denied.';
        }
    }

    return readFile(filePath);
});

// ── write ──
toolHandlers.set('write', async (input) => {
    const filePath = getStringField(input, 'filePath');
    const content = getStringField(input, 'content');
    if (!filePath || content === undefined) {
        return 'Error: filePath and content are required for write tool';
    }

    // Skip approval check if autoApprove.default is set to 'allow'
    if (autoApprove.default !== 'allow') {
        const approval = await safePathApproval(filePath);
        if (!approval.status) {
            return approval.reason || 'Path approval denied.';
        }
    }

    return writeFile(filePath, content);
});

// ── edit ──
toolHandlers.set('edit', async (input) => {
    const filePath = getStringField(input, 'filePath');
    const oldContent = getStringField(input, 'oldContent');
    const newContent = getStringField(input, 'newContent');
    if (!filePath || oldContent === undefined || newContent === undefined) {
        return 'Error: filePath, oldContent, and newContent are required for edit tool';
    }

    // Skip approval check if autoApprove.default is set to 'allow'
    if (autoApprove.default !== 'allow') {
        const approval = await safePathApproval(filePath);
        if (!approval.status) {
            return approval.reason || 'Path approval denied.';
        }
    }

    return editFile(filePath, oldContent, newContent);
});

function parseToolInput(call: FinalToolCall): { ok: true, input: ToolInput } | { ok: false, error: string } {
    try {
        const parsed: unknown = call.function?.arguments
            ? JSON.parse(call.function.arguments)
            : {};
        const input = isToolInput(parsed) ? parsed : {};
        return { ok: true, input };
    } catch {
        return { ok: false, error: `Error: Invalid JSON tool call arguments returned by model.` };
    }
}

async function executeSingleTool(call: FinalToolCall) {
    const toolName = call.function?.name;
    const toolCallId = call.id || `missing_tool_call_id_${Date.now()}`;

    // ── Parse input ──
    const parsed = parseToolInput(call);
    if (!parsed.ok) {
        return { role: 'tool', tool_call_id: toolCallId, content: parsed.error } as const;
    }

    // ── Debug logging ──
    if (keys.DEBUG === true) {
        console.log('Tool Call - tool:', toolName);
        console.log('Tool Call - Input:', parsed.input);
    }

    // ── Dispatch to handler ──
    const handler = isToolName(toolName) ? toolHandlers.get(toolName) : undefined;
    if (!handler) {
        console.log(`Unknown tool requested: ${toolName}`);
        return {
            role: 'tool',
            tool_call_id: toolCallId,
            content: `Unknown tool or tool call input: ${toolName || 'unknown'}`
        } as const;
    }

    const output = await handler(parsed.input);

    // ── Redact & return ──
    return {
        role: 'tool',
        tool_call_id: toolCallId,
        content: redact(output)
    } as const;
}

/**
 * Execute one or more tool calls and return an array of tool-response
 * messages ready to push into the conversation array.
 *
 * @param {Array} finalToolCalls - Array of tool-call objects from the AI
 * @returns {Array|string} Array of { role, tool_call_id, content } objects
 */
export async function toolCall(finalToolCalls: FinalToolCall[]) {
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

export type ToolCallResponse = string | Awaited<ReturnType<typeof toolCall>>;
