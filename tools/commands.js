import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import { askQuestion, closeReadline } from './askQuestion.js';

export function clearConversation(msgArray) {
    // Keep only the system prompt
    msgArray.length = 1;
    console.log(chalk.green('✓ Conversation history cleared.'));
    console.log('');
}

export function rewindConversation(msgArray) {
    // Find and remove the last user message and assistant response
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
    const chatMessages = msgArray.filter(msg => msg.role === 'user' || msg.role === 'assistant');

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
            markdown += `## 🤖 Assistant\n\n${msg.content}\n\n`;
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
