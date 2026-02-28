/**
 * Input sanitization utilities to prevent XSS and injection attacks
 */

// HTML entity encoding map
const htmlEntities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
};

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - Input string
 * @returns {string} - Sanitized string
 */
const escapeHtml = (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"'`=/]/g, (char) => htmlEntities[char]);
};

/**
 * Remove potentially dangerous patterns from text
 * @param {string} str - Input string
 * @returns {string} - Cleaned string
 */
const stripDangerousPatterns = (str) => {
    if (typeof str !== 'string') return '';

    let cleaned = str;

    // Remove javascript: protocol
    cleaned = cleaned.replace(/javascript\s*:/gi, '');

    // Remove data: protocol (except safe image types)
    cleaned = cleaned.replace(/data\s*:\s*(?!image\/(png|jpeg|gif|webp))/gi, '');

    // Remove vbscript: protocol
    cleaned = cleaned.replace(/vbscript\s*:/gi, '');

    // Remove event handlers (onclick, onerror, etc.)
    cleaned = cleaned.replace(/\bon\w+\s*=/gi, '');

    // Remove script tags
    cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove style tags
    cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Remove iframe tags
    cleaned = cleaned.replace(/<iframe\b[^>]*>.*?<\/iframe>/gi, '');

    // Remove object/embed tags
    cleaned = cleaned.replace(/<(object|embed)\b[^>]*>.*?<\/\1>/gi, '');

    return cleaned;
};

/**
 * Sanitize user input for safe storage and display
 * @param {string} str - Input string
 * @param {Object} options - Sanitization options
 * @param {boolean} options.escapeHtml - Whether to escape HTML (default: false for messages)
 * @param {boolean} options.stripDangerous - Whether to strip dangerous patterns (default: true)
 * @param {number} options.maxLength - Maximum length (default: no limit)
 * @returns {string} - Sanitized string
 */
const sanitizeInput = (str, options = {}) => {
    if (typeof str !== 'string') return '';

    const {
        escapeHtml: shouldEscape = false,
        stripDangerous = true,
        maxLength = 0,
    } = options;

    let result = str.trim();

    // Strip dangerous patterns first
    if (stripDangerous) {
        result = stripDangerousPatterns(result);
    }

    // Escape HTML if requested
    if (shouldEscape) {
        result = escapeHtml(result);
    }

    // Enforce max length
    if (maxLength > 0 && result.length > maxLength) {
        result = result.slice(0, maxLength);
    }

    return result;
};

/**
 * Sanitize message text - strips dangerous patterns but preserves safe content
 * @param {string} text - Message text
 * @returns {string} - Sanitized message
 */
const sanitizeMessage = (text) => {
    return sanitizeInput(text, {
        escapeHtml: false, // Frontend will handle display escaping
        stripDangerous: true,
        maxLength: 10000, // Max message length
    });
};

/**
 * Sanitize username - strict sanitization
 * @param {string} username - Username
 * @returns {string} - Sanitized username
 */
const sanitizeUsername = (username) => {
    if (typeof username !== 'string') return '';
    // Only allow alphanumeric, underscore, hyphen
    return username.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
};

/**
 * Sanitize room ID - strict sanitization
 * @param {string} roomId - Room ID
 * @returns {string} - Sanitized room ID
 */
const sanitizeRoomId = (roomId) => {
    if (typeof roomId !== 'string') return '';
    // Allow alphanumeric, underscore, hyphen, colon (for DMs)
    return roomId.replace(/[^a-zA-Z0-9_:-]/g, '').slice(0, 100);
};

/**
 * Sanitize URL - only allow http/https protocols
 * @param {string} url - URL string
 * @returns {string|null} - Sanitized URL or null if invalid
 */
const sanitizeUrl = (url) => {
    if (typeof url !== 'string') return null;

    const trimmed = url.trim();

    // Allow data URLs for images
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

module.exports = {
    escapeHtml,
    stripDangerousPatterns,
    sanitizeInput,
    sanitizeMessage,
    sanitizeUsername,
    sanitizeRoomId,
    sanitizeUrl,
};
