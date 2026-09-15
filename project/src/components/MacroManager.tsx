import { useState } from 'react';
import { Zap, Plus, Trash2, Power, PowerOff } from 'lucide-react';
import { loadMacros, deleteMacro, toggleMacro, type VoiceMacro } from '../lib/macros';

export function MacroManager() {
  const [macros, setMacros] = useState<VoiceMacro[]>(loadMacros());

  function handleDelete(id: string) {
    deleteMacro(id);
    setMacros(loadMacros());
  }

  function handleToggle(id: string) {
    toggleMacro(id);
    setMacros(loadMacros());
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-400" />
          Voice Macros
        </h3>
      </div>

      <p className="text-sm text-slate-400">
        Macros trigger multi-step actions with a single voice command.
      </p>

      <div className="space-y-2">
        {macros.map((macro) => (
          <div
            key={macro.id}
            className={`p-4 rounded-lg border transition-all ${
              macro.enabled
                ? 'bg-slate-800/40 border-slate-700/50'
                : 'bg-slate-900/40 border-slate-800/50 opacity-50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-medium text-white">{macro.name}</h4>
                  {macro.enabled ? (
                    <Power className="w-3 h-3 text-green-400" />
                  ) : (
                    <PowerOff className="w-3 h-3 text-slate-600" />
                  )}
                </div>
                <p className="text-xs text-cyan-400 mb-2">
                  Say: "<span className="font-medium">{macro.trigger}</span>"
                </p>
                <div className="text-xs text-slate-500">
                  {macro.actions.length} action{macro.actions.length !== 1 ? 's' : ''}
                </div>
              </div>

              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleToggle(macro.id)}
                  className={`p-1.5 rounded transition-all ${
                    macro.enabled
                      ? 'text-green-400 hover:bg-green-500/10'
                      : 'text-slate-600 hover:bg-slate-700'
                  }`}
                  title={macro.enabled ? 'Disable' : 'Enable'}
                >
                  {macro.enabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => handleDelete(macro.id)}
                  className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Action preview */}
            <div className="mt-3 pt-3 border-t border-slate-700/30">
              <div className="space-y-1">
                {macro.actions.slice(0, 3).map((action, idx) => (
                  <div key={idx} className="text-xs text-slate-500 flex items-center gap-2">
                    <span className="text-slate-600">→</span>
                    {action.type === 'speak' && `Say: "${action.params.text.slice(0, 40)}..."`}
                    {action.type === 'tool' && `Run: ${action.params.tool}`}
                    {action.type === 'wait' && `Wait ${action.params.ms}ms`}
                  </div>
                ))}
                {macro.actions.length > 3 && (
                  <div className="text-xs text-slate-600">
                    +{macro.actions.length - 3} more
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
        <p className="text-xs text-amber-300 flex items-start gap-2">
          <Zap className="w-3 h-3 mt-0.5 shrink-0" />
          <span>
            Try saying <strong>"good morning"</strong> or <strong>"status report"</strong> to test macros.
          </span>
        </p>
      </div>
    </div>
  );
}
