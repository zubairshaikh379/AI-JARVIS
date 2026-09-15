// Active reminder notification system
// Checks localStorage for due reminders and fires browser notifications

interface Reminder {
  id: string;
  text: string;
  time: string; // ISO 8601
  created_at: string;
  triggered?: boolean;
}

let schedulerInterval: number | null = null;

export function startReminderScheduler() {
  if (schedulerInterval) return; // Already running

  // Request notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Check every 30 seconds
  schedulerInterval = window.setInterval(checkDueReminders, 30000);

  // Check immediately on start
  checkDueReminders();
}

export function stopReminderScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}

export function checkDueReminders() {
  try {
    const reminders: Reminder[] = JSON.parse(localStorage.getItem('jarvis_reminders') || '[]');
    const now = new Date();

    for (const reminder of reminders) {
      if (reminder.triggered) continue;

      const dueTime = new Date(reminder.time);
      if (dueTime <= now) {
        triggerNotification(reminder);
        markTriggered(reminder.id);
      }
    }
  } catch (error) {
    console.error('Reminder check failed:', error);
  }
}

function triggerNotification(reminder: Reminder) {
  if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification('JARVIS Reminder', {
      body: reminder.text,
      icon: '/favicon.ico',
      tag: reminder.id,
      requireInteraction: false,
    });

    // Auto-close after 10 seconds
    setTimeout(() => notification.close(), 10000);

    // Play sound (optional)
    playNotificationSound();
  }
}

function markTriggered(id: string) {
  try {
    const reminders: Reminder[] = JSON.parse(localStorage.getItem('jarvis_reminders') || '[]');
    const reminder = reminders.find(r => r.id === id);
    if (reminder) {
      reminder.triggered = true;
      localStorage.setItem('jarvis_reminders', JSON.stringify(reminders));
    }
  } catch (error) {
    console.error('Failed to mark reminder as triggered:', error);
  }
}

function playNotificationSound() {
  try {
    // Create a subtle notification beep
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.1;

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch {
    // Ignore audio errors
  }
}

// Helper: get upcoming reminders (next 24 hours, not yet triggered)
export function getUpcomingReminders(): Reminder[] {
  try {
    const reminders: Reminder[] = JSON.parse(localStorage.getItem('jarvis_reminders') || '[]');
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    return reminders
      .filter(r => !r.triggered)
      .filter(r => {
        const dueTime = new Date(r.time);
        return dueTime > now && dueTime <= tomorrow;
      })
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  } catch {
    return [];
  }
}

// Helper: clean up triggered reminders older than 7 days
export function cleanupOldReminders() {
  try {
    const reminders: Reminder[] = JSON.parse(localStorage.getItem('jarvis_reminders') || '[]');
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const filtered = reminders.filter(r => {
      if (!r.triggered) return true;
      const dueTime = new Date(r.time);
      return dueTime > sevenDaysAgo;
    });

    localStorage.setItem('jarvis_reminders', JSON.stringify(filtered));
  } catch (error) {
    console.error('Cleanup failed:', error);
  }
}
