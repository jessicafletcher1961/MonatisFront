# Monatis Frontend (React + TS + Tailwind)

Ce frontend consomme l'API décrite dans le catalogue backend Monatis (PDF).

## Prérequis
- Node.js 18+ (ou 20+)
- Le backend Monatis démarré (par défaut sur `http://localhost:8082`)

## Installation
```bash
npm install
cp .env.example .env
npm run dev
```

## Configuration API
- `VITE_API_BASE_URL` dans `.env`
  - recommandé: `http://localhost:8082`

## Pages principales
- Dépense / Recette / Transfert
- Journal des opérations
- Budgets (catégorie / sous-catégorie / bénéficiaire)
- Comptes (internes / externes / techniques)
- Références (banques, catégories, sous-catégories, bénéficiaires, titulaires)
- Évaluations (soldes par compte interne)
- Rapports (plus/moins-value, relevé de compte + export PDF)
- Admin (sauvegarde, exports CSV)

> Les champs des formulaires suivent les RequestDto du backend.
