import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import { askQuestion, closeReadline } from './askQuestion.js';
import { models } from '../config.js';
import { search } from '@inquirer/prompts';

export function clearConversation(msgArray) {
    msgArray.length = 1;
    console.log(chalk.green('✓ Conversation history cleared.'));
    console.log('');
}

export function rewindConversation(msgArray) {
    let removedCount = 0;
    let toolMessagesRemoved = 0;

    let initialLength = msgArray.length;

    // Edge case: only system prompt remains
    if (msgArray.length <= 1) {
        console.log(chalk.yellow('⚠ Nothing to rewind (only system prompt remains).'));
        console.log('');
        return;
    }

    // Strategy: Work backwards to find and remove the last complete exchange
    // A complete exchange is: user message → assistant response (possibly with tool calls)
    // If there were tool calls, the pattern is: user → assistant(tool_calls) → tool → assistant(final)

    let i = initialLength - 1;

    // Step 1: Remove trailing tool messages and assistant messages until we find a user message
    // We need to remove everything after the last user message
    while (i > 0) {
        const msg = msgArray[i];

        if (msg.role === 'tool') {
            msgArray.splice(i, 1);
            toolMessagesRemoved++;
            removedCount++;
            i--;
        } else if (msg.role === 'assistant') {
            msgArray.splice(i, 1);
            removedCount++;
            i--;
        } else if (msg.role === 'user') {
            // Found the last user message - remove it and stop
            msgArray.splice(i, 1);
            removedCount++;
            break;
        } else {
            // Hit system message or something else, stop
            break;
        }
    }

    // Provide detailed feedback
    if (removedCount > 0) {
        let message = `✓ Rewound ${removedCount} message(s).`;
        if (toolMessagesRemoved > 0) {
            message += ` (including ${toolMessagesRemoved} tool response${toolMessagesRemoved > 1 ? 's' : ''})`;
        }
        console.log(chalk.green(message));
    } else {
        console.log(chalk.yellow('⚠ Nothing to rewind.'));
    }
    console.log('');
}

export async function exportConversation(msgArray, provider, model, __dirname) {
    // Include user, assistant, and tool messages
    const chatMessages = msgArray.filter(msg => msg.role === 'user' || msg.role === 'assistant' || msg.role === 'tool');

    if (chatMessages.length === 0) {
        console.log(chalk.yellow('⚠ No conversation to export.'));
        console.log('');
        return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    let markdown = `# Chat Export - ${new Date().toLocaleString()}\n\n`;
    markdown += `**Provider:** ${provider} | **Model:** ${model}\n\n`;
    markdown += `---\n\n`;

    for (const msg of chatMessages) {
        if (msg.role === 'user') {
            markdown += `## 👤 User\n\n${msg.content}\n\n`;
        } else if (msg.role === 'assistant') {
            markdown += `## 🤖 Assistant\n\n`;
            if (msg.content) {
                markdown += `${msg.content}\n\n`;
            }
            if (msg.tool_calls && msg.tool_calls.length > 0) {
                markdown += `**⚡ Tool Calls:**\n\n`;
                for (const toolCall of msg.tool_calls) {
                    markdown += `- **Tool:** \`${toolCall.function?.name || 'unknown'}\`\n`;
                    markdown += `  **Arguments:** \`\`\`json\n${toolCall.function?.arguments || ''}\n\`\`\`\n`;
                }
                markdown += `\n`;
            }
        } else if (msg.role === 'tool') {
            markdown += `## 🔧 Tool Response\n\n`;
            markdown += `**Tool Call ID:** \`${msg.tool_call_id}\`\n\n`;
            markdown += `\`\`\`\n${msg.content}\n\`\`\`\n\n`;
        }
        markdown += `---\n\n`;
    }

    const defaultFilename = `chat-export-${timestamp}.md`;
    const filenameInput = await askQuestion(chalk.yellow(`Enter filename (default: ${defaultFilename}): `));
    const rawFilename = filenameInput?.trim() || defaultFilename;
    const safeBaseName = path.basename(rawFilename).replace(/[\\/]/g, '') || defaultFilename;
    const finalFilename = safeBaseName.endsWith('.md') ? safeBaseName : `${safeBaseName}.md`;

    try {
        const exportPath = path.join(__dirname, finalFilename);
        fs.writeFileSync(exportPath, markdown, 'utf-8');
        console.log(chalk.green(`✓ Chat history exported to: ${finalFilename}`));
    } catch (error) {
        console.error(chalk.red('✗ Error exporting chat history:'), error.message);
    }
    console.log('');
}

export function exitAgent() {
    console.log('\n' + chalk.cyan('👋 Goodbye!') + '\n');
    closeReadline();
    process.exit(0);
}

export function getSessionsDir(projectRoot) {
    return path.resolve(projectRoot, '.uai', 'sessions');
}

export function saveSession(msgArray, projectRoot, sessionName = 'session.json') {
    const sessionsDir = getSessionsDir(projectRoot);
    if (!fs.existsSync(sessionsDir)) {
        fs.mkdirSync(sessionsDir, { recursive: true });
    }
    const sessionPath = path.join(sessionsDir, sessionName);
    fs.writeFileSync(sessionPath, JSON.stringify(msgArray, null, 2), 'utf-8');
}

export async function saveSessionCommand(msgArray, projectRoot, sessionName = 'session.json') {
    const filenameInput = await askQuestion(chalk.yellow(`Enter session name (default: ${sessionName}): `));
    const rawFilename = filenameInput?.trim() || sessionName;
    const safeBaseName = path.basename(rawFilename).replace(/[\\/]/g, '') || sessionName;
    const finalFilename = safeBaseName.endsWith('.json') ? safeBaseName : `${safeBaseName}.json`;

    try {
        saveSession(msgArray, projectRoot, finalFilename);
        console.log(chalk.green(`✓ Session saved successfully to .uai/sessions/${finalFilename}.`));
    } catch (err) {
        console.error(chalk.red('✗ Error saving session:'), err.message);
    }
    console.log('');
}

export function showHelp() {
    console.log('\n' + chalk.bold.yellow('⌨  Help & Commands:'));
    console.log('  ' + chalk.cyan('/help') + '     ' + chalk.dim('Show this help message'));
    console.log('  ' + chalk.cyan('/clear') + '    ' + chalk.dim('Clear conversation history (keeps system prompt)'));
    console.log('  ' + chalk.cyan('/rewind') + '   ' + chalk.dim('Undo the last message and assistant response'));
    console.log('  ' + chalk.cyan('/export') + '   ' + chalk.dim('Export chat history to a markdown file'));
    console.log('  ' + chalk.cyan('/save') + '     ' + chalk.dim('Save the current session'));
    console.log('  ' + chalk.cyan('/model') + '    ' + chalk.dim('Change the current model/provider'));
    console.log('  ' + chalk.cyan('/exit') + '     ' + chalk.dim('Exit the agent'));
    console.log('');
    console.log(chalk.bold.yellow('💡 Usage:'));
    console.log('  Type your message and press Enter to chat.');
    console.log('  The agent can execute tools (bash, read, write, edit) with your confirmation.');
    console.log('');
    console.log(chalk.bold.yellow('⌨  Keyboard Shortcuts:'));
    console.log('  ' + chalk.dim('Ctrl+C') + '   ' + chalk.dim('Interrupt / exit'));
    console.log('  ' + chalk.dim('↑ / ↓') + '    ' + chalk.dim('Navigate command history'));
    console.log('');
}

export async function changeModel(context) {
    const { config } = context;
    const current = (config.provider && config.model)
        ? `${config.provider}/${config.model}`
        : 'None';

    console.log(chalk.dim(`Current Model: ${current}\n`));

    // 1. Build all model choices
    const allChoices = [];
    for (const [providerKey, providerData] of Object.entries(models)) {
        for (const [modelKey] of Object.entries(providerData)) {
            if (['apiKey', 'baseURL'].includes(modelKey)) continue;

            const value = { provider: providerKey, model: modelKey };
            allChoices.push({
                name: `${providerKey}/${modelKey}`,
                value: value,
                description: `Switch to ${modelKey} from ${providerKey}`
            });
        }
    }

    // 2. Trigger the search prompt
    const selection = await search({
        message: 'Search for a model:',
        source: async (term, { signal }) => {
            if (!term) return allChoices;

            const lower = term.toLowerCase();
            return allChoices.filter(choice =>
                choice.name.toLowerCase().includes(lower)
            );
        },
        pageSize: 10,
    });

    if (!selection) {
        console.log(chalk.dim('Model change cancelled.\n'));
        return;
    }

    // 3. Apply the config
    config.provider = selection.provider;
    config.model = selection.model;

    console.log(chalk.green(`\n✓ Model changed to: ${config.provider}/${config.model}\n`));
}

export async function importSession(msgArray, projectRoot) {
    const sessionsDir = getSessionsDir(projectRoot);
    if (!fs.existsSync(sessionsDir)) {
        return;
    }

    const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json'));
    if (files.length === 0) {
        return;
    }

    const selection = global.__MOCK_SEARCH_RESULT || await search({
        message: 'Select a session to import:',
        source: async (term, { signal } = {}) => {
            if (!term) return files.map(f => ({ name: f, value: f }));

            const lower = term.toLowerCase();
            return files.filter(f => f.toLowerCase().includes(lower))
                .map(f => ({ name: f, value: f }));
        },
        pageSize: 10,
    });

    if (!selection) {
        console.log(chalk.dim('Session import cancelled.\n'));
        return;
    }

    const sessionPath = path.join(sessionsDir, selection);
    try {
        const data = fs.readFileSync(sessionPath, 'utf8');
        const parsed = JSON.parse(data);
        msgArray.length = 0;
        msgArray.push(...parsed);
        console.log(chalk.green(`✓ Session imported successfully from .uai/sessions/${selection}.`));
    } catch (err) {
        console.error(chalk.red('✗ Error importing session:'), err.message);
    }
    console.log('');
}

// ============================================
// COMMAND HANDLER
// ============================================

const commands = {
    help: { fn: showHelp, description: 'Show help message' },
    clear: { fn: clearConversation, description: 'Clear conversation history' },
    rewind: { fn: rewindConversation, description: 'Undo last message and response' },
    export: { fn: exportConversation, description: 'Export chat history to markdown' },
    save: { fn: saveSessionCommand, description: 'Save current session' },
    import: { fn: importSession, description: 'Import a saved session' },
    model: { fn: changeModel, description: 'Change the current model/provider' },
    exit: { fn: exitAgent, description: 'Exit the agent' },
};

export async function handleCommand(trimmedInput, context) {
    // Strip leading slash if present (e.g., "/model" → "model")
    const commandKey = trimmedInput.startsWith('/') ? trimmedInput.slice(1) : trimmedInput;

    if (!commands[commandKey]) {
        if (trimmedInput.startsWith('/')) {
            console.log(chalk.yellow(`⚠ Unknown command: ${commandKey}`));
            console.log(chalk.dim('Type /help for a list of available commands.\n'));
            return true; // Input was intended as a command, but it's unknown
        }
        return false;
    }

    const command = commands[commandKey];
    const { msgArray, config, __dirname, sessionName } = context;
    const provider = config.provider || 'none';
    const model = config.model || 'none';

    if (commandKey === 'export') {
        await command.fn(msgArray, provider, model, __dirname);
    } else if (commandKey === 'save') {
        await command.fn(msgArray, __dirname, sessionName);
    } else if (commandKey === 'import') {
        await command.fn(msgArray, __dirname);
    } else if (commandKey === 'model') {
        await command.fn(context);
    } else if (['clear', 'rewind'].includes(commandKey)) {
        command.fn(msgArray);
    } else {
        command.fn();
    }

    return true;
}
