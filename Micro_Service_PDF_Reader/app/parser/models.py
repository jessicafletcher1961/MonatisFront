from __future__ import annotations

from dataclasses import dataclass, field, asdict
from decimal import Decimal
from typing import Any, Optional


@dataclass
class Transaction:
    operation_date: Optional[str]
    value_date: Optional[str]
    label_raw: str
    amount: Optional[Decimal]
    currency: str = "EUR"
    page: Optional[int] = None
    confidence: float = 0.8
    raw_line: str = ""
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["amount"] = float(self.amount) if self.amount is not None else None
        return data
