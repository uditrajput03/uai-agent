import fs from 'fs';
import path from 'path';

export function getWorkspaceRoot() {
    return fs.realpathSync(process.cwd());
}

export function resolveWorkspacePath(filePath, { requireParent = true } = {}) {
    if (typeof filePath !== 'string' || filePath.trim() === '') {
        return { ok: false, reason: 'Invalid path: path must be a non-empty string' };
    }

    if (filePath.startsWith('~')) {
        return { ok: false, reason: `Path outside workspace is not allowed: ${filePath}` };
    }

    const root = getWorkspaceRoot();
    const resolved = path.resolve(filePath);

    let candidate;
    try {
        if (fs.existsSync(resolved)) {
            candidate = fs.realpathSync(resolved);
        } else {
            const parent = path.dirname(resolved);
            if (!fs.existsSync(parent)) {
                if (requireParent) {
                    return { ok: false, reason: `Parent directory does not exist: ${path.dirname(filePath)}` };
                }
                candidate = resolved;
            } else {
                candidate = path.join(fs.realpathSync(parent), path.basename(resolved));
            }
        }
    } catch (error) {
        return { ok: false, reason: `Invalid path: ${error.message}` };
    }

    const inside = candidate === root || candidate.startsWith(root + path.sep);
    if (!inside) {
        return { ok: false, reason: `Path outside workspace is not allowed: ${filePath}` };
    }

    return { ok: true, root, resolved, realPath: candidate };
}

function escapeRegex(text) {
    return text.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
}

function patternToRegex(pattern) {
    let anchored = pattern.startsWith('/');
    let directory = pattern.endsWith('/');
    let p = pattern.replace(/^\//, '').replace(/\/$/, '');
    const regex = escapeRegex(p)
        .replace(/\\\*\\\*/g, '.*')
        .replace(/\\\*/g, '[^/]*');

    if (directory) {
        return new RegExp(anchored ? `^${regex}(?:/|$)` : `(?:^|/)${regex}(?:/|$)`);
    }
    return new RegExp(anchored ? `^${regex}$` : `(?:^|/)${regex}$|^${regex}$`);
}

export function readGitignorePatterns(cwd = process.cwd()) {
    const gitignorePath = path.join(cwd, '.gitignore');
    if (!fs.existsSync(gitignorePath)) return [];
    return fs.readFileSync(gitignorePath, 'utf-8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#') && !line.startsWith('!'));
}

export function isGitignored(filePath, cwd = process.cwd()) {
    const root = fs.realpathSync(cwd);
    const resolved = path.resolve(filePath);
    const relative = path.relative(root, resolved).split(path.sep).join('/');
    const basename = path.basename(filePath);

    return readGitignorePatterns(root).some(pattern => {
        if (pattern === basename || pattern === relative) return true;
        return patternToRegex(pattern).test(relative);
    });
}
