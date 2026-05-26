import { execFileSync } from 'child_process';
import { readFile } from '../tools/fsOps.js';
import { redact } from './redact.js';
import { safePathApproval } from './approval.js';

export function parseCommands(string = '') {
    const regex = /(?:^|[\s(])@((?:workspace)|(?:\.\.?[\/\\][^\s),;:!?]+))/g;
    return Array.from(string.matchAll(regex), match => match[1].replace(/[),.;:!?]+$/, ''));
}

export async function addUserContext(string = '') {
    let context = '';
    const commands = parseCommands(string);
    if (commands.length > 0) context += 'Context: \n';

    for (const command of commands) {
        if (command === 'workspace') {
            try {
                const toolResult = execFileSync('ls', ['-la'], { encoding: 'utf-8', timeout: 10000, cwd: process.cwd() });
                context += `Workspace: ls -la \n${toolResult}\n`;
            } catch (error) {
                context += `Workspace: ls -la \nError: ${error.message}\n`;
            }
            continue;
        }

        if (command.startsWith('./') || command.startsWith('.\\') || command.startsWith('../') || command.startsWith('..\\')) {
            const approval = await safePathApproval(command, true);
            const toolResult = approval.status ? readFile(command) : approval.reason;
            context += `File: ${command}\n${toolResult}\n`;
        }
    }

    return redact(context);
}
