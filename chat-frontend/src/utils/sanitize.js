/**
 * Frontend input sanitization utilities
 * Defense-in-depth: sanitize on display even though backend also sanitizes
 */

// HTML entity encoding map
const htmlEntities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
};

/**
 * Escape HTML special characters for safe display
 * @param {string} str - Input string
 * @returns {string} - Escaped string safe for innerHTML
 */
export const escapeHtml = (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"']/g, (char) => htmlEntities[char]);
};

/**
 * Sanitize text content for display
 * Use this when setting textContent (already safe) or when you need escaped HTML
 * @param {string} text - Input text
 * @returns {string} - Sanitized text
 */
export const sanitizeForDisplay = (text) => {
    if (typeof text !== 'string') return '';
    return text
        .replace(/javascript\s*:/gi, '')
        .replace(/vbscript\s*:/gi, '')
        .replace(/on\w+\s*=/gi, '');
};

/**
 * Validate and sanitize URL
 * @param {string} url - URL to validate
 * @returns {string|null} - Safe URL or null
 */
export const sanitizeUrl = (url) => {
    if (typeof url !== 'string') return null;
    const trimmed = url.trim();

    // Allow data URLs for images only
    if (trimmed.startsWith('data:image/')) {
        return trimmed;
    }

    // Only allow http/https
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        return null;
    }

    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return null;
        }
        return parsed.href;
    } catch {
        return null;
    }
};

/**
 * Convert URLs in text to clickable links (safely)
 * @param {string} text - Text that may contain URLs
 * @returns {string} - Text with URLs converted to safe anchor tags
 */
export const linkifyText = (text) => {
    if (typeof text !== 'string') return '';

    // First escape HTML
    const escaped = escapeHtml(text);

    // URL regex pattern
    const urlPattern = /(https?:\/\/[^\s<]+)/gi;

    return escaped.replace(urlPattern, (url) => {
        const safeUrl = sanitizeUrl(url);
        if (!safeUrl) return url;
        // Double-escape the URL for href attribute
        const escapedUrl = escapeHtml(safeUrl);
        return `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
};

export default {
    escapeHtml,
    sanitizeForDisplay,
    sanitizeUrl,
    linkifyText,
};
