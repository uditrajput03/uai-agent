import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

// Singleton readline interface for better UX
let rl = null;
let savedHistory = [];

function getReadline() {
    if (!rl) {
        rl = readline.createInterface({
            input,
            output,
            historySize: 100,
            tabSize: 4
        });
        rl.history = savedHistory;
    }
    return rl;
}

export async function askQuestion(inputText) {
    if (process.env.NODE_ENV === 'test') {
        return global.__MOCK_ASK_ANSWER !== undefined ? global.__MOCK_ASK_ANSWER : 'y';
    }
    const rlInstance = getReadline();
    try {
        return await rlInstance.question(inputText);
    } catch (error) {
        // Handle Ctrl+C gracefully
        if (error.code === 'ABORT_ERR' || error.name === 'AbortError') {
            return null;
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

let blockInputHandler = null;

export function pauseReadline() {
    if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        process.stdin.resume();

        if (!blockInputHandler) {
            blockInputHandler = (data) => {
                if (data.toString() === '\x03') { // Ctrl+C
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
