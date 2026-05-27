import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

type ReadlineWithHistory = readline.Interface & { history: string[] };

// Singleton readline interface for better UX
let rl: ReadlineWithHistory | null = null;
let savedHistory: string[] = [];

function getReadline(): ReadlineWithHistory {
    if (!rl) {
        const instance = readline.createInterface({
            input,
            output,
            historySize: 100,
            tabSize: 4
        }) as ReadlineWithHistory;

        rl = instance;

        // readline consumes Ctrl+C while a question is active and emits SIGINT on
        // the interface instead of the process. Forward it to the process-level
        // handler so Ctrl+C exits consistently from prompts, approval questions,
        // and normal chat input.
        instance.on('SIGINT', () => {
            process.emit('SIGINT');
        });

        instance.history = savedHistory;
    }
    return rl;
}

export async function askQuestion(inputText: string) {
    if (process.env.NODE_ENV === 'test') {
        return (global as any).__MOCK_ASK_ANSWER !== undefined ? (global as any).__MOCK_ASK_ANSWER : 'y';
    }
    const rlInstance = getReadline();
    try {
        return await rlInstance.question(inputText);
    } catch (error) {
        // Handle Ctrl+C gracefully
        if(error instanceof Error) {
            if (error.name === 'AbortError') {
                return null;
            }
        }
        throw error;
    } finally {
        closeReadline();
    }
}

export function closeReadline() {
    if (rl) {
        savedHistory = rl.history;
        rl.close();
        rl = null;
    }
}

let blockInputHandler: ((data: Buffer) => void) | null = null;

export function pauseReadline() {
    if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        process.stdin.resume();

        if (!blockInputHandler) {
            blockInputHandler = (data) => {
                if (data.includes(3)) { // Ctrl+C
                    process.emit('SIGINT');
                }
            };
            process.stdin.on('data', blockInputHandler);
        }
    }
}

export function resumeReadline() {
    if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
        if (blockInputHandler) {
            process.stdin.off('data', blockInputHandler);
            blockInputHandler = null;
        }
    }
}
