import fs from 'fs';
import path from 'path';
import { resolveWorkspacePath } from '../utils/pathSecurity.js';

function formatError(action, filePath, error) {
    return `Error ${action} file ${filePath}: ${error.message}`;
}

export function readFile(filePath) {
    const safePath = resolveWorkspacePath(filePath);
    if (!safePath.ok) return `Error reading file ${filePath}: ${safePath.reason}`;

    try {
        const stat = fs.statSync(safePath.realPath);
        if (!stat.isFile()) return `Error reading file ${filePath}: path is not a file`;
        return fs.readFileSync(safePath.realPath, 'utf-8');
    } catch (error) {
        return formatError('reading', filePath, error);
    }
}

export function writeFile(filePath, content) {
    const safePath = resolveWorkspacePath(filePath);
    if (!safePath.ok) return `Error writing file ${filePath}: ${safePath.reason}`;

    try {
        const parent = path.dirname(safePath.realPath);
        if (!fs.existsSync(parent)) return `Error writing file ${filePath}: parent directory does not exist`;
        if (fs.existsSync(safePath.realPath) && !fs.statSync(safePath.realPath).isFile()) {
            return `Error writing file ${filePath}: path is not a file`;
        }
        fs.writeFileSync(safePath.realPath, String(content), 'utf-8');
        return `File written successfully to ${filePath}`;
    } catch (error) {
        return formatError('writing', filePath, error);
    }
}

export function editFile(filePath, oldContent, newContent) {
    const safePath = resolveWorkspacePath(filePath);
    if (!safePath.ok) return `Error editing file ${filePath}: ${safePath.reason}`;

    try {
        if (!fs.existsSync(safePath.realPath)) return `File not found: ${filePath}`;
        if (!fs.statSync(safePath.realPath).isFile()) return `Error editing file ${filePath}: path is not a file`;

        const data = fs.readFileSync(safePath.realPath, 'utf-8');
        if (oldContent === '') return `Error: oldContent must not be empty. No changes made.`;
        if (!data.includes(oldContent)) return `Error: oldContent not found in ${filePath}. No changes made.`;

        fs.writeFileSync(safePath.realPath, data.replace(oldContent, newContent), 'utf-8');
        return `File edited successfully: ${filePath}`;
    } catch (error) {
        return formatError('editing', filePath, error);
    }
}
