import { LEGAL_PRIVACY_VERSION } from '@/lib/legal-versions'
import { LegalDocumentLayout, LegalSection } from '@/components/legal/LegalDocumentLayout'

export function PrivacyContent() {
  return (
    <LegalDocumentLayout
      title="Politique de confidentialité"
      version={LEGAL_PRIVACY_VERSION}
    >
      <p>
        La présente politique décrit comment Mandala traite les données personnelles des
        utilisateurs du site et des applications associées (PWA / Google Play).
      </p>

      <LegalSection title="1. Responsable de traitement">
        <p>
          Élude In Art / Mandala — contact :{' '}
          <a href="mailto:contact@eludein.art" className="text-violet-300 underline">
            contact@eludein.art
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="2. Données collectées">
        <ul className="list-disc pl-5 space-y-1">
          <li>Compte : e-mail, nom, prénom, mot de passe (hashé), préférences de profil</li>
          <li>Usage communautaire : lieux, messages, publications, événements, compétences</li>
          <li>Technique : journaux serveur, adresse IP (sécurité / rate-limit), user-agent</li>
          <li>
            Notifications push : abonnement Web Push / tokens si vous activez les alertes
          </li>
          <li>
            Paiement : géré par Stripe ou Google Play ; nous ne stockons pas le numéro de carte
            complet
          </li>
          <li>Acceptations légales : version des CGU / CGV / confidentialité acceptée</li>
          <li>Signalements et blocages (modération)</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Finalités et bases légales">
        <ul className="list-disc pl-5 space-y-1">
          <li>Fourniture du service et du compte (exécution du contrat)</li>
          <li>Sécurité, prévention des abus (intérêt légitime)</li>
          <li>Facturation des abonnements (exécution du contrat / obligation légale)</li>
          <li>Modération UGC et conformité aux règles des magasins d’applications</li>
          <li>Notifications que vous avez autorisées (consentement)</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Destinataires">
        <p>
          Hébergeur / infrastructure (VPS, base de données), prestataires de paiement (Stripe,
          Google), et éventuellement outils d’e-mail transactionnel. Pas de vente de données à des
          annonceurs tiers.
        </p>
      </LegalSection>

      <LegalSection title="5. Durées de conservation">
        <p>
          Données de compte : pendant la durée du compte, puis suppression ou anonymisation dans un
          délai raisonnable après clôture, sauf obligations légales (facturation). Journaux
          techniques : durée limitée nécessaire à la sécurité. Signalements : le temps du
          traitement puis archivage limité.
        </p>
      </LegalSection>

      <LegalSection title="6. Vos droits">
        <p>
          Conformément au RGPD, vous disposez de droits d’accès, rectification, effacement,
          limitation, opposition et portabilité le cas échéant. Vous pouvez supprimer votre compte
          dans l’application. Contact :{' '}
          <a href="mailto:contact@eludein.art" className="text-violet-300 underline">
            contact@eludein.art
          </a>
          . Vous pouvez aussi saisir la CNIL.
        </p>
      </LegalSection>

      <LegalSection title="7. Transferts hors UE">
        <p>
          Si un prestataire traite des données hors UE (ex. certains flux Stripe / Google), des
          garanties appropriées (clauses contractuelles types, etc.) sont mises en place selon
          leurs politiques respectives.
        </p>
      </LegalSection>

      <LegalSection title="8. Mineurs">
        <p>
          Le service n’est pas destiné aux enfants de moins de 13 ans. Nous ne collectons pas
          sciemment de données d’enfants en dessous de cet âge.
        </p>
      </LegalSection>

      <LegalSection title="9. Cookies et stockage local">
        <p>
          Cookies / stockage locaux strictement nécessaires à l’authentification, à la session et
          à l’installation PWA. Pas de publicité comportementale tierce sur Mandala v1.
        </p>
      </LegalSection>

      <LegalSection title="10. Mises à jour">
        <p>
          Cette politique peut évoluer. La version en vigueur est indiquée en tête de page. En cas
          de changement substantiel, une information pourra être affichée dans l’application.
        </p>
      </LegalSection>
    </LegalDocumentLayout>
  )
}
