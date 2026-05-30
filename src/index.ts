#!/usr/bin/env node
import OpenAI from 'openai';
import 'dotenv/config';
import fs from 'fs';
import { askQuestion, closeReadline, pauseReadline, resumeReadline } from './utils/askQuestion.js';
import { toolCall, type ToolCallResponse } from './tools/toolCall.js';
import { models, type AvailableModel, type Provider } from './config.js';
import chalk from 'chalk';

import path from 'path';
import { fileURLToPath } from 'url';
import { addUserContext } from './utils/userAppend.js';
import { tools } from './config/tools.js';

import { printWelcome, printSeparator, printToolCallInfo, printToolResponse } from './utils/prints.js';
import { changeModel, handleCommand, saveSession } from './utils/commands.js';
import { getApprovalRequirements } from './utils/approval.js';
import { keys } from './config/keys.js';
// ============================================
// CONFIGURATION
// ============================================
const config: { provider: Provider, model: AvailableModel } = {
    provider: keys.defaultProvider as Provider,
    model: keys.defaultModel as AvailableModel,
};

if (!config.provider || !config.model) {
    await changeModel({ config });
}
// ============================================
// SETUP
// ============================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const systemPath = path.resolve(__dirname, '../config/SYSTEM.md');
const systemPrompt = fs.readFileSync(systemPath, 'utf-8');

interface Message {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | undefined | null;
    tool_calls?: FinalToolCall[];
    tool_call_id?: string;
}

interface ToolCall {
    index: number
    id: string;
    type: string;
    function: {
        name: string;
        arguments: string;
    };
}

export type FinalToolCall = Omit<ToolCall, 'index'>;

const msgArray: Message[] = [
    { "role": "system", "content": systemPrompt }
];
export type MsgArray = typeof msgArray;

const sessionName = `session-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

// ============================================
// SIGNAL HANDLERS
// ============================================

process.on('SIGINT', () => {
    console.log('\n' + chalk.cyan('👋 Interrupted. Goodbye!') + '\n');
    resumeReadline();
    closeReadline();
    process.exit(130);
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
    let toolResponse: ToolCallResponse = "";
    let finalToolCalls: Record<number, FinalToolCall> = {};
    let finalToolCallsArray: FinalToolCall[] = [];
    let lastMessageWasTool = msgArray.length > 0 && msgArray[msgArray.length - 1]?.role === 'tool';

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
    const commandContext = { msgArray, config, __dirname, sessionName };
    const isCommand = await handleCommand(trimmedInput, commandContext);
    if (isCommand) return;

    // Skip empty input
    if (!inputMsg.trim() && !lastMessageWasTool) {
        return;
    }
    let userContext = await addUserContext(inputMsg);
    if (userContext) {
        inputMsg = userContext + "\nUser Message: " + inputMsg;
    }
    // Add user message to conversation
    if (!lastMessageWasTool) {
        msgArray.push({ "role": "user", "content": inputMsg });
    }
    if (keys.DEBUG === true) {
        console.log(chalk.dim('Message Array:'), msgArray);
    }

    // Show thinking indicator
    process.stdout.write(chalk.dim('🤔 Thinking...'));

    try {
        pauseReadline();
        const modelConfig = (models[config.provider] as Record<string, any>)[config.model];
        const completion = await openai.chat.completions.create({
            ...modelConfig,
            messages: msgArray,
            tools: tools,
            stream: true,
        });

        // Clear thinking indicator and show response
        process.stdout.write('\r' + ' '.repeat(20) + '\r');
        console.log(chalk.cyan.bold('Assistant:'));

        let isFirstChunk = true;
        for await (const chunk of completion as any) {
            if (keys.DEBUG === true) {
                let toLog: any = chunk.choices[0]?.delta?.tool_calls;
                if (toLog) console.log(toLog);
            }
            let content:string = chunk.choices[0]?.delta?.content || '';
            let reasoning: string = chunk.choices[0]?.delta?.reasoning_content;
            let toolCalls: ToolCall[] = chunk.choices[0]?.delta?.tool_calls;

            if (reasoning) {
                if (keys.showThinking === true) {
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
        if(error instanceof Error) {

            resumeReadline();
            process.stdout.write('\r' + ' '.repeat(20) + '\r');
            console.error(chalk.red('✗ Error during AI API call:'), error.message);
            
            // FIX: Pause execution and wait for user input to break the infinite loop
            const action = await askQuestion(chalk.yellow('⚠ Press Enter to retry, or type "cancel" to abort: '));
            
            if (action?.trim().toLowerCase() === 'cancel') {
                msgArray.pop();
                console.log(chalk.red('✗ Action cancelled.'));
            } else if (!lastMessageWasTool) {
                msgArray.pop();
                console.log(chalk.dim('Tip: Press the Up arrow key to quickly retrieve your previous message.'));
            }
            
            return;
        }
        else {
            throw error;
        }
    }

    if (finalToolCalls && Object.keys(finalToolCalls).length > 0) {
        finalToolCallsArray = Object.values(finalToolCalls);
        if (keys.DEBUG === true) {
            console.log(JSON.stringify(finalToolCallsArray, null, 2));
        }
        msgArray.push({ "role": "assistant", "content": null, tool_calls: finalToolCallsArray });
    }
    else {
        msgArray.push({ "role": "assistant", "content": outmsg });
    }
    // Add assistant response to conversation

    // Check for tool calls
    if (finalToolCallsArray && finalToolCallsArray.length > 0) {
        printToolCallInfo(finalToolCallsArray);
        const { execApproval } = await getApprovalRequirements(finalToolCallsArray);
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
                const response = await toolCall(finalToolCallsArray);
                if (Array.isArray(response) && response.length > 0) {
                    toolResponse = response;
                } else {
                    toolResponse = "\nTool executed successfully with no response.";
                }
            } catch (error) {
                if(error instanceof Error) {
                    toolResponse = `\nError executing tool call: ${error.message}`;
                    console.error(chalk.red('✗') + chalk.red(toolResponse));
                }
                else {
                    throw error;
                }
            }
        }
    }
    if (toolResponse) {
        printToolResponse(toolResponse, finalToolCallsArray);
        const { sendingApproval } = await getApprovalRequirements(finalToolCallsArray);
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
    finalToolCallsArray = [];

    saveSession(msgArray, __dirname, sessionName);
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
