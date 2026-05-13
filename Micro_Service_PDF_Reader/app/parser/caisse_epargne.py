from __future__ import annotations

import re
import tempfile
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Any, Optional

import pdfplumber

from .models import Transaction
from .utils import (
    detect_statement_year,
    clean_label_noise,
    contains_technical_noise,
    find_amounts,
    is_page_decoration,
    is_probable_footer_or_total,
    is_section_heading,
    line_starts_with_operation_date,
    normalize_label,
    normalize_text,
    parse_date_dd_mm,
    parse_french_amount,
    remove_amount_from_label,
)


@dataclass
class WordLine:
    text: str
    words: list[dict[str, Any]]
    page_number: int
    top: float


@dataclass
class ColumnContext:
    debit_x: Optional[float] = None
    credit_x: Optional[float] = None

    @property
    def has_columns(self) -> bool:
        return self.debit_x is not None and self.credit_x is not None


class CaisseEpargneParser:
    bank_name = "caisse_epargne"

    def can_parse(self, text: str) -> bool:
        t = normalize_text(text)
        return "CAISSE D'EPARGNE" in t or "CAISSE DEPARGNE" in t

    def detect_document_type(self, text: str) -> str:
        t = normalize_text(text)

        if "RELEVE DE FRAIS" in t or "RECAPITULATIF ANNUEL DE FRAIS" in t:
            return "fees_statement"

        if (
            "RELEVE DE VOS COMPTES" in t
            or "RELEVE DE VOTRE COMPTE" in t
            or "VOTRE RELEVE DE COMPTES" in t
            or "VOTRE RELEVE DE COMPTE" in t
            or "RELEVE DE COMPTES" in t
        ):
            return "account_statement"

        # Some statements have only a generic title but still include the
        # operations table. We support both old Debit/Credit columns and newer
        # signed amount columns named "Montant en EUR".
        if ("DETAIL DES OPERATIONS" in t or "DETAIL DE VOS OPERATIONS" in t) and (
            ("DEBIT" in t and "CREDIT" in t) or "MONTANT EN EUR" in t
        ):
            return "account_statement"

        return "unknown"

    def parse(self, pdf_path: str | Path) -> dict[str, Any]:
        pdf_path = Path(pdf_path)
        text = self._extract_full_text(pdf_path)
        warnings: list[str] = []

        if not self.can_parse(text):
            return {
                "bank": None,
                "document_type": "unknown",
                "transactions": [],
                "warnings": ["Le document ne semble pas être un relevé Caisse d'Épargne."],
                "stats": {"transaction_count": 0},
            }

        document_type = self.detect_document_type(text)
        year = detect_statement_year(text)
        statement_month = self._detect_statement_month(text)

        if document_type == "fees_statement":
            return {
                "bank": self.bank_name,
                "document_type": document_type,
                "statement_year": year,
                "statement_month": statement_month,
                "transactions": [],
                "warnings": [
                    "Ce document est un relevé de frais/récapitulatif annuel, pas un relevé mensuel d'opérations."
                ],
                "stats": {"transaction_count": 0},
            }

        if document_type == "unknown":
            warnings.append("Type de document non reconnu. Tentative de lecture générique du tableau d'opérations.")

        transactions = self.extract_transactions(
            pdf_path,
            statement_year=year,
            statement_month=statement_month,
            warnings=warnings,
        )

        if not transactions and document_type == "account_statement":
            warnings.append(
                "Aucune opération détectée. Le PDF est peut-être scanné, protégé, ou son format nécessite une règle supplémentaire."
            )

        balance_control = self._build_balance_control(text, transactions)
        if balance_control.get("status") == "failed":
            warnings.append(
                "Contrôle des soldes en échec : la somme des opérations ne retombe pas sur l'écart entre ancien et nouveau solde."
            )
        elif balance_control.get("status") == "unavailable":
            warnings.append("Contrôle des soldes indisponible : ancien ou nouveau solde non détecté dans le PDF.")

        return {
            "bank": self.bank_name,
            "document_type": document_type,
            "statement_year": year,
            "statement_month": statement_month,
            "transactions": [t.to_dict() for t in transactions],
            "warnings": warnings,
            "stats": {
                "transaction_count": len(transactions),
                "missing_amount_count": sum(1 for t in transactions if t.amount is None),
                "technical_noise_warning_count": sum(
                    1 for t in transactions for w in t.warnings if "code technique" in w.lower()
                ),
                "balance_control": balance_control,
            },
        }

    def _extract_full_text(self, pdf_path: Path) -> str:
        chunks: list[str] = []
        with pdfplumber.open(str(pdf_path)) as pdf:
            for page in pdf.pages:
                chunks.append(page.extract_text(x_tolerance=1, y_tolerance=3) or "")
        return "\n".join(chunks)

    def _detect_statement_month(self, text: str) -> Optional[int]:
        match = re.search(r"au\s+(\d{2})/(\d{2})/(?:\d{2}|\d{4})", text, flags=re.IGNORECASE)
        if not match:
            return None
        try:
            return int(match.group(2))
        except ValueError:
            return None

    def _build_balance_control(self, text: str, transactions: list[Transaction]) -> dict[str, Any]:
        balances = self._extract_statement_balances(text)
        if len(balances) < 2:
            return {
                "status": "unavailable",
                "opening_balance": None,
                "closing_balance": None,
                "transactions_total": self._decimal_to_json(sum((t.amount or Decimal("0")) for t in transactions)),
                "expected_delta": None,
                "difference": None,
                "passed": False,
            }

        opening = balances[0]
        closing = balances[-1]
        transactions_total = sum((t.amount or Decimal("0")) for t in transactions)
        expected_delta = closing - opening
        difference = transactions_total - expected_delta
        passed = abs(difference) <= Decimal("0.01")

        return {
            "status": "passed" if passed else "failed",
            "opening_balance": self._decimal_to_json(opening),
            "closing_balance": self._decimal_to_json(closing),
            "transactions_total": self._decimal_to_json(transactions_total),
            "expected_delta": self._decimal_to_json(expected_delta),
            "difference": self._decimal_to_json(difference),
            "passed": passed,
        }

    def _extract_statement_balances(self, text: str) -> list[Decimal]:
        compact = re.sub(r"\s+", " ", text.replace("\u00a0", " "))
        pattern = re.compile(
            r"SOLDE\s+(CREDITEUR|CREDITEUR|DEBITEUR|D[ÉE]BITEUR)\s+AU\s+"
            r"\d{2}/\d{2}/(?:\d{2}|\d{4})\s+"
            r"([+-]?\s?\d{1,3}(?:[\s.]\d{3})*,\d{2}|[+-]?\s?\d+,\d{2})",
            flags=re.IGNORECASE,
        )
        balances: list[Decimal] = []
        for match in pattern.finditer(compact):
            kind = normalize_text(match.group(1))
            raw_amount = match.group(2)
            amount = parse_french_amount(raw_amount)
            if amount is None:
                continue

            raw_stripped = raw_amount.strip()
            if raw_stripped.startswith("-") or "DEBITEUR" in kind:
                amount = abs(amount) * Decimal("-1")
            else:
                amount = abs(amount)

            balances.append(amount)
        return balances

    def _decimal_to_json(self, value: Decimal) -> float:
        return float(value.quantize(Decimal("0.01")))

    def extract_transactions(
        self,
        pdf_path: Path,
        statement_year: int,
        statement_month: Optional[int],
        warnings: list[str],
    ) -> list[Transaction]:
        transactions: list[Transaction] = []
        current: Optional[Transaction] = None
        in_table = False
        columns = ColumnContext()

        with pdfplumber.open(str(pdf_path)) as pdf:
            for page in pdf.pages:
                lines = self._extract_lines(page, page.page_number)

                for line in lines:
                    if self._is_margin_noise(line):
                        continue

                    normalized = normalize_text(line.text)

                    # Repeated page headers, footers and barcode/postal codes should be
                    # ignored without breaking a transaction that continues on the next page.
                    if is_page_decoration(line.text):
                        continue

                    if self._is_table_header(normalized):
                        in_table = True
                        columns = self._detect_columns_from_header(line, fallback=columns)
                        # Do not reset `current`: an operation may continue after a page break
                        # just below this repeated header.
                        continue

                    if self._starts_operations_area(normalized):
                        in_table = True
                        columns = self._detect_columns_from_header(line, fallback=columns)
                        current = None
                        continue

                    if not in_table:
                        continue

                    if self._is_table_end(normalized):
                        in_table = False
                        current = None
                        continue

                    if not line.text.strip():
                        continue

                    if is_probable_footer_or_total(line.text):
                        current = None
                        continue

                    if is_section_heading(line.text) and not line_starts_with_operation_date(line.text):
                        current = None
                        continue

                    if self._line_has_operation_date_pair(line.text):
                        tx = self._parse_operation_line(line, statement_year, statement_month, columns)
                        if tx:
                            transactions.append(tx)
                            current = tx
                        else:
                            current = None
                        continue

                    # Continuation line: append extra details to previous operation.
                    if current:
                        if self._looks_like_useless_continuation(line.text):
                            continue

                        # If the previous line did not contain the amount, sometimes the amount
                        # appears on a following physical line. Try to complete it.
                        if current.amount is None:
                            amount_info = self._extract_amount_info(line, columns)
                            if amount_info:
                                amount_value, amount_raw, side, confidence_delta = amount_info
                                current.amount = amount_value
                                current.confidence = min(0.95, current.confidence + confidence_delta)
                                self._append_continuation(current, line.text, amount_raw=amount_raw)
                                if side is None:
                                    current.warnings.append("Montant détecté sans colonne débit/crédit fiable.")
                                continue

                        self._append_continuation(current, line.text)

        return transactions

    def _append_continuation(self, transaction: Transaction, line_text: str, amount_raw: Optional[str] = None) -> None:
        cleaned_line = clean_label_noise(line_text)
        if amount_raw:
            cleaned_line = remove_amount_from_label(cleaned_line, amount_raw)
        if not cleaned_line:
            return

        if contains_technical_noise(line_text):
            transaction.confidence = min(transaction.confidence, 0.87)
            warning = "Libellé nettoyé : code technique PDF supprimé."
            if warning not in transaction.warnings:
                transaction.warnings.append(warning)

        transaction.label_raw = normalize_label(transaction.label_raw + " " + cleaned_line)
        transaction.raw_line = normalize_label(transaction.raw_line + " " + cleaned_line)

    def _extract_lines(self, page: Any, page_number: int) -> list[WordLine]:
        words = page.extract_words(
            x_tolerance=1,
            y_tolerance=3,
            keep_blank_chars=False,
            use_text_flow=False,
        )
        if not words:
            return []

        # Group words by visual baseline. Tolerance is in PDF points.
        sorted_words = sorted(words, key=lambda w: (round(float(w["top"]) / 4) * 4, float(w["x0"])))
        groups: list[list[dict[str, Any]]] = []
        current_group: list[dict[str, Any]] = []
        current_top: Optional[float] = None

        for word in sorted_words:
            top = float(word["top"])
            if current_group and current_top is not None and abs(top - current_top) > 4.0:
                groups.append(current_group)
                current_group = [word]
                current_top = top
            else:
                current_group.append(word)
                if current_top is None:
                    current_top = top
                else:
                    current_top = (current_top + top) / 2

        if current_group:
            groups.append(current_group)

        lines: list[WordLine] = []
        for group in groups:
            group = sorted(group, key=lambda w: float(w["x0"]))
            text = " ".join(w["text"] for w in group)
            lines.append(WordLine(text=text, words=group, page_number=page_number, top=float(group[0]["top"])))

        return lines

    def _is_margin_noise(self, line: WordLine) -> bool:
        if not line.words:
            return False
        min_x = min(float(word["x0"]) for word in line.words)
        max_x = max(float(word["x1"]) for word in line.words)
        text = normalize_label(line.text)

        # Vertical postal/barcode fragments are often extracted as tiny lines in
        # the far-left margin. Keep true operation rows, which contain dates and
        # extend across the table.
        if min_x < 25 and max_x < 35 and not self._line_has_operation_date_pair(text):
            return True

        return False

    def _starts_operations_area(self, normalized_line: str) -> bool:
        return "DETAIL DE VOS OPERATIONS" in normalized_line or "DETAIL DES OPERATIONS" in normalized_line

    def _is_table_header(self, normalized_line: str) -> bool:
        has_dates = "DATE" in normalized_line and ("VALEUR" in normalized_line or "DATE DE" in normalized_line)
        has_detail = "DETAIL" in normalized_line and "OPERATION" in normalized_line
        has_debit_credit = "DEBIT" in normalized_line and "CREDIT" in normalized_line
        has_signed_amount = "MONTANT" in normalized_line and "EUR" in normalized_line
        return (has_dates and has_detail) or (has_detail and (has_debit_credit or has_signed_amount))

    def _operation_match(self, text: str) -> Optional[re.Match[str]]:
        # Newer Caisse d'Epargne PDFs use full dates: DD/MM/YYYY DD/MM/YYYY label amount.
        # Some pages can contain a technical prefix before the first date, so we allow
        # a single non-space token before the two dates.
        date = r"\d{2}/\d{2}(?:/\d{2,4})?"
        return re.match(rf"^(?:\S{{8,}}\s+)?({date})\s+({date})\s+(.*)$", text)

    def _line_has_operation_date_pair(self, text: str) -> bool:
        return self._operation_match(normalize_label(text)) is not None

    def _is_table_end(self, normalized_line: str) -> bool:
        return any(
            marker in normalized_line
            for marker in [
                "NOUVEAU SOLDE",
                "SOLDE AU",
                "TOTAL DES OPERATIONS",
                "TOTAUX DES OPERATIONS",
                "VOS SERVICES ASSOCIES",
                "LA CAISSE D'EPARGNE A VOCATION",
            ]
        )

    def _detect_columns_from_header(self, line: WordLine, fallback: ColumnContext) -> ColumnContext:
        debit_x = fallback.debit_x
        credit_x = fallback.credit_x
        for word in line.words:
            t = normalize_text(str(word["text"]))
            center = (float(word["x0"]) + float(word["x1"])) / 2
            if t == "DEBIT":
                debit_x = center
            elif t == "CREDIT":
                credit_x = center
        return ColumnContext(debit_x=debit_x, credit_x=credit_x)

    def _parse_operation_line(
        self,
        line: WordLine,
        statement_year: int,
        statement_month: Optional[int],
        columns: ColumnContext,
    ) -> Optional[Transaction]:
        text = normalize_label(line.text)
        match = self._operation_match(text)
        if not match:
            return None

        operation_date_raw = match.group(1)
        value_date_raw = match.group(2)
        rest = match.group(3) or ""

        amount_info = self._extract_amount_info(line, columns)
        amount: Optional[Decimal] = None
        amount_raw: Optional[str] = None
        amount_side: Optional[str] = None
        confidence = 0.82
        tx_warnings: list[str] = []

        if amount_info:
            amount, amount_raw, amount_side, confidence_delta = amount_info
            confidence = min(0.98, confidence + confidence_delta)
            if amount_side is None:
                tx_warnings.append("Montant détecté, mais colonne débit/crédit incertaine.")
        else:
            tx_warnings.append("Montant non détecté sur la ligne d'opération.")
            confidence = 0.45

        label = rest
        if amount_raw:
            label = remove_amount_from_label(label, amount_raw)

        cleaned_label = clean_label_noise(label)
        if contains_technical_noise(label):
            confidence = min(confidence, 0.87)
            tx_warnings.append("Libellé nettoyé : code technique PDF supprimé.")

        return Transaction(
            operation_date=parse_date_dd_mm(operation_date_raw, statement_year, statement_month),
            value_date=parse_date_dd_mm(value_date_raw, statement_year, statement_month) if value_date_raw else None,
            label_raw=cleaned_label,
            amount=amount,
            page=line.page_number,
            confidence=confidence,
            raw_line=clean_label_noise(text),
            warnings=tx_warnings,
        )

    def _extract_amount_info(
        self,
        line: WordLine,
        columns: ColumnContext,
    ) -> Optional[tuple[Decimal, str, Optional[str], float]]:
        candidates = self._amount_candidates_with_x(line)
        if not candidates:
            return None

        # Usually the transaction amount is the rightmost amount in the row.
        amount_raw, x_center = sorted(candidates, key=lambda item: item[1])[-1]
        parsed = parse_french_amount(amount_raw)
        if parsed is None:
            return None

        side: Optional[str] = None
        confidence_delta = 0.0

        signed_text = amount_raw.strip()
        if signed_text.startswith("-"):
            return (abs(parsed) * Decimal("-1"), amount_raw, "debit", 0.12)
        if signed_text.startswith("+"):
            return (abs(parsed), amount_raw, "credit", 0.12)

        if columns.has_columns:
            assert columns.debit_x is not None and columns.credit_x is not None
            debit_distance = abs(x_center - columns.debit_x)
            credit_distance = abs(x_center - columns.credit_x)
            if debit_distance < credit_distance:
                side = "debit"
                parsed = abs(parsed) * Decimal("-1")
            else:
                side = "credit"
                parsed = abs(parsed)
            confidence_delta = 0.12
        else:
            # Last-resort heuristic: if the PDF text explicitly says D/C.
            t = normalize_text(line.text)
            if re.search(r"\bD\b|DEBIT", t):
                side = "debit"
                parsed = abs(parsed) * Decimal("-1")
                confidence_delta = 0.04
            elif re.search(r"\bC\b|CREDIT", t):
                side = "credit"
                parsed = abs(parsed)
                confidence_delta = 0.04
            else:
                parsed = abs(parsed)

        return (parsed, amount_raw, side, confidence_delta)

    def _amount_candidates_with_x(self, line: WordLine) -> list[tuple[str, float]]:
        candidates: list[tuple[str, float]] = []
        words = line.words

        for index, word in enumerate(words):
            token = str(word.get("text", "")).replace("€", "").strip()
            token_clean = token.strip("()")
            if not re.fullmatch(r"\d{1,3},\d{2}|\d+,\d{2}", token_clean):
                continue

            parts = [token_clean]
            first_index = index
            x0 = float(word["x0"])
            x1 = float(word["x1"])

            # Amounts like "32 338,96" or "+ 1 043,79" are often split into
            # separate PDF words. Walk left while groups are visually close.
            j = index - 1
            while j >= 0:
                prev = str(words[j].get("text", "")).replace("€", "").strip()
                gap = float(words[first_index]["x0"]) - float(words[j]["x1"])

                if 0 <= gap <= 12 and re.fullmatch(r"\d{1,3}", prev):
                    parts.insert(0, prev)
                    first_index = j
                    x0 = float(words[j]["x0"])
                    j -= 1
                    continue

                if 0 <= gap <= 12 and prev in {"+", "-"}:
                    parts.insert(0, prev)
                    first_index = j
                    x0 = float(words[j]["x0"])

                break

            amount_raw = " ".join(parts)
            parsed = parse_french_amount(amount_raw)
            if parsed is None:
                continue

            candidates.append((amount_raw, (x0 + x1) / 2))

        # Fallback when word-level detection missed a normal amount.
        if not candidates:
            for amount in find_amounts(line.text):
                if words:
                    x0 = float(words[-1]["x0"])
                    x1 = float(words[-1]["x1"])
                    candidates.append((amount, (x0 + x1) / 2))

        return candidates

    def _looks_like_useless_continuation(self, line: str) -> bool:
        t = normalize_text(line)
        if not t:
            return True
        if t in {"DEBIT", "CREDIT", "DATE", "VALEUR"}:
            return True
        if is_page_decoration(line):
            return True
        if is_probable_footer_or_total(line):
            return True
        if not clean_label_noise(line):
            return True
        return False
