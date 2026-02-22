const isPlainObject = (value) => (
    value !== null && typeof value === 'object' && !Array.isArray(value)
);

const normalizeNonEmptyString = (value) => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = {
    isPlainObject,
    normalizeNonEmptyString,
    escapeRegExp,
};
