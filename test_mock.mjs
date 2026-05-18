import { mock } from 'node:test';
import rl from 'node:readline/promises';
import { askQuestion } from './utils/askQuestion.js';

mock.method(rl, 'createInterface', () => ({
    question: async () => 'y',
    close: () => {}
}));

askQuestion('?').then(console.log);
