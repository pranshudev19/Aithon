const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const FASTAPI_BASE = process.env.FASTAPI_URL || 'http://localhost:8000';

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET || 'taskplanner-secret-key',
    { expiresIn: '7d' }
  );
}

/**
 * Calls FastAPI /auth/login and returns the access_token.
 * FastAPI uses username+password form-encoded and UPPERCASE roles.
 * Tries email as the username first (since registerInFastAPI sets username=email).
 * If FastAPI is unavailable we return null (graceful degradation).
 */
async function getFastAPIToken(usernameOrEmail, password) {
  try {
    const params = new URLSearchParams();
    params.append('username', usernameOrEmail);
    params.append('password', password);
    const { data } = await axios.post(`${FASTAPI_BASE}/auth/login`, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 5000,
    });
    return data.access_token || null;
  } catch (err) {
    // FastAPI might not have this user yet — not fatal
    console.warn('[auth] FastAPI login failed (non-fatal):', err.message);
    return null;
  }
}

/**
 * Registers the user in FastAPI so they can call Aithon data modules.
 * Role mapping: manager → MANAGER, developer → DEVELOPER.
 */
async function registerInFastAPI(user, plainPassword) {
  try {
    const role = user.role === 'manager' ? 'MANAGER' : 'DEVELOPER';
    await axios.post(`${FASTAPI_BASE}/auth/register`, {
      username: user.email,
      email: user.email,
      password: plainPassword,
      role,
      skills: user.skills || [],
    }, { timeout: 5000 });
  } catch (err) {
    // 409 = already exists — ignore. Other errors: non-fatal.
    if (err.response?.status !== 409) {
      console.warn('[auth] FastAPI register failed (non-fatal):', err.message);
    }
  }
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    const user = userResult.rows[0];

    // Same error for "no user" and "wrong password" to avoid enumeration
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Issue Node.js session cookie (TaskPlanner real-time auth)
    const token = signToken(user);
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Also obtain FastAPI Bearer token (for Aithon data modules).
    // If the user doesn't exist in FastAPI yet (e.g. seed users only in TaskPlanner DB),
    // auto-register them in FastAPI first, then retry the token fetch.
    let aithonToken = await getFastAPIToken(email.toLowerCase().trim(), password);
    if (!aithonToken) {
      console.log(`[auth] FastAPI user not found for ${email} — auto-registering...`);
      await registerInFastAPI({ ...user, email: user.email }, password);
      aithonToken = await getFastAPIToken(email.toLowerCase().trim(), password);
      if (aithonToken) {
        console.log(`[auth] FastAPI auto-registration successful for ${email}`);
      } else {
        console.warn(`[auth] FastAPI auto-registration failed for ${email} — Aithon modules may be unavailable`);
      }
    }

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        skills: user.skills,
      },
      aithon_token: aithonToken,
    });
  } catch (err) {
    console.error('[POST /login] Error:', err.message);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT id, name, email, role, skills FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = userResult.rows[0];

    if (!user) {
      res.clearCookie('token');
      return res.status(401).json({ error: 'User no longer exists' });
    }

    return res.json({ user });
  } catch (err) {
    console.error('[GET /me] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /api/auth/register — unified registration (creates user in both DBs)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role = 'developer', skills = [] } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }

    const validRoles = ['manager', 'developer'];
    const safeRole = validRoles.includes(role) ? role : 'developer';

    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, skills)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, skills`,
      [name.trim(), email.toLowerCase().trim(), hash, safeRole, skills]
    );
    const newUser = result.rows[0];

    // Mirror in FastAPI so the user can access Aithon modules immediately
    await registerInFastAPI({ ...newUser, role: safeRole }, password);

    return res.status(201).json({ user: newUser });
  } catch (err) {
    console.error('[POST /register] Error:', err.message);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

module.exports = router;