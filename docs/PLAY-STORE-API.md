# Mandala — Play API / fastlane (fiche store sans Chrome)

Push des textes + assets de la fiche Play via l’API **Google Play Android Developer**, avec metadata au format **fastlane** (compatible `supply` si Ruby un jour).

**Package :** `art.eludein.mandala`  
**Metadata :** `android-twa/fastlane/metadata/android/fr-FR/`  
**Runner Windows :** `scripts/play-store-sync.ps1` → Node + `googleapis`  
**Hors scope API :** questionnaires **Data safety** et **UGC** (toujours Console).

---

## 1. Compte de service (une fois)

### 1.1 Google Cloud

1. Ouvre [Google Cloud Console](https://console.cloud.google.com/) (même org / compte que Play si possible).
2. Projet dédié ou existant (ex. `eludein-mandala-play`).
3. **APIs et services → Bibliothèque** → active **Google Play Android Developer API**.
4. **IAM → Comptes de service → Créer**  
   - Nom : `play-api-mandala`  
   - Rôle Cloud : aucun obligatoire pour Play (les droits sont dans Play Console).
5. Onglet **Clés → Ajouter une clé → JSON** → télécharge le fichier.
6. Place-le hors git :

```text
nogit/play-certs/play-api-sa.json
```

(Ne jamais committer ce JSON.)

### 1.2 Lier à Play Console

1. [Play Console](https://play.google.com/console) → **Utilisateurs et autorisations**.
2. **Inviter de nouveaux utilisateurs** → colle l’**e-mail** du compte de service (`…@….iam.gserviceaccount.com`).
3. Droits minimum pour la fiche :
   - Voir les informations de l’appli
   - **Gérer la présence sur la page Play Store** (métadonnées / graphismes)
4. (Optionnel plus tard pour AAB) : versions / pistes de test, etc.
5. Enregistre. Attends quelques minutes (propagation).

### 1.3 Vérif locale

```powershell
cd c:\workspace-mandala
.\scripts\play-store-sync.ps1 -DryRun
```

Doit afficher titre / compteurs / chemins images **sans** erreur « JSON not found ».

---

## 2. Sync fiche (textes + images)

```powershell
cd c:\workspace-mandala
# recopie nogit/play-store-assets → fastlane/metadata/.../images puis API
.\scripts\play-store-sync.ps1
```

Options :

| Flag | Effet |
|------|--------|
| `-DryRun` | Pas d’appel API |
| `-TextsOnly` | Titre + descriptions seulement |
| `-ImagesOnly` | Icône + feature + screenshots téléphone |
| `-SkipAssetCopy` | Ne pas recopier depuis `nogit/play-store-assets` |

Équivalent Node (après `npm install` dans `scripts/play-store`) :

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "c:\workspace-mandala\nogit\play-certs\play-api-sa.json"
cd scripts\play-store
npm run sync
```

Sources textes : fichiers sous `android-twa/fastlane/metadata/android/fr-FR/`  
(régénérables depuis `docs/PLAY-STORE-LISTING.md`).

---

## 3. Layout metadata (fastlane)

```text
android-twa/fastlane/
  Appfile
  Fastfile                 # optionnel (Ruby) — lanes store_listing / internal_aab
  metadata/android/fr-FR/
    title.txt
    short_description.txt
    full_description.txt
    changelogs/default.txt
    images/                # généré depuis nogit/ (non versionné)
      icon.png
      featureGraphic.png
      phoneScreenshots/01.png … 06.png
```

Assets source : `nogit/play-store-assets/`.

---

## 4. Ruby / fastlane (optionnel)

Pas installé sur le PC Windows actuel. Si Ruby + fastlane un jour :

```bash
cd android-twa
bundle exec fastlane store_listing
```

Sinon rester sur le script Node — **même API**.

---

## 5. Après le sync

Toujours à la main dans Play Console :

1. **Contenu de l’appli** → UGC  
2. **Data safety** → `docs/PLAY-STORE-DATA-SAFETY.md`  
3. Classification / âge 13+  
4. Piste interne / test fermé si besoin

---

## 6. Dépannage

| Erreur | Cause probable |
|--------|----------------|
| `service account JSON not found` | Fichier absent ou mauvais chemin |
| `403` / insufficient permissions | SA pas invité dans Play Console, ou droits trop faibles |
| `404` package | App `art.eludein.mandala` absente / mauvais compte développeur |
| Image rejected | Mauvaises dimensions (icône 512², feature 1024×500) |
| Propagation | Attendre 5–15 min après invitation SA |
