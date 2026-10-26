import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import type { ZodSchema } from 'zod';

/**
 * Minimal Zod resolver for react-hook-form (the project does not depend on
 * @hookform/resolvers). Maps the first issue per field to a field error.
 */
export function zodResolver<T extends FieldValues>(schema: ZodSchema<T>): Resolver<T> {
  return async (values) => {
    const result = schema.safeParse(values);
    if (result.success) return { values: result.data, errors: {} };
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || 'root';
      if (!errors[key]) errors[key] = { type: issue.code, message: issue.message };
    }
    return { values: {}, errors: errors as unknown as FieldErrors<T> };
  };
}
