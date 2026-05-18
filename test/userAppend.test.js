import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { parseCommands, addUserContext } from '../utils/userAppend.js';

describe('userAppend', () => {
    const testDir = path.join('test', '_temp_userappend');
    let originalCwd;

    beforeEach(() => {
        fs.rmSync(testDir, { recursive: true, force: true });
        fs.mkdirSync(testDir, { recursive: true });
        originalCwd = process.cwd();
        process.chdir(testDir);
    });

    afterEach(() => {
        process.chdir(originalCwd);
        fs.rmSync(testDir, { recursive: true, force: true });
    });

    it('parses workspace and relative file references', () => {
        assert.deepStrictEqual(parseCommands('Check @workspace and @./a.txt'), ['workspace', './a.txt']);
        assert.deepStrictEqual(parseCommands('Read @.\\a.txt'), ['.\\a.txt']);
    });

    it('does not treat email addresses as context commands', () => {
        assert.deepStrictEqual(parseCommands('mail user@example.com'), []);
    });

    it('returns empty context when there are no commands', async () => {
        assert.strictEqual(await addUserContext('hello'), '');
    });

    it('adds workspace context', async () => {
        const result = await addUserContext('show @workspace');
        assert.match(result, /Context:/);
        assert.match(result, /Workspace:/);
    });

    it('adds file context for safe relative files', async () => {
        fs.writeFileSync('a.txt', 'content A');
        const result = await addUserContext('read @./a.txt');
        assert.match(result, /File: \.\/a.txt/);
        assert.match(result, /content A/);
    });

    it('includes safe error text for missing files', async () => {
        const result = await addUserContext('read @./missing.txt');
        assert.match(result, /File:/);
        assert.match(result, /Error reading file|ENOENT/);
    });

    it('strips trailing punctuation from file references', () => {
        assert.deepStrictEqual(parseCommands('Read @./a.txt, then continue'), ['./a.txt']);
        assert.deepStrictEqual(parseCommands('Read (@./a.txt).'), ['./a.txt']);
    });

    it('does not read parent traversal paths', async () => {
        const result = await addUserContext('read @../secret.txt');
        assert.match(result, /outside workspace/);
    });
});
