import { LEGAL_CGU_VERSION } from '@/lib/legal-versions'
import { LegalDocumentLayout, LegalSection } from '@/components/legal/LegalDocumentLayout'

export function CguContent() {
  return (
    <LegalDocumentLayout title="Conditions générales d’utilisation" version={LEGAL_CGU_VERSION}>
      <p>
        Les présentes Conditions générales d’utilisation (ci-après « CGU ») régissent l’accès et
        l’usage de l’application Mandala (site web, PWA et éventuelle application distribuée via
        les magasins d’applications), éditée par Élude In Art / Mandala (« nous »).
      </p>
      <p>
        En créant un compte ou en utilisant les fonctionnalités interactives, vous acceptez ces
        CGU. Si vous n’acceptez pas, n’utilisez pas le service.
      </p>

      <LegalSection title="1. Objet du service">
        <p>
          Mandala est un réseau communautaire destiné aux lieux et à leurs membres : carte,
          événements, messages, compétences et ressources. Certaines fonctions avancées (offre
          Lieu, Mandala Pro) peuvent être payantes et sont soumises aux Conditions générales de
          vente.
        </p>
      </LegalSection>

      <LegalSection title="2. Compte et âge minimum">
        <p>
          Vous devez avoir au moins <strong>13 ans</strong> pour créer un compte. Si vous avez
          entre 13 et 17 ans, vous confirmez disposer de l’autorisation d’un titulaire de
          l’autorité parentale lorsque la loi l’exige.
        </p>
        <p>
          Vous êtes responsable de la confidentialité de vos identifiants et des activités réalisées
          depuis votre compte.
        </p>
      </LegalSection>

      <LegalSection title="3. Contenu généré par les utilisateurs">
        <p>
          Vous conservez vos droits sur les contenus que vous publiez (messages, publications,
          photos, descriptions). Vous nous accordez une licence non exclusive, mondiale et
          gratuite pour les héberger, les afficher et les diffuser dans le cadre du service.
        </p>
        <p>Il est interdit de publier ou de diffuser :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>des contenus illégaux, haineux, harcelants, diffamatoires ou pornographiques ;</li>
          <li>des contenus portant atteinte aux mineurs ;</li>
          <li>des spam, fraudes, malware ou tentatives d’accès non autorisé ;</li>
          <li>des contenus portant atteinte aux droits de tiers (image, propriété intellectuelle).</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Modération, signalement et blocage">
        <p>
          Nous pouvons retirer un contenu ou suspendre un compte en cas de manquement. Vous
          disposez d’un outil de <strong>signalement</strong> in-app et d’un outil de{' '}
          <strong>blocage</strong> d’utilisateurs (notamment en messagerie). Les signalements sont
          traités dans un délai raisonnable au regard du type de contenu.
        </p>
      </LegalSection>

      <LegalSection title="5. Vie privée">
        <p>
          Le traitement des données personnelles est décrit dans la{' '}
          <a href="/confidentialite" className="text-violet-300 underline">
            Politique de confidentialité
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="6. Disponibilité">
        <p>
          Le service est fourni « en l’état ». Nous nous efforçons d’assurer une disponibilité
          continue, sans garantie d’absence d’interruption. La maintenance peut entraîner des
          indisponibilités temporaires.
        </p>
      </LegalSection>

      <LegalSection title="7. Responsabilité">
        <p>
          Mandala est un outil de mise en relation. Nous ne sommes pas parties aux échanges entre
          utilisateurs ni aux activités organisées hors ligne par les lieux. Dans les limites
          autorisées par la loi, notre responsabilité est limitée aux dommages directs prouvés
          résultant d’une faute de notre part.
        </p>
      </LegalSection>

      <LegalSection title="8. Résiliation">
        <p>
          Vous pouvez supprimer votre compte depuis les réglages. Nous pouvons suspendre ou
          résilier l’accès en cas de violation des CGU ou d’obligation légale.
        </p>
      </LegalSection>

      <LegalSection title="9. Droit applicable">
        <p>
          Les présentes CGU sont régies par le droit français. En cas de litige, et à défaut
          d’accord amiable, les tribunaux compétents seront ceux du ressort du siège de l’éditeur,
          sous réserve des règles impératives de protection du consommateur.
        </p>
      </LegalSection>

      <LegalSection title="10. Contact">
        <p>
          Pour toute question relative aux CGU :{' '}
          <a href="mailto:contact@eludein.art" className="text-violet-300 underline">
            contact@eludein.art
          </a>
          .
        </p>
      </LegalSection>
    </LegalDocumentLayout>
  )
}
