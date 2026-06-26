const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const geminiApiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

/**
 * Decomposes a high-level task description into structured subtasks using Gemini AI.
 * @param {string} taskTitle - Short title of the task
 * @param {string} taskDescription - Full natural language description
 * @returns {Promise<Array>} Array of subtask objects
 */
function buildPrompt(taskTitle, taskDescription) {
  return `You are an expert software project manager and technical architect.

A manager has submitted the following high-level software project task:

Title: "${taskTitle}"
Description: "${taskDescription}"

Your job is to decompose this into concrete, actionable development subtasks.

Requirements:
- Break it down into 4-8 specific subtasks
- Each subtask must be independently assignable to ONE developer
- Assign relevant technical skills needed for each subtask
- Estimate realistic hours (1-20 hours per subtask)
- Assign priority: "high", "medium", or "low"

Respond ONLY with a valid JSON array — no markdown, no explanation. Example format:
[
  {
    "title": "Set up user authentication system",
    "description": "Implement JWT-based registration and login endpoints with password hashing and httpOnly cookie storage.",
    "required_skills": ["backend", "Node.js", "REST", "Express"],
    "estimated_hours": 6,
    "priority": "high"
  }
]

Now decompose the task into subtasks:`;
}

async function callGemini(prompt) {
  if (!geminiApiKey) {
    return null;
  }
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

async function callClaude(prompt) {
  if (!anthropicApiKey) {
    return null;
  }
  const client = new Anthropic({ apiKey: anthropicApiKey });
  const response = await client.messages.create({
    model: 'claude-3-5-haiku-latest',
    max_tokens: 1200,
    system: 'Return only JSON array with no markdown.',
    messages: [{ role: 'user', content: prompt }],
  });
  const firstTextBlock = response.content.find((entry) => entry.type === 'text');
  return firstTextBlock ? firstTextBlock.text.trim() : null;
}

function fallbackDecomposition(taskTitle, taskDescription) {
  const baseTitle = `${taskTitle}`.slice(0, 80);
  return [
    {
      title: `Requirements and architecture for ${baseTitle}`,
      description: `Refine scope, assumptions, and system architecture for: ${taskDescription}`,
      required_skills: ['backend', 'API', 'REST'],
      estimated_hours: 4,
      priority: 'high',
    },
    {
      title: `Frontend UX implementation for ${baseTitle}`,
      description: 'Implement UI flows, reusable components, and integration hooks.',
      required_skills: ['frontend', 'React', 'CSS'],
      estimated_hours: 8,
      priority: 'medium',
    },
    {
      title: `Backend services and data model for ${baseTitle}`,
      description: 'Build core APIs, validation, and database persistence.',
      required_skills: ['backend', 'Node.js', 'PostgreSQL'],
      estimated_hours: 10,
      priority: 'high',
    },
    {
      title: `Testing and deployment readiness for ${baseTitle}`,
      description: 'Add integration checks, fix edge cases, and prepare release checklist.',
      required_skills: ['DevOps', 'API', 'REST'],
      estimated_hours: 6,
      priority: 'medium',
    },
  ];
}

async function decomposeTask(taskTitle, taskDescription) {
  const prompt = buildPrompt(taskTitle, taskDescription);

  let text = null;
  try {
    text = (await callGemini(prompt)) || (await callClaude(prompt));
  } catch (err) {
    console.error('AI provider failed, using fallback decomposition:', err.message);
  }

  if (!text) {
    return fallbackDecomposition(taskTitle, taskDescription);
  }

  // Strip markdown code fences if present
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let subtasks;
  try {
    subtasks = JSON.parse(cleaned);
  } catch (parseErr) {
    // Fallback: try to extract JSON array from the text
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      subtasks = JSON.parse(match[0]);
    } else {
      return fallbackDecomposition(taskTitle, taskDescription);
    }
  }

  // Validate and sanitize each subtask
  return subtasks.map((st) => ({
    title: String(st.title || 'Untitled Subtask').substring(0, 200),
    description: String(st.description || '').substring(0, 2000),
    required_skills: Array.isArray(st.required_skills) ? st.required_skills.map(String) : [],
    estimated_hours: Math.max(0.5, Math.min(40, Number(st.estimated_hours) || 4)),
    priority: ['high', 'medium', 'low'].includes(st.priority) ? st.priority : 'medium',
  }));
}

module.exports = { decomposeTask };
