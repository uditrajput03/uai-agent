#!/usr/bin/env node
import OpenAI from 'openai';
import 'dotenv/config';
import fs from 'fs';
import { askQuestion, closeReadline, pauseReadline, resumeReadline } from './utils/askQuestion.js';
import { toolCall } from './tools/toolCall.js';
import { models } from './config.js';
import chalk from 'chalk';
import { keys } from './config/keys.js';

import path from 'path';
import { fileURLToPath } from 'url';
import { addUserContext } from './utils/userAppend.js';
import { tools } from './config/tools.js';

import { printWelcome, printSeparator, printToolCallInfo, printToolResponse } from './utils/prints.js';
import { changeModel, handleCommand } from './utils/commands.js';
import { getApprovalRequirements } from './utils/approval.js';
// ============================================
// CONFIGURATION
// ============================================
const config = {
    provider: keys.defaultProvider,
    model: keys.defaultModel,
};

if (!config.provider || !config.model) {
    await changeModel({ config });
}
// ============================================
// SETUP
// ============================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const systemPath = path.resolve(__dirname, 'config/SYSTEM.md');
// const toolsPath = path.resolve(__dirname, 'config/TOOLS.md');

const agentPrompt = fs.readFileSync(systemPath, 'utf-8');
// const toolsPrompt = fs.readFileSync(toolsPath, 'utf-8');
const systemPrompt = agentPrompt;

const msgArray = [
    { "role": "system", "content": systemPrompt }
];

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
    let toolResponse = '';
    let finalToolCalls = {};
    let lastMessageWasTool = msgArray.length > 0 && msgArray[msgArray.length - 1].role === 'tool';

    // Initialize OpenAI client dynamically to support provider/model switching
    const openai = new OpenAI({
        apiKey: models[config.provider].apiKey,
        baseURL: models[config.provider].baseURL,
    });

    // Handle tool response from previous iteration
    if (!lastMessageWasTool) inputMsg = await askQuestion(chalk.green.bold('You: '));

    // Handle null input (Ctrl+C during question)
    if (inputMsg === null && !lastMessageWasTool) {
        return;
    }

    const trimmedInput = inputMsg?.trim()?.toLowerCase();

    // Handle special commands via command handler
    const commandContext = { msgArray, config, __dirname };
    const isCommand = await handleCommand(trimmedInput, commandContext);
    if (isCommand) return;

    // Skip empty input
    if (!inputMsg.trim() && !lastMessageWasTool) {
        return;
    }
    let userContext = await addUserContext(inputMsg);
    inputMsg = userContext + "\nUser Message: " + inputMsg;
    // Add user message to conversation
    if (!lastMessageWasTool) {
        msgArray.push({ "role": "user", "content": inputMsg });
    }
    if (keys.DEBUG === 'true') {
        console.log(chalk.dim('Message Array:'), msgArray);
    }

    // Show thinking indicator
    process.stdout.write(chalk.dim('🤔 Thinking...'));

    try {
        pauseReadline();

        const completion = await openai.chat.completions.create({
            ...models[config.provider][config.model],
            messages: msgArray,
            tools: tools,
            stream: true,
        });

        // Clear thinking indicator and show response
        process.stdout.write('\r' + ' '.repeat(20) + '\r');
        console.log(chalk.cyan.bold('Assistant:'));

        let isFirstChunk = true;
        for await (const chunk of completion) {
            if (keys.DEBUG == true) {
                let toLog = chunk.choices[0]?.delta?.tool_calls
                // if (toLog) console.log(toLog);
            }
            let content = chunk.choices[0]?.delta?.content || '';
            let reasoning = chunk.choices[0]?.delta?.reasoning_content;
            let toolCalls = chunk.choices[0]?.delta?.tool_calls;

            if (reasoning) {
                if (keys.showThinking == true) {
                    process.stdout.write(chalk.dim.blue(reasoning));
                }
                else process.stdout.write(chalk.dim('.'));
                continue;
            }

            if (isFirstChunk && content.trim()) {
                process.stdout.write('\n');
                isFirstChunk = false;
            }

            if (toolCalls) {
                toolCalls.forEach(toolCall => {
                    const { index } = toolCall;

                    if (!finalToolCalls[index]) {
                        finalToolCalls[index] = {
                            id: toolCall.id,
                            type: toolCall.type,
                            function: {
                                name: toolCall.function?.name || '',
                                arguments: toolCall.function?.arguments || ''
                            }
                        };
                    } else {
                        if (toolCall.function?.name) finalToolCalls[index].function.name += toolCall.function.name;
                        if (toolCall.function?.arguments) finalToolCalls[index].function.arguments += toolCall.function.arguments;
                    }
                });
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
    if (finalToolCalls && Object.keys(finalToolCalls).length > 0) {
        finalToolCalls = Object.values(finalToolCalls);
        if (keys.DEBUG === 'true') {
            console.log(JSON.stringify(finalToolCalls, null, 2));
        }
        msgArray.push({ "role": "assistant", "content": null, tool_calls: finalToolCalls });
    }
    else {
        msgArray.push({ "role": "assistant", "content": outmsg });
    }
    // Add assistant response to conversation

    // Check for tool calls
    if (finalToolCalls && finalToolCalls.length > 0) {
        printToolCallInfo(finalToolCalls);
        const { execApproval } = getApprovalRequirements(finalToolCalls);
        let confirmation;
        if (execApproval) {
            confirmation = await askQuestion(chalk.yellow('Execute this tool call? (y/N): '));
        }
        if (confirmation && confirmation.toLowerCase().startsWith('n')) {
            toolResponse = "\nTool call cancelled by user.";
            console.log(chalk.red('✗ Tool call cancelled.'));
        } else {
            console.log(chalk.green('✓ Executing tool...'));
            try {
                const response = await toolCall(finalToolCalls);
                toolResponse = response || "\nTool executed successfully with no response.";
            } catch (error) {
                toolResponse = `\nError executing tool call: ${error.message}`;
                console.error(chalk.red('✗') + chalk.red(toolResponse));
            }
        }
    }
    if (toolResponse) {
        printToolResponse(toolResponse, finalToolCalls);
        const { sendingApproval } = getApprovalRequirements(finalToolCalls);
        let confirmation;
        if (sendingApproval) {
            confirmation = await askQuestion(chalk.yellow('Send this response to the agent? (Y/n): '));
        }
        if (confirmation && confirmation.toLowerCase().startsWith('n')) {
            toolResponse = "\nTool response not sent to agent (cancelled by user)." + confirmation;
            console.log(chalk.red('✗ Tool response not sent.'));
        } else {
            console.log(chalk.green('✓ Sending tool response to agent...'));
        }
        if (Array.isArray(toolResponse)) {
            msgArray.push(...toolResponse);
        }
        else {
            msgArray.push({ role: "tool", content: toolResponse });
        }
    }
    finalToolCalls = {};
}
// ============================================
// START
// ============================================

printWelcome(config.provider, config.model);

(async () => {
    while (true) {
        await main();
    }
})();
