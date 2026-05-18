import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { printWelcome, printSeparator, printToolCallInfo, printToolResponse } from '../utils/prints.js';

describe('prints', () => {
    let mockConsoleLog;
    let mockConsoleDir;

    beforeEach(() => {
        mockConsoleLog = mock.method(console, 'log', () => {});
        mockConsoleDir = mock.method(console, 'dir', () => {});
    });

    afterEach(() => {
        mock.restoreAll();
    });

    describe('printWelcome', () => {
        it('should print welcome message with provider and model', () => {
            printWelcome('alibaba', 'qwen');
            // Verify console.log was called multiple times
            assert.ok(mockConsoleLog.mock.callCount() > 0);
        });

        it('should include provider name in output', () => {
            printWelcome('nvidia', 'minimax');
            const calls = mockConsoleLog.mock.calls;
            const output = calls.map(c => c.arguments.join(' ')).join(' ');
            assert.ok(output.toLowerCase().includes('nvidia'));
        });

        it('should include model name in output', () => {
            printWelcome('cloudflare', 'kimi');
            const calls = mockConsoleLog.mock.calls;
            const output = calls.map(c => c.arguments.join(' ')).join(' ');
            assert.ok(output.toLowerCase().includes('kimi'));
        });

        it('should handle empty provider and model', () => {
            assert.doesNotThrow(() => printWelcome('', ''));
        });

        it('should print all commands in welcome', () => {
            printWelcome('test', 'test');
            const calls = mockConsoleLog.mock.calls;
            const output = calls.map(c => c.arguments.join(' ')).join(' ');
            assert.ok(output.includes('model'));
            assert.ok(output.includes('help'));
            assert.ok(output.includes('clear'));
            assert.ok(output.includes('rewind'));
            assert.ok(output.includes('export'));
            assert.ok(output.includes('exit'));
        });
    });

    describe('printSeparator', () => {
        it('should print a separator line', () => {
            printSeparator();
            assert.ok(mockConsoleLog.mock.callCount() === 1);
        });

        it('should print dashes', () => {
            printSeparator();
            const call = mockConsoleLog.mock.calls[0];
            const output = call.arguments.join(' ');
            assert.ok(output.includes('─'));
        });
    });

    describe('printToolCallInfo', () => {
        it('should print tool call information', () => {
            const toolCalls = [{
                function: {
                    name: 'read',
                    arguments: '{"filePath": "./test.txt"}'
                }
            }];
            printToolCallInfo(toolCalls);
            assert.ok(mockConsoleLog.mock.callCount() > 0);
        });

        it('should print multiple tool calls', () => {
            const toolCalls = [
                { function: { name: 'read', arguments: '{"filePath": "a.txt"}' } },
                { function: { name: 'bash', arguments: '{"command": "ls"}' } }
            ];
            printToolCallInfo(toolCalls);
            const calls = mockConsoleLog.mock.calls;
            const output = calls.map(c => c.arguments.join(' ')).join(' ');
            assert.ok(output.includes('read'));
            assert.ok(output.includes('bash'));
        });

        it('should handle invalid JSON in arguments gracefully', () => {
            const toolCalls = [{
                function: {
                    name: 'read',
                    arguments: '{invalid json'
                }
            }];
            assert.doesNotThrow(() => printToolCallInfo(toolCalls));
        });

        it('should handle empty tool calls array', () => {
            printToolCallInfo([]);
            // Should not crash
            assert.ok(true);
        });

        it('should handle tool calls with no arguments', () => {
            const toolCalls = [{
                function: {
                    name: 'bash',
                    arguments: ''
                }
            }];
            assert.doesNotThrow(() => printToolCallInfo(toolCalls));
        });
    });

    describe('printToolResponse', () => {
        it('should print tool response with content', () => {
            const toolResponse = 'File content here';
            const toolCalls = [{ function: { name: 'read', arguments: '{"filePath": "./test.txt"}' } }];
            printToolResponse(toolResponse, toolCalls);
            assert.ok(mockConsoleLog.mock.callCount() > 0);
        });

        it('should handle null tool response', () => {
            printToolResponse(null, []);
            const calls = mockConsoleLog.mock.calls;
            const output = calls.map(c => c.arguments.join(' ')).join(' ');
            assert.ok(output.includes('No output returned'));
        });

        it('should handle undefined tool response', () => {
            printToolResponse(undefined, []);
            const calls = mockConsoleLog.mock.calls;
            const output = calls.map(c => c.arguments.join(' ')).join(' ');
            assert.ok(output.includes('No output returned'));
        });

        it('should handle empty string tool response', () => {
            printToolResponse('', []);
            assert.ok(mockConsoleLog.mock.callCount() > 0);
        });

        it('should handle tool calls as non-array', () => {
            printToolResponse('output', { function: { name: 'read', arguments: '{}' } });
            assert.ok(mockConsoleLog.mock.callCount() > 0);
        });

        it('should handle null tool calls', () => {
            printToolResponse('output', null);
            assert.ok(mockConsoleLog.mock.callCount() > 0);
        });

        it('should handle write tool showing only filePath', () => {
            const toolCalls = [{
                function: {
                    name: 'write',
                    arguments: '{"filePath": "./test.txt", "content": "secret content"}'
                }
            }];
            printToolResponse('written', toolCalls);
            const calls = mockConsoleLog.mock.calls;
            const output = calls.map(c => c.arguments.join(' ')).join(' ');
            assert.ok(output.includes('./test.txt'));
            // Content should not be displayed for write/edit
            assert.ok(!output.includes('secret content'));
        });

        it('should handle edit tool showing only filePath', () => {
            const toolCalls = [{
                function: {
                    name: 'edit',
                    arguments: '{"filePath": "./test.txt", "oldContent": "old", "newContent": "new"}'
                }
            }];
            printToolResponse('edited', toolCalls);
            const calls = mockConsoleLog.mock.calls;
            const output = calls.map(c => c.arguments.join(' ')).join(' ');
            assert.ok(output.includes('./test.txt'));
            assert.ok(!output.includes('old'));
        });

        it('should handle invalid JSON in tool call arguments', () => {
            const toolCalls = [{
                function: {
                    name: 'read',
                    arguments: '{bad json'
                }
            }];
            assert.doesNotThrow(() => printToolResponse('output', toolCalls));
        });

        it('should handle tool calls with no function property', () => {
            const toolCalls = [{}];
            assert.doesNotThrow(() => printToolResponse('output', toolCalls));
        });

        it('should handle tool calls with unknown tool name', () => {
            const toolCalls = [{
                function: {
                    name: 'unknown_tool',
                    arguments: '{}'
                }
            }];
            assert.doesNotThrow(() => printToolResponse('output', toolCalls));
        });

        it('should display array tool responses', () => {
            const toolResponse = ['line1', 'line2', 'line3'];
            printToolResponse(toolResponse, []);
            assert.ok(mockConsoleLog.mock.callCount() > 0);
        });

        it('should not expose write content even with invalid-looking extra fields', () => {
            const toolCalls = [{
                function: {
                    name: 'write',
                    arguments: JSON.stringify({ filePath: './safe.txt', content: 'DO_NOT_PRINT', nested: { token: 'SECRET' } })
                }
            }];
            printToolResponse('written', toolCalls);
            const output = mockConsoleLog.mock.calls.map(c => c.arguments.join(' ')).join(' ');
            assert.ok(output.includes('./safe.txt'));
            assert.ok(!output.includes('DO_NOT_PRINT'));
            assert.ok(!output.includes('SECRET'));
        });

        it('should handle tool call arguments that parse to null', () => {
            const toolCalls = [{ function: { name: 'read', arguments: 'null' } }];
            assert.doesNotThrow(() => printToolResponse('output', toolCalls));
        });
    });
});
