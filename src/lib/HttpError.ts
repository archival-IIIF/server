export default class HttpError extends Error {
    private status: number;

    constructor(status: number, ...params: any[]) {
        super(...params);

        if (Error.captureStackTrace)
            Error.captureStackTrace(this, HttpError);

        this.status = status;
    }
}
