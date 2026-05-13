# Caisse d'Épargne PDF Importer

Mini application web de test pour analyser des relevés PDF Caisse d'Épargne **sans IA**.

Elle permet de :

- déposer un PDF depuis une page web ;
- détecter si le document ressemble à un relevé Caisse d'Épargne ;
- distinguer un `relevé de vos comptes` d'un `relevé de frais` ;
- extraire les opérations des tableaux `Date / Valeur / Détail / Débit / Crédit` **et** des tableaux `Date / Valeur / Détail / Montant en EUR` ;
- afficher les opérations détectées dans un tableau ;
- nettoyer les codes techniques de marge qui peuvent polluer les libellés ;
- gérer une continuation de libellé entre deux pages ;
- vérifier le contrôle comptable `ancien solde + somme des opérations = nouveau solde` ;
- préparer des candidats d'opérations compatibles avec le front MONATIS ;
- télécharger la réponse JSON.

## Lancer l'application

```bash
cd Micro_Service_PDF_Reader
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Puis ouvrir :

```text
http://127.0.0.1:8000
```

Dans MONATIS Front, ce lancement manuel n'est plus necessaire en local : le serveur Vite demarre ce microservice automatiquement au premier import PDF.

## Fonctionnement

Le parser lit le PDF avec `pdfplumber`, récupère les mots et leurs coordonnées, puis :

1. détecte `CAISSE D'EPARGNE` ;
2. détecte le type de document ;
3. ignore les relevés de frais/récapitulatifs annuels ;
4. cherche l'en-tête du tableau d'opérations ;
5. déduit les colonnes `Débit` et `Crédit` depuis leur position quand elles existent ;
6. lit aussi les relevés plus récents avec une seule colonne `Montant en EUR` et des signes `+` / `-` ;
7. lit les lignes commençant par deux dates `DD/MM` ou `DD/MM/YYYY` ;
8. regroupe les lignes suivantes dans le libellé si elles font partie de la même opération ;
9. conserve la continuité d'un libellé quand une opération commence en bas de page et continue en haut de page suivante ;
10. nettoie les codes techniques/barcodes de marge, par exemple `GI NS0310C ...` ou `51571C0130SN...` ;
11. transforme les débits en montants négatifs et les crédits en montants positifs ;
12. calcule un contrôle des soldes quand l'ancien et le nouveau solde sont lisibles.

## Limites connues

Cette version est volontairement simple. Elle est faite pour tester et améliorer les règles.

Elle peut échouer si :

- le PDF est un scan/image sans texte intégré ;
- le PDF est protégé ;
- les colonnes sont très différentes du format attendu ;
- l'année du relevé n'apparaît pas clairement ;
- les montants sont découpés bizarrement par le moteur PDF.

Dans ces cas, l'application renvoie des warnings. L'idée est d'ajouter progressivement des variantes de parser.

## Où modifier les règles ?

Le parser principal se trouve ici :

```text
app/parser/caisse_epargne.py
```

Les fonctions utilitaires sont ici :

```text
app/parser/utils.py
```

## Format JSON retourné

Exemple :

```json
{
  "bank": "caisse_epargne",
  "document_type": "account_statement",
  "statement_year": 2025,
  "statement_month": 1,
  "transactions": [
    {
      "operation_date": "2025-01-02",
      "value_date": "2025-01-03",
      "label_raw": "REMISE CHEQUES N° 8312327 VALEUR AU 03/01",
      "amount": 400.0,
      "currency": "EUR",
      "page": 1,
      "confidence": 0.94,
      "raw_line": "02/01/2025 03/01/2025 REMISE CHEQUES N° 8312327 VALEUR AU 03/01 + 400,00",
      "warnings": []
    }
  ],
  "warnings": [],
  "stats": {
    "transaction_count": 1,
    "missing_amount_count": 0,
    "technical_noise_warning_count": 0,
    "balance_control": {
      "status": "passed",
      "opening_balance": 15140.40,
      "closing_balance": 31036.57,
      "transactions_total": 15896.17,
      "expected_delta": 15896.17,
      "difference": 0.0,
      "passed": true
    }
  },
  "operation_candidates": [
    {
      "id": "3108b55a8aa555",
      "selected": true,
      "codeTypeOperation": "RECETTE",
      "dateValeur": "2025-01-03",
      "dateComptabilisation": "2025-01-02",
      "libelle": "REMISE CHEQUES N° 8312327 VALEUR AU 03/01",
      "montantEnCentimes": 40000,
      "montantSigneEnCentimes": 40000,
      "statementAccountRole": "recette",
      "counterpartyAccountRole": "depense",
      "suggestedCounterpartyName": null
    }
  ],
  "monatis": {
    "candidate_count": 1,
    "auto_selected_count": 1,
    "requires_statement_account": true,
    "supported_operation_types": ["DEPENSE", "RECETTE"]
  }
}
```

## Étape suivante conseillée

Pour fiabiliser le système, garde 5 à 10 relevés anonymisés dans un dossier de tests local, puis ajoute des tests qui vérifient :

- le nombre d'opérations détectées ;
- les montants débit/crédit ;
- les libellés multi-lignes ;
- les relevés de frais qui doivent être refusés ;
- le contrôle des soldes qui doit passer ;
- l’absence de codes techniques dans les libellés.
