import chalk from "chalk";
import { execSync } from "child_process";
import { readFile } from "../tools/fsOps.js";
import { redact } from "./redact.js";

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
            try {
                const toolResult = execSync("ls -la", { encoding: 'utf-8', timeout: 10000 });
                context += "Workspace: ls -la \n" + toolResult + "\n";
            } catch (error) {
                context += "Workspace: ls -la \nError: " + error.message + "\n";
            }
        } else if (command.startsWith('./') || command.startsWith('.\\')) {
            const toolResult = readFile(command);
            context += "File: " + command + "\n" + toolResult + "\n";
        } else {
            chalk.red(`Unknown command: ${command}`);
        }
    }
    return redact(context);
}
