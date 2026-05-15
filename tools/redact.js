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

export function redact(text, options = {}) {
    if (!text || typeof text !== 'string') {
        return text;
    }
    const {
        redactEmails = true,
        redactUsernames = true,
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
    return redactedText;
}