import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

// Singleton readline interface for better UX
let rl = null;

function getReadline() {
    if (!rl) {
        rl = readline.createInterface({
            input,
            output,
            historySize: 100,
            tabSize: 4
        });
    }
    return rl;
}

export async function askQuestion(inputText) {
    const rlInstance = getReadline();
    try {
        const answer = await rlInstance.question(inputText);
        return answer;
    } catch (error) {
        // Handle Ctrl+C gracefully
        if (error.code === 'ABORT_ERR' || error.name === 'AbortError') {
            return null;
        }
        throw error;
    }
}

export function closeReadline() {
    if (rl) {
        rl.close();
        rl = null;
    }
}

export function pauseReadline() {
    if (rl) {
        rl.pause();
    }
}

export function resumeReadline() {
    if (rl) {
        rl.resume();
    }
}
