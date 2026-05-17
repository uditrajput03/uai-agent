import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import { askQuestion, closeReadline } from './askQuestion.js';

export function clearConversation(msgArray) {
    msgArray.length = 1;
    console.log(chalk.green('✓ Conversation history cleared.'));
    console.log('');
}

export function rewindConversation(msgArray) {
    let removedCount = 0;
    let foundAssistant = false;
    let foundUser = false;

    let initialLength = msgArray.length;
    for (let i = initialLength - 1; i > 0; i--) {
        if (!foundAssistant && msgArray[i].role === 'assistant') {
            msgArray.splice(i, 1);
            foundAssistant = true;
            removedCount++;
        } else if (foundAssistant && !foundUser && msgArray[i].role === 'user') {
            msgArray.splice(i, 1);
            foundUser = true;
            removedCount++;
            break;
        }
    }

    if (foundUser && foundAssistant) {
        console.log(chalk.green(`✓ Rewound ${initialLength - msgArray.length} message(s).`));
    } else if (removedCount > 0) {
        console.log(chalk.green('✓ Removed last message(s).'));
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
                    markdown += `- **Tool:** \`${toolCall.function.name}\`\n`;
                    markdown += `  **Arguments:** \`\`\`json\n${toolCall.function.arguments}\n\`\`\`\n`;
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
    const filename = filenameInput?.trim() || defaultFilename;

    const finalFilename = filename.endsWith('.md') ? filename : `${filename}.md`;

    try {
        const exportPath = path.resolve(__dirname, finalFilename);
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

export function showHelp() {
    console.log('\n' + chalk.bold.yellow('Help & Commands:'));
    console.log('  ' + chalk.green('help') + '    - Show this help message');
    console.log('  ' + chalk.green('clear') + '   - Clear conversation history (keeps system prompt)');
    console.log('  ' + chalk.green('rewind') + '  - Undo the last message and assistant response');
    console.log('  ' + chalk.green('export') + '  - Export chat history to a markdown file');
    console.log('  ' + chalk.green('exit') + '    - Exit the agent');
    console.log('');
    console.log(chalk.bold.yellow('Usage:'));
    console.log('  Type your message and press Enter to send.');
    console.log('  The agent can execute tools (bash, read, write) with your confirmation.');
    console.log('');
    console.log(chalk.bold.yellow('Keyboard Shortcuts:'));
    console.log('  ' + chalk.dim('Ctrl+C') + '  - Exit the agent');
    console.log('  ' + chalk.dim('Up/Down') + ' - Navigate command history');
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
    exit: { fn: exitAgent, description: 'Exit the agent' },
};

export async function handleCommand(trimmedInput, context) {
    if (!commands[trimmedInput]) {
        return false;
    }

    const command = commands[trimmedInput];
    const { msgArray, provider, model, __dirname } = context;

    if (trimmedInput === 'export') {
        await command.fn(msgArray, provider, model, __dirname);
    } else if (['clear', 'rewind'].includes(trimmedInput)) {
        command.fn(msgArray);
    } else {
        command.fn();
    }

    return true;
}
