# Maintenance actuelle

## Nettoyage identifié

- `OperationsPage.tsx` concentre encore l'historique, l'assistant de création, le détail, les lignes et les filtres avancés. Lors d'une prochaine modification substantielle de cet écran, extraire les sous-domaines en composants ou hooks dédiés.
- `BudgetsPanel.tsx` concentre encore liste, détail, formulaire et renouvellement pour les trois types de budget. Lors d'une prochaine modification substantielle des budgets, extraire le formulaire et le détail en composants dédiés.

## Règle de maintien

Cette page ne doit contenir que des dettes précises visibles dans le code courant. Supprimer une ligne dès que le nettoyage correspondant est terminé.
