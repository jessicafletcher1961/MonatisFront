from decimal import Decimal

from app.parser.caisse_epargne import CaisseEpargneParser
from app.parser.utils import parse_date_dd_mm, parse_french_amount
from app.monatis_mapper import build_monatis_import


def test_parse_french_amount_with_sign_split_style():
    assert parse_french_amount("- 100,00") == Decimal("-100.00")
    assert parse_french_amount("+ 1 043,79") == Decimal("1043.79")
    assert parse_french_amount("32 338,96") == Decimal("32338.96")


def test_parse_full_and_short_dates():
    assert parse_date_dd_mm("09/12/2024", 2025, 1) == "2024-12-09"
    assert parse_date_dd_mm("07/01/2025", 2025, 1) == "2025-01-07"
    assert parse_date_dd_mm("09/12", 2025, 1) == "2024-12-09"
    assert parse_date_dd_mm("20/05", 2024, 5) == "2024-05-20"


def test_operation_match_accepts_full_dates_and_optional_technical_prefix():
    parser = CaisseEpargneParser()
    assert parser._line_has_operation_date_pair(
        "31/12/2024 31/12/2024 CHEQUE N°8197362 - 100,00"
    )
    assert parser._line_has_operation_date_pair(
        "025597453942700NE 02/01/2025 02/01/2025 VIR SEPA HUMANIS RETRAITE AGIRC + 286,64"
    )

from app.parser.utils import clean_label_noise, is_page_decoration


def test_clean_label_noise_removes_margin_codes_only():
    dirty = "CB PAYPAL *LUDUM S FACT 301124 GI NS0310C 20250107 S20B618 06768308 17515 EN007249354795520"
    assert clean_label_noise(dirty) == "CB PAYPAL *LUDUM S FACT 301124"

    useful_ref = "-Réf. donneur d'ordre : 1038879631447"
    assert clean_label_noise(useful_ref) == "Réf. donneur d'ordre : 1038879631447"


def test_page_header_second_line_is_decoration():
    assert is_page_decoration("D'OPERATION VALEUR COMPTE DE DEPOT JOINT N° 17515 00092 04953671374 (suite) EN EUR")


def test_build_monatis_import_maps_debit_and_credit_roles():
    payload = build_monatis_import(
        [
            {
                "operation_date": "2025-01-02",
                "value_date": "2025-01-03",
                "label_raw": "CB BOULANGER FACT 010125",
                "amount": -42.35,
                "currency": "EUR",
                "confidence": 0.95,
                "warnings": [],
            },
            {
                "operation_date": "2025-01-04",
                "value_date": "2025-01-04",
                "label_raw": "VIR SEPA EMPLOYEUR",
                "amount": 1200,
                "currency": "EUR",
                "confidence": 0.96,
                "warnings": [],
            },
        ]
    )

    debit, credit = payload["operation_candidates"]
    assert debit["codeTypeOperation"] == "DEPENSE"
    assert debit["statementAccountRole"] == "depense"
    assert debit["counterpartyAccountRole"] == "recette"
    assert debit["montantEnCentimes"] == 4235
    assert debit["suggestedCounterpartyName"] == "BOULANGER"
    assert debit["dateComptabilisation"] == "2025-01-01"

    assert credit["codeTypeOperation"] == "RECETTE"
    assert credit["statementAccountRole"] == "recette"
    assert credit["counterpartyAccountRole"] == "depense"
    assert credit["montantEnCentimes"] == 120000
    assert payload["monatis"]["auto_selected_count"] == 2


def test_build_monatis_import_uses_fact_date_as_accounting_date():
    payload = build_monatis_import(
        [
            {
                "operation_date": "2025-01-04",
                "value_date": "2025-01-04",
                "label_raw": "CB MICASALVA FACT 031224",
                "amount": -12.4,
                "currency": "EUR",
            },
        ]
    )

    operation = payload["operation_candidates"][0]
    assert operation["dateValeur"] == "2025-01-04"
    assert operation["dateComptabilisation"] == "2024-12-03"


def test_build_monatis_import_detects_recurring_external_account_groups():
    payload = build_monatis_import(
        [
            {
                "operation_date": "2025-01-02",
                "value_date": "2025-01-02",
                "label_raw": "CB BOULANGER FACT 010125",
                "amount": -42.35,
                "currency": "EUR",
            },
            {
                "operation_date": "2025-01-06",
                "value_date": "2025-01-06",
                "label_raw": "CB BOULANGER FACT 060125",
                "amount": -18.0,
                "currency": "EUR",
            },
            {
                "operation_date": "2025-01-07",
                "value_date": "2025-01-07",
                "label_raw": "VIR SEPA EMPLOYEUR",
                "amount": 1200,
                "currency": "EUR",
            },
        ]
    )

    first, second, third = payload["operation_candidates"]
    assert first["groupKey"] == second["groupKey"]
    assert first["groupLabel"] == "BOULANGER"
    assert first["groupSize"] == 2
    assert first["isRecurring"] is True
    assert first["dateComptabilisation"] == "2025-01-01"
    assert second["dateComptabilisation"] == "2025-01-06"
    assert third["groupSize"] == 1
    assert third["isRecurring"] is False

    groups = payload["monatis"]["external_account_groups"]
    assert groups[0]["label"] == "BOULANGER"
    assert groups[0]["count"] == 2
    assert groups[0]["operationIds"] == [first["id"], second["id"]]
