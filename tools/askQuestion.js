import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

export async function askQuestion(inputText) {
  // 1. Create the interface
  const rl = readline.createInterface({ input, output });

  try {
    // 2. Ask the question and wait for the response
    const name = await rl.question(inputText);
    // console.log(`Hello, ${name}!`);
    return name;
  } finally {
    // 3. Always close the interface when done
    rl.close();
  }
}