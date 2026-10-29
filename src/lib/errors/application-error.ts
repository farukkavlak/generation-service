export class ApplicationError<Code extends string = string> extends Error {
  readonly code: Code;

  constructor(code: Code, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}
