// Validates req.body against a zod schema; replaces req.body with the parsed
// (coerced/stripped) result on success, responds 400 with the first issue on failure.
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.issues[0]?.message || 'Invalid request body' });
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validateBody };
