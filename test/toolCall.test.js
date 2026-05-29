import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

const { toolCall } = await import('../src/tools/toolCall.ts');

describe('toolCall', () => {
    const testDir = path.join('test', '_temp_toolcall');
    let originalCwd;

    beforeEach(() => {
        fs.rmSync(testDir, { recursive: true, force: true });
        fs.mkdirSync(testDir, { recursive: true });
        originalCwd = process.cwd();
        process.chdir(testDir);
        global.__MOCK_ASK_ANSWER = 'y';
    });

    afterEach(() => {
        process.chdir(originalCwd);
        fs.rmSync(testDir, { recursive: true, force: true });
    });

    function makeToolCall(id, name, args) {
        return { id, type: 'function', function: { name, arguments: JSON.stringify(args) } };
    }

    it('validates toolCall input', async () => {
        assert.strictEqual(await toolCall(null), 'Invalid tool call: no input provided');
        assert.strictEqual(await toolCall([]), 'Invalid tool call: no input provided');
    });

    it('reads, writes, and edits files', async () => {
        let result = await toolCall([makeToolCall('w', 'write', { filePath: './a.txt', content: 'hello' })]);
        assert.match(result[0].content, /File written successfully/);

        result = await toolCall([makeToolCall('r', 'read', { filePath: './a.txt' })]);
        assert.strictEqual(result[0].content, 'hello');

        result = await toolCall([makeToolCall('e', 'edit', { filePath: './a.txt', oldContent: 'hello', newContent: 'hi' })]);
        assert.match(result[0].content, /File edited successfully/);
        assert.strictEqual(fs.readFileSync('a.txt', 'utf-8'), 'hi');
    });

    it('returns validation errors for missing arguments', async () => {
        assert.match((await toolCall([makeToolCall('r', 'read', {})]))[0].content, /filePath is required/);
        assert.match((await toolCall([makeToolCall('w', 'write', { filePath: './x' })]))[0].content, /filePath and content/);
        assert.match((await toolCall([makeToolCall('e', 'edit', { filePath: './x' })]))[0].content, /filePath, oldContent, and newContent/);
        assert.match((await toolCall([makeToolCall('b', 'bash', {})]))[0].content, /command is required/);
    });

    it('blocks out-of-workspace file access', async () => {
        const result = await toolCall([makeToolCall('r', 'read', { filePath: '../secret.txt' })]);
        assert.match(result[0].content, /outside workspace/);
    });

    it('executes approved bash commands', async () => {
        const result = await toolCall([makeToolCall('b', 'bash', { command: 'echo hello' })]);
        assert.match(result[0].content, /hello/);
    });

    it('returns denial for blocked bash commands', async () => {
        const result = await toolCall([makeToolCall('b', 'bash', { command: 'rm -rf /' })]);
        assert.match(result[0].content, /Command blocked/);
    });

    it('handles unknown tools and invalid JSON', async () => {
        assert.match((await toolCall([makeToolCall('u', 'unknown', {})]))[0].content, /Unknown tool/);
        const invalid = [{ id: 'bad', type: 'function', function: { name: 'read', arguments: '{bad' } }];
        assert.match((await toolCall(invalid))[0].content, /Invalid JSON/);
    });

    it('handles multiple calls', async () => {
        fs.writeFileSync('one.txt', 'one');
        fs.writeFileSync('two.txt', 'two');
        const result = await toolCall([
            makeToolCall('1', 'read', { filePath: './one.txt' }),
            makeToolCall('2', 'read', { filePath: './two.txt' })
        ]);
        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[0].content, 'one');
        assert.strictEqual(result[1].content, 'two');
    });

    it('handles malformed tool call objects without throwing', async () => {
        const result = await toolCall([{ id: 'broken', type: 'function' }]);
        assert.strictEqual(result.length, 1);
        assert.match(result[0].content, /Unknown tool/);
    });

    it('handles missing tool call id by generating a response id', async () => {
        const result = await toolCall([{ type: 'function', function: { name: 'read', arguments: '{}' } }]);
        assert.strictEqual(result.length, 1);
        assert.ok(result[0].tool_call_id);
        assert.match(result[0].content, /filePath is required/);
    });
});
