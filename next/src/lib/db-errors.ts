/** Message lisible pour les erreurs de connexion MariaDB (dev tunnel VPS). */
export function formatDbConnectionError(err: unknown): string {
  const e = err as { code?: string; errno?: number; message?: string }
  if (e.code === 'ECONNREFUSED' || String(e.message ?? '').includes('ECONNREFUSED')) {
    const port = process.env.MARIADB_PORT || '3308'
    if (process.env.MARIADB_VIA_TUNNEL === 'true') {
      return `Base de données inaccessible (tunnel ${port}). Lancez « npm run dev.vps » et vérifiez la connexion SSH au VPS.`
    }
    return 'Base de données inaccessible. Vérifiez que MariaDB est démarrée.'
  }
  if (e.code === 'ETIMEDOUT' || e.code === 'PROTOCOL_CONNECTION_LOST') {
    return 'Connexion à la base interrompue. Réessayez ou relancez npm run dev.vps.'
  }
  return e.message || 'Erreur base de données'
}
