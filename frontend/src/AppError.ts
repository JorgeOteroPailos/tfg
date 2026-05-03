export enum ErrorCode {
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  CONFLICT = 409,
  SERVER_ERROR = 500,

  //app errors
  UNKNOWN_ERROR = 1000,
  SESSION_SAVE_ERROR = 601,
  SESSION_RESTORE_ERROR = 602,
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public httpStatus?: number,
    public backendMessage?: string
  ) {
    super(backendMessage ?? String(code));
    this.name = 'AppError';
  }
}

export function mapHttpStatusToErrorCode(status: number): ErrorCode {
  switch (status) {
    case 400:
      return ErrorCode.BAD_REQUEST;
    case 401:
      return ErrorCode.UNAUTHORIZED;
    case 403:
      return ErrorCode.FORBIDDEN;
    case 409:
      return ErrorCode.CONFLICT;
    case 500:
      return ErrorCode.SERVER_ERROR;
    default:
      return ErrorCode.UNKNOWN_ERROR;
  }
}