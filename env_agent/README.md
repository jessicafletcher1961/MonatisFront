# Environnement agent MONATIS Front

Ce dossier décrit l'état courant du front React/Vite de MONATIS. Il sert aux agents de code pour maintenir la cohérence entre le code, les appels API et la documentation.

## Projet couvert

- Racine front : `MonatisFront-codex-monatis-front-ui-refresh`
- Application : React 19, TypeScript, Vite, React Query, React Hook Form, Zod
- API principale : `VITE_MONATIS_API_URL`, par défaut `http://localhost:8082`
- Microservice PDF local : proxy Vite `/__monatis_pdf_reader`, port par défaut `8000`

## Commandes

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

`npm run build` est la vérification minimale après modification du front.

## Documents

- [Index documentaire](docs/README.md)
- [Vue d'ensemble](docs/front-overview.md)
- [Outillage et lancement](docs/runtime-and-tooling.md)
- [Architecture](docs/architecture.md)
- [Contrats API](docs/api-contract.md)
- [Opérations et import](docs/features-operations.md)
- [Comptes et références](docs/features-accounts-references.md)
- [Rapports](docs/features-reports.md)
- [Maintenance actuelle](docs/maintenance.md)
