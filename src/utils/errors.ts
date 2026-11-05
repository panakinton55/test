import { z, ZodError, type ZodTypeAny } from "zod";

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function parseBody<S extends ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(400, "VALIDATION_ERROR", "Validation failed.", safeIssues(result.error));
  }
  return result.data;
}

function safeIssues(error: ZodError): { path: string; code: string }[] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    code: issue.code,
  }));
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
