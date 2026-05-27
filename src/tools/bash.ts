import { execFile } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import { askQuestion } from '../utils/askQuestion.js';
import { redact } from '../utils/redact.js';
import { resolveWorkspacePath } from '../utils/pathSecurity.js';

const execFileAsync = promisify(execFile);

const BLOCKED_COMMANDS = [
    'rm -rf /', 'rm -rf /*', 'mkfs', 'dd if=', 'chmod -R 000', 'chown -R',
    ':(){:|:&};:', 'fork bomb', 'shutdown', 'reboot', 'init 0', 'init 6',
    'halt', 'poweroff', 'killall', 'kill -9 -1', 'crontab -r', 'userdel',
    'groupdel', 'passwd root', 'iptables -F', 'ufw disable', 'eval', 'exec ',
    'nc -e', 'bash -i', '/dev/tcp/', '/dev/udp', 'chroot', 'mount --bind',
    'fdisk', 'parted', 'sed -i.*/etc', 'cat /etc/passwd', 'cat /etc/shadow'
];

const DESTRUCTIVE_COMMANDS = [
    'rm -rf', 'rm -r', 'rm -f', 'del', 'format', 'truncate', 'drop database',
    'drop table', 'delete from', 'docker rm', 'docker rmi', 'docker stop',
    'git reset --hard', 'git push --force'
];

const ALLOWED_COMMANDS = new Set([
    'ls', 'dir', 'pwd', 'echo', 'cat', 'head', 'tail', 'find', 'grep', 'wc',
    'git', 'npm', 'node', 'true', 'false', 'seq'
]);

const AUTO_SAFE_COMMANDS = new Set(['ls', 'dir', 'pwd', 'echo', 'cat', 'head', 'tail', 'find', 'grep', 'wc', 'true', 'seq']);
const SHELL_METACHARS = /[;&|`$<>\n\r]/;
const WINDOWS_ABSOLUTE_PATH = /^[A-Za-z]:/;
const ABSOLUTE_PATH_SEGMENT = /(^|[\s:=])\/(?!\/)/;
const TRAVERSAL_SEGMENT = /(^|[\\/])\.\.([\\/]|$)/;

function  tokenize(command: string) {
    const tokens = [];
    let current = '';
    let quote = null;
    let escaped = false;

    for (const char of command.trim()) {
        if (escaped) {
            current += char;
            escaped = false;
            continue;
        }

        if (char === '\\') {
            escaped = true;
            continue;
        }

        if (quote) {
            if (char === quote) quote = null;
            else current += char;
            continue;
        }

        if (char === '"' || char === "'") {
            quote = char;
            continue;
        }

        if (/\s/.test(char)) {
            if (current) {
                tokens.push(current);
                current = '';
            }
            continue;
        }

        current += char;
    }

    if (escaped) current += '\\';
    if (quote) return { ok: false, reason: 'Command blocked: unterminated quote' } as const;
    if (current) tokens.push(current);
    return { ok: true, tokens } as const;
}

function isCommandBlocked(command: string) {
    const lower = command.toLowerCase();
    for (const blocked of BLOCKED_COMMANDS) {
        if (lower.includes(blocked.toLowerCase())) return { blocked: true, pattern: blocked };
    }
    return { blocked: false, pattern: null };
}

function isDestructive(command: string) {
    const lower = command.toLowerCase();
    return DESTRUCTIVE_COMMANDS.some(pattern => lower.includes(pattern.toLowerCase()));
}

function tokenContainsUnsafePath(token: string) {
    return token.startsWith('~')
        || token.includes('~/')
        || token.includes('~\\')
        || WINDOWS_ABSOLUTE_PATH.test(token)
        || ABSOLUTE_PATH_SEGMENT.test(token)
        || TRAVERSAL_SEGMENT.test(token)
        || token.includes('../')
        || token.includes('..\\');
}

function validateWorkspacePathToken(token: string): { ok: true } | { ok: false, reason: string } {
    // Plain paths can be resolved directly. Embedded paths (e.g. --file=/tmp/x,
    // script snippets, URLs) are rejected instead of trying to parse intent.
    const looksPlainPath = token.startsWith('/') || token.startsWith('../') || token.startsWith('..\\')
        || token.startsWith('~/') || token.startsWith('~\\') || WINDOWS_ABSOLUTE_PATH.test(token);

    if (looksPlainPath) {
        const pathCheck = WINDOWS_ABSOLUTE_PATH.test(token)
            ? { ok: false, reason: `Path outside workspace is not allowed: ${token}` }
            : resolveWorkspacePath(token, { requireParent: false });
        if (!pathCheck.ok) return { ok: false, reason: pathCheck.reason || "Invalid workspace path" };
        return { ok: true };
    }

    if (tokenContainsUnsafePath(token)) {
        return { ok: false, reason: `Command blocked: argument contains an unsafe path: ${token}` };
    }
    return { ok: true };
}

function validateCommandSpecificRules(base: string, args: string[]): { ok: true } | { ok: false, reason: string } {
    if (base === 'node') {
        const forbidden = new Set(['-e', '--eval', '-p', '--print', '--input-type']);
        const hasEval = args.some(arg => forbidden.has(arg) || arg.startsWith('--eval=') || arg.startsWith('--print='));
        if (hasEval) return { ok: false, reason: 'Command blocked: node eval/print modes are not allowed' };
    }

    if (base === 'find') {
        const forbidden = new Set(['-exec', '-execdir', '-delete', '-ok', '-okdir']);
        if (args.some(arg => forbidden.has(arg))) {
            return { ok: false, reason: 'Command blocked: dangerous find action is not allowed' };
        }
    }

    if (base === 'git') {
        const forbidden = ['push', 'reset', 'clean', 'rebase', 'filter-branch'];
        if (args.some(arg => forbidden.includes(arg))) {
            return { ok: false, reason: `Command blocked: git ${args.find(arg => forbidden.includes(arg))} is not allowed` };
        }
    }

    if (base === 'npm') {
        const allowedNpm = new Set(['test', '--version', '-v', 'version', 'list', 'ls', 'view', 'audit']);
        const subcommand = args.find(arg => !arg.startsWith('-'));
        if (subcommand && !allowedNpm.has(subcommand)) {
            return { ok: false, reason: `Command blocked: npm ${subcommand} is not allowed` };
        }
    }

    return { ok: true };
}

function validateCommand(command: string): { ok: true, tokens: string[] } | { ok: false, reason: string } {
    if (typeof command !== 'string' || command.trim() === '') {
        return { ok: false, reason: 'Command must be a non-empty string' };
    }

    const block = isCommandBlocked(command);
    if (block.blocked) return { ok: false, reason: `Command blocked: contains dangerous pattern '${block.pattern}'` };
    if (SHELL_METACHARS.test(command)) return { ok: false, reason: 'Command blocked: shell operators/redirection are not allowed' };

    const parsed = tokenize(command);
    if (!parsed.ok) return parsed;

    const tokens = parsed.tokens;
    if (tokens.length === 0) return { ok: false, reason: 'Command must be a non-empty string' };

    const [base, ...args] = tokens;
    if (base?.includes('/') || base?.includes('\\') || base?.startsWith('.')) {
        return { ok: false, reason: 'Command blocked: executable path is not allowed' };
    }
    if (!ALLOWED_COMMANDS.has(base!)) return { ok: false, reason: `Command not on allowlist: ${base}` };

    const commandRules = validateCommandSpecificRules(base!, args);
    if (!commandRules.ok) return commandRules;

    for (const token of args) {
        if (token === '.' || token === './') continue;
        const pathValidation = validateWorkspacePathToken(token);
        if (!pathValidation.ok) return pathValidation;
    }

    return { ok: true, tokens };
}

export async function safeBashApproval(command: string) {
    const validation = validateCommand(command);
    if (!validation.ok) return { approved: false, reason: validation.reason };

    const base = validation.tokens[0];
    const isSafeGit = command.startsWith('git status') || command.startsWith('git log') || command.startsWith('git diff');
    const autoSafe = AUTO_SAFE_COMMANDS.has(base!) || isSafeGit;
    if (autoSafe && !isDestructive(command)) {
        return { approved: true, reason: `Auto-approved safe command: ${command.trim()}` };
    }

    console.log(chalk.yellow(`\n⚠️ The AI wants to execute a terminal command:`));
    console.log(chalk.cyan(`   $ ${command.trim()}`));
    if (isDestructive(command)) console.log(chalk.yellow('   (Potentially destructive command)'));

    const answer = await askQuestion(chalk.yellow('Do you want to allow this command to run? [Y/n]: '));
    if (answer === null || answer.trim().toLowerCase().startsWith('n')) {
        return { approved: false, reason: 'Command execution denied by user.' };
    }
    return { approved: true, reason: 'Command execution granted by user.' };
}

const SENSITIVE_ENV_KEYS = /(^|_)(KEY|TOKEN|SECRET|PASSWORD|PASS|CREDENTIAL|AUTH|COOKIE)(_|$)/i;

function getSafeEnvironment() {
    return Object.fromEntries(
        Object.entries(process.env).filter(([key]) => !SENSITIVE_ENV_KEYS.test(key))
    );
}

export async function bash(command: string, options: { timeout?: number; maxBuffer?: number } = {}) {
    const validation = validateCommand(command);
    if (!validation.ok) throw new Error(validation.reason);

    const [file, ...args] = validation.tokens;
    const { stdout, stderr } = await execFileAsync(file!, args, {
        cwd: process.cwd(),
        env: getSafeEnvironment(),
        timeout: options.timeout ?? 30000,
        maxBuffer: options.maxBuffer ?? 1024 * 1024 * 10,
        shell: false,
    });
    return { stdout: redact(stdout), stderr: redact(stderr) };
}

export { BLOCKED_COMMANDS, DESTRUCTIVE_COMMANDS, validateCommand };
