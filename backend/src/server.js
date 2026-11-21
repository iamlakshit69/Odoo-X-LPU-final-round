require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN }));
app.use(express.json());

app.get('/api/v1/health', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT count(*)::int AS plans FROM membership_plans');
    res.json({ data: { status: 'ok', plans: rows[0].plans } });
  } catch (e) { next(e); }
});

// error handler: matches the { error: { code, message } } contract
app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === '23P01') // exclusion violation = booking overlap
    return res.status(409).json({ error: { code: 'BOOKING_CONFLICT', message: 'Court already booked for this time' } });
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
});

app.listen(process.env.PORT || 4000, () => console.log('API on :' + (process.env.PORT || 4000)));
