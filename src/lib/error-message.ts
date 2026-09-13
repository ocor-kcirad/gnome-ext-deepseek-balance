export function errorMessage(error: unknown): string {
    if (isErrorLike(error)) return error.message;
    return String(error);
}

function isErrorLike(error: unknown): error is {message: string} {
    return (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof error.message === 'string'
    );
}
