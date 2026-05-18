import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { bash, safeBashApproval, BLOCKED_COMMANDS, DESTRUCTIVE_COMMANDS } from '../tools/bash.js';
import * as askQuestionModule from '../utils/askQuestion.js';
import fs from 'fs';
import path from 'path';

describe('bash', () => {
    describe('bash - execution', () => {
        it('should execute a simple safe command and return stdout', async () => {
            const result = await bash('echo hello');
            assert.ok(result.stdout.includes('hello'));
        });

        it('should return stderr for commands that produce stderr', async () => {
            try {
                await bash('ls /nonexistent_directory_xyz');
                assert.fail('Should have thrown');
            } catch (error) {
                assert.ok(error);
            }
        });

        it('should execute commands with arguments', async () => {
            const result = await bash('echo "hello world"');
            assert.ok(result.stdout.includes('hello world'));
        });

        it('should handle commands producing large output', async () => {
            const result = await bash('seq 1 1000');
            const lines = result.stdout.trim().split('\n');
            assert.strictEqual(lines.length, 1000);
        });

        it('should handle commands with exit code 0', async () => {
            const result = await bash('true');
            assert.ok(result);
        });

        it('should reject blocked commands containing rm -rf /', async () => {
            await assert.rejects(
                async () => await bash('rm -rf /'),
                /Command blocked/
            );
        });

        it('should reject blocked commands containing shutdown', async () => {
            await assert.rejects(
                async () => await bash('shutdown now'),
                /Command blocked/
            );
        });

        it('should reject blocked commands containing cat /etc/shadow', async () => {
            await assert.rejects(
                async () => await bash('cat /etc/shadow'),
                /Command blocked/
            );
        });

        it('should reject blocked commands containing cat /etc/passwd', async () => {
            await assert.rejects(
                async () => await bash('cat /etc/passwd'),
                /Command blocked/
            );
        });

        it('should reject fork bomb pattern', async () => {
            await assert.rejects(
                async () => await bash(':(){:|:&};:'),
                /Command blocked/
            );
        });

        it('should reject dd if= pattern', async () => {
            await assert.rejects(
                async () => await bash('dd if=/dev/zero of=/dev/sda'),
                /Command blocked/
            );
        });

        it('should handle case-insensitive blocked commands', async () => {
            await assert.rejects(
                async () => await bash('SHUTDOWN now'),
                /Command blocked/
            );
        });

        it('should handle commands with pipes (not blocked by isCommandBlocked)', async () => {
            const result = await bash('echo hello | cat');
            assert.ok(result.stdout.includes('hello'));
        });

        it('should return redacted output', async () => {
            const result = await bash('echo test@test.com');
            assert.ok(!result.stdout.includes('test@test.com'));
            assert.ok(result.stdout.includes('[EMAIL_REDACTED]'));
        });

        it('should handle empty command', async () => {
            try {
                await bash('');
                assert.fail('Should have thrown for empty command');
            } catch (error) {
                assert.ok(error);
            }
        });

        it('should handle command with only whitespace', async () => {
            try {
                await bash('   ');
                assert.fail('Should have thrown');
            } catch (error) {
                assert.ok(error);
            }
        });

        it('should handle multiline commands', async () => {
            const result = await bash('echo line1\necho line2');
            assert.ok(result.stdout.includes('line1'));
        });

        it('should execute pwd and return current directory', async () => {
            const result = await bash('pwd');
            assert.ok(result.stdout.trim().length > 0);
        });

        it('should handle command that produces no output', async () => {
            const result = await bash('true');
            assert.strictEqual(result.stdout, '');
            assert.strictEqual(result.stderr, '');
        });
    });

    describe('BLOCKED_COMMANDS and DESTRUCTIVE_COMMANDS exports', () => {
        it('should export BLOCKED_COMMANDS as an array', () => {
            assert.ok(Array.isArray(BLOCKED_COMMANDS));
            assert.ok(BLOCKED_COMMANDS.length > 0);
        });

        it('should export DESTRUCTIVE_COMMANDS as an array', () => {
            assert.ok(Array.isArray(DESTRUCTIVE_COMMANDS));
            assert.ok(DESTRUCTIVE_COMMANDS.length > 0);
        });

        it('should contain known dangerous patterns in BLOCKED_COMMANDS', () => {
            assert.ok(BLOCKED_COMMANDS.includes('rm -rf /'));
            assert.ok(BLOCKED_COMMANDS.includes('shutdown'));
        });

        it('should contain known destructive patterns in DESTRUCTIVE_COMMANDS', () => {
            assert.ok(DESTRUCTIVE_COMMANDS.includes('rm -rf'));
            assert.ok(DESTRUCTIVE_COMMANDS.includes('git push --force'));
        });
    });
});
