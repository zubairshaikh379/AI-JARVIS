import { FolderOpen, CheckCircle, XCircle } from 'lucide-react';
import { useState } from 'react';
import { requestDirectoryAccess, hasDirectoryAccess, revokeDirectoryAccess } from '../lib/fileSystem';

interface FileAccessButtonProps {
  onAccessGranted?: () => void;
}

export function FileAccessButton({ onAccessGranted }: FileAccessButtonProps) {
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkAccess() {
    const access = await hasDirectoryAccess();
    setHasAccess(access);
  }

  async function requestAccess() {
    setLoading(true);
    setError(null);
    const result = await requestDirectoryAccess();
    setLoading(false);

    if (result.success) {
      setHasAccess(true);
      onAccessGranted?.();
    } else {
      setError(result.error || 'Failed to grant access');
    }
  }

  async function revokeAccess() {
    await revokeDirectoryAccess();
    setHasAccess(false);
  }

  // Check on mount
  useState(() => {
    checkAccess();
  });

  if (hasAccess) {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-400">
        <CheckCircle className="w-3 h-3" />
        <span>File access granted</span>
        <button
          onClick={revokeAccess}
          className="text-slate-500 hover:text-red-400 transition-colors ml-1"
        >
          (revoke)
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={requestAccess}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg py-2 text-sm font-medium transition-all disabled:opacity-50"
      >
        <FolderOpen className="w-4 h-4" />
        {loading ? 'Waiting for permission...' : 'Grant File Access'}
      </button>

      {error && (
        <div className="flex items-start gap-2 text-xs text-red-400">
          <XCircle className="w-3 h-3 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <p className="text-xs text-slate-500">
        JARVIS needs permission to read and write files. You choose which folder to grant access to.
      </p>
    </div>
  );
}
