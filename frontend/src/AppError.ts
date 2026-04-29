export enum ErrorCode {
  // HTTP (mismos códigos que el backend)
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  SERVER_ERROR = 500,
  CONFLICT = 409,

  // App (errores propios)
  SESSION_SAVE_ERROR = 600,
  SESSION_RESTORE_ERROR = 601,
}
export class AppError extends Error {
  constructor(public code: ErrorCode) {
    super(String(code));
    this.name = 'AppError';
  }
}