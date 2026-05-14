/**
 * True when Convex rejected function arguments (e.g. `v.id()`), before the
 * handler runs. Use in route loaders to map bad URL params to `notFound()`.
 */
export function isConvexArgumentValidationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "ArgumentValidationError" ||
    error.message.includes("ArgumentValidationError") ||
    error.message.includes("does not match validator")
  );
}
