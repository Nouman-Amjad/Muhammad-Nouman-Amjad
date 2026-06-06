export type ErrorContext = Readonly<Record<string, string | number | boolean | null>>;

/**
 * Base for all business-rule failures. Lives in the domain and stays free of any
 * transport concern (no HTTP status here) so use-cases can branch on `code` and the
 * outer error filter owns the protocol mapping.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  readonly context: ErrorContext;

  protected constructor(message: string, context: ErrorContext = {}) {
    super(message);
    this.name = new.target.name;
    this.context = context;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
