export function sendSuccess(res, data = {}, statusCode = 200, message = null) {
  const responseBody = {
    success: true,
    data
  };
  if (message) {
    responseBody.message = message;
  }
  return res.status(statusCode).json(responseBody);
}

export function sendError(res, message, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', details = null) {
  const responseBody = {
    success: false,
    error: {
      code,
      message
    }
  };

  if (details) {
    responseBody.error.details = details;
  }

  return res.status(statusCode).json(responseBody);
}
