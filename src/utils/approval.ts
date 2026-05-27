import chalk from 'chalk';
import { autoApprove } from '../config.js';
import { askQuestion } from './askQuestion.js';
import { keys } from '../config/keys.js';
import { isGitignored, resolveWorkspacePath } from './pathSecurity.js';
import type { FinalToolCall } from '../index.js';

export async function getApprovalRequirements(toolCalls: FinalToolCall[] = []) {
    const mode = autoApprove.default;
    if (mode === 'allow') return { execApproval: false, sendingApproval: false };
    if (mode === 'block') return { execApproval: true, sendingApproval: true };

    if (mode === 'manual') {
        return {
            execApproval: toolCalls.some(call => {
                let config = autoApprove[call.function?.name as keyof typeof autoApprove] as { promptExecution?: boolean } | undefined;
                return config?.promptExecution === true
            }),
            sendingApproval: toolCalls.some(call => {
                let config = autoApprove[call.function?.name as keyof typeof autoApprove] as { promptSending?: boolean } | undefined;
                return config?.promptSending === true
            }),
        };
    }

    if (mode === 'auto') {
        const hasBash = toolCalls.some(call => call.function?.name === 'bash');
        let hasUnsafePath = false;

        for (const call of toolCalls) {
            try {
                const input = JSON.parse(call.function?.arguments || '{}');
                if (input.filePath) {
                    const approval = await safePathApproval(input.filePath, true);
                    if (!approval.status) {
                        hasUnsafePath = true;
                        break;
                    }
                }
            } catch {
                hasUnsafePath = true;
                break;
            }
        }

        return { execApproval: hasBash, sendingApproval: hasBash || hasUnsafePath };
    }

    console.log(chalk.yellow('⚠ Unknown approval mode, requiring approval.'));
    return { execApproval: true, sendingApproval: true };
}

export async function safePathApproval(filePath: string, noPrompt = false) {
    const resolved = resolveWorkspacePath(filePath);
    const denied = { status: false, reason: resolved.reason };

    if (!resolved.ok) {
        // Do not allow bypassing workspace boundaries. User approval must never override sandboxing.
        return denied;
    }

    if (isGitignored(resolved.realPath!) && keys?.gitIgnoreUnsafePaths) {
        const reason = `Path is marked as unsafe by .gitignore: ${filePath}`;
        if (noPrompt) return { status: false, reason };

        const answer = await askQuestion(chalk.yellow(`\n⚠️  Marked as unsafe by .gitignore. File: ${filePath}\nDo you want to allow this? [y/N]: `));
        if (answer?.trim().toLowerCase().startsWith('y')) {
            return { status: true, reason: `Access granted by user despite .gitignore match: ${filePath}` };
        }
        return { status: false, reason: `Access denied due to .gitignore match: ${filePath}` };
    }

    return { status: true, reason: `Path is within working directory: ${filePath}` };
}
