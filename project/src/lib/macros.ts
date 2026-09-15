// Voice macro system - custom voice commands that trigger multi-step actions

interface VoiceMacro {
  id: string;
  name: string;
  trigger: string; // phrase that activates it
  actions: MacroAction[];
  enabled: boolean;
  created_at: string;
}

interface MacroAction {
  type: 'speak' | 'tool' | 'wait' | 'navigate';
  params: Record<string, any>;
}

const DEFAULT_MACROS: VoiceMacro[] = [
  {
    id: 'morning',
    name: 'Morning Briefing',
    trigger: 'good morning',
    enabled: true,
    created_at: new Date().toISOString(),
    actions: [
      { type: 'speak', params: { text: 'Good morning! Here is your daily briefing.' } },
      { type: 'tool', params: { tool: 'task.list' } },
      { type: 'wait', params: { ms: 500 } },
      { type: 'tool', params: { tool: 'reminder.list' } },
      { type: 'speak', params: { text: 'That is all for today. Have a productive day!' } },
    ],
  },
  {
    id: 'focus',
    name: 'Focus Mode',
    trigger: 'focus mode',
    enabled: true,
    created_at: new Date().toISOString(),
    actions: [
      { type: 'speak', params: { text: 'Entering focus mode. Muting notifications for 25 minutes.' } },
      { type: 'tool', params: { tool: 'reminder.create', args: { text: 'Focus session complete', time: new Date(Date.now() + 25 * 60 * 1000).toISOString() } } },
    ],
  },
  {
    id: 'status',
    name: 'Status Report',
    trigger: 'status report',
    enabled: true,
    created_at: new Date().toISOString(),
    actions: [
      { type: 'speak', params: { text: 'Generating status report.' } },
      { type: 'tool', params: { tool: 'task.list' } },
      { type: 'speak', params: { text: 'All systems operational.' } },
    ],
  },
];

export function loadMacros(): VoiceMacro[] {
  const stored = localStorage.getItem('jarvis_macros');
  if (!stored) {
    localStorage.setItem('jarvis_macros', JSON.stringify(DEFAULT_MACROS));
    return DEFAULT_MACROS;
  }
  return JSON.parse(stored);
}

export function saveMacros(macros: VoiceMacro[]): void {
  localStorage.setItem('jarvis_macros', JSON.stringify(macros));
}

export function findMacroByTrigger(text: string): VoiceMacro | null {
  const macros = loadMacros();
  const normalized = text.toLowerCase().trim();

  for (const macro of macros) {
    if (macro.enabled && normalized.includes(macro.trigger.toLowerCase())) {
      return macro;
    }
  }

  return null;
}

export function createMacro(name: string, trigger: string, actions: MacroAction[]): VoiceMacro {
  const macro: VoiceMacro = {
    id: crypto.randomUUID(),
    name,
    trigger,
    actions,
    enabled: true,
    created_at: new Date().toISOString(),
  };

  const macros = loadMacros();
  macros.push(macro);
  saveMacros(macros);

  return macro;
}

export function deleteMacro(id: string): void {
  const macros = loadMacros();
  const filtered = macros.filter(m => m.id !== id);
  saveMacros(filtered);
}

export function toggleMacro(id: string): void {
  const macros = loadMacros();
  const macro = macros.find(m => m.id === id);
  if (macro) {
    macro.enabled = !macro.enabled;
    saveMacros(macros);
  }
}

// Execute macro actions sequentially
export async function executeMacro(
  macro: VoiceMacro,
  context: {
    speak: (text: string) => void;
    executeTool: (tool: string, args?: any) => Promise<any>;
  }
): Promise<void> {
  for (const action of macro.actions) {
    switch (action.type) {
      case 'speak':
        context.speak(action.params.text);
        await sleep(1000); // Wait for speech to start
        break;

      case 'tool':
        try {
          const result = await context.executeTool(action.params.tool, action.params.args);
          if (result && result.data) {
            // Format and speak result
            const formatted = formatToolResult(action.params.tool, result.data);
            if (formatted) context.speak(formatted);
          }
        } catch (error) {
          console.error('Macro tool execution failed:', error);
        }
        break;

      case 'wait':
        await sleep(action.params.ms || 1000);
        break;

      case 'navigate':
        // Could add navigation between chats/screens
        break;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatToolResult(tool: string, data: any): string | null {
  switch (tool) {
    case 'task.list':
      if (!data || data.length === 0) return 'You have no tasks.';
      const incompleteTasks = data.filter((t: any) => !t.completed);
      if (incompleteTasks.length === 0) return 'All tasks completed!';
      return `You have ${incompleteTasks.length} pending tasks. ${incompleteTasks.slice(0, 3).map((t: any) => t.title).join(', ')}`;

    case 'reminder.list':
      if (!data || data.length === 0) return 'No reminders set.';
      const upcoming = data.filter((r: any) => !r.triggered);
      if (upcoming.length === 0) return 'No upcoming reminders.';
      return `You have ${upcoming.length} reminders. Next: ${upcoming[0].text}`;

    case 'file.list':
      if (!data || !data.files || data.files.length === 0) return 'Directory is empty.';
      return `Found ${data.files.length} items.`;

    default:
      return null;
  }
}
