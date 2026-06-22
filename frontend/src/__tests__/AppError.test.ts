import { AppError, ErrorCode } from '../AppError';

describe('AppError', () => {
  it('is an instance of Error and AppError', () => {
    const err = new AppError(ErrorCode.UNAUTHORIZED);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it('has name "AppError"', () => {
    const err = new AppError(ErrorCode.FORBIDDEN);
    expect(err.name).toBe('AppError');
  });

  it('stores the error code', () => {
    const err = new AppError(ErrorCode.UNAUTHORIZED);
    expect(err.code).toBe(ErrorCode.UNAUTHORIZED);
    expect(err.code).toBe(401);
  });

  it('uses backendMessage as the Error message when provided', () => {
    const err = new AppError(ErrorCode.SERVER_ERROR, 500, 'Internal server error');
    expect(err.message).toBe('Internal server error');
  });

  it('falls back to String(code) when no backendMessage', () => {
    const err = new AppError(ErrorCode.SERVER_ERROR);
    expect(err.message).toBe('500');
  });

  it('stores httpStatus when provided', () => {
    const err = new AppError(ErrorCode.BAD_REQUEST, 400);
    expect(err.httpStatus).toBe(400);
  });

  it('has undefined httpStatus when not provided', () => {
    const err = new AppError(ErrorCode.UNKNOWN_ERROR);
    expect(err.httpStatus).toBeUndefined();
  });

  it('ErrorCode enum has the expected numeric values', () => {
    expect(ErrorCode.BAD_REQUEST).toBe(400);
    expect(ErrorCode.UNAUTHORIZED).toBe(401);
    expect(ErrorCode.FORBIDDEN).toBe(403);
    expect(ErrorCode.CONFLICT).toBe(409);
    expect(ErrorCode.SERVER_ERROR).toBe(500);
    expect(ErrorCode.UNKNOWN_ERROR).toBe(1000);
    expect(ErrorCode.SESSION_SAVE_ERROR).toBe(601);
    expect(ErrorCode.SESSION_RESTORE_ERROR).toBe(602);
  });
});
