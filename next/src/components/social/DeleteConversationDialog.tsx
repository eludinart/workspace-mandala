'use client'

type DeleteConversationDialogProps = {
  name: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
  error?: string | null
}

export function DeleteConversationDialog({
  name,
  onConfirm,
  onCancel,
  loading = false,
  error = null,
}: DeleteConversationDialogProps) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
      onClick={loading ? undefined : onCancel}
    >
      <div
        className="w-full max-w-md rounded-xl border border-red-700/40 bg-slate-900 shadow-2xl overflow-hidden"
        role="alertdialog"
        aria-labelledby="delete-conversation-title"
        aria-describedby="delete-conversation-warning"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-red-700/30 px-5 py-4">
          <p id="delete-conversation-title" className="text-lg font-semibold text-slate-100">
            Supprimer cette conversation ?
          </p>
          <p className="mt-1 text-sm text-slate-300">{name}</p>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p id="delete-conversation-warning" className="text-sm text-slate-200 leading-relaxed">
            Les messages seront effacés pour toutes les personnes qui participent. Personne ne
            pourra plus les lire.
          </p>
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            Cette action est définitive.
          </p>
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            autoFocus
            className="flex-1 py-2 rounded-lg border border-slate-700 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  )
}
