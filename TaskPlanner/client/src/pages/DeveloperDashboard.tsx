import { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { socket } from '../lib/socket';
import type { Subtask } from '../types';
import ShellLayout from '../components/ShellLayout';
import StatusBadge from '../components/StatusBadge';

const nextStatuses: Record<Subtask['status'], Subtask['status']> = {
  pending: 'in_progress',
  in_progress: 'completed',
  completed: 'completed',
};

export default function DeveloperDashboard() {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editorCode, setEditorCode] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchMine = async () => {
    const { data } = await api.get('/subtasks/mine');
    setSubtasks(data.subtasks);
    if (data.subtasks.length && selectedId === null) {
      setSelectedId(data.subtasks[0].id);
      setEditorCode(data.subtasks[0].code_submission || '');
    }
  };

  useEffect(() => {
    fetchMine();
  }, []);

  useEffect(() => {
    const onAssigned = (payload: { subtask: Subtask }) => {
      setSubtasks((prev) => [payload.subtask, ...prev]);
      toast.success(`New task assigned: ${payload.subtask.title}`);
    };
    socket.on('task_assigned', onAssigned);
    return () => {
      socket.off('task_assigned', onAssigned);
    };
  }, []);

  const selected = subtasks.find((item) => item.id === selectedId) || null;

  return (
    <ShellLayout title="Developer Dashboard">
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="grid gap-3">
          {subtasks.map((task) => (
            <article
              key={task.id}
              className="cursor-pointer rounded border border-slate-800 bg-slate-900 p-3"
              onClick={() => {
                setSelectedId(task.id);
                setEditorCode(task.code_submission || '');
              }}
            >
              <div className="mb-1 flex items-center justify-between">
                <h3 className="font-medium">{task.title}</h3>
                <StatusBadge status={task.status} />
              </div>
              <p className="text-sm text-slate-300">{task.description}</p>
            </article>
          ))}
        </section>

        <section className="rounded border border-slate-800 bg-slate-900 p-3">
          {!selected ? (
            <p className="text-slate-400">Select a task to update status and submit code.</p>
          ) : (
            <>
              <h3 className="mb-2 font-semibold">{selected.title}</h3>
              <p className="mb-2 text-sm text-slate-300">{selected.description}</p>
              <div className="mb-3 flex gap-2">
                <button
                  className="rounded bg-amber-600 px-3 py-1 text-sm"
                  onClick={async () => {
                    const status = nextStatuses[selected.status];
                    const { data } = await api.patch(`/subtasks/${selected.id}`, { status });
                    setSubtasks((prev) =>
                      prev.map((task) => (task.id === selected.id ? { ...task, ...data.subtask } : task))
                    );
                    toast.success(`Status changed to ${status}`);
                  }}
                >
                  Move to {nextStatuses[selected.status]}
                </button>
              </div>

              <Editor
                height="320px"
                language="javascript"
                value={editorCode}
                onChange={(value) => setEditorCode(value || '')}
                theme="vs-dark"
              />
              <button
                disabled={saving}
                className="mt-3 rounded bg-indigo-600 px-3 py-1 text-sm disabled:opacity-50"
                onClick={async () => {
                  setSaving(true);
                  try {
                    const { data } = await api.patch(`/subtasks/${selected.id}`, {
                      code_submission: editorCode,
                    });
                    setSubtasks((prev) =>
                      prev.map((task) => (task.id === selected.id ? { ...task, ...data.subtask } : task))
                    );
                    toast.success('Code submitted');
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? 'Saving...' : 'Submit Code'}
              </button>
            </>
          )}
        </section>
      </div>
    </ShellLayout>
  );
}
