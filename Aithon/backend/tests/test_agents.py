"""
Unit tests for all 4 agents.
"""

import os
import sys
import pytest
import pandas as pd
import numpy as np
import tempfile

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ─── Test Data ────────────────────────────────────────────────────────────────

@pytest.fixture
def sample_csv(tmp_path):
    """Create a sample CSV file for testing."""
    df = pd.DataFrame({
        "id": range(1, 21),
        "name": [f"Product_{i}" for i in range(1, 21)],
        "price": [round(np.random.uniform(10, 100), 2) for _ in range(20)],
        "quantity": [np.random.randint(1, 50) for _ in range(20)],
        "category": np.random.choice(["A", "B", "C"], 20),
        "email": [f"user{i}@example.com" for i in range(1, 21)],
    })
    # Add some missing values
    df.loc[3, "price"] = np.nan
    df.loc[7, "quantity"] = np.nan
    # Add a duplicate row
    df = pd.concat([df, df.iloc[[0]]], ignore_index=True)

    path = str(tmp_path / "test_data.csv")
    df.to_csv(path, index=False)
    return path


# ─── Task Planner Tests ──────────────────────────────────────────────────────

class TestTaskPlanner:
    def test_classify_validate(self):
        from agents.task_planner import classify_intent
        assert classify_intent("Validate the sales dataset") == "validate"

    def test_classify_quality(self):
        from agents.task_planner import classify_intent
        assert classify_intent("Clean and impute missing values") == "quality_check"

    def test_classify_synthetic(self):
        from agents.task_planner import classify_intent
        assert classify_intent("Generate synthetic fake data") == "generate_synthetic"

    def test_classify_compound(self):
        from agents.task_planner import classify_intent
        result = classify_intent("Validate dataset and generate synthetic data")
        assert result == "full_pipeline"

    def test_extract_entities(self):
        from agents.task_planner import extract_entities
        entities = extract_entities("Validate the sales dataset and generate 1000 rows")
        assert entities.dataset_name == "sales"
        assert entities.row_count == 1000

    def test_build_dag(self):
        from agents.task_planner import build_dag_from_intent
        dag = build_dag_from_intent("full_pipeline", "test-task-id")
        assert len(dag["nodes"]) == 3
        assert len(dag["edges"]) == 2
        assert dag["nodes"][0]["type"] == "CONTRACT_ENFORCEMENT"

    def test_plan_task(self):
        from agents.task_planner import plan_task
        result = plan_task("Validate sales dataset and generate synthetic data", "test-id")
        assert "intent" in result
        assert "dag" in result
        assert "entities" in result


# ─── Contract Enforcement Tests ──────────────────────────────────────────────

class TestContractEnforcement:
    def test_infer_contract(self):
        from agents.contract_enforcement import infer_contract
        df = pd.DataFrame({"a": [1, 2, 3], "b": ["x", "y", "z"]})
        contract = infer_contract(df)
        assert len(contract.columns) == 2

    def test_validate_valid(self):
        from agents.contract_enforcement import validate_dataset, DataContract, ColumnContract
        df = pd.DataFrame({"name": ["a", "b"], "value": [1, 2]})
        contract = DataContract(columns=[
            ColumnContract(name="name", dtype="string"),
            ColumnContract(name="value", dtype="integer"),
        ])
        report = validate_dataset(df, contract)
        assert report.is_valid

    def test_validate_missing_column(self):
        from agents.contract_enforcement import validate_dataset, DataContract, ColumnContract
        df = pd.DataFrame({"name": ["a", "b"]})
        contract = DataContract(columns=[
            ColumnContract(name="name", dtype="string"),
            ColumnContract(name="missing_col", required=True),
        ])
        report = validate_dataset(df, contract)
        assert not report.is_valid
        assert report.failed_checks > 0

    def test_enforce_contract(self, sample_csv):
        from agents.contract_enforcement import enforce_contract
        result = enforce_contract(sample_csv)
        assert "is_valid" in result
        assert "report" in result
        assert "contract" in result


# ─── Data Governance Tests ───────────────────────────────────────────────────

class TestDataGovernance:
    def test_missing_value_analysis(self):
        from agents.data_governance import analyze_missing_values
        df = pd.DataFrame({"a": [1, None, 3], "b": [4, 5, 6]})
        report = analyze_missing_values(df)
        assert report["a"]["missing_count"] == 1
        assert report["b"]["missing_count"] == 0

    def test_knn_imputation(self):
        from agents.data_governance import impute_missing_values
        df = pd.DataFrame({"a": [1.0, None, 3.0, 4.0, 5.0], "b": [2.0, 3.0, 4.0, 5.0, 6.0]})
        clean_df, report = impute_missing_values(df)
        assert clean_df["a"].isnull().sum() == 0

    def test_duplicate_detection(self):
        from agents.data_governance import detect_duplicates
        df = pd.DataFrame({"a": [1, 2, 1], "b": ["x", "y", "x"]})
        clean_df, report = detect_duplicates(df)
        assert report["duplicate_count"] == 1
        assert len(clean_df) == 2

    def test_outlier_zscore(self):
        from agents.data_governance import detect_outliers_zscore
        data = pd.Series([1, 2, 3, 2, 1, 3, 2, 100])
        result = detect_outliers_zscore(data)
        assert result["outlier_count"] >= 1

    def test_govern_data(self, sample_csv):
        from agents.data_governance import govern_data
        result = govern_data(sample_csv, output_dir=os.path.dirname(sample_csv))
        assert "quality_report" in result
        assert "cleaned_file_path" in result
        assert os.path.exists(result["cleaned_file_path"])


# ─── Synthetic Generator Tests ───────────────────────────────────────────────

class TestSyntheticGenerator:
    def test_pii_detection(self):
        from agents.synthetic_generator import detect_pii_columns
        df = pd.DataFrame({
            "name": ["Alice", "Bob"],
            "email": ["alice@example.com", "bob@example.com"],
            "score": [85, 92],
        })
        pii = detect_pii_columns(df)
        assert "email" in pii
        assert "name" in pii

    def test_statistical_generation(self):
        from agents.synthetic_generator import generate_statistical
        df = pd.DataFrame({
            "price": [10.0, 20.0, 30.0, 40.0, 50.0],
            "category": ["A", "B", "A", "C", "B"],
        })
        synthetic = generate_statistical(df, num_rows=10)
        assert len(synthetic) == 10
        assert set(synthetic.columns) == {"price", "category"}

    def test_noise_injection(self):
        from agents.synthetic_generator import inject_noise
        df = pd.DataFrame({"value": [10.0, 20.0, 30.0, 40.0, 50.0]})
        noisy = inject_noise(df, noise_level=0.1)
        assert not df["value"].equals(noisy["value"])

    def test_compare_datasets(self):
        from agents.synthetic_generator import compare_datasets
        orig = pd.DataFrame({"a": [1.0, 2.0, 3.0], "b": [4.0, 5.0, 6.0]})
        synth = pd.DataFrame({"a": [1.1, 2.1, 3.1], "b": [4.1, 5.1, 6.1]})
        comparison = compare_datasets(orig, synth)
        assert "a" in comparison
        assert "original" in comparison["a"]

    def test_generate_synthetic(self, sample_csv):
        from agents.synthetic_generator import generate_synthetic
        result = generate_synthetic(
            sample_csv,
            num_rows=10,
            output_dir=os.path.dirname(sample_csv),
        )
        assert "synthetic_file_path" in result
        assert "comparison_report" in result
        assert os.path.exists(result["synthetic_file_path"])
