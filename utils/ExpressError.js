class ExpressError extends Error {
    constructor(status, message) {
        super(message);
        this.statusCode = status;
        this.status = status;
        this.message = message;
        this.name = this.constructor.name;
    }
}

module.exports = ExpressError;