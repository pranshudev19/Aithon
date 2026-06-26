import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { socket } from '../socket';
import { Loader2, Zap, Send, FileCode2, Clock, CheckCircle2 } from 'lucide-react';

export default function ManagerDashboard() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedTask, setExpandedTask] = useState(null);

  useEffect(() => {
    fetchTasks();

    socket.on('task_updated', (updatedSubtask) => {
      toast.success(`Subtask "\${updatedSubtask.title}" updated`);
      setTasks((prev) => 
        prev.map((t) => {
          if (t.id === updatedSubtask.task_id) {
            return {
              ...t,
              subtasks: t.subtasks.map((st) => 
                st.id === updatedSubtask.id ? { ...st, ...updatedSubtask } : st
              )
            };
          }
          return t;
        })
      );
    });

    return () => {
      socket.off('task_updated');
    };
  }, []);

  const fetchTasks = async () => {
    try {
      // GET /api/tasks/manager returns { subtasks: [...] } — flat list with task info joined
      const { data } = await axios.get('/tasks/manager');
      const subtasks = data.subtasks || [];
      // Group subtasks by task_id into { id, title, description, subtasks[] } objects
      const taskMap = {};
      subtasks.forEach((st) => {
        if (!taskMap[st.task_id]) {
          taskMap[st.task_id] = {
            id: st.task_id,
            title: st.parent_task_title,
            description: st.parent_task_description,
            subtasks: [],
          };
        }
        taskMap[st.task_id].subtasks.push(st);
      });
      setTasks(Object.values(taskMap));
    } catch (err) {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setIsSubmitting(true);
    const createToast = toast.loading('AI is decomposing task and finding best developers...');
    
    try {
      const { data } = await axios.post('/tasks', { title, description });
      toast.success('Task successfully decomposed and assigned!', { id: createToast });
      // Server returns { task: {...}, subtasks: [...] }
      setTasks((prev) => [
        {
          id: data.task.id,
          title: data.task.title,
          description: data.task.description,
          subtasks: data.subtasks || [],
        },
        ...prev,
      ]);
      setTitle('');
      setDescription('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create task', { id: createToast });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'completed': return 'text-green-600 bg-green-50 border-green-200';
      case 'in_progress': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-amber-600 bg-amber-50 border-amber-200';
    }
  };

  return (
    <div className="space-y-8">
      {/* Create Task Form */}
      <div className="card border-primary-100 shadow-sm">
        <div className="flex items-center gap-2 mb-6 text-primary-600">
          <Zap className="h-6 w-6" />
          <h2 className="text-xl font-bold text-gray-900">AI Task Planner</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">High-Level Objective</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Build an e-commerce checkout flow..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Detailed Description & Requirements</label>
            <textarea
              className="input-field min-h-[120px] resize-y"
              placeholder="Describe the features, business logic, endpoints, or UI pieces required..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !title || !description}
              className="btn-primary"
            >
              {isSubmitting ? (
                <><Loader2 className="animate-spin h-5 w-5" /> Processing with AI...</>
              ) : (
                <><Send className="h-5 w-5" /> Auto-Decompose & Assign</>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Task List */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Project Backlog</h2>
        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-primary-500" /></div>
        ) : tasks.length === 0 ? (
          <div className="text-center p-12 bg-white rounded-xl border border-dashed border-gray-300">
            <p className="text-gray-500">No tasks created yet.</p>
          </div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="card p-0 overflow-hidden">
              <div 
                className="p-6 cursor-pointer hover:bg-gray-50 transition-colors flex justify-between items-start"
                onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
              >
                <div>
                  <h3 className="font-bold text-lg text-gray-900">{task.title}</h3>
                  <p className="text-gray-500 mt-1 line-clamp-2">{task.description}</p>
                </div>
                <div className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full text-sm font-medium text-gray-600 shrink-0">
                  <FileCode2 className="h-4 w-4" />
                  {task.subtasks?.length || 0} Subtasks
                </div>
              </div>

              {expandedTask === task.id && (
                <div className="border-t border-gray-100 bg-gray-50 p-6 space-y-4">
                  <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                    <Clock className="h-5 w-5" /> AI-Generated Subtasks
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {task.subtasks?.map((st) => (
                      <div key={st.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                          <span className={`text-xs font-bold px-2 py-1 uppercase rounded border ${getStatusColor(st.status)}`}>
                            {st.status.replace('_', ' ')}
                          </span>
                          <span className="text-xs font-medium text-gray-500 align-middle inline-flex">
                            {st.priority === 'high' ? '🔴' : st.priority === 'medium' ? '🟡' : '🟢'}
                          </span>
                        </div>
                        <h5 className="font-bold text-gray-900 leading-snug">{st.title}</h5>
                        <p className="text-sm text-gray-600 mt-2">Assigned to: <span className="font-semibold text-primary-700">{st.developer_name || 'Unassigned'}</span></p>
                        
                        {st.code_submission && (
                          <div className="mt-4 pt-4 border-t border-gray-100">
                            <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1 mb-2">
                              <CheckCircle2 className="h-4 w-4 text-green-500" /> Submitted Code
                            </span>
                            <div className="bg-slate-900 rounded p-3 overflow-x-auto mt-2">
                              <pre className="text-xs text-green-400 font-mono"><code>{st.code_submission}</code></pre>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
