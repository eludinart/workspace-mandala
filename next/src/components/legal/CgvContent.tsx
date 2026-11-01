import { LEGAL_CGV_VERSION } from '@/lib/legal-versions'
import { LegalDocumentLayout, LegalSection } from '@/components/legal/LegalDocumentLayout'

export function CgvContent() {
  return (
    <LegalDocumentLayout title="Conditions générales de vente" version={LEGAL_CGV_VERSION}>
      <p>
        Les présentes Conditions générales de vente (ci-après « CGV ») s’appliquent aux
        abonnements payants proposés sur Mandala : offre <strong>Lieu</strong> et offre{' '}
        <strong>Mandala Pro</strong>.
      </p>

      <LegalSection title="1. Éditeur et service">
        <p>
          Les abonnements donnent accès à des fonctionnalités numériques (visibilité publique
          renforcée, outils Pro, etc.). Ils ne constituent pas la vente de biens physiques.
        </p>
      </LegalSection>

      <LegalSection title="2. Offres et prix">
        <p>
          Les tarifs affichés dans l’application (TTC, en euros, sauf mention contraire) font foi
          au moment de la commande. Mandala peut faire évoluer ses tarifs ; les abonnements en
          cours restent aux conditions en vigueur jusqu’à leur prochain renouvellement, sauf
          disposition contraire affichée.
        </p>
        <p>Offres indicatives v1 :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Lieu : 29 € / mois ou 290 € / an</li>
          <li>Mandala Pro : 12 € / mois ou 120 € / an</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Commande et moyens de paiement">
        <p>
          Sur le <strong>site web</strong> (navigateur / PC), le paiement est traité par{' '}
          <strong>Stripe</strong>.
        </p>
        <p>
          Sur l’application distribuée via <strong>Google Play</strong>, les abonnements
          numériques souscrits in-app sont traités via <strong>Google Play Billing</strong>,
          conformément aux règles du magasin. Les prix Play peuvent différer légèrement (exigences
          store / taxes locales).
        </p>
        <p>
          En validant le paiement, vous acceptez le prélèvement récurrent jusqu’à résiliation.
        </p>
      </LegalSection>

      <LegalSection title="4. Activation et durée">
        <p>
          L’abonnement est activé après confirmation du paiement. Il se renouvelle
          automatiquement pour la période choisie (mois ou an), sauf résiliation avant l’échéance.
        </p>
      </LegalSection>

      <LegalSection title="5. Résiliation">
        <p>
          Abonnement souscrit via Stripe : résiliation depuis votre compte Mandala / portail
          client Stripe, ou en nous contactant.
        </p>
        <p>
          Abonnement souscrit via Google Play : résiliation depuis les réglages d’abonnement Google
          Play du compte Google utilisé pour l’achat.
        </p>
        <p>
          La résiliation prend effet à la fin de la période déjà payée ; aucun remboursement
          proportionnel n’est dû sauf obligation légale ou politique Play / Stripe applicable.
        </p>
      </LegalSection>

      <LegalSection title="6. Droit de rétractation">
        <p>
          Conformément au droit de la consommation, pour les contenus numériques fournis
          immédiatement, vous pouvez être invité·e à renoncer explicitement au droit de
          rétractation de 14 jours lors de la commande. À défaut, et si la loi l’impose, le droit
          de rétractation s’applique dans les conditions légales.
        </p>
      </LegalSection>

      <LegalSection title="7. Disponibilité des fonctionnalités">
        <p>
          En cas d’indisponibilité temporaire du service, aucun remboursement automatique n’est
          dû pour une interruption courte. En cas d’impossibilité durable de fournir la
          fonctionnalité payante, un geste commercial ou un prorata pourra être étudié.
        </p>
      </LegalSection>

      <LegalSection title="8. Support">
        <p>
          Support facturation :{' '}
          <a href="mailto:contact@eludein.art" className="text-violet-300 underline">
            contact@eludein.art
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="9. Droit applicable">
        <p>Les présentes CGV sont régies par le droit français.</p>
      </LegalSection>
    </LegalDocumentLayout>
  )
}
