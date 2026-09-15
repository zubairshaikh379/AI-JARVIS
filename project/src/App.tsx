import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthScreen } from './screens/AuthScreen';
import { AssistantScreen } from './screens/AssistantScreen';
import { Loader2, Zap } from 'lucide-react';
import { useEffect } from 'react';
import { startReminderScheduler, cleanupOldReminders } from './lib/reminders';

function AppContent() {
  const { user, loading } = useAuth();

  useEffect(() => {
    // Start reminder scheduler when app loads
    startReminderScheduler();

    // Clean up old reminders once per session
    cleanupOldReminders();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
          <Zap className="w-6 h-6 text-white" strokeWidth={2.5} />
        </div>
        <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
      </div>
    );
  }

  return user ? <AssistantScreen /> : <AuthScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
