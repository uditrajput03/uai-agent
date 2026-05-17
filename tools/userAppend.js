import chalk from "chalk";
import { toolCall } from "./toolCall.js";

// All the code that is used when the user is appending to the file
export function parseCommands(string) {
    const regex = /@([\w./\\]+)\b/g;
    const allMatches = string.matchAll(regex);
    return Array.from(allMatches).map(match => match[1]);
}

export async function addUserContext(string) {
    let context = "";
    const commands = parseCommands(string);
    if (commands.length > 0) {
        context += "Context: \n";
    }
    for (const command of commands) {
        if (command === 'workspace') {
            let toolResult = await toolCall({ tool: 'bash', input: { command: "ls -la" } });
            context += "Workspace: ls -la \n" + toolResult + "\n";
            // Add workspace context
        } else if (command.startsWith('./') || command.startsWith('.\\')) {
            let toolResult = await toolCall({ tool: 'read', input: { filePath: command } });
            context += "File: " + command + "\n" + toolResult + "\n";
            // Add file context
        } else {
            chalk.red(`Unknown command: ${command}`);
            // Handle other commands
        }
    }
    return context;
}