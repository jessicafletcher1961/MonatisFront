# MONATIS Front

Front React + TypeScript + Vite pour la V1 MONATIS.

Le projet couvre :
- les references `banque`, `titulaire`, `beneficiaire`, `categorie`, `souscategorie`
- les comptes externes
- les comptes internes et leurs evaluations
- les operations avec compatibilites de comptes
- les rapports V1

## Stack

- React 19
- Vite 8
- TypeScript
- React Router
- TanStack Query
- React Hook Form + Zod
- Lucide React
- Framer Motion

## Demarrage

1. Installer les dependances :

```bash
npm install
```

2. Configurer l URL du back :

```bash
cp .env.example .env
```

3. Lancer le front :

```bash
npm run dev
```

Par defaut, le front attend le back sur `http://localhost:8082`.

## Scripts

- `npm run dev` : demarrage local
- `npm run lint` : verification ESLint
- `npm run build` : build production
- `npm run preview` : apercu du build

## Notes d integration

- Le client API est centralise dans `src/lib/monatis-api.ts`.
- Certains rapports sont calcules localement dans `src/lib/reporting.ts` pour contourner les endpoints back en `GET` avec body.
- L URL API peut etre surchargee via `VITE_MONATIS_API_URL`.
