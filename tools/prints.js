import chalk from 'chalk';

export function printWelcome(provider, model) {
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

export function printSeparator() {
    console.log(chalk.dim('─'.repeat(60)));
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

export function printToolCallInfo(finalToolCalls) {
    console.log('\n' + chalk.bgYellow.black(' ⚡ Tool Call Detected '));
    finalToolCalls.forEach((toolCall, index) => {
        console.log(chalk.yellow(`Tool Call #${index + 1}:`));
        console.log(chalk.yellow('  Tool: ') + chalk.bold(toolCall.function.name));
        let parsedArgs = toolCall.function.arguments;
        // console.log(parsedArgs);
        try {
            parsedArgs = JSON.parse(toolCall.function.arguments);
        } catch (e) {
            // Ignore incomplete parse for display
        }
        console.log(chalk.yellow('  Input: ') + chalk.dim(JSON.stringify(parsedArgs, null, 2)));
    });
}

export function printToolResponse(toolResponse) {
    console.log('\n' + chalk.blue('📋 Tool Response:'));
    console.log(chalk.dim('─'.repeat(60)));
    console.log(toolResponse);
    console.log(chalk.dim('─'.repeat(60)));
}
