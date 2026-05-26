import { keys } from "../config/keys.js";

function escapeRegex(text: string | RegExp) {
    return String(text).replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
}

function makeWholeTokenPattern(text: string | RegExp, flags = 'gi') {
    return new RegExp(`(?<![A-Za-z0-9_])${escapeRegex(text)}(?![A-Za-z0-9_])`, flags);
}

const REDACTION_PATTERNS = {
    // Email addresses
    email: {
        pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        replacement: '[EMAIL_REDACTED]'
    },
    username: {
        pattern: process.env.USER ? makeWholeTokenPattern(process.env.USER, 'g') : null,
        replacement: '[NAME_REDACTED]'
    }
};

let customPatterns: RegExp[] = [];
if (keys.REDACTION_PATTERN) {
    try {
        const parsed = keys.REDACTION_PATTERN;
        if (Array.isArray(parsed)) {
            const validStrings = parsed.filter(p => typeof p === 'string' && p.length > 0);
            const validRegexes = parsed.filter(p => p instanceof RegExp);

            customPatterns = [
                ...validStrings.map(p => makeWholeTokenPattern(p, 'gi')),
                ...validRegexes
            ];
        }
    } catch (error) {
        // Fallback: treat as comma-separated if not valid JSON
        const pattersnString = keys.REDACTION_PATTERN as unknown as string;
        if (typeof pattersnString == 'string') {
            customPatterns = pattersnString
                .split(',')
                .map(p => p.trim())
                .filter(p => p.length > 0)
                .map(p => makeWholeTokenPattern(p, 'gi'));
        }
    }
}

export function redact(text: string, options: { redactEmails?: boolean; redactUsernames?: boolean; redactCustom?: boolean } = {}) {
    if (!text || typeof text !== 'string') {
        return text;
    }
    const {
        redactEmails = true,
        redactUsernames = true,
        redactCustom = true,
    } = options;

    let redactedText = text;

    const patterns = [
        { enabled: redactEmails, ...REDACTION_PATTERNS.email },
        { enabled: redactUsernames, ...REDACTION_PATTERNS.username }
    ];

    for (const { enabled, pattern, replacement } of patterns) {
        if (enabled && pattern) {
            redactedText = redactedText.replace(pattern, replacement);
        }
    }

    if (redactCustom) {
        for (const pattern of customPatterns) {
            redactedText = redactedText.replace(pattern, '[REDACTED]');
        }
    }

    return redactedText;
}
