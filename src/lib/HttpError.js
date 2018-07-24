class HttpError extends Error {
    constructor(status, ...params) {
        super(...params);

        if (Error.captureStackTrace)
            Error.captureStackTrace(this, HttpError);

        this.status = status;
    }
}

module.exports = HttpError;
