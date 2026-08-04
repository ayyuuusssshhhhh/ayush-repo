export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    message: string,
    options: {
      statusCode: number;
      code: string;
      fieldErrors?: Record<string, string[]>;
    },
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.fieldErrors = options.fieldErrors;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid request.", fieldErrors?: Record<string, string[]>) {
    super(message, { statusCode: 400, code: "VALIDATION_ERROR", fieldErrors });
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "You must be signed in to do this.") {
    super(message, { statusCode: 401, code: "UNAUTHORIZED" });
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You don't have access to this resource.") {
    super(message, { statusCode: 403, code: "FORBIDDEN" });
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found.") {
    super(message, { statusCode: 404, code: "NOT_FOUND" });
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "This conflicts with existing data.") {
    super(message, { statusCode: 409, code: "CONFLICT" });
    this.name = "ConflictError";
  }
}
