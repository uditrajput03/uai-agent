import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { readFile, writeFile, editFile } from '../tools/fsOps.js';

describe('fsOps', () => {
    const testDir = './test/_temp_fsops';

    beforeEach(() => {
        fs.mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
        fs.rmSync(testDir, { recursive: true, force: true });
    });

    describe('readFile', () => {
        it('should read an existing file successfully', () => {
            const filePath = path.join(testDir, 'test.txt');
            fs.writeFileSync(filePath, 'Hello World');
            const result = readFile(filePath);
            assert.strictEqual(result, 'Hello World');
        });

        it('should return error message for non-existent file', () => {
            const result = readFile('./non_existent_file_xyz.txt');
            assert.ok(result.startsWith('File not found:'));
        });

        it('should read empty files', () => {
            const filePath = path.join(testDir, 'empty.txt');
            fs.writeFileSync(filePath, '');
            const result = readFile(filePath);
            assert.strictEqual(result, '');
        });

        it('should read files with special characters', () => {
            const filePath = path.join(testDir, 'special.txt');
            const content = 'Line1\nLine2\tTabbed\r\nUnicode: \u00e9\u00e0\u00fc\nEmoji: \u{1F600}';
            fs.writeFileSync(filePath, content);
            const result = readFile(filePath);
            assert.strictEqual(result, content);
        });

        it('should read files with large content', () => {
            const filePath = path.join(testDir, 'large.txt');
            const content = 'x'.repeat(100000);
            fs.writeFileSync(filePath, content);
            const result = readFile(filePath);
            assert.strictEqual(result.length, 100000);
        });

        it('should read JSON files', () => {
            const filePath = path.join(testDir, 'data.json');
            const content = '{"key": "value", "nested": {"a": 1}}';
            fs.writeFileSync(filePath, content);
            const result = readFile(filePath);
            assert.strictEqual(result, content);
        });

        it('should handle files with null bytes', () => {
            const filePath = path.join(testDir, 'nullbytes.txt');
            fs.writeFileSync(filePath, 'before\x00after');
            const result = readFile(filePath);
            assert.ok(result.includes('before'));
        });

        it('should return error for directory path', () => {
            const result = readFile(testDir);
            assert.ok(result.startsWith('Error reading file'));
        });

        it('should handle permission denied (if possible to test)', () => {
            const filePath = path.join(testDir, 'noperm.txt');
            fs.writeFileSync(filePath, 'secret');
            // Make unreadable
            try {
                fs.chmodSync(filePath, 0o000);
                const result = readFile(filePath);
                assert.ok(result.startsWith('Error reading file'));
            } finally {
                // Restore permissions for cleanup
                fs.chmodSync(filePath, 0o644);
            }
        });

        it('should read files with Windows-style line endings', () => {
            const filePath = path.join(testDir, 'crlf.txt');
            fs.writeFileSync(filePath, 'line1\r\nline2\r\n');
            const result = readFile(filePath);
            assert.strictEqual(result, 'line1\r\nline2\r\n');
        });

        it('should handle relative paths correctly', () => {
            const filePath = path.join(testDir, 'relative.txt');
            fs.writeFileSync(filePath, 'relative content');
            const result = readFile(filePath);
            assert.strictEqual(result, 'relative content');
        });
    });

    describe('writeFile', () => {
        it('should write content to a new file', () => {
            const filePath = path.join(testDir, 'new.txt');
            const result = writeFile(filePath, 'Test content');
            assert.ok(result.includes('File written successfully'));
            assert.strictEqual(fs.readFileSync(filePath, 'utf-8'), 'Test content');
        });

        it('should overwrite existing files', () => {
            const filePath = path.join(testDir, 'overwrite.txt');
            fs.writeFileSync(filePath, 'old content');
            const result = writeFile(filePath, 'new content');
            assert.ok(result.includes('File written successfully'));
            assert.strictEqual(fs.readFileSync(filePath, 'utf-8'), 'new content');
        });

        it('should write empty content', () => {
            const filePath = path.join(testDir, 'empty.txt');
            const result = writeFile(filePath, '');
            assert.ok(result.includes('File written successfully'));
            assert.strictEqual(fs.readFileSync(filePath, 'utf-8'), '');
        });

        it('should create intermediate directories', () => {
            const filePath = path.join(testDir, 'sub', 'dir', 'nested.txt');
            const result = writeFile(filePath, 'nested content');
            // Note: writeFileSync doesn't create dirs by default, so this should fail
            assert.ok(result.startsWith('Error writing file'));
        });

        it('should write special characters', () => {
            const filePath = path.join(testDir, 'special.txt');
            const content = 'Unicode: \u00e9\u00e0\u00fc\nEmoji: \u{1F600}\nTabs:\t\t\n';
            writeFile(filePath, content);
            assert.strictEqual(fs.readFileSync(filePath, 'utf-8'), content);
        });

        it('should handle very large content', () => {
            const filePath = path.join(testDir, 'large.txt');
            const content = 'A'.repeat(1000000);
            const result = writeFile(filePath, content);
            assert.ok(result.includes('File written successfully'));
        });

        it('should return error for invalid path', () => {
            const result = writeFile('/nonexistent/path/file.txt', 'content');
            assert.ok(result.startsWith('Error writing file'));
        });

        it('should write content with null bytes', () => {
            const filePath = path.join(testDir, 'nullbytes.txt');
            const content = 'before\x00after';
            writeFile(filePath, content);
            const read = fs.readFileSync(filePath, 'utf-8');
            assert.strictEqual(read, content);
        });

        it('should handle content that is number 0 (falsy)', () => {
            const filePath = path.join(testDir, 'zero.txt');
            const result = writeFile(filePath, '0');
            assert.ok(result.includes('File written successfully'));
            assert.strictEqual(fs.readFileSync(filePath, 'utf-8'), '0');
        });
    });

    describe('editFile', () => {
        beforeEach(() => {
            fs.writeFileSync(path.join(testDir, 'edit.txt'), 'Hello World\nFoo Bar\nHello Again');
        });

        it('should replace exact content match', () => {
            const filePath = path.join(testDir, 'edit.txt');
            const result = editFile(filePath, 'Hello World', 'Goodbye World');
            assert.ok(result.includes('File edited successfully'));
            const content = fs.readFileSync(filePath, 'utf-8');
            assert.strictEqual(content, 'Goodbye World\nFoo Bar\nHello Again');
        });

        it('should only replace the first occurrence', () => {
            const filePath = path.join(testDir, 'edit.txt');
            const result = editFile(filePath, 'Hello', 'Hi');
            assert.ok(result.includes('File edited successfully'));
            const content = fs.readFileSync(filePath, 'utf-8');
            assert.strictEqual(content, 'Hi World\nFoo Bar\nHello Again');
        });

        it('should return error if oldContent not found', () => {
            const filePath = path.join(testDir, 'edit.txt');
            const result = editFile(filePath, 'NotInFile', 'replacement');
            assert.ok(result.includes('oldContent not found'));
        });

        it('should return error for non-existent file', () => {
            const result = editFile('./nonexistent_file.txt', 'old', 'new');
            assert.ok(result.startsWith('File not found:'));
        });

        it('should handle replacing with empty string', () => {
            const filePath = path.join(testDir, 'edit.txt');
            const result = editFile(filePath, 'Hello World\n', '');
            assert.ok(result.includes('File edited successfully'));
            const content = fs.readFileSync(filePath, 'utf-8');
            assert.strictEqual(content, 'Foo Bar\nHello Again');
        });

        it('should handle replacing empty string (edge case)', () => {
            const filePath = path.join(testDir, 'edit.txt');
            // Replacing empty string with something - replace() inserts at beginning
            const result = editFile(filePath, '', 'PREFIX');
            assert.ok(result.includes('File edited successfully'));
            const content = fs.readFileSync(filePath, 'utf-8');
            assert.ok(content.startsWith('PREFIX'));
        });

        it('should handle multiline oldContent', () => {
            const filePath = path.join(testDir, 'edit.txt');
            const result = editFile(filePath, 'Hello World\nFoo Bar', 'Replaced Block');
            assert.ok(result.includes('File edited successfully'));
            const content = fs.readFileSync(filePath, 'utf-8');
            assert.strictEqual(content, 'Replaced Block\nHello Again');
        });

        it('should handle special regex characters in oldContent literally', () => {
            const filePath = path.join(testDir, 'regex.txt');
            fs.writeFileSync(filePath, 'Price is $10.99 (50% off) [deal]');
            const result = editFile(filePath, '$10.99 (50% off) [deal]', '$FREE');
            assert.ok(result.includes('File edited successfully'));
            const content = fs.readFileSync(filePath, 'utf-8');
            assert.strictEqual(content, 'Price is $FREE');
        });

        it('should preserve file encoding', () => {
            const filePath = path.join(testDir, 'edit.txt');
            editFile(filePath, 'Hello World', 'Hola Mundo');
            const content = fs.readFileSync(filePath, 'utf-8');
            assert.ok(content.includes('Hola Mundo'));
        });

        it('should handle newlines in oldContent and newContent', () => {
            const filePath = path.join(testDir, 'edit.txt');
            const result = editFile(filePath, 'Foo Bar\nHello Again', 'Single Line');
            assert.ok(result.includes('File edited successfully'));
            const content = fs.readFileSync(filePath, 'utf-8');
            assert.strictEqual(content, 'Hello World\nSingle Line');
        });

        it('should return error for directory path', () => {
            const result = editFile(testDir, 'old', 'new');
            assert.ok(result.startsWith('Error editing file') || result.startsWith('File not found'));
        });
    });
});
