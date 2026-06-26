const express = require('express');
const pool = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/subtasks/mine  (developer only)
router.get('/mine', authenticate, requireRole('developer'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        s.id, s.task_id, s.title, s.description, s.required_skills, s.estimated_hours,
        s.priority, s.status, s.assigned_to, s.code_submission, s.updated_at,
        t.manager_id, t.title AS parent_task_title, t.description AS parent_task_description
      FROM subtasks s
      INNER JOIN tasks t ON s.task_id = t.id
      WHERE s.assigned_to = $1
      ORDER BY s.updated_at DESC`,
      [req.user.id]
    );

    return res.json({ subtasks: result.rows });
  } catch (err) {
    console.error('[GET /subtasks/mine] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch subtasks' });
  }
});

// PATCH /api/subtasks/:subtaskId  (developer only)
router.patch('/:subtaskId', authenticate, requireRole('developer'), async (req, res) => {
  try {
    const subtaskId = Number(req.params.subtaskId);

    // BUG FIX: original check `!subtaskId` was falsy for id=0 AND passed NaN silently.
    // Correct check: must be a positive integer.
    if (!subtaskId || isNaN(subtaskId) || subtaskId <= 0 || !Number.isInteger(subtaskId)) {
      return res.status(400).json({ error: 'Invalid subtask id' });
    }

    const { status, code_submission } = req.body;

    const existing = await pool.query(
      `SELECT s.*, t.manager_id
       FROM subtasks s
       INNER JOIN tasks t ON s.task_id = t.id
       WHERE s.id = $1`,
      [subtaskId]
    );
    const row = existing.rows[0];

    if (!row) {
      return res.status(404).json({ error: 'Subtask not found' });
    }
    if (row.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'You can only update your assigned subtasks' });
    }

    const nextStatus = status || row.status;
    if (!['pending', 'in_progress', 'completed'].includes(nextStatus)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const nextCodeSubmission =
      typeof code_submission === 'string' ? code_submission : row.code_submission;

    const result = await pool.query(
      `UPDATE subtasks
       SET status = $1, code_submission = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [nextStatus, nextCodeSubmission, subtaskId]
    );

    const updated = result.rows[0];
    const io = req.app.get('io');
    io.to(`user:${row.manager_id}`).emit('task_updated', { subtask: updated });
    io.to(`user:${req.user.id}`).emit('task_self_updated', { subtask: updated });

    return res.json({ subtask: updated });
  } catch (err) {
    console.error('[PATCH /subtasks/:subtaskId] Error:', err.message);
    return res.status(500).json({ error: 'Failed to update subtask' });
  }
});

module.exports = router;