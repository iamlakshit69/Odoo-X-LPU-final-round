const router = require('express').Router();
const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

router.get('/health', asyncHandler(async (req, res) => {
  const { rows } = await db.query('SELECT count(*)::int AS plans FROM membership_plans');
  res.json({ data: { status: 'ok', plans: rows[0].plans } });
}));

// Mount each phase's router here as it gets built:
// router.use('/auth', require('../modules/auth/auth.routes'));
// router.use('/members', require('../modules/members/members.routes'));
// router.use('/bookings', require('../modules/bookings/bookings.routes'));

module.exports = router;
