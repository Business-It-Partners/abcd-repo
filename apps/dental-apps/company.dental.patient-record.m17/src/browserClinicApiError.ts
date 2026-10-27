/** Browser edition error shape retained for upstream UI instanceof checks. */
export class ClinicApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ClinicApiError';
  }
}
