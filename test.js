import { toolCall } from './tools/toolCall.js';

const result = await toolCall('{ "tool": "bash", "input": "ls -la" }');
console.log('Tool Call Result:', result);
