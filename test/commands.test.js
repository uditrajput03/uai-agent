import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';


const commandsModule = await import('../src/utils/commands.ts');
const {
    clearConversation,
    rewindConversation,
    exitAgent,
    showHelp,
    exportConversation,
    saveSession,
    saveSessionCommand,
    loadSession
} = commandsModule;


describe('commands - clearConversation', () => {
    let msgArray;

    beforeEach(() => {
        msgArray = [{ role: 'system', content: 'You are a test agent.' }];
    });

    it('should clear all messages except system prompt', () => {
        msgArray.push({ role: 'user', content: 'msg1' });
        msgArray.push({ role: 'assistant', content: 'resp1' });
        msgArray.push({ role: 'user', content: 'msg2' });
        msgArray.push({ role: 'assistant', content: 'resp2' });

        clearConversation(msgArray);
        assert.strictEqual(msgArray.length, 1);
        assert.strictEqual(msgArray[0].role, 'system');
    });

    it('should handle already cleared conversation', () => {
        clearConversation(msgArray);
        assert.strictEqual(msgArray.length, 1);
    });

    it('should handle conversation with tool messages', () => {
        msgArray.push({ role: 'user', content: 'read file' });
        msgArray.push({ role: 'assistant', content: null, tool_calls: [{ id: '1' }] });
        msgArray.push({ role: 'tool', tool_call_id: '1', content: 'file content' });
        msgArray.push({ role: 'assistant', content: 'Here is the file.' });

        clearConversation(msgArray);
        assert.strictEqual(msgArray.length, 1);
    });

    it('should clear only-user conversation (no assistant responses)', () => {
        msgArray.push({ role: 'user', content: 'only user msg' });
        clearConversation(msgArray);
        assert.strictEqual(msgArray.length, 1);
    });
});

describe('commands - rewindConversation', () => {
    let msgArray;

    beforeEach(() => {
        msgArray = [{ role: 'system', content: 'You are a test agent.' }];
    });

    it('should rewind a simple user-assistant exchange', () => {
        msgArray.push({ role: 'user', content: 'Hello' });
        msgArray.push({ role: 'assistant', content: 'Hi!' });
        rewindConversation(msgArray);
        assert.strictEqual(msgArray.length, 1);
    });

    it('should rewind a tool call sequence', () => {
        msgArray.push({ role: 'user', content: 'read file' });
        msgArray.push({ role: 'assistant', content: null, tool_calls: [{ id: '1' }] });
        msgArray.push({ role: 'tool', tool_call_id: '1', content: 'content' });
        msgArray.push({ role: 'assistant', content: 'Here is the file.' });
        rewindConversation(msgArray);
        assert.strictEqual(msgArray.length, 1);
    });

    it('should do nothing when only system prompt remains', () => {
        rewindConversation(msgArray);
        assert.strictEqual(msgArray.length, 1);
    });

    it('should rewind multiple tool messages', () => {
        msgArray.push({ role: 'user', content: 'read and list' });
        msgArray.push({ role: 'assistant', content: null, tool_calls: [{ id: '1' }, { id: '2' }] });
        msgArray.push({ role: 'tool', tool_call_id: '1', content: 'file content' });
        msgArray.push({ role: 'tool', tool_call_id: '2', content: 'list output' });
        msgArray.push({ role: 'assistant', content: 'Summary.' });
        rewindConversation(msgArray);
        assert.strictEqual(msgArray.length, 1);
    });

    it('should handle user message without assistant response', () => {
        msgArray.push({ role: 'user', content: 'Hello' });
        rewindConversation(msgArray);
        assert.strictEqual(msgArray.length, 1);
    });

    it('should rewind last user-assistant pair from multi-exchange conversation', () => {
        msgArray.push({ role: 'user', content: 'msg1' });
        msgArray.push({ role: 'assistant', content: 'resp1' });
        msgArray.push({ role: 'user', content: 'msg2' });
        msgArray.push({ role: 'assistant', content: 'resp2' });
        rewindConversation(msgArray);
        // Should remove msg2 and resp2, leaving msg1 and resp1
        assert.strictEqual(msgArray.length, 3); // system + msg1 + resp1
    });

    it('should handle trailing tool message (incomplete exchange)', () => {
        msgArray.push({ role: 'user', content: 'cmd' });
        msgArray.push({ role: 'assistant', content: null, tool_calls: [{ id: '1' }] });
        msgArray.push({ role: 'tool', tool_call_id: '1', content: 'output' });
        rewindConversation(msgArray);
        assert.strictEqual(msgArray.length, 1);
    });

    it('should handle conversation with only user messages (no responses yet)', () => {
        msgArray.push({ role: 'user', content: 'msg1' });
        msgArray.push({ role: 'user', content: 'msg2' });
        rewindConversation(msgArray);
        // Should remove the last user message (msg2)
        assert.strictEqual(msgArray.length, 2); // system + msg1
    });

    it('should handle conversation with assistant but no user (edge case)', () => {
        msgArray.push({ role: 'assistant', content: 'orphan response' });
        rewindConversation(msgArray);
        // Should remove the orphan assistant message
        assert.strictEqual(msgArray.length, 1);
    });
});

describe('commands - showHelp', () => {
    it('should not throw when called', () => {
        assert.doesNotThrow(() => showHelp());
    });
});

describe('commands - exitAgent', () => {
    it('should call process.exit', () => {
        const mockExit = mock.method(process, 'exit', () => { throw new Error('PROCESS_EXIT'); });

        try {
            exitAgent();
            assert.fail('Should have thrown');
        } catch (error) {
            assert.strictEqual(error.message, 'PROCESS_EXIT');
        }

        mock.restoreAll();
    });
});

describe('commands - exportConversation', () => {
    const testDir = './test/_temp_export';
    let msgArray;

    beforeEach(() => {
        fs.mkdirSync(testDir, { recursive: true });
        msgArray = [{ role: 'system', content: 'You are a test agent.' }];
        // Set up mock once per test suite
        global.__MOCK_ASK_ANSWER = 'test.md';
    });

    afterEach(() => {
        fs.rmSync(testDir, { recursive: true, force: true });
        mock.restoreAll();
    });

    it('should handle empty conversation (only system prompt)', async () => {
        // Only system prompt, no user/assistant messages
        await exportConversation(msgArray, 'test', 'model', testDir);
        // Should print warning but not crash
        assert.ok(true);
    });

    it('should handle conversation with tool messages', async () => {
        msgArray.push({ role: 'user', content: 'read file' });
        msgArray.push({ role: 'assistant', content: null, tool_calls: [{ id: '1', function: { name: 'read', arguments: '{}' } }] });
        msgArray.push({ role: 'tool', tool_call_id: '1', content: 'file content' });
        msgArray.push({ role: 'assistant', content: 'Here is the file.' });

        await exportConversation(msgArray, 'test', 'model', testDir);

        // Check if file was created
        const files = fs.readdirSync(testDir);
        assert.ok(files.some(f => f.endsWith('.md')));
    });

    it('should handle conversation with multiple exchanges', async () => {
        msgArray.push({ role: 'user', content: 'Hello' });
        msgArray.push({ role: 'assistant', content: 'Hi!' });
        msgArray.push({ role: 'user', content: 'How are you?' });
        msgArray.push({ role: 'assistant', content: 'I am good!' });

        await exportConversation(msgArray, 'test', 'model', testDir);

        const files = fs.readdirSync(testDir);
        assert.ok(files.some(f => f.endsWith('.md')));
    });

    it('should use default filename when user provides empty string', async () => {
        msgArray.push({ role: 'user', content: 'Hello' });
        msgArray.push({ role: 'assistant', content: 'Hi!' });

        global.__MOCK_ASK_ANSWER = '';

        await exportConversation(msgArray, 'test', 'model', testDir);

        const files = fs.readdirSync(testDir);
        assert.ok(files.some(f => f.startsWith('chat-export-') && f.endsWith('.md')));
    });

    it('should add .md extension if not provided', async () => {
        msgArray.push({ role: 'user', content: 'Hello' });
        msgArray.push({ role: 'assistant', content: 'Hi!' });

        global.__MOCK_ASK_ANSWER = 'myexport';

        await exportConversation(msgArray, 'test', 'model', testDir);

        const files = fs.readdirSync(testDir);
        assert.ok(files.includes('myexport.md'));
    });

    it('should keep .md extension if already provided', async () => {
        msgArray.push({ role: 'user', content: 'Hello' });
        msgArray.push({ role: 'assistant', content: 'Hi!' });

        global.__MOCK_ASK_ANSWER = 'myexport.md';

        await exportConversation(msgArray, 'test', 'model', testDir);

        const files = fs.readdirSync(testDir);
        assert.ok(files.includes('myexport.md'));
    });

    it('should sanitize traversal in export filename', async () => {
        msgArray.push({ role: 'user', content: 'Hello' });
        msgArray.push({ role: 'assistant', content: 'Hi!' });

        global.__MOCK_ASK_ANSWER = '../evil';
        await exportConversation(msgArray, 'test', 'model', testDir);

        assert.ok(fs.existsSync(path.join(testDir, 'evil.md')));
        assert.strictEqual(fs.existsSync(path.join('test', 'evil.md')), false);
    });

    it('should export assistant tool calls with missing function data safely', async () => {
        msgArray.push({ role: 'user', content: 'do tool' });
        msgArray.push({ role: 'assistant', content: null, tool_calls: [{ id: '1' }] });
        global.__MOCK_ASK_ANSWER = "missing-function.md";
        await assert.doesNotReject(() => exportConversation(msgArray, "test", "model", testDir));
    });
});
describe('commands - saveSession', () => {
    const testDir = './test/_temp_save';
    let msgArray;

    beforeEach(() => {
        if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
        fs.mkdirSync(testDir, { recursive: true });
        msgArray = [{ role: 'system', content: 'You are a test agent.' }];
    });

    afterEach(() => {
        if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
        delete global.__MOCK_ASK_ANSWER;
    });

    it('should create .uai/sessions folder and save session.json', () => {
        msgArray.push({ role: 'user', content: 'Hello' });

        saveSession(msgArray, testDir);

        const savePath = path.join(testDir, '.uai', 'sessions', 'session.json');
        assert.ok(fs.existsSync(savePath));

        const savedData = JSON.parse(fs.readFileSync(savePath, 'utf-8'));
        assert.strictEqual(savedData.length, 2);
        assert.strictEqual(savedData[1].content, 'Hello');
    });

    it('should save with a custom session name', () => {
        const customName = 'mysession-123.json';
        saveSession(msgArray, testDir, customName);

        const savePath = path.join(testDir, '.uai', 'sessions', customName);
        assert.ok(fs.existsSync(savePath));
    });
});

describe('commands - saveSessionCommand', () => {
    const testDir = './test/_temp_save_cmd';
    let msgArray;

    beforeEach(() => {
        if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
        fs.mkdirSync(testDir, { recursive: true });
        msgArray = [{ role: 'system', content: 'agent test.' }];
    });

    afterEach(() => {
        if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    });

    it('should wrap saveSession and capture errors safely', async () => {
        global.__MOCK_ASK_ANSWER = '';

        await assert.doesNotReject(() =>
            saveSessionCommand(msgArray, testDir, 'test-session.json')
        );
        assert.ok(fs.existsSync(path.join(testDir, '.uai', 'sessions', 'test-session.json')));
    });

    it('should ask for an optional session name', async () => {
        global.__MOCK_ASK_ANSWER = 'named-session';

        await saveSessionCommand(msgArray, testDir, 'test-session.json');

        assert.ok(fs.existsSync(path.join(testDir, '.uai', 'sessions', 'named-session.json')));
    });

    it('should keep .json extension if provided', async () => {
        global.__MOCK_ASK_ANSWER = 'named-session.json';

        await saveSessionCommand(msgArray, testDir, 'test-session.json');

        assert.ok(fs.existsSync(path.join(testDir, '.uai', 'sessions', 'named-session.json')));
    });

    it('should sanitize traversal in session name', async () => {
        global.__MOCK_ASK_ANSWER = '../evil';

        await saveSessionCommand(msgArray, testDir, 'test-session.json');

        assert.ok(fs.existsSync(path.join(testDir, '.uai', 'sessions', 'evil.json')));
        assert.strictEqual(fs.existsSync(path.join(testDir, '.uai', 'evil.json')), false);
    });
});

describe('commands - loadSession', () => {
    const testDir = './test/_temp_import';
    let msgArray;

    beforeEach(() => {
        if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
        msgArray = [{ role: 'system', content: 'You are a test agent.' }];

        global.__MOCK_SEARCH_RESULT = 'session.json';
    });

    afterEach(() => {
        if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
        delete global.__MOCK_SEARCH_RESULT;
    });

    it('should ignore if no .uai/sessions dir exists', async () => {
        await loadSession(msgArray, testDir);
        assert.strictEqual(msgArray.length, 1);
    });

    it('should ignore if no json files exist', async () => {
        fs.mkdirSync(path.join(testDir, '.uai', 'sessions'), { recursive: true });
        await loadSession(msgArray, testDir);
        assert.strictEqual(msgArray.length, 1);
    });
});
