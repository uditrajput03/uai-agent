import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

const { getApprovalRequirements, safePathApproval } = await import('../utils/approval.js');
const { autoApprove } = await import('../config.js');

describe('approval', () => {
    const testDir = path.join('test', '_temp_approval');
    let originalCwd;

    beforeEach(() => {
        fs.rmSync(testDir, { recursive: true, force: true });
        fs.mkdirSync(testDir, { recursive: true });
        fs.writeFileSync(path.join(testDir, '.gitignore'), '*.secret\nnode_modules/\n.env\n');
        originalCwd = process.cwd();
        process.chdir(testDir);
        global.__MOCK_ASK_ANSWER = 'y';
    });

    afterEach(() => {
        process.chdir(originalCwd);
        fs.rmSync(testDir, { recursive: true, force: true });
        autoApprove.default = 'auto';
    });

    function makeToolCall(name, args = {}) {
        return { id: 'call_1', type: 'function', function: { name, arguments: JSON.stringify(args) } };
    }

    it('approves paths inside cwd', async () => {
        fs.writeFileSync('safe.txt', 'ok');
        const result = await safePathApproval('./safe.txt');
        assert.strictEqual(result.status, true);
    });

    it('does not allow user approval to bypass workspace boundaries', async () => {
        global.__MOCK_ASK_ANSWER = 'y';
        const result = await safePathApproval('../outside.txt');
        assert.strictEqual(result.status, false);
        assert.match(result.reason, /outside workspace/);
    });

    it('denies gitignored files by default in noPrompt mode', async () => {
        fs.writeFileSync('test.secret', 'secret');
        const result = await safePathApproval('./test.secret', true);
        assert.strictEqual(result.status, false);
        assert.match(result.reason, /gitignore/);
    });

    it('allows gitignored files only after explicit yes', async () => {
        fs.writeFileSync('test.secret', 'secret');
        global.__MOCK_ASK_ANSWER = 'y';
        const result = await safePathApproval('./test.secret');
        assert.strictEqual(result.status, true);
    });

    it('denies gitignored files when user says no', async () => {
        fs.writeFileSync('test.secret', 'secret');
        global.__MOCK_ASK_ANSWER = 'n';
        const result = await safePathApproval('./test.secret');
        assert.strictEqual(result.status, false);
    });

    it('reports no approvals in allow mode', async () => {
        autoApprove.default = 'allow';
        const result = await getApprovalRequirements([makeToolCall('bash', { command: 'echo hi' })]);
        assert.deepStrictEqual(result, { execApproval: false, sendingApproval: false });
    });

    it('requires execution approval for bash in auto mode', async () => {
        const result = await getApprovalRequirements([makeToolCall('bash', { command: 'echo hi' })]);
        assert.strictEqual(result.execApproval, true);
        assert.strictEqual(result.sendingApproval, true);
    });

    it('does not require approval for safe file tools in auto mode', async () => {
        fs.writeFileSync('safe.txt', 'ok');
        const result = await getApprovalRequirements([makeToolCall('read', { filePath: './safe.txt' })]);
        assert.strictEqual(result.execApproval, false);
        assert.strictEqual(result.sendingApproval, false);
    });

    it('requires sending approval for unsafe paths in auto mode', async () => {
        const result = await getApprovalRequirements([makeToolCall('read', { filePath: '../outside.txt' })]);
        assert.strictEqual(result.sendingApproval, true);
    });

    it('denies symlinks that resolve outside cwd', async () => {
        fs.writeFileSync('../outside-approval.txt', 'secret');
        fs.symlinkSync('../outside-approval.txt', 'link.txt');
        try {
            const result = await safePathApproval('./link.txt');
            assert.strictEqual(result.status, false);
            assert.match(result.reason, /outside workspace/);
        } finally {
            fs.rmSync('../outside-approval.txt', { force: true });
        }
    });

    it('treats invalid JSON arguments as unsafe', async () => {
        const result = await getApprovalRequirements([{ id: '1', type: 'function', function: { name: 'read', arguments: '{bad' } }]);
        assert.strictEqual(result.sendingApproval, true);
    });
});
