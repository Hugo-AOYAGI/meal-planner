/** Thrown by services; the API turns it into `{ error }` with this HTTP status. */
export class AppError extends Error {
  constructor(
    message: string,
    public status: 400 | 404 | 409 | 503 = 400,
  ) {
    super(message);
  }
}
export const notFound = (what: string, id: number | string) => new AppError(`${what} introuvable (${id})`, 404);
