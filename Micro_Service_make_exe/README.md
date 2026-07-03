# Micro_Service_make_exe

Service local de creation d'une version portable Windows de MONATIS.

## Lancer le service

En usage normal, le front lance ce service automatiquement via Vite quand la page CSV/admin appelle `/__monatis_portable_builder`.

Le lancement manuel reste possible pour diagnostiquer le service hors interface :

```bat
start-service.bat
```

Le service ecoute uniquement sur `127.0.0.1:8095`.

## Pre-requis

- Node.js disponible pour lancer ce service.
- Un JDK complet disponible dans `JAVA_HOME`, `MONATIS_JAVA_HOME` ou dans le `PATH`.
- Le JDK doit fournir `javac`, `jar` et `jpackage`.
- Le dossier back peut être choisi depuis l'interface. Par défaut, le service propose `../MonatisBack-main` ou la variable `MONATIS_BACK_ROOT`.
- Le dossier back choisi doit contenir `pom.xml` et le wrapper Maven du back (`mvnw.cmd` sous Windows).

## Fonctionnement

Quand le front appelle `POST /api/build-portable`, le service construit d'abord une image portable interne dans `Micro_Service_make_exe/work/{jobId}` :

- le front avec `VITE_MONATIS_API_URL` vide pour utiliser les appels API relatifs ;
- le back Spring Boot choisi via `mvnw.cmd clean package -Dmaven.test.skip=true` ;
- un jar back portable enrichi avec le `dist/` du front dans `BOOT-INF/classes/static` ;
- un petit lanceur Java dont toutes les classes compilees sont empaquetees avant l'appel a `jpackage` ;
- une image portable contenant `Monatis.exe`, `runtime/`, `app/`, `data/`, `sauvegardes/`, `echanges/` et `logs/`.
- `runtime/bin/java.exe` et `Lancer-Monatis.bat` comme lanceur de secours lorsque le launcher natif Windows ne trouve pas la JVM.

Le JSON de création accepte `backRoot` et `includeData: true`. `backRoot` est le chemin absolu du back à compiler ; s'il est absent, le service utilise `MONATIS_BACK_ROOT` ou `../MonatisBack-main`. Quand `includeData` vaut `true`, le service copie aussi `{backRoot}/data` vers le dossier `data/` du portable. Le back local doit être arrêté avant la copie ; si le service répond encore sur `127.0.0.1:8082`, la création est refusée pour éviter une copie incohérente de H2.

Cette image interne reste dans le dossier de travail tant que le job est conserve en memoire. L'interface propose ensuite deux actions separees :

- `POST /api/build-portable/jobs/{id}/export` copie l'image vers le dossier absolu choisi dans l'interface ;
- `GET /api/build-portable/jobs/{id}/download` genere puis telecharge une archive ZIP de l'image.

Le choix de dossier utilise deux routes :

- `POST /api/select-back-directory` ouvre une fenetre Windows pour choisir le back à compiler ;
- `POST /api/select-output-directory` ouvre une fenetre Windows pour choisir le dossier d'export.

Les champs texte restent disponibles pour saisir des chemins absolus manuellement.

Sur Windows, les scripts `npm.cmd` et `mvnw.cmd` sont lances via `cmd.exe /d /s /c` pour rester compatibles avec Node 22 et les postes ou `spawn` direct sur un fichier `.cmd` renvoie `EINVAL`.

La base H2 courante n'est pas copiee par defaut pour eviter une copie incoherente si elle est ouverte. Cocher `Inclure la base actuelle` dans l'interface pour la copier dans le package. La variable `MONATIS_PORTABLE_COPY_DATA=1` reste disponible pour forcer cette copie hors interface.

Le ZIP telecharge doit etre extrait avant lancement. Lancer `Monatis.exe` directement depuis l'interieur de l'archive Windows peut provoquer `Failed to launch JVM`, car Windows extrait seulement une partie du dossier temporairement.
