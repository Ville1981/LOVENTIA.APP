export const notFound = (req, res, next) => {
  res.status(404).json({ error: 'Not Found' });
};

export const errorHandler = (err, req, res, next) => {
  const code = err.status || err.statusCode || 500;
  const payload = { error: err.message || 'Server Error' };
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    payload.stack = err.stack;
  }
  res.status(code).json(payload);
};
