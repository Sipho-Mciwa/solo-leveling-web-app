// Validates req.body against a zod schema; replaces req.body with the parsed
// (coerced/stripped) result on success, responds 400 with the first issue
// (prefixed with its field path, so callers can tell which field is wrong)
// on failure.
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issue = result.error.issues[0];
      const path = issue?.path?.length ? issue.path.join('.') : 'body';
      return res.status(400).json({ error: `${path}: ${issue?.message || 'Invalid request body'}` });
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validateBody };
