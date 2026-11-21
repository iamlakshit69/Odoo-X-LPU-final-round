const AppError = require('../utils/AppError');

// Every error leaves the API as { error: { code, message } }
module.exports = (err, req, res, next) => {
  if (err instanceof AppError)
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });

  // Postgres errors
  if (err.code === '23P01') return res.status(409).json({ error: { code: 'BOOKING_CONFLICT', message: 'Court already booked for this time' } });
  if (err.code === '23505') return res.status(409).json({ error: { code: 'DUPLICATE', message: 'Record already exists' } });
  if (err.code === '23503') return res.status(422).json({ error: { code: 'INVALID_REFERENCE', message: 'Referenced record does not exist' } });
  if (err.code === '23514') return res.status(422).json({ error: { code: 'RULE_VIOLATION', message: 'Value violates a data rule' } });

  if (err.name === 'ZodError')
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ') } });

  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
};
