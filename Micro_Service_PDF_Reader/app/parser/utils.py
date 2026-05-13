from __future__ import annotations

import re
import unicodedata
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Optional

DATE_DD_MM_RE = re.compile(r"^(\d{2})/(\d{2})(?:/(\d{2}|\d{4}))?(?:\s+|$)")
AMOUNT_RE = re.compile(r"[+-]?\s?\d{1,3}(?:[\s\u00A0.]\d{3})*,\d{2}|[+-]?\s?\d+,\d{2}")

# Codes techniques Caisse d'Epargne qui peuvent être présents dans les marges,
# puis collés par l'extraction PDF à une vraie ligne d'opération.
TECHNICAL_CODE_PATTERNS = [
    re.compile(r"\bGI\+?\s*NS\d+[A-Z]?\s+\d{8}\s+[A-Z0-9]+\s+\d{6,}\s+\d{4,}\s+[A-Z0-9]{8,}\b", re.IGNORECASE),
    re.compile(r"\b\d{12,}[A-Z]{1,3}\b"),  # ex: 025597453942700NE
    re.compile(r"\b\d{5}C\d{4}SN\d*\b", re.IGNORECASE),  # ex: 51571C0130SN7435409000
]


def strip_accents(value: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", value)
        if unicodedata.category(c) != "Mn"
    )


def normalize_text(value: str) -> str:
    value = value.replace("’", "'").replace("`", "'")
    value = value.replace("\u00a0", " ")
    value = strip_accents(value)
    value = re.sub(r"\s+", " ", value)
    return value.upper().strip()


def normalize_label(value: str) -> str:
    value = value.replace("\u00a0", " ")
    value = re.sub(r"\s+", " ", value)
    return value.strip(" -\t")


def contains_technical_noise(value: str) -> bool:
    return any(pattern.search(value) for pattern in TECHNICAL_CODE_PATTERNS)


def clean_label_noise(value: str) -> str:
    """Remove recurring PDF margin/header codes without touching useful bank refs.

    We deliberately keep normal references such as "-Réf. donneur d'ordre" or
    SEPA mandate numbers, and remove only patterns observed in page margins or
    postal/barcode zones of Caisse d'Epargne statements.
    """
    cleaned = value
    for pattern in TECHNICAL_CODE_PATTERNS:
        cleaned = pattern.sub(" ", cleaned)

    cleaned = re.sub(r"\bRelev[ée]\s+n[°o]\s*\d+\s+au\s+\d{2}/\d{2}/\d{4}\s*-?\s*Page\s+\d+\s*/\s*\d+\b", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bCOMPTE\s+DE\s+DEPOT\s+(?:JOINT\s+)?N[°o]\s+[\d\s]+(?:\(suite\))?\b", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bMONTANT\s+EN\s+EUR\b", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bDATE\s+D['’]OPERATION\b", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bDATE\s+DE\s+VALEUR\b", " ", cleaned, flags=re.IGNORECASE)
    return normalize_label(cleaned)


def parse_french_amount(value: str) -> Optional[Decimal]:
    value = value.strip()
    value = value.replace("€", "")
    value = value.replace("EUR", "")
    value = value.replace("\u00a0", " ")
    value = value.replace(" ", "")
    value = value.replace(".", "")
    value = value.replace(",", ".")
    value = value.replace("+", "")
    try:
        return Decimal(value)
    except (InvalidOperation, ValueError):
        return None


def find_amounts(text: str) -> list[str]:
    return [m.group(0) for m in AMOUNT_RE.finditer(text)]


def parse_date_dd_mm(value: str, statement_year: int, statement_month: Optional[int] = None) -> Optional[str]:
    """Parse Caisse d'Epargne dates.

    Supports both old compact dates (DD/MM) and newer rows that include
    the full year (DD/MM/YYYY or DD/MM/YY). When only DD/MM is present,
    January statements may contain December operations, so the year is
    inferred from the statement month when available.
    """
    m = re.match(r"^(\d{2})/(\d{2})(?:/(\d{2}|\d{4}))?$", value.strip())
    if not m:
        return None
    day = int(m.group(1))
    month = int(m.group(2))
    year_raw = m.group(3)

    if year_raw:
        year = int(year_raw)
        if year < 100:
            year = 2000 + year if year < 70 else 1900 + year
    else:
        year = statement_year
        if statement_month is not None and month > statement_month:
            year -= 1

    try:
        return date(year, month, day).isoformat()
    except ValueError:
        return None


def detect_statement_year(text: str) -> int:
    """Best effort year detection."""
    years = [int(y) for y in re.findall(r"\b(20\d{2}|19\d{2})\b", text)]
    if years:
        return max(set(years), key=years.count)

    two_digit = re.findall(r"\b\d{2}/\d{2}/(\d{2})\b", text)
    if two_digit:
        y = int(two_digit[0])
        return 2000 + y if y < 70 else 1900 + y

    return date.today().year


def line_starts_with_operation_date(text: str) -> bool:
    return bool(DATE_DD_MM_RE.match(text.strip()))


def remove_amount_from_label(label: str, amount: str) -> str:
    idx = label.rfind(amount)
    if idx >= 0:
        return normalize_label(label[:idx] + label[idx + len(amount):])
    return normalize_label(label)


def is_page_decoration(line: str) -> bool:
    """Lines to ignore while preserving a possible operation continuation.

    Page headers/footers are not part of transactions. We do not use this to
    end the current operation because a multi-line transaction can continue on
    the next page after the repeated header.
    """
    t = normalize_text(line)
    if not t:
        return True
    if contains_technical_noise(line) and not re.search(r"\d{2}/\d{2}/(?:\d{2}|\d{4})", line):
        return True
    if "D'OPERATION" in t and "VALEUR" in t:
        return True
    if "DATE DATE DE" in t and "DETAIL" in t:
        return True
    if "COMPTE DE DEPOT" in t and "SUITE" in t:
        return True

    markers = [
        "RELEVE N",
        "PAGE ",
        "CAISSE D'EPARGNE ET DE PREVOYANCE",
        "SOCIETE ANONYME",
        "CODE MONETAIRE",
        "SIEGE SOCIAL",
        "DIRECT ECUREUIL",
        "POUR NOUS CONTACTER",
        "JE CONSERVE CE DOCUMENT",
        "VOTRE AGENCE",
    ]
    return any(marker in t for marker in markers)


def is_probable_footer_or_total(line: str) -> bool:
    t = normalize_text(line)
    keywords = [
        "SOLDE AU",
        "SOLDE CREDITEUR",
        "SOLDE DEBITEUR",
        "NOUVEAU SOLDE",
        "TOTAL DES OPERATIONS",
        "TOTAUX DES OPERATIONS",
        "TOTAL GENERAL",
        "REPORT",
    ]
    return any(k in t for k in keywords)


def is_section_heading(line: str) -> bool:
    t = normalize_text(line)
    headings = [
        "OPERATION DE DEPOT",
        "VIREMENTS RECUS",
        "FRAIS BANCAIRES",
        "COTISATIONS",
        "REMISES",
        "CHEQUES",
        "PRELEVEMENTS",
        "PAIEMENTS CHEQUES",
        "PAIEMENTS DIFFERES",
        "OPERATIONS CARTE",
        "DETAIL DES OPERATIONS",
        "DETAIL DE VOS OPERATIONS",
        "SOLDE PRECEDENT",
    ]
    return any(h in t for h in headings)
