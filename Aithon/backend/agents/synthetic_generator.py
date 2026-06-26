"""
Synthetic Data Generator Agent
──────────────────────────────
Generates synthetic tabular data using statistical methods.
Includes CTGAN and VAE stubs for production deployment.
Applies noise injection and PII masking.
"""

import os
import re
import numpy as np
import pandas as pd
from utils.logging_utils import get_logger, write_audit_log
from models.database_models import AgentType
from config import settings

logger = get_logger("agent.synthetic_generator")


# ─── PII Detection & Masking ─────────────────────────────────────────────────

PII_PATTERNS = {
    "email": r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
    "phone": r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}",
    "ssn": r"\d{3}-\d{2}-\d{4}",
}

PII_COLUMN_NAMES = [
    "email", "phone", "telephone", "ssn", "social_security",
    "credit_card", "address", "street", "zip_code", "postal",
    "first_name", "last_name", "full_name", "name",
    "date_of_birth", "dob", "passport", "license",
]


def detect_pii_columns(df: pd.DataFrame) -> list[str]:
    """Detect columns likely containing PII data."""
    pii_cols = []
    for col in df.columns:
        col_lower = col.lower().replace(" ", "_")

        # Check column name
        if any(pii in col_lower for pii in PII_COLUMN_NAMES):
            pii_cols.append(col)
            continue

        # Check content patterns (sample first 100 rows)
        if df[col].dtype == object:
            sample = df[col].dropna().head(100).astype(str)
            for pattern_name, pattern in PII_PATTERNS.items():
                matches = sample.str.contains(pattern, regex=True, na=False).sum()
                if matches > len(sample) * 0.3:  # >30% match
                    pii_cols.append(col)
                    break

    return pii_cols


def mask_pii(df: pd.DataFrame, pii_columns: list[str]) -> pd.DataFrame:
    """Remove PII columns from the dataset."""
    df_safe = df.drop(columns=[c for c in pii_columns if c in df.columns], errors="ignore")
    logger.info(f"Masked {len(pii_columns)} PII columns: {pii_columns}")
    return df_safe


# ─── Noise Injection ─────────────────────────────────────────────────────────

def inject_noise(df: pd.DataFrame, noise_level: float = 0.05) -> pd.DataFrame:
    """
    Add small random noise to numeric columns for differential privacy.
    noise_level: fraction of column std to use as noise magnitude.
    """
    df_noisy = df.copy()
    numeric_cols = df_noisy.select_dtypes(include=[np.number]).columns

    for col in numeric_cols:
        std = df_noisy[col].std()
        if std > 0:
            noise = np.random.normal(0, std * noise_level, size=len(df_noisy))
            df_noisy[col] = df_noisy[col] + noise

    return df_noisy


# ─── Statistical Generator (Default) ─────────────────────────────────────────

def generate_statistical(df: pd.DataFrame, num_rows: int = None) -> pd.DataFrame:
    """
    Generate synthetic data by sampling from column distributions.
    - Numeric: sample from normal distribution (mean, std)
    - Categorical: sample from value frequency distribution
    """
    if num_rows is None:
        num_rows = len(df)

    synthetic_data = {}

    for col in df.columns:
        if df[col].dtype in [np.float64, np.int64, np.float32, np.int32]:
            # Numeric: normal distribution
            mean = df[col].mean()
            std = df[col].std()
            if std == 0:
                synthetic_data[col] = np.full(num_rows, mean)
            else:
                synthetic_data[col] = np.random.normal(mean, std, num_rows)

            # Preserve integer type
            if df[col].dtype in [np.int64, np.int32]:
                synthetic_data[col] = np.round(synthetic_data[col]).astype(int)
        else:
            # Categorical: frequency-based sampling
            value_counts = df[col].dropna().value_counts(normalize=True)
            if len(value_counts) > 0:
                synthetic_data[col] = np.random.choice(
                    value_counts.index,
                    size=num_rows,
                    p=value_counts.values,
                )
            else:
                synthetic_data[col] = [None] * num_rows

    return pd.DataFrame(synthetic_data)


# ─── CTGAN Stub ───────────────────────────────────────────────────────────────

class CTGANGenerator:
    """
    CTGAN stub for production deployment.
    Replace with real SDV implementation:

        from sdv.single_table import CTGANSynthesizer
        from sdv.metadata import SingleTableMetadata

        metadata = SingleTableMetadata()
        metadata.detect_from_dataframe(df)
        synthesizer = CTGANSynthesizer(metadata)
        synthesizer.fit(df)
        synthetic = synthesizer.sample(num_rows)

    The interface stays the same.
    """

    def __init__(self, epochs: int = 300):
        self.epochs = epochs
        logger.info(f"CTGANGenerator initialized (stub mode, epochs={epochs})")

    def fit(self, df: pd.DataFrame):
        """Fit the CTGAN model (stub: stores distribution stats)."""
        self._stats = {
            col: {"mean": df[col].mean(), "std": df[col].std()}
            for col in df.select_dtypes(include=[np.number]).columns
        }
        self._df = df
        logger.info("CTGAN fit complete (stub)")

    def generate(self, num_rows: int) -> pd.DataFrame:
        """Generate synthetic data using CTGAN (stub: statistical sampling)."""
        return generate_statistical(self._df, num_rows)


# ─── VAE Stub ─────────────────────────────────────────────────────────────────

class VAEGenerator:
    """
    VAE stub for production deployment.
    Replace with real PyTorch VAE implementation.
    """

    def __init__(self, latent_dim: int = 16, epochs: int = 100):
        self.latent_dim = latent_dim
        self.epochs = epochs
        logger.info(f"VAEGenerator initialized (stub mode, latent_dim={latent_dim})")

    def fit(self, df: pd.DataFrame):
        """Fit the VAE model (stub)."""
        self._df = df
        logger.info("VAE fit complete (stub)")

    def generate(self, num_rows: int) -> pd.DataFrame:
        """Generate synthetic data using VAE (stub: statistical sampling)."""
        return generate_statistical(self._df, num_rows)


# ─── Statistical Comparison ──────────────────────────────────────────────────

def compare_datasets(original: pd.DataFrame, synthetic: pd.DataFrame) -> dict:
    """Generate statistical comparison report between original and synthetic data."""
    comparison = {}
    numeric_cols = original.select_dtypes(include=[np.number]).columns

    for col in numeric_cols:
        if col in synthetic.columns:
            orig_stats = {
                "mean": float(original[col].mean()),
                "std": float(original[col].std()),
                "min": float(original[col].min()),
                "max": float(original[col].max()),
                "median": float(original[col].median()),
            }
            synth_stats = {
                "mean": float(synthetic[col].mean()),
                "std": float(synthetic[col].std()),
                "min": float(synthetic[col].min()),
                "max": float(synthetic[col].max()),
                "median": float(synthetic[col].median()),
            }
            # Calculate relative differences
            mean_diff = abs(orig_stats["mean"] - synth_stats["mean"])
            mean_pct = (mean_diff / abs(orig_stats["mean"]) * 100) if orig_stats["mean"] != 0 else 0

            comparison[col] = {
                "original": orig_stats,
                "synthetic": synth_stats,
                "mean_difference_pct": round(mean_pct, 2),
            }

    # Overall correlation comparison
    if len(numeric_cols) > 1:
        try:
            orig_corr = original[numeric_cols].corr().values.flatten().tolist()
            synth_corr = synthetic[numeric_cols].corr().values.flatten().tolist()
            corr_diff = np.mean(np.abs(np.array(orig_corr) - np.array(synth_corr)))
            comparison["_correlation_difference"] = round(float(corr_diff), 4)
        except Exception:
            comparison["_correlation_difference"] = None

    return comparison


# ─── Main Agent Function ─────────────────────────────────────────────────────

def generate_synthetic(
    file_path: str,
    num_rows: int | None = None,
    method: str = "statistical",      # statistical, ctgan, vae
    task_id: str | None = None,
    db=None,
    output_dir: str | None = None,
    apply_noise: bool = True,
    mask_pii_data: bool = True,
) -> dict:
    """
    Main entry point for the Synthetic Data Generator Agent.

    Pipeline:
    1. Load dataset
    2. Detect and mask PII columns
    3. Generate synthetic data using selected method
    4. Apply noise injection for differential privacy
    5. Save synthetic dataset
    6. Generate statistical comparison report

    Args:
        file_path: Path to source dataset
        num_rows: Number of synthetic rows (default: same as source)
        method: Generation method — statistical, ctgan, vae
        task_id: Parent task ID
        db: Database session (optional)
        output_dir: Directory for output file
        apply_noise: Whether to add noise for privacy
        mask_pii_data: Whether to remove PII columns

    Returns:
        dict with keys: synthetic_file_path, comparison_report, pii_columns, summary
    """
    logger.info(f"Generating synthetic data from: {file_path} (method={method})")

    # Step 1: Load dataset
    if file_path.endswith(".json"):
        df = pd.read_json(file_path)
    else:
        df = pd.read_csv(file_path)

    if num_rows is None:
        num_rows = len(df)

    logger.info(f"Source dataset: {df.shape[0]} rows, {df.shape[1]} columns")

    # Step 2: PII masking
    pii_columns = []
    if mask_pii_data:
        pii_columns = detect_pii_columns(df)
        if pii_columns:
            df = mask_pii(df, pii_columns)
            logger.info(f"Masked {len(pii_columns)} PII columns")

    # Step 3: Generate synthetic data
    if method == "ctgan":
        generator = CTGANGenerator()
        generator.fit(df)
        synthetic_df = generator.generate(num_rows)
    elif method == "vae":
        generator = VAEGenerator()
        generator.fit(df)
        synthetic_df = generator.generate(num_rows)
    else:
        synthetic_df = generate_statistical(df, num_rows)

    logger.info(f"Generated {len(synthetic_df)} synthetic rows")

    # Step 4: Noise injection
    if apply_noise:
        synthetic_df = inject_noise(synthetic_df)
        logger.info("Applied noise injection")

    # Step 5: Save synthetic dataset
    if output_dir is None:
        output_dir = settings.SYNTHETIC_OUTPUT_DIR
    os.makedirs(output_dir, exist_ok=True)

    base_name = os.path.splitext(os.path.basename(file_path))[0]
    output_path = os.path.join(output_dir, f"{base_name}_synthetic.csv")
    synthetic_df.to_csv(output_path, index=False)
    logger.info(f"Synthetic dataset saved to: {output_path}")

    # Step 6: Statistical comparison
    comparison = compare_datasets(df, synthetic_df)

    summary = {
        "source_rows": len(df),
        "synthetic_rows": len(synthetic_df),
        "method": method,
        "pii_columns_masked": len(pii_columns),
        "noise_applied": apply_noise,
        "columns_generated": len(synthetic_df.columns),
    }

    # Audit log
    if db and task_id:
        write_audit_log(
            db=db,
            action="Synthetic data generated",
            task_id=task_id,
            agent_type=AgentType.SYNTHETIC_GENERATOR,
            details=summary,
        )

    return {
        "synthetic_file_path": output_path,
        "comparison_report": comparison,
        "pii_columns": pii_columns,
        "summary": summary,
    }
