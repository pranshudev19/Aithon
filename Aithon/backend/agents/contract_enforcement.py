"""
Data Contract Enforcement Agent
────────────────────────────────
Validates datasets against JSON Schema contracts.
Checks column names, data types, missing fields, range constraints.
Halts pipeline on validation failure.
"""

import json
import pandas as pd
import numpy as np
from pydantic import BaseModel, Field
from typing import Any
from utils.logging_utils import get_logger, write_audit_log
from models.database_models import AgentType

logger = get_logger("agent.contract_enforcement")


# ─── Schema Models ────────────────────────────────────────────────────────────

class ColumnContract(BaseModel):
    """Contract for a single column."""
    name: str
    dtype: str = "any"          # string, integer, float, boolean, datetime, any
    required: bool = True
    nullable: bool = False
    min_value: float | None = None
    max_value: float | None = None
    allowed_values: list[Any] | None = None
    regex_pattern: str | None = None


class DataContract(BaseModel):
    """Full dataset contract."""
    name: str = "default_contract"
    description: str = ""
    columns: list[ColumnContract] = []
    min_rows: int | None = None
    max_rows: int | None = None


class ValidationError(BaseModel):
    """A single validation error."""
    column: str | None = None
    error_type: str
    message: str
    severity: str = "ERROR"   # ERROR, WARNING


class ValidationReport(BaseModel):
    """Complete validation report."""
    is_valid: bool
    total_checks: int = 0
    passed_checks: int = 0
    failed_checks: int = 0
    warnings: int = 0
    errors: list[ValidationError] = []


# ─── Type Mapping ─────────────────────────────────────────────────────────────

DTYPE_MAP = {
    "string": ["object", "string"],
    "integer": ["int64", "int32", "Int64", "Int32"],
    "float": ["float64", "float32", "Float64"],
    "boolean": ["bool", "boolean"],
    "datetime": ["datetime64[ns]", "datetime64"],
}


def check_dtype(series: pd.Series, expected: str) -> bool:
    """Check if a pandas Series matches the expected data type."""
    if expected == "any":
        return True
    actual = str(series.dtype)
    return actual in DTYPE_MAP.get(expected, [expected])


# ─── Contract Generation ─────────────────────────────────────────────────────

def infer_contract(df: pd.DataFrame, name: str = "auto_contract") -> DataContract:
    """
    Auto-generate a data contract from a DataFrame.
    Useful as a starting point that users can refine.
    """
    columns = []
    for col in df.columns:
        series = df[col]
        dtype = str(series.dtype)

        # Map pandas dtype to contract dtype
        contract_dtype = "any"
        for key, values in DTYPE_MAP.items():
            if dtype in values:
                contract_dtype = key
                break

        col_contract = ColumnContract(
            name=col,
            dtype=contract_dtype,
            required=True,
            nullable=bool(series.isnull().any()),
        )

        # Add range constraints for numeric columns
        if contract_dtype in ("integer", "float"):
            col_contract.min_value = float(series.min()) if not series.empty else None
            col_contract.max_value = float(series.max()) if not series.empty else None

        columns.append(col_contract)

    return DataContract(
        name=name,
        description=f"Auto-generated contract for dataset with {len(df)} rows, {len(df.columns)} columns",
        columns=columns,
        min_rows=0,
        max_rows=len(df) * 10,
    )


# ─── Validation Engine ───────────────────────────────────────────────────────

def validate_dataset(df: pd.DataFrame, contract: DataContract) -> ValidationReport:
    """
    Validate a DataFrame against a DataContract.

    Checks:
    1. Required columns exist
    2. No unexpected columns (warning)
    3. Data types match
    4. Null constraints
    5. Range constraints (min/max)
    6. Allowed values
    7. Row count constraints
    """
    errors = []
    total_checks = 0
    passed_checks = 0

    contract_col_names = {c.name for c in contract.columns}
    actual_col_names = set(df.columns)

    # ── Check 1: Required columns ────────────────────────────────────────
    for col_contract in contract.columns:
        if col_contract.required:
            total_checks += 1
            if col_contract.name not in actual_col_names:
                errors.append(ValidationError(
                    column=col_contract.name,
                    error_type="missing_column",
                    message=f"Required column '{col_contract.name}' is missing",
                ))
            else:
                passed_checks += 1

    # ── Check 2: Unexpected columns (warning) ────────────────────────────
    unexpected = actual_col_names - contract_col_names
    for col_name in unexpected:
        total_checks += 1
        errors.append(ValidationError(
            column=col_name,
            error_type="unexpected_column",
            message=f"Column '{col_name}' is not defined in the contract",
            severity="WARNING",
        ))

    # ── Per-column checks ─────────────────────────────────────────────────
    for col_contract in contract.columns:
        if col_contract.name not in actual_col_names:
            continue

        series = df[col_contract.name]

        # Check 3: Data type
        if col_contract.dtype != "any":
            total_checks += 1
            if check_dtype(series, col_contract.dtype):
                passed_checks += 1
            else:
                errors.append(ValidationError(
                    column=col_contract.name,
                    error_type="dtype_mismatch",
                    message=(
                        f"Column '{col_contract.name}' expected type '{col_contract.dtype}', "
                        f"got '{series.dtype}'"
                    ),
                ))

        # Check 4: Null constraint
        if not col_contract.nullable:
            total_checks += 1
            null_count = int(series.isnull().sum())
            if null_count == 0:
                passed_checks += 1
            else:
                errors.append(ValidationError(
                    column=col_contract.name,
                    error_type="null_violation",
                    message=f"Column '{col_contract.name}' has {null_count} null values but is non-nullable",
                ))

        # Check 5: Range constraints
        if col_contract.min_value is not None:
            total_checks += 1
            try:
                numeric_series = pd.to_numeric(series.dropna(), errors="coerce")
                actual_min = float(numeric_series.min()) if len(numeric_series) > 0 else None
                if actual_min is not None and actual_min >= col_contract.min_value:
                    passed_checks += 1
                elif actual_min is not None:
                    errors.append(ValidationError(
                        column=col_contract.name,
                        error_type="range_violation",
                        message=(
                            f"Column '{col_contract.name}' min value {actual_min} "
                            f"is below allowed minimum {col_contract.min_value}"
                        ),
                    ))
            except Exception:
                passed_checks += 1  # skip if not numeric

        if col_contract.max_value is not None:
            total_checks += 1
            try:
                numeric_series = pd.to_numeric(series.dropna(), errors="coerce")
                actual_max = float(numeric_series.max()) if len(numeric_series) > 0 else None
                if actual_max is not None and actual_max <= col_contract.max_value:
                    passed_checks += 1
                elif actual_max is not None:
                    errors.append(ValidationError(
                        column=col_contract.name,
                        error_type="range_violation",
                        message=(
                            f"Column '{col_contract.name}' max value {actual_max} "
                            f"exceeds allowed maximum {col_contract.max_value}"
                        ),
                    ))
            except Exception:
                passed_checks += 1

        # Check 6: Allowed values
        if col_contract.allowed_values:
            total_checks += 1
            invalid_values = set(series.dropna().unique()) - set(col_contract.allowed_values)
            if not invalid_values:
                passed_checks += 1
            else:
                sample = list(invalid_values)[:5]
                errors.append(ValidationError(
                    column=col_contract.name,
                    error_type="allowed_values_violation",
                    message=(
                        f"Column '{col_contract.name}' contains invalid values: {sample}"
                    ),
                ))

    # ── Check 7: Row count constraints ────────────────────────────────────
    if contract.min_rows is not None:
        total_checks += 1
        if len(df) >= contract.min_rows:
            passed_checks += 1
        else:
            errors.append(ValidationError(
                error_type="row_count_violation",
                message=f"Dataset has {len(df)} rows, minimum required is {contract.min_rows}",
            ))

    if contract.max_rows is not None:
        total_checks += 1
        if len(df) <= contract.max_rows:
            passed_checks += 1
        else:
            errors.append(ValidationError(
                error_type="row_count_violation",
                message=f"Dataset has {len(df)} rows, maximum allowed is {contract.max_rows}",
            ))

    # ── Build report ──────────────────────────────────────────────────────
    actual_errors = [e for e in errors if e.severity == "ERROR"]
    warnings = [e for e in errors if e.severity == "WARNING"]

    return ValidationReport(
        is_valid=len(actual_errors) == 0,
        total_checks=total_checks,
        passed_checks=passed_checks,
        failed_checks=len(actual_errors),
        warnings=len(warnings),
        errors=errors,
    )


# ─── Main Agent Function ─────────────────────────────────────────────────────

def enforce_contract(
    file_path: str,
    contract: DataContract | None = None,
    task_id: str | None = None,
    db=None,
) -> dict:
    """
    Main entry point for the Data Contract Enforcement Agent.

    1. Load dataset from file
    2. If no contract provided, auto-generate one
    3. Validate dataset against contract
    4. Return validation report

    Args:
        file_path: Path to CSV or JSON dataset
        contract: Optional DataContract; auto-generated if None
        task_id: Parent task ID for audit logging
        db: Database session (optional)

    Returns:
        dict with keys: is_valid, report, contract
    """
    logger.info(f"Enforcing contract on: {file_path}")

    # Load dataset
    if file_path.endswith(".json"):
        df = pd.read_json(file_path)
    else:
        df = pd.read_csv(file_path)

    logger.info(f"Loaded dataset: {df.shape[0]} rows, {df.shape[1]} columns")

    # Auto-generate contract if not provided
    if contract is None:
        contract = infer_contract(df, name="auto_inferred")
        logger.info("Auto-generated contract from dataset")

    # Validate
    report = validate_dataset(df, contract)
    logger.info(f"Validation complete: valid={report.is_valid}, "
                f"passed={report.passed_checks}/{report.total_checks}")

    # Audit log
    if db and task_id:
        write_audit_log(
            db=db,
            action="Contract enforcement completed",
            task_id=task_id,
            agent_type=AgentType.CONTRACT_ENFORCEMENT,
            details={
                "is_valid": report.is_valid,
                "total_checks": report.total_checks,
                "passed_checks": report.passed_checks,
                "failed_checks": report.failed_checks,
            },
            severity="INFO" if report.is_valid else "WARNING",
        )

    return {
        "is_valid": report.is_valid,
        "report": report.model_dump(),
        "contract": contract.model_dump(),
        "dataset_shape": {"rows": df.shape[0], "columns": df.shape[1]},
    }
