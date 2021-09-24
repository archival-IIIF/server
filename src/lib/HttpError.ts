export default class HttpError extends Error {
    status: number;

    constructor(status: number, ...params: any[]) {
        super(...params);
        this.status = status;
        Error.captureStackTrace(this, HttpError);
    }
}
