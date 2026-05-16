from __future__ import annotations

import hashlib
import re
import unicodedata
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Mapping, Sequence


def _decimal_from_json(value: Any) -> Decimal | None:
    if value is None:
        return None

    try:
        return Decimal(str(value))
    except Exception:  # noqa: BLE001 - defensive conversion for API payloads.
        return None


def _cents_from_decimal(value: Decimal | None) -> int | None:
    if value is None:
        return None

    return int((value * Decimal("100")).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _stable_candidate_id(index: int, transaction: Mapping[str, Any]) -> str:
    raw = "|".join(
        [
            str(index),
            str(transaction.get("operation_date") or ""),
            str(transaction.get("value_date") or ""),
            str(transaction.get("amount") or ""),
            str(transaction.get("label_raw") or ""),
            str(transaction.get("page") or ""),
        ]
    )
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:14]


def _compact_counterparty_name(label: str) -> str | None:
    cleaned = label.strip()
    if not cleaned:
        return None

    replacements = [
        r"^CB\s+",
        r"^CARTE\s+\d+\s+",
        r"^PRLV\s+(?:SEPA\s+)?",
        r"^PRELEVEMENT\s+(?:SEPA\s+)?",
        r"^VIR\s+(?:SEPA\s+)?(?:RECU\s+)?",
        r"^VIREMENT\s+(?:SEPA\s+)?(?:RECU\s+)?",
        r"^CHEQUE\s+N[°O]?\s*\d+\s*",
        r"^REMISE\s+CHEQUES?\s+N[°O]?\s*\d+\s*",
    ]
    for pattern in replacements:
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)

    cleaned = re.sub(r"\bFACT\s+\d{4,}\b.*$", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bVALEUR\s+AU\s+\d{2}/\d{2}\b.*$", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+-?\s*R[ée]f\..*$", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+-?\s*ID\s+CREANCIER.*$", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"(?:\s+\d{4,})+$", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" -")

    if not cleaned:
        return None

    if len(cleaned) <= 48:
        return cleaned

    shortened = cleaned[:48].rsplit(" ", 1)[0].strip(" -")
    return shortened or cleaned[:48].strip(" -")


def _date_comptabilisation_from_fact(label: str) -> str | None:
    match = re.search(r"\bFACT\s+(\d{6})\b", label, flags=re.IGNORECASE)
    if not match:
        return None

    raw_date = match.group(1)
    day = int(raw_date[:2])
    month = int(raw_date[2:4])
    year = 2000 + int(raw_date[4:6])

    try:
        return date(year, month, day).isoformat()
    except ValueError:
        return None


def _normalize_group_token(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value)
    normalized = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    normalized = normalized.upper()
    normalized = re.sub(r"\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b", " ", normalized)
    normalized = re.sub(r"\b\d{4,}\b", " ", normalized)
    normalized = re.sub(r"[^A-Z0-9]+", " ", normalized)

    ignored_words = {
        "ACHAT",
        "AU",
        "AUX",
        "AVEC",
        "CARTE",
        "CB",
        "CHEQUE",
        "D",
        "DE",
        "DES",
        "DEPENSE",
        "DU",
        "EN",
        "FACT",
        "FR",
        "LA",
        "LE",
        "LES",
        "N",
        "PAR",
        "PAIEMENT",
        "PRELEVEMENT",
        "PRLV",
        "RECU",
        "RECETTE",
        "REF",
        "REMISE",
        "SEPA",
        "SUR",
        "VIR",
        "VIREMENT",
    }
    tokens = [token for token in normalized.split() if len(token) > 1 and token not in ignored_words and not token.isdigit()]

    return " ".join(tokens).strip()


def _group_label_for_candidate(candidate: Mapping[str, Any]) -> str:
    return str(candidate.get("suggestedCounterpartyName") or candidate.get("libelle") or "Operation").strip()


def _group_key_for_candidate(candidate: Mapping[str, Any]) -> str:
    label = _group_label_for_candidate(candidate)
    token = _normalize_group_token(label) or _normalize_group_token(str(candidate.get("libelle") or "")) or str(candidate["id"])
    role = str(candidate.get("counterpartyAccountRole") or "")
    code_type = str(candidate.get("codeTypeOperation") or "")
    raw_key = f"{role}-{code_type}-{token[:80]}"
    key = re.sub(r"[^a-z0-9]+", "-", raw_key.lower()).strip("-")
    return key[:96] or hashlib.sha1(raw_key.encode("utf-8")).hexdigest()[:16]


def _candidate_from_transaction(index: int, transaction: Mapping[str, Any]) -> dict[str, Any]:
    amount = _decimal_from_json(transaction.get("amount"))
    signed_cents = _cents_from_decimal(amount)
    amount_cents = abs(signed_cents) if signed_cents is not None else None
    is_credit = amount is not None and amount >= 0
    code_type = "RECETTE" if is_credit else "DEPENSE"
    statement_account_role = "recette" if is_credit else "depense"
    counterparty_account_role = "depense" if is_credit else "recette"
    label = str(transaction.get("label_raw") or "").strip()
    warnings = list(transaction.get("warnings") or [])

    if amount_cents is None:
        warnings.append("Montant absent : operation a verifier manuellement.")

    if not transaction.get("operation_date") and not transaction.get("value_date"):
        warnings.append("Date absente : operation a verifier manuellement.")

    return {
        "id": _stable_candidate_id(index, transaction),
        "sourceIndex": index,
        "selected": amount_cents is not None,
        "codeTypeOperation": code_type,
        "dateValeur": transaction.get("value_date") or transaction.get("operation_date"),
        "dateComptabilisation": _date_comptabilisation_from_fact(label) or transaction.get("operation_date") or transaction.get("value_date"),
        "numero": None,
        "libelle": label,
        "montantEnCentimes": amount_cents,
        "montantSigneEnCentimes": signed_cents,
        "currency": transaction.get("currency") or "EUR",
        "identifiantCompteDepense": None,
        "identifiantCompteRecette": None,
        "statementAccountRole": statement_account_role,
        "counterpartyAccountRole": counterparty_account_role,
        "suggestedCounterpartyName": _compact_counterparty_name(label),
        "nomSousCategorie": None,
        "nomsBeneficiaires": [],
        "confidence": transaction.get("confidence"),
        "page": transaction.get("page"),
        "warnings": warnings,
        "raw": transaction,
    }


def _with_group_metadata(candidates: Sequence[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    groups: dict[str, dict[str, Any]] = {}

    for candidate in candidates:
        group_key = _group_key_for_candidate(candidate)
        group_label = _group_label_for_candidate(candidate)
        group = groups.setdefault(
            group_key,
            {
                "key": group_key,
                "label": group_label,
                "count": 0,
                "operationIds": [],
                "totalAmountEnCentimes": 0,
                "counterpartyAccountRole": candidate.get("counterpartyAccountRole"),
                "codeTypeOperation": candidate.get("codeTypeOperation"),
            },
        )
        group["count"] += 1
        group["operationIds"].append(candidate["id"])
        group["totalAmountEnCentimes"] += int(candidate.get("montantSigneEnCentimes") or 0)

        if len(group_label) < len(group["label"]):
            group["label"] = group_label

        candidate["groupKey"] = group_key
        candidate["groupLabel"] = group["label"]

    for candidate in candidates:
        group = groups[candidate["groupKey"]]
        candidate["groupSize"] = group["count"]
        candidate["isRecurring"] = group["count"] > 1
        candidate["groupLabel"] = group["label"]

    grouped_summary = sorted(
        groups.values(),
        key=lambda group: (-int(group["count"]), str(group["label"]).casefold()),
    )
    for group in grouped_summary:
        group["isRecurring"] = group["count"] > 1

    return list(candidates), grouped_summary


def build_monatis_import(transactions: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    candidates = [_candidate_from_transaction(index, transaction) for index, transaction in enumerate(transactions, start=1)]
    candidates, external_account_groups = _with_group_metadata(candidates)

    return {
        "operation_candidates": candidates,
        "monatis": {
            "candidate_count": len(candidates),
            "auto_selected_count": sum(1 for candidate in candidates if candidate["selected"]),
            "requires_statement_account": True,
            "supported_operation_types": ["DEPENSE", "RECETTE"],
            "external_account_groups": external_account_groups,
        },
    }
