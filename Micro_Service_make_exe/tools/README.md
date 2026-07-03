# Outils locaux du builder portable

Le microservice cherche un JDK portable dans `tools/jdk`.

Si ce dossier est absent, le premier build portable sous Windows télécharge automatiquement un JDK complet et l'installe ici. Le dossier `tools/jdk` peut ensuite être copié avec le projet pour fabriquer les portables sur une autre machine sans configurer `JAVA_HOME`.

Le dossier `tools/jdk` est volontairement ignoré par Git, car il contient des binaires lourds.
