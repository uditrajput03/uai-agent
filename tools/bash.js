import { exec } from 'child_process';
import { redact } from '../utils/redact.js';
import chalk from 'chalk';
import { askQuestion } from '../utils/askQuestion.js';

// ============================================
// SENSITIVE COMMANDS PROTECTION
// ============================================

// List of dangerous commands that should be blocked
const BLOCKED_COMMANDS = [
    'rm -rf /',
    'rm -rf /*',
    'mkfs',
    'dd if=',
    'chmod -R 000',
    'chown -R',
    ':(){:|:&};:',
    'fork bomb',
    'shutdown',
    'reboot',
    'init 0',
    'init 6',
    'halt',
    'poweroff',
    'killall',
    'kill -9 -1',
    'crontab -r',
    'userdel',
    'groupdel',
    'passwd root',
    'iptables -F',
    'ufw disable',
    'eval',
    'exec ',
    'nc -e',
    'bash -i',
    '/dev/tcp/',
    '/dev/udp',
    'chroot',
    'mount --bind',
    'fdisk',
    'parted',
    'sed -i.*/etc',
    'cat /etc/passwd',
    'cat /etc/shadow'
];

// Commands requiring additional confirmation
const DESTRUCTIVE_COMMANDS = [
    'rm -rf',
    'rm -r',
    'rm -f',
    'del',
    'format',
    'truncate',
    'drop database',
    'drop table',
    'delete from',
    'docker rm',
    'docker rmi',
    'docker stop',
    'git reset --hard',
    'git push --force'
];

const SAFE_COMMANDS = new Set([
    'ls', 'dir', 'pwd', 'echo', 'cat', 'head', 'tail',
    'find', 'grep', 'wc'
]);

const DANGEROUS_OPERATORS = [';', '&&', '||', '|', '`', '$(', '>', '>>', '<'];

export async function safeBashApproval(command) {
    let toReturn = { approved: false, reason: '' };
    const trimmedCommand = command.trim();

    // 1. Check for command chaining and file redirection
    const containsDangerousOperators = DANGEROUS_OPERATORS.some(op => trimmedCommand.includes(op));
    const containsExecFlag = trimmedCommand.includes('-exec');

    // 2. DIRECTORY PROTECTION: Check for out-of-bounds path patterns
    const hasDirectoryTraversal = trimmedCommand.includes('../') || trimmedCommand.includes('..\\');

    // Checks for Unix absolute paths (e.g., `cat /etc/passwd` or starting a command with `/bin/sh`)
    const hasUnixAbsolutePath = trimmedCommand.startsWith('/') || trimmedCommand.includes(' /') || trimmedCommand.includes('~/');

    // Checks for Windows absolute paths (e.g., `dir C:\Windows`)
    const hasWindowsAbsolutePath = /[a-zA-Z]:[\\/]/.test(trimmedCommand);

    const isPathOut_of_Bounds = hasDirectoryTraversal || hasUnixAbsolutePath || hasWindowsAbsolutePath;

    // 3. Auto-Approve Logic
    if (!containsDangerousOperators && !containsExecFlag && !isPathOut_of_Bounds) {
        const baseCommand = trimmedCommand.split(' ')[0];

        const isSafeGit = trimmedCommand.startsWith('git status') ||
            trimmedCommand.startsWith('git log') ||
            trimmedCommand.startsWith('git diff');

        if (SAFE_COMMANDS.has(baseCommand) || isSafeGit) {
            toReturn.approved = true;
            toReturn.reason = `Auto-approved safe command: ${trimmedCommand}`;
            console.log(chalk.dim(toReturn.reason));
            return toReturn;
        }
    }

    console.log(chalk.yellow(`\n⚠️ The AI wants to execute a terminal command:`));
    console.log(chalk.cyan(`   $ ${trimmedCommand}`));

    if (isPathOut_of_Bounds) {
        console.log(chalk.red(`   (Flagged: AI is trying to access paths outside the current directory)`));
    }

    const answer = await askQuestion(chalk.yellow('Do you want to allow this command to run? [Y/n]: '));

    if (answer === null || answer.trim().toLowerCase().startsWith('n')) {
        toReturn.reason = `Command execution denied by user.`;
        console.log(chalk.red(`${toReturn.reason}\n`));
        toReturn.approved = false;
        return toReturn;
    }

    console.log(chalk.green(`✓ Command execution granted.\n`));
    return toReturn;
}

// Check if command contains dangerous patterns
function isCommandBlocked(command) {
    const lowerCommand = command.toLowerCase();
    for (const blocked of BLOCKED_COMMANDS) {
        if (lowerCommand.includes(blocked.toLowerCase())) {
            return { blocked: true, pattern: blocked };
        }
    }
    return { blocked: false, pattern: null };
}

// Check if command is potentially destructive
function isDestructive(command) {
    const lowerCommand = command.toLowerCase();
    for (const destructive of DESTRUCTIVE_COMMANDS) {
        if (lowerCommand.includes(destructive.toLowerCase())) {
            return true;
        }
    }
    return false;
}

// Sanitize input - remove dangerous characters
function sanitizeInput(input) {
    return input //TODO
}

export function bash(command, options = {}) {
    // Sanitize input first
    const sanitizedCommand = sanitizeInput(command);

    // Check for blocked commands
    const blockCheck = isCommandBlocked(sanitizedCommand);
    if (blockCheck.blocked) {
        console.error(chalk.red(`\n🔒 Security: Command blocked - contains dangerous pattern '${blockCheck.pattern}'`));
        return Promise.reject(
            new Error(`Command blocked: contains dangerous pattern '${blockCheck.pattern}'`)
        );
    }

    // Check for destructive commands and warn
    if (isDestructive(sanitizedCommand)) {
        console.warn(chalk.yellow(`\n⚠️  Warning: Potentially destructive command detected`));
    }

    // Execute the command
    return new Promise((resolve, reject) => {
        exec(sanitizedCommand, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve({ stdout: redact(stdout), stderr: redact(stderr) });
        });
    });
}

// Export lists for external access
export { BLOCKED_COMMANDS, DESTRUCTIVE_COMMANDS };
