import chalk from "chalk";
import { autoApprove } from "../config.js";
import path from "path";
import fs from "fs";
import { askQuestion } from "./askQuestion.js";
import { keys } from "../config/keys.js";

function parseGitignore(gitignorePath) {
    const patterns = [];
    if (!fs.existsSync(gitignorePath)) {
        return patterns;
    }

    const content = fs.readFileSync(gitignorePath, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }
        patterns.push(trimmed);
    }

    return patterns;
}

function matchGitignorePattern(filePath, pattern, cwd) {
    const relativePath = path.relative(cwd, filePath);
    const basename = path.basename(filePath);

    // Handle directory patterns (ending with /)
    if (pattern.endsWith('/')) {
        const dirPattern = pattern.slice(0, -1);
        if (relativePath === dirPattern || relativePath.startsWith(dirPattern + '/') ||
            relativePath.includes('/' + dirPattern + '/') || relativePath.endsWith('/' + dirPattern)) {
            return true;
        }
        // Check if any part of the path matches the directory pattern
        const pathParts = relativePath.split('/');
        if (pathParts.includes(dirPattern)) {
            return true;
        }
    }

    // Handle wildcard patterns
    if (pattern.includes('*')) {
        const regexPattern = pattern
            .replace(/\./g, '\\.')
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*');
        const regex = new RegExp(`^${regexPattern}$`);
        if (regex.test(relativePath) || regex.test(basename)) {
            return true;
        }
        // Also check with ** for any path depth
        const doubleStarPattern = pattern.replace(/\*/g, '.*');
        const doubleStarRegex = new RegExp(`^${doubleStarPattern}$`);
        if (doubleStarRegex.test(relativePath)) {
            return true;
        }
    }

    // Handle exact matches
    if (relativePath === pattern || basename === pattern) {
        return true;
    }

    // Handle patterns without leading slash (match anywhere in path)
    if (!pattern.startsWith('/')) {
        if (relativePath.endsWith('/' + pattern) || relativePath === pattern) {
            return true;
        }
        // Check if pattern matches any file in subdirectories
        const pathParts = relativePath.split('/');
        for (let i = 0; i < pathParts.length; i++) {
            const subpath = pathParts.slice(i).join('/');
            if (subpath === pattern || subpath.startsWith(pattern + '/')) {
                return true;
            }
        }
    }

    return false;
}

function isPathInGitignore(filePath, cwd) {
    const gitignorePath = path.join(cwd, '.gitignore');
    const patterns = parseGitignore(gitignorePath);

    for (const pattern of patterns) {
        if (matchGitignorePattern(filePath, pattern, cwd)) {
            return true;
        }
    }

    return false;
}

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
        // In manual mode, prompt only for tools explicitly configured to require it.
        // promptExecution: true  → ask before running
        // promptSending:   true  → ask before sending result to AI
        return {
            execApproval: toolCalls.some(call => autoApprove[call.function.name]?.promptExecution === true),
            sendingApproval: toolCalls.some(call => autoApprove[call.function.name]?.promptSending === true)
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
                        // console.log(approval);
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
        // Check if the path matches any pattern in .gitignore
        if (isPathInGitignore(resolvedPath, cwd) && keys?.gitIgnoreUnsafePaths) {
            toReturn.reason = `✗ STRICTLY Rule Path or file is marked as Unsafe and Sensitive do not access it. (matches .gitignore pattern): ${filepath}`;
            //ask for approval
            if (!noPrompt) {
                const answer = await askQuestion(chalk.yellow(`\n⚠️  Marked as unsafe by .gitignore. File: ${filepath} \nDo you want to allow this? [enter/n]: `));
                if (answer.startsWith('y') || answer === '') {
                    console.log(chalk.green(`✓ Access granted by user despite .gitignore match.\n`));
                    toReturn.status = true;
                    toReturn.reason = `✓ Access granted by user despite .gitignore match: ${filepath}`;
                } else {
                    console.log(chalk.red(`✗ Access denied by user due to .gitignore match.\n`));
                }
            }
            return toReturn;
        }

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