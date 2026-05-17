import { keys } from "../config/keys.js";

const REDACTION_PATTERNS = {
    // Email addresses
    email: {
        pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        replacement: '[EMAIL_REDACTED]'
    },
    // Phone numbers (various formats)
    username: {
        pattern: process.env.USER ? new RegExp(`\\b${process.env.USER}\\b`, 'g') : null,
        replacement: '[NAME_REDACTED]'
    }
};

let customPatterns = [];
let wordBoundaryPatterns = [];
if (keys.REDACTION_PATTERN) {
    try {
        const parsed = keys.REDACTION_PATTERN
        if (Array.isArray(parsed)) {
            const validStrings = parsed.filter(p => typeof p === 'string' && p.length > 0);
            const validRegexes = parsed.filter(p => typeof p === 'object' && p instanceof RegExp);
            customPatterns = validStrings.map(p => new RegExp(p, 'gi'));
            customPatterns = [...customPatterns, ...validRegexes];

            wordBoundaryPatterns = validStrings
                .filter(p => !(p.startsWith('\\b') && p.endsWith('\\b')))
                .map(p => new RegExp(`\\b${p}\\b`, 'gi'));
            customPatterns = [...wordBoundaryPatterns, ...customPatterns];
        }

    } catch (error) {
        // Fallback: treat as comma-separated if not valid JSON
        if (typeof keys.REDACTION_PATTERN === 'string') {
            customPatterns = keys.REDACTION_PATTERN
                .split(',')
                .map(p => p.trim())
                .filter(p => p.length > 0)
                .map(p => new RegExp(p, 'gi'));
        }
    }
}

export function redact(text, options = {}) {
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
        console.log("Custom Patterns", customPatterns);

        for (const pattern of customPatterns) {
            redactedText = redactedText.replace(pattern, '[REDACTED]');
        }
    }

    return redactedText;
}