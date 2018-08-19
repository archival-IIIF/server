class RequestError extends Error {
    constructor(...params) {
        super(params);

        if (Error.captureStackTrace)
            Error.captureStackTrace(this, RequestError);
    }
}

class NotImplementedError extends Error {
    constructor(...params) {
        super(params);

        if (Error.captureStackTrace)
            Error.captureStackTrace(this, NotImplementedError);
    }
}

module.exports = {RequestError, NotImplementedError};
