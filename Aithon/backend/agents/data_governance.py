"""
Data Quality Governance Agent
─────────────────────────────
Missing value detection and KNN imputation.
Duplicate detection using hash-based comparison.
Outlier detection using Z-score and IQR methods.
Generates data quality report and saves cleaned dataset.
"""

import hashlib
import os
import pandas as pd
import numpy as np
from sklearn.impute import KNNImputer
from utils.logging_utils import get_logger, write_audit_log
from models.database_models import AgentType
from config import settings

logger = get_logger("agent.data_governance")


# ─── Missing Value Analysis & Imputation ──────────────────────────────────────

def analyze_missing_values(df: pd.DataFrame) -> dict:
    """Analyze missing values per column."""
    missing = df.isnull().sum()
    total = len(df)
    report = {}
    for col in df.columns:
        count = int(missing[col])
        report[col] = {
            "missing_count": count,
            "missing_percentage": round(count / total * 100, 2) if total > 0 else 0,
        }
    return report


def impute_missing_values(df: pd.DataFrame, n_neighbors: int = 5) -> tuple[pd.DataFrame, dict]:
    """
    Impute missing values using KNN Imputer for numeric columns.
    Categorical columns are filled with mode.
    Returns (imputed_df, imputation_report).
    """
    imputation_report = {}
    df_clean = df.copy()

    # Separate numeric and categorical columns
    numeric_cols = df_clean.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = df_clean.select_dtypes(exclude=[np.number]).columns.tolist()

    # KNN imputation for numeric columns
    if numeric_cols:
        missing_before = df_clean[numeric_cols].isnull().sum().sum()
        if missing_before > 0:
            imputer = KNNImputer(n_neighbors=min(n_neighbors, len(df_clean) - 1))
            df_clean[numeric_cols] = imputer.fit_transform(df_clean[numeric_cols])
            missing_after = df_clean[numeric_cols].isnull().sum().sum()
            imputation_report["numeric"] = {
                "method": "KNN",
                "n_neighbors": n_neighbors,
                "values_imputed": int(missing_before - missing_after),
                "columns": numeric_cols,
            }

    # Mode imputation for categorical columns
    if categorical_cols:
        missing_before = df_clean[categorical_cols].isnull().sum().sum()
        if missing_before > 0:
            for col in categorical_cols:
                if df_clean[col].isnull().any():
                    mode_val = df_clean[col].mode()
                    if len(mode_val) > 0:
                        df_clean[col].fillna(mode_val[0], inplace=True)
            missing_after = df_clean[categorical_cols].isnull().sum().sum()
            imputation_report["categorical"] = {
                "method": "mode",
                "values_imputed": int(missing_before - missing_after),
                "columns": categorical_cols,
            }

    return df_clean, imputation_report


# ─── Duplicate Detection ─────────────────────────────────────────────────────

def detect_duplicates(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """
    Detect and remove duplicate rows using hash-based comparison.
    Returns (deduplicated_df, duplicate_report).
    """
    # Hash each row for efficient comparison
    row_hashes = df.apply(
        lambda row: hashlib.md5(str(row.values).encode()).hexdigest(), axis=1
    )
    duplicate_mask = row_hashes.duplicated(keep="first")
    duplicate_count = int(duplicate_mask.sum())
    duplicate_indices = df[duplicate_mask].index.tolist()

    df_clean = df[~duplicate_mask].reset_index(drop=True)

    report = {
        "total_rows": len(df),
        "duplicate_count": duplicate_count,
        "duplicate_percentage": round(duplicate_count / len(df) * 100, 2) if len(df) > 0 else 0,
        "rows_after_dedup": len(df_clean),
        "removed_indices": duplicate_indices[:20],  # first 20 for display
    }

    return df_clean, report


# ─── Outlier Detection ────────────────────────────────────────────────────────

def detect_outliers_zscore(series: pd.Series, threshold: float = 3.0) -> dict:
    """Detect outliers using Z-score method."""
    if series.dtype not in [np.float64, np.int64, np.float32, np.int32]:
        return {"method": "zscore", "outlier_count": 0, "skipped": True}

    clean_series = series.dropna()
    if len(clean_series) < 3:
        return {"method": "zscore", "outlier_count": 0, "skipped": True}

    mean = clean_series.mean()
    std = clean_series.std()
    if std == 0:
        return {"method": "zscore", "outlier_count": 0, "std_zero": True}

    z_scores = np.abs((clean_series - mean) / std)
    outlier_mask = z_scores > threshold
    outlier_count = int(outlier_mask.sum())

    return {
        "method": "zscore",
        "threshold": threshold,
        "outlier_count": outlier_count,
        "outlier_percentage": round(outlier_count / len(clean_series) * 100, 2),
        "outlier_indices": clean_series[outlier_mask].index.tolist()[:10],
    }


def detect_outliers_iqr(series: pd.Series, multiplier: float = 1.5) -> dict:
    """Detect outliers using IQR (Interquartile Range) method."""
    if series.dtype not in [np.float64, np.int64, np.float32, np.int32]:
        return {"method": "iqr", "outlier_count": 0, "skipped": True}

    clean_series = series.dropna()
    if len(clean_series) < 4:
        return {"method": "iqr", "outlier_count": 0, "skipped": True}

    q1 = clean_series.quantile(0.25)
    q3 = clean_series.quantile(0.75)
    iqr = q3 - q1
    lower_bound = q1 - multiplier * iqr
    upper_bound = q3 + multiplier * iqr

    outlier_mask = (clean_series < lower_bound) | (clean_series > upper_bound)
    outlier_count = int(outlier_mask.sum())

    return {
        "method": "iqr",
        "multiplier": multiplier,
        "q1": float(q1),
        "q3": float(q3),
        "iqr": float(iqr),
        "lower_bound": float(lower_bound),
        "upper_bound": float(upper_bound),
        "outlier_count": outlier_count,
        "outlier_percentage": round(outlier_count / len(clean_series) * 100, 2),
    }


def detect_all_outliers(df: pd.DataFrame) -> dict:
    """Run both Z-score and IQR outlier detection on all numeric columns."""
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    outlier_report = {}

    for col in numeric_cols:
        outlier_report[col] = {
            "zscore": detect_outliers_zscore(df[col]),
            "iqr": detect_outliers_iqr(df[col]),
        }

    return outlier_report


# ─── Main Agent Function ─────────────────────────────────────────────────────

def govern_data(
    file_path: str,
    task_id: str | None = None,
    db=None,
    output_dir: str | None = None,
) -> dict:
    """
    Main entry point for the Data Quality Governance Agent.

    Pipeline:
    1. Load dataset
    2. Analyze and impute missing values (KNN)
    3. Detect and remove duplicates (hash-based)
    4. Detect outliers (Z-score + IQR)
    5. Save cleaned dataset
    6. Generate quality report

    Args:
        file_path: Path to CSV or JSON dataset
        task_id: Parent task ID for audit logging
        db: Database session (optional)
        output_dir: Directory to save cleaned dataset

    Returns:
        dict with keys: quality_report, cleaned_file_path, summary
    """
    logger.info(f"Starting data governance on: {file_path}")

    # Step 1: Load dataset
    if file_path.endswith(".json"):
        df = pd.read_json(file_path)
    else:
        df = pd.read_csv(file_path)

    original_shape = df.shape
    logger.info(f"Loaded dataset: {original_shape[0]} rows, {original_shape[1]} columns")

    # Step 2: Missing values
    missing_report = analyze_missing_values(df)
    df, imputation_report = impute_missing_values(df)
    logger.info("Missing value imputation complete")

    # Step 3: Duplicates
    df, duplicate_report = detect_duplicates(df)
    logger.info(f"Duplicate detection: {duplicate_report['duplicate_count']} duplicates removed")

    # Step 4: Outliers
    outlier_report = detect_all_outliers(df)
    total_outliers = sum(
        col_data["zscore"].get("outlier_count", 0)
        for col_data in outlier_report.values()
    )
    logger.info(f"Outlier detection: {total_outliers} outliers found (Z-score)")

    # Step 5: Save cleaned dataset
    if output_dir is None:
        output_dir = settings.UPLOAD_DIR
    os.makedirs(output_dir, exist_ok=True)

    base_name = os.path.splitext(os.path.basename(file_path))[0]
    cleaned_path = os.path.join(output_dir, f"{base_name}_cleaned.csv")
    df.to_csv(cleaned_path, index=False)
    logger.info(f"Cleaned dataset saved to: {cleaned_path}")

    # Step 6: Build quality report
    quality_report = {
        "original_shape": {"rows": original_shape[0], "columns": original_shape[1]},
        "cleaned_shape": {"rows": df.shape[0], "columns": df.shape[1]},
        "missing_values": missing_report,
        "imputation": imputation_report,
        "duplicates": duplicate_report,
        "outliers": outlier_report,
        "summary": {
            "rows_removed": original_shape[0] - df.shape[0],
            "total_missing_imputed": sum(
                v.get("values_imputed", 0)
                for v in imputation_report.values()
            ),
            "total_outliers_detected": total_outliers,
        },
    }

    # Audit log
    if db and task_id:
        write_audit_log(
            db=db,
            action="Data governance completed",
            task_id=task_id,
            agent_type=AgentType.DATA_GOVERNANCE,
            details=quality_report["summary"],
        )

    return {
        "quality_report": quality_report,
        "cleaned_file_path": cleaned_path,
        "summary": quality_report["summary"],
    }
