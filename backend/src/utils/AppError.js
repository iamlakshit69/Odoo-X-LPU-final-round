// throw new AppError(409, 'BOOKING_CONFLICT', 'Court already booked')
class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
module.exports = AppError;
