import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";

type RouteHandler<Params extends Record<string, string> = Record<string, string>> = (
  request: NextRequest,
  context: { params: Promise<Params> },
) => Promise<NextResponse> | NextResponse;

/**
 * Wraps a Route Handler so every route returns the same success/error envelope
 * and no route needs its own try/catch for expected (AppError) failures.
 */
export function apiHandler<Params extends Record<string, string> = Record<string, string>>(
  handler: RouteHandler<Params>,
): RouteHandler<Params> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return errorToResponse(error);
    }
  };
}

export function apiSuccess<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, init);
}

function errorToResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, fieldErrors: error.fieldErrors } },
      { status: error.statusCode },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request.",
          fieldErrors: error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  // Unexpected error: log server-side, never leak internals to the client.
  console.error(error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } },
    { status: 500 },
  );
}
