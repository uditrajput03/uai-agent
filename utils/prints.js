import chalk from 'chalk';

export function printWelcome(provider, model) {
    console.log('\n' + chalk.bold.cyan('╔═══════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║') + '           ' + chalk.bold.white('🤖 UAI Agent - AI Assistant') + '             ' + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('╠═══════════════════════════════════════════════════╣'));
    console.log(chalk.bold.cyan('║') + '  ' + chalk.dim('Provider:') + ' ' + chalk.bold(provider.toLowerCase()) + '  |  ' + chalk.dim('Model:') + ' ' + chalk.bold(model.toLowerCase()) + '                ' + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('╠═══════════════════════════════════════════════════╣'));
    console.log(chalk.bold.cyan('║') + '  ' + chalk.yellow('Commands:') + '                                        ' + chalk.bold.cyan('║'));
    console.log(chalk.bold.cyan('║') + '    ' + chalk.green('model') + '   - Change the current model/provider    ' + chalk.bold.cyan('║'));
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

export function printSeparator() {
    console.log(chalk.dim('─'.repeat(60)));
}

export function printToolCallInfo(finalToolCalls) {
    console.log('\n' + chalk.bgYellow.black(' ⚡ Tool Call Detected '));
    finalToolCalls.forEach((toolCall, index) => {
        console.log(chalk.yellow(`Tool Call #${index + 1}:`));
        console.log(chalk.yellow('  Tool: ') + chalk.bold(toolCall.function.name));
        let parsedArgs = toolCall.function.arguments;
        try {
            parsedArgs = JSON.parse(toolCall.function.arguments);
        } catch (e) {
            // Ignore incomplete parse for display
        }
        console.log(chalk.yellow('  Input: ') + chalk.dim(JSON.stringify(parsedArgs, null, 2)));
    });
}

export function printToolResponse(toolResponse, toolCalls) {
    console.log('\n' + chalk.blue('📋 Tool Response:'));
    console.log(chalk.dim('─'.repeat(60)));

    // 1. Print the output FIRST
    const displayResponse = toolResponse
        ? toolResponse
        : chalk.dim('No output returned.');
    console.log(displayResponse);

    console.log(chalk.dim('─'.repeat(60)));

    // 2. Print the context at the BOTTOM (No scrolling needed!)
    const calls = Array.isArray(toolCalls) ? toolCalls : (toolCalls ? [toolCalls] : []);

    if (calls.length > 0) {
        calls.forEach(call => {
            const toolName = call.function?.name || 'Unknown';
            let args = call.function?.arguments || '';

            // Clean up the arguments for display
            try {
                const parsedArgs = JSON.parse(args);
                if (toolName === 'bash' && parsedArgs.command) {
                    args = parsedArgs.command; // Just show the raw command string
                } else {
                    args = JSON.stringify(parsedArgs); // Keep it on one line for a clean footer
                }
            } catch (e) {
                // Fallback to raw string if parsing fails
            }

            console.log(
                chalk.yellow('Related to Tool: ') +
                chalk.bold(toolName) +
                chalk.dim(' | Input: ') +
                chalk.cyan(args)
            );
        });
    }
}
