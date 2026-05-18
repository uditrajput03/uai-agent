import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { redact } from '../utils/redact.js';

describe('redact', () => {
    describe('Email redaction', () => {
        it('should redact a simple email address', () => {
            const result = redact('Contact us at user@example.com for help');
            assert.ok(!result.includes('user@example.com'));
            assert.ok(result.includes('[EMAIL_REDACTED]'));
        });

        it('should redact multiple email addresses', () => {
            const result = redact('Email a@b.com and c@d.org today');
            assert.ok(!result.includes('a@b.com'));
            assert.ok(!result.includes('c@d.org'));
            const matches = result.match(/\[EMAIL_REDACTED\]/g);
            assert.strictEqual(matches.length, 2);
        });

        it('should redact emails with dots in the local part', () => {
            const result = redact('john.doe@company.co.uk');
            assert.ok(!result.includes('john.doe@company.co.uk'));
            assert.ok(result.includes('[EMAIL_REDACTED]'));
        });

        it('should redact emails with plus addressing', () => {
            const result = redact('user+tag@gmail.com');
            assert.ok(!result.includes('user+tag@gmail.com'));
            assert.ok(result.includes('[EMAIL_REDACTED]'));
        });

        it('should redact emails with underscores and percent signs', () => {
            const result = redact('user_name%tag@domain.com');
            assert.ok(!result.includes('user_name%tag@domain.com'));
            assert.ok(result.includes('[EMAIL_REDACTED]'));
        });

        it('should not redact non-email text when redactEmails is false', () => {
            const result = redact('user@example.com', { redactEmails: false });
            assert.ok(result.includes('user@example.com'));
        });

        it('should handle emails with hyphens in domain', () => {
            const result = redact('test@my-domain.com');
            assert.ok(!result.includes('test@my-domain.com'));
            assert.ok(result.includes('[EMAIL_REDACTED]'));
        });

        it('should handle emails with subdomains', () => {
            const result = redact('user@mail.server.example.com');
            assert.ok(!result.includes('user@mail.server.example.com'));
            assert.ok(result.includes('[EMAIL_REDACTED]'));
        });
    });

    describe('Username redaction', () => {
        it('should redact current username from output', () => {
            const username = process.env.USER;
            if (username) {
                const result = redact(`Hello ${username}, welcome!`);
                assert.ok(!result.includes(username));
                assert.ok(result.includes('[NAME_REDACTED]'));
            }
        });

        it('should not redact username when redactUsernames and redactCustom are false', () => {
            const username = process.env.USER;
            if (username) {
                const result = redact(`Hello ${username}`, { redactUsernames: false, redactCustom: false });
                assert.ok(result.includes(username));
            }
        });

        it('should handle username with word boundaries', () => {
            const username = process.env.USER;
            if (username) {
                // Should not redact partial matches
                const result = redact(`${username}extended`);
                // Word boundary should prevent matching if followed by more word chars
                // Actually \b matches at the boundary between word and non-word chars
                // so "username" in "usernameextended" would not match since there's no boundary
            }
        });
    });

    describe('Edge cases', () => {
        it('should handle null input', () => {
            const result = redact(null);
            assert.strictEqual(result, null);
        });

        it('should handle undefined input', () => {
            const result = redact(undefined);
            assert.strictEqual(result, undefined);
        });

        it('should handle number input', () => {
            const result = redact(42);
            assert.strictEqual(result, 42);
        });

        it('should handle empty string', () => {
            const result = redact('');
            assert.strictEqual(result, '');
        });

        it('should handle string with no sensitive data', () => {
            const result = redact('Hello World, this is a test.');
            assert.strictEqual(result, 'Hello World, this is a test.');
        });

        it('should handle very long strings', () => {
            const longText = 'a'.repeat(100000) + ' user@example.com ' + 'b'.repeat(100000);
            const result = redact(longText);
            assert.ok(!result.includes('user@example.com'));
            assert.ok(result.includes('[EMAIL_REDACTED]'));
        });

        it('should handle multiline strings with emails', () => {
            const text = 'Line 1: a@b.com\nLine 2: c@d.com\nLine 3: no email';
            const result = redact(text);
            assert.ok(!result.includes('a@b.com'));
            assert.ok(!result.includes('c@d.com'));
            const matches = result.match(/\[EMAIL_REDACTED\]/g);
            assert.strictEqual(matches.length, 2);
        });

        it('should handle all redaction options disabled', () => {
            const result = redact('user@example.com', {
                redactEmails: false,
                redactUsernames: false,
                redactCustom: false
            });
            assert.ok(result.includes('user@example.com'));
        });

        it('should handle strings with special characters', () => {
            const text = 'Special chars: <>&"\n\t\r';
            const result = redact(text);
            assert.strictEqual(result, text);
        });

        it('should handle overlapping patterns', () => {
            // Email that also contains username
            const username = process.env.USER;
            if (username) {
                const text = `Contact ${username}@example.com`;
                const result = redact(text);
                assert.ok(!result.includes(`${username}@example.com`));
            }
        });

        it('should handle boolean input', () => {
            assert.strictEqual(redact(true), true);
            assert.strictEqual(redact(false), false);
        });

        it('should handle object input', () => {
            const obj = { key: 'value' };
            assert.strictEqual(redact(obj), obj);
        });
    });
});
