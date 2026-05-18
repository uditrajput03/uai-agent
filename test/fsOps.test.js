import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { readFile, writeFile, editFile } from '../tools/fsOps.js';

function inTempWorkspace(name, fn) {
    const root = path.join('test', `_temp_${name}`);
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    const previous = process.cwd();
    process.chdir(root);
    try { fn(root); } finally { process.chdir(previous); fs.rmSync(root, { recursive: true, force: true }); }
}

describe('fsOps', () => {
    it('reads files inside the current workspace', () => inTempWorkspace('fs_read', () => {
        fs.writeFileSync('a.txt', 'hello');
        assert.strictEqual(readFile('./a.txt'), 'hello');
    }));

    it('returns a clear error for missing files', () => inTempWorkspace('fs_missing', () => {
        assert.match(readFile('./missing.txt'), /Error reading file|ENOENT/);
    }));

    it('blocks reads outside the workspace', () => inTempWorkspace('fs_oob_read', () => {
        assert.match(readFile('../secret.txt'), /outside workspace|Error reading/);
    }));

    it('writes and overwrites files inside the workspace', () => inTempWorkspace('fs_write', () => {
        assert.match(writeFile('./out.txt', 'one'), /File written successfully/);
        assert.strictEqual(fs.readFileSync('out.txt', 'utf-8'), 'one');
        assert.match(writeFile('./out.txt', 'two'), /File written successfully/);
        assert.strictEqual(fs.readFileSync('out.txt', 'utf-8'), 'two');
    }));

    it('does not create missing parent directories implicitly', () => inTempWorkspace('fs_parent', () => {
        assert.match(writeFile('./missing/out.txt', 'x'), /Parent directory|parent directory|ENOENT/);
    }));

    it('blocks writes outside the workspace', () => inTempWorkspace('fs_oob_write', () => {
        assert.match(writeFile('../out.txt', 'x'), /outside workspace|Error writing/);
    }));

    it('edits the first exact match only', () => inTempWorkspace('fs_edit', () => {
        fs.writeFileSync('edit.txt', 'hello hello');
        assert.match(editFile('./edit.txt', 'hello', 'hi'), /File edited successfully/);
        assert.strictEqual(fs.readFileSync('edit.txt', 'utf-8'), 'hi hello');
    }));

    it('rejects empty oldContent to avoid accidental insertion', () => inTempWorkspace('fs_empty_edit', () => {
        fs.writeFileSync('edit.txt', 'hello');
        assert.match(editFile('./edit.txt', '', 'prefix'), /must not be empty/);
        assert.strictEqual(fs.readFileSync('edit.txt', 'utf-8'), 'hello');
    }));

    it('rejects symlink escapes outside the workspace', () => inTempWorkspace('fs_symlink_escape', () => {
        fs.writeFileSync('../outside.txt', 'secret');
        fs.symlinkSync('../outside.txt', 'link.txt');
        assert.match(readFile('./link.txt'), /outside workspace|Error reading/);
        fs.rmSync('../outside.txt', { force: true });
    }));

    it('does not allow editing directories', () => inTempWorkspace('fs_edit_dir', () => {
        fs.mkdirSync('dir');
        assert.match(editFile('./dir', 'a', 'b'), /path is not a file|Error editing/);
    }));
});
