'use client'

type DeleteAccountConfirmDialogProps = {
  email: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export function DeleteAccountConfirmDialog({
  email,
  onConfirm,
  onCancel,
  loading = false,
}: DeleteAccountConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div
        className="w-full max-w-md rounded-xl border border-red-900/60 bg-slate-900 shadow-2xl overflow-hidden"
        role="alertdialog"
        aria-labelledby="delete-account-title"
      >
        <div className="bg-red-950/50 border-b border-red-900/40 px-5 py-4">
          <p id="delete-account-title" className="text-lg font-semibold text-red-100">
            Supprimer mon compte Mandala
          </p>
          <p className="text-sm text-red-200/80 mt-1">
            Compte <strong className="text-red-100">{email}</strong>
          </p>
        </div>
        <div className="px-5 py-4 space-y-3 text-sm text-slate-300">
          <p className="text-red-300/90 font-medium">Cette action est définitive et supprimera :</p>
          <ul className="list-disc list-inside space-y-1 text-slate-400 text-xs leading-relaxed">
            <li>Votre profil, identité et préférences</li>
            <li>Votre appartenance à tous les lieux</li>
            <li>Vos présences, publications Agora et données par lieu</li>
            <li>Vos notifications et historique associé</li>
          </ul>
          <p className="text-xs text-slate-500 border-t border-slate-800 pt-3">
            Vous ne pourrez plus vous connecter avec ce compte. Les lieux que vous gériez resteront
            accessibles aux autres membres.
          </p>
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-slate-800 bg-slate-950/40">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2 rounded-lg border border-slate-700 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Suppression…' : 'Supprimer mon compte'}
          </button>
        </div>
      </div>
    </div>
  )
}
