import { mock } from 'node:test';

mock.module('./utils/askQuestion.js', {
    namedExports: {
        askQuestion: async () => 'TEST_MOCK_ANSWER',
        closeReadline: () => {},
        pauseReadline: () => {},
        resumeReadline: () => {}
    }
});

mock.module('./utils/redact.js', {
    namedExports: {
        redact: (text) => text
    }
});

const mod = await import('./tools/bash.js');
console.log('Module imported:', Object.keys(mod));
const result = await mod.safeBashApproval('npm test');
console.log('Result:', JSON.stringify(result));
