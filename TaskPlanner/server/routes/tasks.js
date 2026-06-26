const express = require('express');
const pool = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { decomposeTask } = require('../services/aiAgent');
const { pickBestDeveloper } = require('../utils/developerMatcher');

const router = express.Router();

// POST /api/tasks  (manager only)
router.post('/', authenticate, requireRole('manager'), async (req, res) => {
  const { title, description } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const taskResult = await client.query(
      `INSERT INTO tasks (manager_id, title, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.user.id, title.trim(), description.trim()]
    );
    const task = taskResult.rows[0];

    // BUG FIX: validate that AI returns a proper non-empty array before iterating.
    // If the AI service fails or returns garbage, fall back to an empty array
    // so the transaction still commits (task is saved, subtasks can be added later).
    let subtasksFromAI = [];
    try {
      const aiResult = await decomposeTask(title, description);
      if (Array.isArray(aiResult) && aiResult.length > 0) {
        subtasksFromAI = aiResult;
      } else {
        console.warn('[decomposeTask] AI returned invalid output, using empty subtasks:', aiResult);
      }
    } catch (aiErr) {
      console.error('[decomposeTask] AI service error:', aiErr.message);
      // Do not rethrow — continue with empty subtasks
    }

    const developersResult = await client.query(
      'SELECT id, name, email, skills FROM users WHERE role = $1 ORDER BY id ASC',
      ['developer']
    );
    const developers = developersResult.rows;

    const insertedSubtasks = [];
    for (const subtask of subtasksFromAI) {
      // BUG FIX: guard against malformed subtask objects from AI
      if (!subtask || typeof subtask !== 'object') continue;
      if (!subtask.title) continue;

      const requiredSkills = Array.isArray(subtask.required_skills) ? subtask.required_skills : [];
      const estimatedHours = Number(subtask.estimated_hours) || 1;
      const priority = subtask.priority || 'medium';

      // Validate priority
      const validPriorities = ['low', 'medium', 'high'];
      const safePriority = validPriorities.includes(priority) ? priority : 'medium';

      const assignedDeveloper = pickBestDeveloper(developers, requiredSkills);

      const insertResult = await client.query(
        `INSERT INTO subtasks
          (task_id, title, description, required_skills, estimated_hours, priority, status, assigned_to)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
         RETURNING *`,
        [
          task.id,
          subtask.title,
          subtask.description || '',
          requiredSkills,
          estimatedHours,
          safePriority,
          assignedDeveloper ? assignedDeveloper.id : null,
        ]
      );

      const createdSubtask = insertResult.rows[0];
      insertedSubtasks.push(createdSubtask);
    }

    await client.query('COMMIT');

    const io = req.app.get('io');
    insertedSubtasks.forEach((subtask) => {
      if (subtask.assigned_to) {
        io.to(`user:${subtask.assigned_to}`).emit('task_assigned', { subtask });
      }
    });
    io.to(`user:${req.user.id}`).emit('manager_task_created', {
      task,
      subtasks: insertedSubtasks,
    });

    return res.status(201).json({ task, subtasks: insertedSubtasks });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[POST /tasks] Create task failed:', error.message);
    return res.status(500).json({ error: 'Failed to create task' });
  } finally {
    client.release();
  }
});

// GET /api/tasks/manager  (manager only)
// NOTE: This route MUST be defined before any `/:taskId` route to avoid
// Express matching "manager" as a task ID param.
router.get('/manager', authenticate, requireRole('manager'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        s.id,
        s.task_id,
        s.title,
        s.description,
        s.required_skills,
        s.estimated_hours,
        s.priority,
        s.status,
        s.assigned_to,
        s.code_submission,
        s.updated_at,
        t.title AS parent_task_title,
        t.description AS parent_task_description,
        u.name AS developer_name,
        u.email AS developer_email
      FROM subtasks s
      INNER JOIN tasks t ON s.task_id = t.id
      LEFT JOIN users u ON s.assigned_to = u.id
      WHERE t.manager_id = $1
      ORDER BY s.updated_at DESC`,
      [req.user.id]
    );

    return res.json({ subtasks: result.rows });
  } catch (err) {
    console.error('[GET /tasks/manager] Error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

module.exports = router;