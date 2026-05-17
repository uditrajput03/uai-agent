import chalk from "chalk";
import { autoApprove } from "../config.js";

export function getApprovalRequirements(toolCalls) {
    let mode = autoApprove.default;
    if (mode === 'allow') {
        console.log(chalk.green('✓ Auto-approving all tool calls (allow mode).'));
        return { execApproval: false, sendingApproval: false };
    }

    if (mode === 'block') {
        console.log(chalk.red('✗ Auto-blocking all tool calls (block mode).'));
        return { execApproval: true, sendingApproval: true };
    }

    if (mode === 'auto') {
        return {
            execApproval: toolCalls.some(call => autoApprove[call.function.name]?.execution === false),
            sendingApproval: toolCalls.some(call => autoApprove[call.function.name]?.sending === false)
        };
    }

    // Failsafe: If mode is missing or invalid, default to blocking everything
    console.log(chalk.yellow('⚠ Unknown approval mode, defaulting to block.'));
    return { execApproval: false, sendingApproval: false };
}