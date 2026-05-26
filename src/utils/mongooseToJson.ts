/* eslint-disable @typescript-eslint/no-explicit-any */
/** Strip mongoose internals from JSON output (TS-safe vs `delete ret.__v`). */
export function mongooseToJsonTransform(_doc: unknown, ret: any): any {
  const { __v, passwordHash, ...clean } = ret;
  return clean;
}
