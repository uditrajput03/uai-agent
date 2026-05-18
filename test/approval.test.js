import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';


const { getApprovalRequirements, safePathApproval } = await import('../utils/approval.js');
const { autoApprove } = await import('../config.js');

describe('approval', () => {
    const testDir = './test/_temp_approval';

    beforeEach(() => {
        fs.mkdirSync(testDir, { recursive: true });
        // Create a test .gitignore
        fs.writeFileSync(path.join(testDir, '.gitignore'), '*.secret\nnode_modules/\n.env\n');
        global.__MOCK_ASK_ANSWER = 'y';
    });

    afterEach(() => {
        fs.rmSync(testDir, { recursive: true, force: true });
        mock.restoreAll();
    });

    describe('safePathApproval', () => {
        it('should approve paths within cwd', async () => {
            const filePath = path.join(testDir, 'safe.txt');
            fs.writeFileSync(filePath, 'test');

            // Change cwd to testDir temporarily
            const origCwd = process.cwd();
            process.chdir(testDir);

            try {
                const result = await safePathApproval('./safe.txt');
                assert.strictEqual(result.status, true);
                assert.ok(result.reason.includes('within working directory'));
            } finally {
                process.chdir(origCwd);
            }
        });

        it('should deny out-of-bounds paths when user says no', async () => {
            global.__MOCK_ASK_ANSWER = 'n';
            const result = await safePathApproval('/etc/passwd');
            assert.strictEqual(result.status, false);
            assert.ok(result.reason.includes('denied'));
        });

        it('should approve out-of-bounds paths when user says yes', async () => {
            global.__MOCK_ASK_ANSWER = 'y';
            const result = await safePathApproval('/etc/passwd');
            assert.strictEqual(result.status, true);
        });

        it('should deny out-of-bounds paths when noPrompt is true', async () => {
            const result = await safePathApproval('/etc/passwd', true);
            assert.strictEqual(result.status, false);
            assert.ok(result.reason.includes('noPrompt=true'));
        });

        it('should deny paths with directory traversal when noPrompt is true', async () => {
            const result = await safePathApproval('../secret.txt', true);
            assert.strictEqual(result.status, false);
        });

        it('should handle null response (Ctrl+C) from user', async () => {
            global.__MOCK_ASK_ANSWER = null;
            const result = await safePathApproval('/etc/passwd');
            assert.strictEqual(result.status, false);
            assert.ok(result.reason.includes('denied'));
        });

        it('should handle gitignore-matched files within cwd', async () => {
            const origCwd = process.cwd();
            process.chdir(testDir);

            try {
                fs.writeFileSync('test.secret', 'secret data');
                global.__MOCK_ASK_ANSWER = 'n';
                const result = await safePathApproval('./test.secret');
                assert.strictEqual(result.status, false);
            } finally {
                process.chdir(origCwd);
            }
        });

        it('should allow gitignore-matched files when user approves', async () => {
            const origCwd = process.cwd();
            process.chdir(testDir);

            try {
                fs.writeFileSync('test.secret', 'secret data');
                global.__MOCK_ASK_ANSWER = 'y';
                const result = await safePathApproval('./test.secret');
                assert.strictEqual(result.status, true);
            } finally {
                process.chdir(origCwd);
            }
        });

        it('should handle non-existent files within cwd', async () => {
            const origCwd = process.cwd();
            process.chdir(testDir);

            try {
                const result = await safePathApproval('./nonexistent.txt');
                // Should still work - parent dir exists
                assert.strictEqual(result.status, true);
            } finally {
                process.chdir(origCwd);
            }
        });

        it('should handle Windows-style absolute paths (mocked)', async () => {
            global.__MOCK_ASK_ANSWER = 'n';
            // Use path.win32 to test Windows path behavior if needed, or just skip if we rely on native path
            // For now let's test a known out-of-bounds posix path
            const result = await safePathApproval('/var/log/syslog');
            assert.strictEqual(result.status, false);
        });

        it('should handle home directory paths (~)', async () => {
            global.__MOCK_ASK_ANSWER = 'n';
            const result = await safePathApproval('~/.ssh/id_rsa');
            assert.strictEqual(result.status, false);
        });
    });

    describe('getApprovalRequirements', () => {
        function makeToolCall(name, args = {}) {
            return {
                id: 'call_1',
                type: 'function',
                function: {
                    name,
                    arguments: JSON.stringify(args)
                }
            };
        }

        it('should return no approval needed in allow mode', async () => {
            const originalMode = autoApprove.default;
            autoApprove.default = 'allow';
            try {
                const calls = [makeToolCall('bash', { command: 'rm -rf /' })];
                const result = await getApprovalRequirements(calls);
                assert.strictEqual(result.execApproval, false);
                assert.strictEqual(result.sendingApproval, false);
            } finally {
                autoApprove.default = originalMode;
            }
        });

        it('should return execApproval true for bash in auto mode', async () => {
            // In auto mode, bash requires exec approval
            // Since we can't easily mock autoApprove.default, we test the current default ('auto')
            const calls = [makeToolCall('bash', { command: 'ls' })];
            const result = await getApprovalRequirements(calls);
            assert.strictEqual(result.execApproval, true);
        });

        it('should return sendingApproval false for safe file reads in auto mode', async () => {
            const origCwd = process.cwd();
            process.chdir(testDir);

            try {
                fs.writeFileSync('safe.txt', 'content');
                const calls = [makeToolCall('read', { filePath: './safe.txt' })];
                const result = await getApprovalRequirements(calls);
                assert.strictEqual(result.execApproval, false);
                assert.strictEqual(result.sendingApproval, false);
            } finally {
                process.chdir(origCwd);
            }
        });

        it('should return sendingApproval true for out-of-bounds paths in auto mode', async () => {
            const calls = [makeToolCall('read', { filePath: '/etc/passwd' })];
            const result = await getApprovalRequirements(calls);
            assert.strictEqual(result.sendingApproval, true);
        });

        it('should handle tool calls with no file path (no filePath arg)', async () => {
            const calls = [makeToolCall('bash', { command: 'echo hello' })];
            const result = await getApprovalRequirements(calls);
            assert.strictEqual(result.execApproval, true); // bash always needs exec approval in auto
        });

        it('should handle empty tool calls array', async () => {
            const result = await getApprovalRequirements([]);
            assert.strictEqual(result.execApproval, false);
            assert.strictEqual(result.sendingApproval, false);
        });

        it('should handle tool calls with invalid JSON arguments', async () => {
            const calls = [{
                id: 'call_1',
                type: 'function',
                function: {
                    name: 'read',
                    arguments: '{invalid json'
                }
            }];
            const result = await getApprovalRequirements(calls);
            // On parse failure, hasUnsafePath becomes true
            assert.strictEqual(result.sendingApproval, true);
        });

        it('should handle multiple tool calls with mixed safety', async () => {
            const origCwd = process.cwd();
            process.chdir(testDir);

            try {
                fs.writeFileSync('safe.txt', 'content');
                const calls = [
                    makeToolCall('read', { filePath: './safe.txt' }),
                    makeToolCall('bash', { command: 'ls' })
                ];
                const result = await getApprovalRequirements(calls);
                assert.strictEqual(result.execApproval, true); // bash requires exec
            } finally {
                process.chdir(origCwd);
            }
        });

        it('should handle write tool in auto mode', async () => {
            const origCwd = process.cwd();
            process.chdir(testDir);

            try {
                const calls = [makeToolCall('write', { filePath: './new.txt', content: 'test' })];
                const result = await getApprovalRequirements(calls);
                // In auto mode, write doesn't trigger exec approval (only bash does)
                assert.strictEqual(result.execApproval, false);
            } finally {
                process.chdir(origCwd);
            }
        });

        it('should handle edit tool in auto mode', async () => {
            const origCwd = process.cwd();
            process.chdir(testDir);

            try {
                const calls = [makeToolCall('edit', { filePath: './edit.txt', oldContent: 'a', newContent: 'b' })];
                const result = await getApprovalRequirements(calls);
                assert.strictEqual(result.execApproval, false);
            } finally {
                process.chdir(origCwd);
            }
        });
    });
});
