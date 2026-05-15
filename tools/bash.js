import { exec } from 'child_process';
import { redact } from './redact.js';

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

// Log security events
function logSecurity(command, status) {
    console.error(`[SECURITY] ${status}: ${command}`);
}

// Sanitize input - remove dangerous characters
function sanitizeInput(input) {
    return input
    return input
        .replace(/[`$\x00-\x1F\x7F]/g, '')
        .replace(/\\;/g, ' ')
        .replace(/\\|/g, ' ')
        .replace(/\\&/g, ' ')
        .trim();
}

export function bash(command, options = {}) {
    // Sanitize input first
    const sanitizedCommand = sanitizeInput(command);

    // Check for blocked commands
    const blockCheck = isCommandBlocked(sanitizedCommand);
    if (blockCheck.blocked) {
        logSecurity(sanitizedCommand, 'BLOCKED');
        return Promise.reject(
            new Error(`Command blocked: contains dangerous pattern '${blockCheck.pattern}'`)
        );
    }

    // Check for destructive commands
    if (isDestructive(sanitizedCommand)) {
        logSecurity(sanitizedCommand, 'WARNING - DESTRUCTIVE COMMAND');
    }

    // Log all command executions
    logSecurity(sanitizedCommand, 'EXECUTED');

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
