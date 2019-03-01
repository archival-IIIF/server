export class RequestError extends Error {
    constructor(...params: any[]) {
        super(...params);

        if (Error.captureStackTrace)
            Error.captureStackTrace(this, RequestError);
    }
}

export class NotImplementedError extends Error {
    constructor(...params: any[]) {
        super(...params);

        if (Error.captureStackTrace)
            Error.captureStackTrace(this, NotImplementedError);
    }
}
