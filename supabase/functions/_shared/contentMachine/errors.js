// Content Machine: an error whose message the admin page shows as-is.
export class ApiError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}
