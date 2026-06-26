const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/users/me
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, skills, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user });
  } catch (err) {
    console.error('[GET /users] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;