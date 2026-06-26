import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { socket } from '../lib/socket';
import type { Subtask } from '../types';
import ShellLayout from '../components/ShellLayout';
import StatusBadge from '../components/StatusBadge';

export default function ManagerDashboard() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);

  const fetchSubtasks = async () => {
    const { data } = await api.get('/tasks/manager');
    setSubtasks(data.subtasks);
  };

  useEffect(() => {
    fetchSubtasks();
  }, []);

  useEffect(() => {
    const onTaskUpdated = (payload: { subtask: Subtask }) => {
      setSubtasks((prev) => [payload.subtask, ...prev.filter((s) => s.id !== payload.subtask.id)]);
      toast.success(`Task updated: ${payload.subtask.title}`);
    };
    socket.on('task_updated', onTaskUpdated);
    return () => {
      socket.off('task_updated', onTaskUpdated);
    };
  }, []);

  return (
    <ShellLayout title="Manager Dashboard">
      <section className="mb-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-3 text-lg font-semibold">Create High-level Task</h2>
        <div className="grid gap-3">
          <input
            className="rounded border border-slate-700 bg-slate-950 p-2"
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="h-28 rounded border border-slate-700 bg-slate-950 p-2"
            placeholder="Describe the full project in natural language"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button
            disabled={loading}
            className="w-fit rounded bg-indigo-600 px-4 py-2 disabled:opacity-50"
            onClick={async () => {
              setLoading(true);
              try {
                await api.post('/tasks', { title, description });
                setTitle('');
                setDescription('');
                await fetchSubtasks();
                toast.success('Task decomposed and assigned');
              } catch {
                toast.error('Task creation failed');
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? 'Planning with AI...' : 'Create and Assign'}
          </button>
        </div>
      </section>

      <section className="grid gap-4">
        {subtasks.map((task) => (
          <article key={task.id} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold">{task.title}</h3>
              <StatusBadge status={task.status} />
            </div>
            <p className="mb-3 text-sm text-slate-300">{task.description}</p>
            <div className="text-xs text-slate-400">
              <p>
                Assigned to: {task.developer_name || 'Unassigned'} | Priority: {task.priority} | Est:{' '}
                {task.estimated_hours}h
              </p>
              <p>Updated: {new Date(task.updated_at).toLocaleString()}</p>
              <p className="mt-2">Code submission:</p>
              <pre className="mt-1 overflow-x-auto rounded bg-slate-950 p-2 text-xs text-slate-200">
                {task.code_submission || '// No code submitted yet'}
              </pre>
            </div>
          </article>
        ))}
      </section>
    </ShellLayout>
  );
}
