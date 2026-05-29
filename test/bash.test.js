import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { bash, safeBashApproval, validateCommand, BLOCKED_COMMANDS, DESTRUCTIVE_COMMANDS } from '../src/tools/bash.ts';

function assertInvalid(command, pattern) {
    const result = validateCommand(command);
    assert.strictEqual(result.ok, false, `${command} should be invalid`);
    if (pattern) assert.match(result.reason, pattern);
}

function assertValid(command) {
    const result = validateCommand(command);
    assert.strictEqual(result.ok, true, `${command} should be valid: ${result.reason}`);
    return result;
}

describe('bash security and execution', () => {
    const testDir = path.join('test', '_temp_bash');
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
        delete global.__MOCK_ASK_ANSWER;
    });

    it('executes simple allowlisted commands without a shell', async () => {
        const result = await bash('echo hello');
        assert.match(result.stdout, /hello/);
    });

    it('supports quoted arguments and preserves spaces', async () => {
        const validation = assertValid('echo "hello world"');
        assert.deepStrictEqual(validation.tokens, ['echo', 'hello world']);
        const result = await bash('echo "hello world"');
        assert.match(result.stdout, /hello world/);
    });

    it('supports escaped spaces', () => {
        const validation = assertValid('echo hello\\ world');
        assert.deepStrictEqual(validation.tokens, ['echo', 'hello world']);
    });

    it('rejects empty commands and malformed quoting', async () => {
        await assert.rejects(() => bash('   '), /non-empty/);
        assertInvalid('echo "unterminated', /unterminated quote/);
    });

    it('rejects blocked dangerous patterns case-insensitively', async () => {
        await assert.rejects(() => bash('rm -rf /'), /Command blocked/);
        await assert.rejects(() => bash('SHUTDOWN now'), /Command blocked/);
        await assert.rejects(() => bash('cat /etc/shadow'), /Command blocked/);
        await assert.rejects(() => bash(':(){:|:&};:'), /Command blocked|shell operators/);
        await assert.rejects(() => bash('dd if=/dev/zero of=file'), /Command blocked/);
    });

    it('rejects shell operators, redirects, substitution, and multiline commands', async () => {
        const commands = [
            'echo hello | cat',
            'echo one; echo two',
            'echo ok && echo no',
            'echo ok || echo no',
            'echo $(pwd)',
            'echo `pwd`',
            'echo hi > out.txt',
            'cat < in.txt',
            'echo line1\necho line2'
        ];
        for (const command of commands) {
            await assert.rejects(() => bash(command), /shell operators/);
        }
    });

    it('rejects commands outside the allowlist and executable paths', () => {
        assertInvalid('curl example.com', /allowlist/);
        assertInvalid('/bin/echo hello', /executable path|allowlist/);
        assertInvalid('./script.sh', /executable path/);
    });

    it('allows workspace relative path arguments', async () => {
        fs.writeFileSync('file.txt', 'workspace content');
        assertValid('cat ./file.txt');
        const result = await bash('cat ./file.txt');
        assert.strictEqual(result.stdout, 'workspace content');
    });

    it('rejects absolute, parent traversal, home, and windows absolute path arguments', () => {
        assertInvalid('cat /etc/passwd', /Command blocked|outside workspace/);
        assertInvalid('cat ../secret.txt', /outside workspace/);
        assertInvalid('cat ~/.ssh/id_rsa', /outside workspace|unsafe path/);
        assertInvalid('cat C:/Windows/win.ini', /outside workspace|unsafe path/);
    });

    it('rejects embedded unsafe paths in option values and snippets', () => {
        assertInvalid('grep secret --include=/etc/passwd', /unsafe path/);
        assertInvalid('node script.js --config=../secret.json', /unsafe path/);
        assertInvalid('echo prefix/../../secret', /unsafe path/);
    });

    it('rejects dangerous find actions even without shell operators', () => {
        assertInvalid('find . -exec echo {}', /dangerous find|dangerous pattern/);
        assertInvalid('find . -delete', /dangerous find/);
        assertInvalid('find . -execdir echo {}', /dangerous find|dangerous pattern/);
    });

    it('rejects node inline code execution modes', () => {
        assertInvalid('node -e "console.log(1)"', /node eval/);
        assertInvalid('node --eval=console.log(1)', /node eval|dangerous pattern/);
        assertInvalid('node -p process.cwd()', /node eval/);
    });

    it('rejects dangerous git operations and allows read-only git commands', async () => {
        assertInvalid('git push origin main', /git push/);
        assertInvalid('git reset --hard', /Command blocked|git reset/);
        assertInvalid('git clean -fd', /git clean/);
        assertValid('git status');
        const approval = await safeBashApproval('git status');
        assert.strictEqual(approval.approved, true);
    });

    it('restricts npm to low-risk subcommands', () => {
        assertValid('npm test');
        assertValid('npm --version');
        assertInvalid('npm install left-pad', /npm install/);
        assertInvalid('npm run build', /npm run/);
    });

    it('auto-approves safe read-only commands', async () => {
        const approval = await safeBashApproval('echo hello');
        assert.strictEqual(approval.approved, true);
    });

    it('denies invalid commands before prompting', async () => {
        global.__MOCK_ASK_ANSWER = 'y';
        const approval = await safeBashApproval('rm -rf /');
        assert.strictEqual(approval.approved, false);
        assert.match(approval.reason, /Command blocked/);
    });

    it('prompts for non-auto-safe allowlisted commands and respects denial', async () => {
        global.__MOCK_ASK_ANSWER = 'n';
        const approval = await safeBashApproval('npm test');
        assert.strictEqual(approval.approved, false);
        assert.match(approval.reason, /denied/);
    });

    it('returns stderr/stdout from executed commands and propagates failures', async () => {
        const ok = await bash('true');
        assert.strictEqual(ok.stdout, '');
        assert.strictEqual(ok.stderr, '');
        await assert.rejects(() => bash('false'));
    });

    it('does not pass sensitive environment variables to child commands', async () => {
        process.env.SECRET_TOKEN = 'super-secret-value';
        fs.writeFileSync('env-check.js', "if (!process.env.SECRET_TOKEN) { throw new Error('SECRET_TOKEN missing'); }\nconsole.log(process.env.SECRET_TOKEN);");
        try {
            await assert.rejects(() => bash('node ./env-check.js'), /SECRET_TOKEN missing/);
        } finally {
            delete process.env.SECRET_TOKEN;
        }
    });

    it('exports security pattern lists', () => {
        assert.ok(BLOCKED_COMMANDS.includes('rm -rf /'));
        assert.ok(DESTRUCTIVE_COMMANDS.includes('git push --force'));
    });
});
