// Tool registry and execution engine
// Defines all available tools, their schemas, escalation levels, and execution logic

import type { EscalationLevel, ToolExecutionResult } from './types';
import * as fs from './fileSystem';

export interface ToolDefinition {
  name: string;
  description: string;
  escalation: EscalationLevel;
  schema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  execute: (args: Record<string, any>) => Promise<ToolExecutionResult>;
}

// ────────────────────────────────────────────────────────────────────────────
// FILE TOOLS (Browser File System Access API)
// ────────────────────────────────────────────────────────────────────────────

async function fileRead(args: Record<string, any>): Promise<ToolExecutionResult> {
  const result = await fs.readFile(args.path);
  return result.success
    ? { success: true, data: { content: result.content } }
    : { success: false, error: result.error };
}

async function fileWrite(args: Record<string, any>): Promise<ToolExecutionResult> {
  const result = await fs.writeFile(args.path, args.content);
  return result.success
    ? { success: true, data: { path: args.path, bytes: args.content.length } }
    : { success: false, error: result.error };
}

async function fileSearch(args: Record<string, any>): Promise<ToolExecutionResult> {
  const result = await fs.searchFiles(args.query, args.path || '');
  return result.success
    ? { success: true, data: { matches: result.matches } }
    : { success: false, error: result.error };
}

async function fileList(args: Record<string, any>): Promise<ToolExecutionResult> {
  const result = await fs.listDirectory(args.path || '');
  return result.success
    ? { success: true, data: { files: result.files } }
    : { success: false, error: result.error };
}

async function fileDelete(args: Record<string, any>): Promise<ToolExecutionResult> {
  const result = await fs.deleteFile(args.path);
  return result.success
    ? { success: true, data: { deleted: args.path } }
    : { success: false, error: result.error };
}

// ────────────────────────────────────────────────────────────────────────────
// REMINDER TOOLS (LocalStorage + Web Notifications API)
// ────────────────────────────────────────────────────────────────────────────

async function reminderCreate(args: Record<string, any>): Promise<ToolExecutionResult> {
  try {
    // Validate time is in future
    const dueTime = new Date(args.time);
    const now = new Date();

    if (isNaN(dueTime.getTime())) {
      return { success: false, error: 'Invalid time format. Use ISO 8601 (YYYY-MM-DDTHH:mm:ssZ)' };
    }

    if (dueTime <= now) {
      return { success: false, error: 'Reminder time must be in the future' };
    }

    const reminders = JSON.parse(localStorage.getItem('jarvis_reminders') || '[]');
    const reminder = {
      id: crypto.randomUUID(),
      text: args.text,
      time: dueTime.toISOString(),
      created_at: new Date().toISOString(),
    };
    reminders.push(reminder);
    localStorage.setItem('jarvis_reminders', JSON.stringify(reminders));

    // Request notification permission if not granted
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }

    return {
      success: true,
      data: {
        ...reminder,
        friendly_time: dueTime.toLocaleString(),
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function reminderList(): Promise<ToolExecutionResult> {
  try {
    const reminders = JSON.parse(localStorage.getItem('jarvis_reminders') || '[]');
    return { success: true, data: reminders };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function reminderDelete(args: Record<string, any>): Promise<ToolExecutionResult> {
  try {
    const reminders = JSON.parse(localStorage.getItem('jarvis_reminders') || '[]');
    const filtered = reminders.filter((r: any) => r.id !== args.id);
    localStorage.setItem('jarvis_reminders', JSON.stringify(filtered));
    return { success: true, data: { deleted: args.id } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// TASK TOOLS (LocalStorage)
// ────────────────────────────────────────────────────────────────────────────

async function taskCreate(args: Record<string, any>): Promise<ToolExecutionResult> {
  try {
    const tasks = JSON.parse(localStorage.getItem('jarvis_tasks') || '[]');
    const task = {
      id: crypto.randomUUID(),
      title: args.title,
      description: args.description || '',
      completed: false,
      created_at: new Date().toISOString(),
    };
    tasks.push(task);
    localStorage.setItem('jarvis_tasks', JSON.stringify(tasks));
    return { success: true, data: task };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function taskList(): Promise<ToolExecutionResult> {
  try {
    const tasks = JSON.parse(localStorage.getItem('jarvis_tasks') || '[]');
    return { success: true, data: tasks };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function taskComplete(args: Record<string, any>): Promise<ToolExecutionResult> {
  try {
    const tasks = JSON.parse(localStorage.getItem('jarvis_tasks') || '[]');
    const task = tasks.find((t: any) => t.id === args.id);
    if (!task) return { success: false, error: 'Task not found' };
    task.completed = true;
    task.completed_at = new Date().toISOString();
    localStorage.setItem('jarvis_tasks', JSON.stringify(tasks));
    return { success: true, data: task };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function taskDelete(args: Record<string, any>): Promise<ToolExecutionResult> {
  try {
    const tasks = JSON.parse(localStorage.getItem('jarvis_tasks') || '[]');
    const filtered = tasks.filter((t: any) => t.id !== args.id);
    localStorage.setItem('jarvis_tasks', JSON.stringify(filtered));
    return { success: true, data: { deleted: args.id } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// TOOL REGISTRY
// ────────────────────────────────────────────────────────────────────────────

export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  'file.read': {
    name: 'file.read',
    description: 'Read contents of a file',
    escalation: 'auto',
    schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to granted directory' },
      },
      required: ['path'],
    },
    execute: fileRead,
  },
  'file.write': {
    name: 'file.write',
    description: 'Write or update a file',
    escalation: 'confirm',
    schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to granted directory' },
        content: { type: 'string', description: 'File content' },
      },
      required: ['path', 'content'],
    },
    execute: fileWrite,
  },
  'file.search': {
    name: 'file.search',
    description: 'Search for files matching a query',
    escalation: 'auto',
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (filename or content)' },
        path: { type: 'string', description: 'Directory to search in (optional)' },
      },
      required: ['query'],
    },
    execute: fileSearch,
  },
  'file.list': {
    name: 'file.list',
    description: 'List files in a directory',
    escalation: 'auto',
    schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path (optional, defaults to root)' },
      },
      required: [],
    },
    execute: fileList,
  },
  'file.delete': {
    name: 'file.delete',
    description: 'Delete a file',
    escalation: 'password',
    schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to delete' },
      },
      required: ['path'],
    },
    execute: fileDelete,
  },
  'reminder.create': {
    name: 'reminder.create',
    description: 'Create a reminder',
    escalation: 'auto',
    schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Reminder text' },
        time: { type: 'string', description: 'ISO 8601 datetime' },
      },
      required: ['text', 'time'],
    },
    execute: reminderCreate,
  },
  'reminder.list': {
    name: 'reminder.list',
    description: 'List all reminders',
    escalation: 'auto',
    schema: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: reminderList,
  },
  'reminder.delete': {
    name: 'reminder.delete',
    description: 'Delete a reminder',
    escalation: 'confirm',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Reminder ID' },
      },
      required: ['id'],
    },
    execute: reminderDelete,
  },
  'task.create': {
    name: 'task.create',
    description: 'Create a task',
    escalation: 'auto',
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Task description (optional)' },
      },
      required: ['title'],
    },
    execute: taskCreate,
  },
  'task.list': {
    name: 'task.list',
    description: 'List all tasks',
    escalation: 'auto',
    schema: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: taskList,
  },
  'task.complete': {
    name: 'task.complete',
    description: 'Mark a task as completed',
    escalation: 'auto',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Task ID' },
      },
      required: ['id'],
    },
    execute: taskComplete,
  },
  'task.delete': {
    name: 'task.delete',
    description: 'Delete a task',
    escalation: 'confirm',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Task ID' },
      },
      required: ['id'],
    },
    execute: taskDelete,
  },
};

// Helper: get tool definition by name
export function getTool(name: string): ToolDefinition | null {
  return TOOL_REGISTRY[name] || null;
}

// Helper: validate tool args against schema
export function validateToolArgs(tool: ToolDefinition, args: Record<string, any>): { valid: boolean; error?: string } {
  const required = tool.schema.required || [];
  for (const field of required) {
    if (!(field in args)) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }
  return { valid: true };
}

// Helper: get tools as JSON schema for LLM
export function getToolSchemas(): any[] {
  return Object.values(TOOL_REGISTRY).map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.schema,
  }));
}
