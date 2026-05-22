module.exports = {
  isValidId: (id) => typeof id === 'string' && id.length <= 128 && /^[a-zA-Z0-9_\-]+$/.test(id),
};
