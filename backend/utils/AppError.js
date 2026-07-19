// A known, expected application error (e.g. not-found, unauthorized) whose
// message is safe to send to the client as-is. Anything thrown that is NOT
// an AppError is treated as unexpected and its message is hidden from clients.
class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'AppError';
    this.status = status;
  }
}

module.exports = { AppError };
