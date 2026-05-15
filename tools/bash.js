import { exec } from 'child_process';
import { log } from 'console';

export function bash(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
}

// let out = await bash('ls');
// log(out.stdout);