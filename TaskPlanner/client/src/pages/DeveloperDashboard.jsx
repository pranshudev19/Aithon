
import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { socket } from '../socket';
import { Loader2, Code2, Clock, CheckCircle2, AlertCircle, Save } from 'lucide-react';
import Editor from '@monaco-editor/react';

export default function DeveloperDashboard() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState(null);
  const [code, setCode] = useState('');
  const [isSavingCode, setIsSavingCode] = useState(false);

  useEffect(() => {
    fetchTasks();

    socket.on('task_assigned', (newTask) => {
      toast.success(`New task assigned: "\${newTask.title}"`);
      setTasks((prev) => [newTask, ...prev]);
    });

    return () => {
      socket.off('task_assigned');
    };
  }, []);

  const fetchTasks = async () => {
    try {
      const { data } = await axios.get('/subtasks/mine');
      const subtasks = data.subtasks || [];
      setTasks(subtasks);
      if (subtasks.length > 0) {
        handleSelectTask(subtasks[0]);
      }
    } catch (err) {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTask = (task) => {
    setActiveTask(task);
    setCode(task.code_submission || '// Write your code or implementation details here...\n');
  };

  const updateStatus = async (status) => {
    if (!activeTask) return;
    try {
      const { data } = await axios.patch(`/subtasks/${activeTask.id}`, { status });
      const updated = data.subtask;
      setTasks((prev) => prev.map((t) => (t.id === activeTask.id ? { ...t, status: updated.status } : t)));
      setActiveTask((prev) => ({ ...prev, status: updated.status }));
      toast.success('Status updated');

      // If completed, maybe auto-select the next pending one
      if (status === 'completed') {
        const nextPending = tasks.find(t => t.id !== activeTask.id && t.status !== 'completed');
        if (nextPending) handleSelectTask(nextPending);
      }
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const submitCode = async () => {
    if (!activeTask) return;
    setIsSavingCode(true);
    try {
      const { data } = await axios.patch(`/subtasks/${activeTask.id}`, { code_submission: code });
      const updated = data.subtask;
      setTasks((prev) => prev.map((t) => (t.id === activeTask.id ? { ...t, code_submission: updated.code_submission } : t)));
      toast.success('Code saved and sent to manager');
    } catch (err) {
      toast.error('Failed to save code');
    } finally {
      setIsSavingCode(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50 border-green-200';
      case 'in_progress': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-amber-600 bg-amber-50 border-amber-200';
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-primary-500" /></div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Sidebar - Task List */}
      <div className="lg:col-span-1 border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-8rem)]">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary-600" /> My Tasks
          </h2>
          <span className="bg-primary-100 text-primary-700 text-xs font-bold px-2 py-0.5 rounded-full">
            {tasks.filter(t => t.status !== 'completed').length} active
          </span>
        </div>

        <div className="overflow-y-auto p-3 space-y-3 flex-1">
          {tasks.length === 0 ? (
            <div className="text-center p-6 text-gray-400">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>You're all caught up!</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                onClick={() => handleSelectTask(task)}
                className={`p-4 rounded-lg cursor-pointer transition-all border \${
                  activeTask?.id === task.id
                    ? 'border-primary-500 bg-primary-50 shadow-sm'
                    : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 uppercase rounded border \${getStatusColor(task.status)}`}>
                    {task.status.replace('_', ' ')}
                  </span>
                  <span className="text-xs font-medium text-gray-500" title="Priority">
                    {task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢'}
                  </span>
                </div>
                <h4 className="font-semibold text-gray-900 leading-tight mb-1 text-sm">{task.title}</h4>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {task.estimated_hours}h est.
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Content - Task Details & Editor */}
      <div className="lg:col-span-2 flex flex-col h-[calc(100vh-8rem)]">
        {activeTask ? (
          <>
            <div className="bg-white rounded-t-xl border border-gray-200 border-b-0 p-6 shrink-0 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-medium text-primary-600 mb-2 uppercase tracking-wide">
                    {activeTask.parent_task_title}
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2 leading-tight">{activeTask.title}</h1>
                  <p className="text-gray-600 text-sm whitespace-pre-wrap">{activeTask.description}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={activeTask.status}
                    onChange={(e) => updateStatus(e.target.value)}
                    className={`text-sm font-semibold rounded-lg px-3 py-2 border outline-none \${getStatusColor(activeTask.status)}`}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex-1 border border-gray-200 shadow-sm relative rounded-b-xl overflow-hidden flex flex-col bg-slate-900">
              <div className="bg-slate-800 text-slate-300 px-4 py-2 text-sm flex items-center justify-between border-b border-slate-700 shrink-0">
                <span className="flex items-center gap-2 font-mono"><Code2 className="h-4 w-4" /> implementation</span>
                <button
                  onClick={submitCode}
                  disabled={isSavingCode}
                  className="bg-primary-600 hover:bg-primary-700 border-none px-3 py-1 rounded text-white text-xs font-bold flex items-center gap-1 transition-colors"
                >
                  {isSavingCode ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Save & Sync
                </button>
              </div>
              <div className="flex-1 w-full" style={{ minHeight: '300px' }}>
                <Editor
                  height="100%"
                  defaultLanguage="javascript"
                  theme="vs-dark"
                  value={code}
                  onChange={(val) => setCode(val)}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    padding: { top: 16 },
                  }}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="h-full bg-white rounded-xl border border-gray-200 flex flex-col justify-center items-center text-gray-400 p-8">
            <AlertCircle className="h-16 w-16 mb-4 opacity-50 text-gray-300" />
            <p className="text-lg">Select a task from the list to view details and submit code.</p>
          </div>
        )}
      </div>
    </div>
  );
}
