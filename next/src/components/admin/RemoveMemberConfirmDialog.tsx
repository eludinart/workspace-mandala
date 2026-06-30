'use client'

type RemoveMemberConfirmDialogProps = {
  memberLabel: string
  placeName: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export function RemoveMemberConfirmDialog({
  memberLabel,
  placeName,
  onConfirm,
  onCancel,
  loading = false,
}: RemoveMemberConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div
        className="w-full max-w-md rounded-xl border border-red-900/60 bg-slate-900 shadow-2xl overflow-hidden"
        role="alertdialog"
        aria-labelledby="remove-member-title"
        aria-describedby="remove-member-desc"
      >
        <div className="bg-red-950/50 border-b border-red-900/40 px-5 py-4">
          <p id="remove-member-title" className="text-lg font-semibold text-red-100">
            Retirer du lieu — action irréversible
          </p>
          <p className="text-sm text-red-200/80 mt-1">
            {memberLabel} sera retiré(e) de <strong className="text-red-100">{placeName}</strong>.
          </p>
        </div>

        <div id="remove-member-desc" className="px-5 py-4 space-y-3 text-sm text-slate-300">
          <p className="text-red-300/90 font-medium">Tout ce qui lie cette personne à ce lieu sera supprimé :</p>
          <ul className="list-disc list-inside space-y-1 text-slate-400 text-xs leading-relaxed">
            <li>Appartenance au lieu et rôle (membre, gestionnaire…)</li>
            <li>Présences au calendrier et inscriptions aux événements</li>
            <li>Publications sur l&apos;Agora de ce lieu</li>
            <li>Météo des cœurs et préférences liées à ce lieu</li>
            <li>Visibilité dans la liste des membres de ce lieu</li>
          </ul>
          <p className="text-xs text-slate-500 border-t border-slate-800 pt-3">
            Le compte Mandala global n&apos;est pas supprimé : la personne pourra être réinvitée
            ultérieurement, mais sans récupération automatique des données effacées ici.
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
            {loading ? 'Suppression…' : 'Retirer définitivement'}
          </button>
        </div>
      </div>
    </div>
  )
}
