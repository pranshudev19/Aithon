export type UserRole = 'manager' | 'developer';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  skills: string[];
}

export interface Subtask {
  id: number;
  task_id: number;
  title: string;
  description: string;
  required_skills: string[];
  estimated_hours: number;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed';
  assigned_to: number | null;
  code_submission: string | null;
  updated_at: string;
  parent_task_title?: string;
  parent_task_description?: string;
  developer_name?: string | null;
  developer_email?: string | null;
}
