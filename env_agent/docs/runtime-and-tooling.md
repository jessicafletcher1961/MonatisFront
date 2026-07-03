# Outillage et lancement

## Stack

- React 19
- TypeScript 5.9
- Vite 8
- React Router 7
- React Query 5
- React Hook Form et Zod pour les formulaires complexes
- Lucide React pour les icônes
- Recharts pour les graphiques de synthèse

Le style runtime est actuellement porté par les variables et composants CSS de `src/index.css`. Tailwind CSS n'est pas installé dans cette version : une adoption Tailwind doit être une migration dédiée des surfaces et des tokens, pas un ajout de dépendance sans conversion réelle des composants.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

`npm run build` exécute `tsc -b` puis `vite build`.

## Variables d'environnement

- `VITE_MONATIS_API_URL` : URL du back MONATIS. Valeur par défaut dans le code : `http://localhost:8082`.
- `VITE_MONATIS_PDF_IMPORTER_URL` : URL directe du microservice PDF. Si absent, le front utilise `/__monatis_pdf_reader`.
- `MONATIS_PDF_IMPORTER_PORT` ou `VITE_MONATIS_PDF_IMPORTER_PORT` : port de lancement local du microservice PDF par Vite. Valeur par défaut : `8000`.
- `VITE_MONATIS_PORTABLE_BUILDER_URL` : URL directe du microservice local de création portable. Si absent, le front utilise `/__monatis_portable_builder`.
- `MONATIS_PORTABLE_BUILDER_PORT` : port du microservice de création portable. Valeur par défaut : `8095`.
- `MONATIS_BACK_ROOT` : chemin du back proposé par défaut par le microservice portable si le dossier n'est pas le frère `../MonatisBack-main`. L'interface peut choisir un autre dossier au moment du build.
- `MONATIS_JAVA_HOME` ou `JAVA_HOME` : JDK complet utilisé par le microservice portable lorsque l'utilisateur veut forcer un JDK système. Le flux normal utilise d'abord le JDK embarqué `Micro_Service_make_exe/tools/jdk`.
- `MONATIS_JDK_DOWNLOAD_URL` : URL optionnelle du ZIP JDK utilisé pour installer automatiquement le JDK embarqué si `tools/jdk` est absent. Par défaut, le service utilise l'API Adoptium pour un JDK Windows x64 LTS.
- `MONATIS_PORTABLE_COPY_DATA=1` : copie optionnelle de la base H2 `data/` du back dans le package portable pour les usages hors interface. Par défaut la base locale n'est pas copiée.

## Microservice PDF

`vite.config.ts` lance le microservice situé dans `Micro_Service_PDF_Reader` au démarrage du serveur Vite. Le proxy Vite expose ensuite le service sous `/__monatis_pdf_reader`.

Le client PDF est `src/lib/pdf-import-api.ts`. Il ne doit pas hardcoder un port ; il passe par `VITE_MONATIS_PDF_IMPORTER_URL` ou par le proxy local.

## Microservice de création portable

Le dossier `Micro_Service_make_exe` contient un microservice Node local lancé automatiquement par `vite.config.ts` au premier appel vers `/__monatis_portable_builder`. Le lancement manuel par `start-service.bat` reste possible pour diagnostiquer le service hors Vite.

Le service écoute uniquement sur `127.0.0.1` et expose :

- `GET /api/status` : état du service, racines front/back détectées, disponibilité du JDK et occupation courante ;
- `POST /api/select-output-directory` : ouvre un sélecteur de dossier Windows et renvoie le chemin absolu choisi ;
- `POST /api/select-back-directory` : ouvre un sélecteur de dossier Windows pour choisir le back à compiler ;
- `POST /api/inspect-back-directory` : vérifie que le dossier back choisi contient `pom.xml` et le wrapper Maven, puis renvoie l'état de son dossier `data/` ;
- `POST /api/build-portable` : démarre la création de l'image portable dans le dossier de travail du microservice ; le JSON accepte `{ "outputRoot": "chemin absolu", "backRoot": "chemin absolu", "includeData": true|false }` ;
- `GET /api/build-portable/jobs/{id}` : état, progression, image interne, export final et logs récents du job ;
- `POST /api/build-portable/jobs/{id}/export` : copie une image portable terminée vers le dossier absolu demandé ;
- `GET /api/build-portable/jobs/{id}/download` : génère puis télécharge un ZIP de l'image portable terminée.

Le panneau `AdminPortableBuilderPanel.tsx` dans `/donnees?view=admin` consomme ce service via `src/lib/portable-builder-api.ts`. Ce client passe par le proxy Vite par défaut, ce qui permet de démarrer le microservice sans action manuelle avant de cliquer sur le bouton de création. Le dossier du back est un champ explicite et peut être choisi avec une boîte Windows ; le dossier choisi doit contenir `pom.xml` et `mvnw.cmd`. Le dossier d'export est un autre champ explicite, prérempli avec le dossier Téléchargements détecté par le service ; il peut aussi être choisi avec la boîte Windows ouverte par le microservice. Si aucun JDK complet n'est détecté, l'interface laisse la création possible sous Windows et le premier build installe automatiquement un JDK portable dans `Micro_Service_make_exe/tools/jdk`. La case `Inclure la base actuelle` envoie `includeData: true` et copie `{backRoot}/data` dans le portable uniquement si le dossier existe et si le back local ne répond pas sur `127.0.0.1:8082`. Ce client est séparé de `monatis-api.ts`, car il ne parle pas au back métier MONATIS.

La création portable construit d'abord le front avec `VITE_MONATIS_API_URL` vide, puis compile le back choisi avec `mvnw.cmd clean package -Dmaven.test.skip=true`. Ce flag saute aussi la compilation des tests, car le package portable ne doit pas être bloqué par des tests obsolètes du back actif. Le JDK est résolu dans cet ordre : `MONATIS_JAVA_HOME`, `tools/jdk`, `JAVA_HOME`, `PATH`, puis installation automatique de `tools/jdk` sous Windows. Quand le microservice lance `mvnw.cmd`, il injecte ce JDK dans `JAVA_HOME`, `JDK_HOME` et en tête du `PATH`; le wrapper Maven ne dépend donc pas de la configuration Java de Windows. Le microservice injecte ensuite le `dist/` Vite dans le jar Spring Boot sous `BOOT-INF/classes/static`, crée un lanceur Java Swing minimal et empaquette toutes les classes générées du lanceur, y compris les classes internes Swing, avant d'appeler `jpackage --type app-image`. Après `jpackage`, le service vérifie que `runtime/bin/java.exe` existe et le copie depuis le JDK source si le runtime minimal ne l'a pas inclus. Il ajoute aussi `Lancer-Monatis.bat`, qui sert de lanceur de secours et affiche une erreur lisible si le dossier portable n'est pas complet. Le résultat initial reste dans `Micro_Service_make_exe/work/{jobId}/jpackage-output/Monatis`, afin qu'un échec de copie vers un dossier utilisateur ne transforme pas un build réussi en erreur. L'export crée ensuite un dossier `MonatisPortable-YYYYMMDD-HHMMSS` dans le dossier choisi ; le téléchargement génère une archive `MonatisPortable-YYYYMMDD-HHMMSS.zip`.

Une archive ZIP téléchargée doit être extraite avant lancement. Exécuter `Monatis.exe` directement depuis l'aperçu ZIP de Windows peut produire `Failed to launch JVM`, car Windows ne met pas forcément `runtime/`, `app/` et le lanceur dans le même dossier temporaire.

Ce mécanisme ne modifie pas le code du back. Il lit le back actif pour le compiler et produit une image applicative autonome destinée à Windows. La base H2 courante n'est copiée que sur demande explicite depuis l'interface ou par variable d'environnement, afin d'éviter de diffuser des données personnelles par erreur.
