#!/usr/bin/env node
import OpenAI from 'openai';
import 'dotenv/config';
import fs from 'fs';
import { askQuestion, closeReadline, pauseReadline, resumeReadline } from './tools/askQuestion.js';
import { toolCall } from './tools/toolCall.js';
import { models } from './models.js';
import { redact } from './tools/redact.js';
import chalk from 'chalk';
import { keys } from './config/keys.js';

import path from 'path';
import { fileURLToPath } from 'url';
import { addUserContext } from './tools/userAppend.js';

// ============================================
// CONFIGURATION
// ============================================
const provider = 'alibaba';
const model = 'qwen';

// ============================================
// SETUP
// ============================================
const openai = new OpenAI({
    apiKey: models[provider].apiKey,
    baseURL: models[provider].baseURL,
});
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const systemPath = path.resolve(__dirname, 'config/SYSTEM.md');
const toolsPath = path.resolve(__dirname, 'config/TOOLS.md');

const agentPrompt = fs.readFileSync(systemPath, 'utf-8');
const toolsPrompt = fs.readFileSync(toolsPath, 'utf-8');
const systemPrompt = agentPrompt + "\n\n" + toolsPrompt;

const msgArray = [
    { "role": "system", "content": systemPrompt }
];

let isToolCall = false;
let toolResponse = '';

// ============================================
// UTILITY FUNCTIONS
// ============================================

function printWelcome() {
    console.log('\n' + chalk.bold.cyan('╔═══════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║') + '           ' + chalk.bold.white('🤖 UAI Agent - AI Assistant') + '             ' + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('╠═══════════════════════════════════════════════════╣'));
    console.log(chalk.bold.cyan('║') + '  ' + chalk.dim('Provider:') + ' ' + chalk.bold(provider.toLowerCase()) + '  |  ' + chalk.dim('Model:') + ' ' + chalk.bold(model.toLowerCase()) + '                ' + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('╠═══════════════════════════════════════════════════╣'));
    console.log(chalk.bold.cyan('║') + '  ' + chalk.yellow('Commands:') + '                                        ' + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('║') + '    ' + chalk.green('help') + '    - Show this help message               ' + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('║') + '    ' + chalk.green('clear') + '   - Clear conversation history           ' + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('║') + '    ' + chalk.green('rewind') + '  - Undo last message and response       ' + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('║') + '    ' + chalk.green('export') + '  - Export chat history to markdown      ' + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('║') + '    ' + chalk.green('exit') + '    - Exit the agent                       ' + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('╠═══════════════════════════════════════════════════╣'));
    console.log(chalk.bold.cyan('║') + '  ' + chalk.dim('Press Ctrl+C at any time to exit') + '                 ' + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('╚═══════════════════════════════════════════════════╝'));
    console.log('');
}

function printSeparator() {
    console.log(chalk.dim('─'.repeat(60)));
}

function showHelp() {
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

function clearConversation() {
    // Keep only the system prompt
    msgArray.length = 1;
    console.log(chalk.green('✓ Conversation history cleared.'));
    console.log('');
}

function rewindConversation() {
    // Find and remove the last user message and assistant response
    // We need to remove the last user+assistant pair (skip any system messages)
    let removedCount = 0;
    let foundAssistant = false;
    let foundUser = false;

    // Remove from the end: first assistant, then user
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

async function exportConversation() {
    // Filter out system messages, keep only user and assistant
    const chatMessages = msgArray.filter(msg => msg.role === 'user' || msg.role === 'assistant');

    if (chatMessages.length === 0) {
        console.log(chalk.yellow('⚠ No conversation to export.'));
        console.log('');
        return;
    }

    // Build markdown content
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

    // Ask for filename
    const defaultFilename = `chat-export-${timestamp}.md`;
    const filenameInput = await askQuestion(chalk.yellow(`Enter filename (default: ${defaultFilename}): `));
    const filename = filenameInput?.trim() || defaultFilename;

    // Ensure .md extension
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

function exitAgent() {
    console.log('\n' + chalk.cyan('👋 Goodbye!') + '\n');
    closeReadline();
    process.exit(0);
}

// ============================================
// SIGNAL HANDLERS
// ============================================

process.on('SIGINT', () => {
    console.log('\n' + chalk.yellow('\n⚠ Interrupted. Type "exit" to quit or continue chatting.'));
    console.log(chalk.dim('Press Ctrl+C again to force exit.'));

    // Set up one-time force exit handler
    const forceExit = () => {
        console.log('\n' + chalk.cyan('👋 Force exit. Goodbye!') + '\n');
        closeReadline();
        process.exit(0);
    };
    process.once('SIGINT', forceExit);
});

process.on('SIGTERM', () => {
    console.log('\n' + chalk.cyan('👋 Terminated. Goodbye!') + '\n');
    closeReadline();
    process.exit(0);
});

// ============================================
// MAIN AGENT LOOP
// ============================================

async function main() {
    let outmsg = '';
    let inputMsg = '';

    // Handle tool response from previous iteration
    if (isToolCall) {
        toolResponse = redact(toolResponse.trim());
        isToolCall = false;

        console.log('\n' + chalk.blue('📋 Tool Response:'));
        console.log(chalk.dim('─'.repeat(60)));
        console.log(toolResponse);
        console.log(chalk.dim('─'.repeat(60)));

        let confirmation;
        if (toolResponse) {
            confirmation = await askQuestion(chalk.yellow('Send this response to the agent? (Y/n): '));
            if (confirmation && confirmation.toLowerCase() === 'n') {
                toolResponse = "\nTool response not sent to agent (cancelled by user).";
                console.log(chalk.red('✗ Tool response not sent.'));
            } else {
                console.log(chalk.green('✓ Sending tool response to agent...'));
            }
        }

        inputMsg = toolResponse + '\n' + (confirmation || 'y');
        toolResponse = '';
    } else {
        inputMsg = await askQuestion(chalk.green.bold('You: '));
    }

    // Handle null input (Ctrl+C during question)
    if (inputMsg === null) {
        return;
    }

    const trimmedInput = inputMsg.trim().toLowerCase();

    // Handle special commands
    if (trimmedInput === 'exit') {
        exitAgent();
        return;
    }

    if (trimmedInput === 'help') {
        showHelp();
        return;
    }

    if (trimmedInput === 'clear') {
        clearConversation();
        return;
    }

    if (trimmedInput === 'rewind') {
        rewindConversation();
        return;
    }

    if (trimmedInput === 'export') {
        await exportConversation();
        return;
    }

    // Skip empty input
    if (!inputMsg.trim()) {
        return;
    }
    let userContext = await addUserContext(inputMsg);
    inputMsg = userContext + "\nUser Message: " + inputMsg;
    // Add user message to conversation
    msgArray.push({ "role": "user", "content": inputMsg });

    if (keys.DEBUG === 'true') {
        console.log(chalk.dim('Message Array:'), msgArray);
    }

    // Show thinking indicator
    process.stdout.write(chalk.dim('🤔 Thinking...'));

    try {
        pauseReadline();

        const completion = await openai.chat.completions.create({
            ...models[provider][model],
            messages: msgArray,
            stream: true,
        });

        // Clear thinking indicator and show response
        process.stdout.write('\r' + ' '.repeat(20) + '\r');
        console.log(chalk.cyan.bold('Assistant:'));

        let isFirstChunk = true;
        for await (const chunk of completion) {
            let content = chunk.choices[0]?.delta?.content || '';
            let reasoning = chunk.choices[0]?.delta?.reasoning_content;

            if (reasoning) {
                process.stdout.write(chalk.dim('.'));
                continue;
            }

            if (isFirstChunk && content.trim()) {
                process.stdout.write('\n');
                isFirstChunk = false;
            }

            outmsg += content;
            process.stdout.write(content);
        }

        resumeReadline();

        // Add newline after response
        console.log('\n');
        printSeparator();

    } catch (error) {
        resumeReadline();
        process.stdout.write('\r' + ' '.repeat(20) + '\r');
        console.error(chalk.red('✗ Error during AI API call:'), error.message);
        return;
    }

    // Add assistant response to conversation
    msgArray.push({ "role": "assistant", "content": outmsg });

    // Check for tool calls
    if (outmsg.includes("```json")) {
        const regex = /```json\s*(\{[\s\S]*?\})\s*```/;
        const toolJson = outmsg.match(regex)?.[1];
        let parsed;

        if (!toolJson) {
            console.log(chalk.yellow('⚠ No tool call JSON found in the output.'));
            return;
        }

        isToolCall = true;

        try {
            parsed = JSON.parse(toolJson);
        } catch (error) {
            console.log(chalk.red(`✗ Invalid JSON in tool call: ${error.message}`));
            toolResponse = `Error parsing tool call JSON: ${error.message}`;
            return;
        }

        if (!parsed.tool || !parsed.input) {
            console.log(chalk.red('✗ Invalid tool call: missing tool or input property'));
            toolResponse = 'Invalid tool call: missing tool or input property';
            return;
        }

        console.log('\n' + chalk.bgYellow.black(' ⚡ Tool Call Detected '));
        console.log(chalk.yellow('  Tool: ') + chalk.bold(parsed.tool));
        console.log(chalk.yellow('  Input: ') + chalk.dim(JSON.stringify(parsed.input, null, 2)));

        const confirmation = await askQuestion(chalk.yellow('Execute this tool call? (y/N): '));

        if (confirmation && confirmation.toLowerCase().startsWith('n')) {
            toolResponse = "\nTool call cancelled by user.";
            console.log(chalk.red('✗ Tool call cancelled.'));
        } else {
            console.log(chalk.green('✓ Executing tool...'));
            try {
                const response = await toolCall(parsed);
                toolResponse = `\nTool call ${parsed.tool} result: ${response}`;
            } catch (error) {
                toolResponse = `\nError executing tool call: ${error.message}`;
                console.error(chalk.red('✗') + chalk.red(toolResponse));
            }
        }
    }
}

// ============================================
// START
// ============================================

printWelcome();

(async () => {
    while (true) {
        await main();
    }
})();
