# Outillage et lancement

## Stack

- React 19
- TypeScript 5.9
- Vite 8
- React Router 7
- React Query 5
- React Hook Form et Zod pour les formulaires complexes
- Lucide React pour les icônes

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

## Microservice PDF

`vite.config.ts` lance le microservice situé dans `Micro_Service_PDF_Reader` au démarrage du serveur Vite. Le proxy Vite expose ensuite le service sous `/__monatis_pdf_reader`.

Le client PDF est `src/lib/pdf-import-api.ts`. Il ne doit pas hardcoder un port ; il passe par `VITE_MONATIS_PDF_IMPORTER_URL` ou par le proxy local.
