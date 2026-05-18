import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

let bashMock = async () => ({ stdout: 'bash output', stderr: '' });
let safeBashApprovalMock = async () => ({ approved: true, reason: 'approved' });
let safePathApprovalMock = async () => ({ status: true, reason: 'safe' });

// User prompt handled by NODE_ENV=test intercept

const { toolCall } = await import('../tools/toolCall.js');


describe('toolCall', () => {
    const testDir = './test/_temp_toolcall';

    beforeEach(() => {
        fs.mkdirSync(testDir, { recursive: true });
        bashMock = async () => ({ stdout: 'bash output', stderr: '' });
        safeBashApprovalMock = async () => ({ approved: true, reason: 'approved' });
        safePathApprovalMock = async () => ({ status: true, reason: 'safe' });
    });

    afterEach(() => {
        fs.rmSync(testDir, { recursive: true, force: true });
        mock.restoreAll();
    });

    function makeToolCall(id, name, args) {
        return {
            id,
            type: 'function',
            function: {
                name,
                arguments: JSON.stringify(args)
            }
        };
    }

    describe('Input validation', () => {
        it('should return error for null input', async () => {
            const result = await toolCall(null);
            assert.strictEqual(result, 'Invalid tool call: no input provided');
        });

        it('should return error for undefined input', async () => {
            const result = await toolCall(undefined);
            assert.strictEqual(result, 'Invalid tool call: no input provided');
        });

        it('should return error for non-array input', async () => {
            const result = await toolCall({ not: 'an array' });
            assert.strictEqual(result, 'Invalid tool call: no input provided');
        });

        it('should return error for empty array', async () => {
            const result = await toolCall([]);
            assert.strictEqual(result, 'Invalid tool call: no input provided');
        });
    });

    describe('read tool', () => {
        it('should read a file successfully', async () => {
            const filePath = path.join(testDir, 'test.txt');
            fs.writeFileSync(filePath, 'file content');

            const calls = [makeToolCall('call_1', 'read', { filePath })];
            const result = await toolCall(calls);

            assert.ok(Array.isArray(result));
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].role, 'tool');
            assert.strictEqual(result[0].tool_call_id, 'call_1');
            assert.ok(result[0].content.includes('file content'));
        });

        it('should return error when reading non-existent file', async () => {
            const calls = [makeToolCall('call_1', 'read', { filePath: './nonexistent.txt' })];
            const result = await toolCall(calls);

            assert.ok(result[0].content.includes('File not found'));
        });

        it('should return error when filePath is missing', async () => {
            const calls = [makeToolCall('call_1', 'read', {})];
            const result = await toolCall(calls);

            assert.ok(result[0].content.includes('filePath is required'));
        });

        it('should return error when arguments are empty object', async () => {
            const calls = [{
                id: 'call_1',
                type: 'function',
                function: { name: 'read', arguments: '{}' }
            }];
            const result = await toolCall(calls);

            assert.ok(result[0].content.includes('filePath is required'));
        });
    });

    describe('write tool', () => {
        it('should write content to a file', async () => {
            const filePath = path.join(testDir, 'output.txt');
            const calls = [makeToolCall('call_1', 'write', { filePath, content: 'Hello World' })];
            const result = await toolCall(calls);

            assert.ok(result[0].content.includes('File written successfully'));
            assert.strictEqual(fs.readFileSync(filePath, 'utf-8'), 'Hello World');
        });

        it('should return error when filePath is missing', async () => {
            const calls = [makeToolCall('call_1', 'write', { content: 'Hello' })];
            const result = await toolCall(calls);

            assert.ok(result[0].content.includes('filePath and content are required'));
        });

        it('should return error when content is missing', async () => {
            const calls = [makeToolCall('call_1', 'write', { filePath: './test.txt' })];
            const result = await toolCall(calls);

            assert.ok(result[0].content.includes('filePath and content are required'));
        });

        it('should handle content that is empty string', async () => {
            const filePath = path.join(testDir, 'empty.txt');
            const calls = [makeToolCall('call_1', 'write', { filePath, content: '' })];
            const result = await toolCall(calls);

            assert.ok(result[0].content.includes('File written successfully'));
        });

        it('should overwrite existing file content', async () => {
            const filePath = path.join(testDir, 'overwrite.txt');
            fs.writeFileSync(filePath, 'old content');

            const calls = [makeToolCall('call_1', 'write', { filePath, content: 'new content' })];
            const result = await toolCall(calls);

            assert.ok(result[0].content.includes('File written successfully'));
            assert.strictEqual(fs.readFileSync(filePath, 'utf-8'), 'new content');
        });
    });

    describe('edit tool', () => {
        beforeEach(() => {
            fs.writeFileSync(path.join(testDir, 'edit.txt'), 'Hello World');
        });

        it('should edit a file successfully', async () => {
            const filePath = path.join(testDir, 'edit.txt');
            const calls = [makeToolCall('call_1', 'edit', {
                filePath,
                oldContent: 'Hello World',
                newContent: 'Goodbye World'
            })];
            const result = await toolCall(calls);

            assert.ok(result[0].content.includes('File edited successfully'));
            assert.strictEqual(fs.readFileSync(filePath, 'utf-8'), 'Goodbye World');
        });

        it('should return error when oldContent not found', async () => {
            const filePath = path.join(testDir, 'edit.txt');
            const calls = [makeToolCall('call_1', 'edit', {
                filePath,
                oldContent: 'Not In File',
                newContent: 'replacement'
            })];
            const result = await toolCall(calls);

            assert.ok(result[0].content.includes('oldContent not found'));
        });

        it('should return error when filePath is missing', async () => {
            const calls = [makeToolCall('call_1', 'edit', {
                oldContent: 'old',
                newContent: 'new'
            })];
            const result = await toolCall(calls);

            assert.ok(result[0].content.includes('filePath, oldContent, and newContent are required'));
        });

        it('should return error when oldContent is missing', async () => {
            const filePath = path.join(testDir, 'edit.txt');
            const calls = [makeToolCall('call_1', 'edit', {
                filePath,
                newContent: 'new'
            })];
            const result = await toolCall(calls);

            assert.ok(result[0].content.includes('filePath, oldContent, and newContent are required'));
        });

        it('should return error when newContent is missing', async () => {
            const filePath = path.join(testDir, 'edit.txt');
            const calls = [makeToolCall('call_1', 'edit', {
                filePath,
                oldContent: 'old'
            })];
            const result = await toolCall(calls);

            assert.ok(result[0].content.includes('filePath, oldContent, and newContent are required'));
        });
    });

    describe('bash tool', () => {
        it('should execute bash command', async () => {
            const calls = [makeToolCall('call_1', 'bash', { command: 'echo hello' })];
            const result = await toolCall(calls);

            assert.ok(result[0].content.includes('hello'));
        });

        it('should return error when command is missing', async () => {
            const calls = [makeToolCall('call_1', 'bash', {})];
            const result = await toolCall(calls);

            assert.ok(result[0].content.includes('command is required'));
        });

        it('should return denial message when bash approval is denied', async () => {
            global.__MOCK_ASK_ANSWER = 'n';

            const calls = [makeToolCall('call_1', 'bash', { command: 'rm -rf .' })];
            const result = await toolCall(calls);

            assert.ok(result[0].content.includes('denied'));
        });

        it('should handle bash execution errors', async () => {
            global.__MOCK_ASK_ANSWER = 'y';
            const calls = [makeToolCall('call_1', 'bash', { command: 'invalid_cmd' })];
            const result = await toolCall(calls);

            assert.ok(result[0].content.includes('Error executing bash command') || result[0].content.includes('command not found'));
        });
    });

    describe('Unknown tool', () => {
        it('should return error for unknown tool name', async () => {
            const calls = [makeToolCall('call_1', 'unknown_tool', { data: 'test' })];
            const result = await toolCall(calls);

            assert.ok(result[0].content.includes('Unknown tool'));
        });

        it('should return error for empty tool name', async () => {
            const calls = [makeToolCall('call_1', '', { data: 'test' })];
            const result = await toolCall(calls);

            assert.ok(result[0].content.includes('Unknown tool'));
        });
    });

    describe('Invalid JSON arguments', () => {
        it('should return error for invalid JSON in arguments', async () => {
            const calls = [{
                id: 'call_1',
                type: 'function',
                function: {
                    name: 'read',
                    arguments: '{invalid json'
                }
            }];
            const result = await toolCall(calls);

            assert.ok(result[0].content.includes('Invalid JSON'));
        });

        it('should handle empty arguments string', async () => {
            const calls = [{
                id: 'call_1',
                type: 'function',
                function: {
                    name: 'read',
                    arguments: ''
                }
            }];
            const result = await toolCall(calls);

            assert.strictEqual(result.length, 1);
            assert.ok(result[0].content.includes('filePath is required'));
        });
    });

    describe('Multiple tool calls', () => {
        it('should handle multiple tool calls in one request', async () => {
            const filePath1 = path.join(testDir, 'file1.txt');
            const filePath2 = path.join(testDir, 'file2.txt');
            fs.writeFileSync(filePath1, 'content1');
            fs.writeFileSync(filePath2, 'content2');

            const calls = [
                makeToolCall('call_1', 'read', { filePath: filePath1 }),
                makeToolCall('call_2', 'read', { filePath: filePath2 })
            ];
            const result = await toolCall(calls);

            assert.strictEqual(result.length, 2);
            assert.ok(result[0].content.includes('content1'));
            assert.ok(result[1].content.includes('content2'));
        });

        it('should handle mixed success and failure in multiple tool calls', async () => {
            const filePath = path.join(testDir, 'exists.txt');
            fs.writeFileSync(filePath, 'exists');

            const calls = [
                makeToolCall('call_1', 'read', { filePath }),
                makeToolCall('call_2', 'read', { filePath: './nonexistent.txt' })
            ];
            const result = await toolCall(calls);

            assert.strictEqual(result.length, 2);
            assert.ok(result[0].content.includes('exists'));
            assert.ok(result[1].content.includes('File not found'));
        });

        it('should handle mixed tool types', async () => {
            const filePath = path.join(testDir, 'mixed.txt');
            fs.writeFileSync(filePath, 'original');

            const calls = [
                makeToolCall('call_1', 'read', { filePath }),
                makeToolCall('call_2', 'write', { filePath: path.join(testDir, 'new.txt'), content: 'new' }),
                makeToolCall('call_3', 'bash', { command: 'echo test' })
            ];
            const result = await toolCall(calls);

            assert.strictEqual(result.length, 3);
            assert.strictEqual(result[0].role, 'tool');
            assert.strictEqual(result[1].role, 'tool');
            assert.strictEqual(result[2].role, 'tool');
        });
    });

    describe('Redaction', () => {
        it('should redact emails from tool output', async () => {
            const filePath = path.join(testDir, 'email.txt');
            fs.writeFileSync(filePath, 'Contact: user@example.com');

            const calls = [makeToolCall('call_1', 'read', { filePath })];
            const result = await toolCall(calls);

            assert.ok(!result[0].content.includes('user@example.com'));
            assert.ok(result[0].content.includes('[EMAIL_REDACTED]'));
        });
    });
});
