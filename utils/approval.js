import chalk from "chalk";
import { autoApprove } from "../config.js";
import path from "path";
import fs from "fs";
import { askQuestion } from "./askQuestion.js";

export async function getApprovalRequirements(toolCalls) {
    let mode = autoApprove.default;
    if (mode === 'allow') {
        console.log(chalk.green('✓ Auto-approving all tool calls (allow mode).'));
        return { execApproval: false, sendingApproval: false };
    }

    if (mode === 'block') {
        console.log(chalk.red('✗ Auto-blocking all tool calls (block mode).'));
        return { execApproval: true, sendingApproval: true };
    }

    if (mode === 'manual') {
        return {
            execApproval: toolCalls.some(call => autoApprove[call.function.name]?.execution === false),
            sendingApproval: toolCalls.some(call => autoApprove[call.function.name]?.sending === false)
        };
    }
    if (mode === 'auto') { //block bash command
        const hasBash = toolCalls.some(call => call.function.name === 'bash');
        let hasUnsafePath = false;

        for (const call of toolCalls) {
            try {
                const input = JSON.parse(call.function.arguments || '{}');
                const filePath = input.filePath;
                if (filePath) {
                    const approval = await safePathApproval(filePath, true);
                    if (!approval.status) {
                        console.log(approval);
                        hasUnsafePath = true;
                        break; // Short-circuit: stop checking further calls
                    }
                }
            } catch (e) {
                hasUnsafePath = true;
                break; // Short-circuit on parse failure
            }
        }

        return {
            execApproval: hasBash,
            sendingApproval: hasBash || hasUnsafePath,
        };
    }

    // Failsafe: If mode is missing or invalid, default to blocking everything
    console.log(chalk.yellow('⚠ Unknown approval mode, defaulting to block.'));
    return { execApproval: false, sendingApproval: false };
}

export async function safePathApproval(filepath, noPrompt = false) {
    const cwd = process.cwd();
    const resolvedPath = path.resolve(filepath);
    let toReturn = { status: false, reason: '' };
    let truePath;
    try {
        if (fs.existsSync(resolvedPath)) {
            truePath = fs.realpathSync(resolvedPath);
        } else {
            const parentDir = path.dirname(resolvedPath);
            truePath = path.join(fs.realpathSync(parentDir), path.basename(resolvedPath));
        }
    } catch (err) {
        toReturn.reason = `✗ Invalid path or parent directory missing: ${filepath}`;
        console.log(chalk.red(toReturn.reason));
        return toReturn;
    }

    const isWithinCwd = truePath === cwd || truePath.startsWith(cwd + path.sep);

    if (isWithinCwd) {
        toReturn.status = true;
        toReturn.reason = `✓ Path is within working directory: ${filepath}`;
        return toReturn; // Path is safe, automatic approval
    }

    // --- OUT OF BOUNDS: Ask for user permission ---
    console.log(chalk.yellow(`\n⚠️ The AI wants to access a file outside the working directory:`));
    console.log(chalk.yellow(`   Target: ${filepath}`));

    if (noPrompt) {
        toReturn.reason = `✗ Access denied (noPrompt=true) for out-of-bounds path: ${filepath}`;
        console.log(chalk.red(toReturn.reason));
        return toReturn;
    }
    // Using [Y/n] convention (Capital Y means default is yes)
    const answer = await askQuestion(chalk.cyan('Do you want to allow this? [Y/n]: '));

    // Handle Ctrl+C (null) or explicitly typing something starting with 'n' or 'N'
    if (answer === null || answer.trim().toLowerCase().startsWith('n')) {
        toReturn.reason = `✗ Access denied by user: ${filepath}`;
        console.log(chalk.red(toReturn.reason));
        return toReturn;
    }

    // Anything else (Enter, 'y', 'yes', 'sure') returns true
    console.log(chalk.green(`✓ Access granted by user.\n`));
    toReturn.status = true;
    toReturn.reason = `✓ Access granted by user: ${filepath}`;
    return toReturn;
}