"""
API integration tests using FastAPI TestClient.
"""

import os
import sys
import pytest
from fastapi.testclient import TestClient

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Use SQLite for testing
os.environ["DATABASE_URL"] = "sqlite:///./test.db"

from main import app
from models.database import engine, Base


@pytest.fixture(autouse=True)
def setup_db():
    """Create tables before each test, drop after."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("./test.db"):
        os.remove("./test.db")


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_headers(client):
    """Register a user and return auth headers."""
    # Register
    client.post("/auth/register", json={
        "username": "testuser",
        "email": "test@example.com",
        "password": "testpass123",
    })
    # Login
    resp = client.post("/auth/login", data={
        "username": "testuser",
        "password": "testpass123",
    })
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


class TestAuth:
    def test_register(self, client):
        resp = client.post("/auth/register", json={
            "username": "newuser",
            "email": "new@example.com",
            "password": "password123",
        })
        assert resp.status_code == 201
        assert resp.json()["username"] == "newuser"

    def test_login(self, client):
        client.post("/auth/register", json={
            "username": "loginuser",
            "email": "login@example.com",
            "password": "password123",
        })
        resp = client.post("/auth/login", data={
            "username": "loginuser",
            "password": "password123",
        })
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    def test_me(self, client, auth_headers):
        resp = client.get("/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["username"] == "testuser"


class TestHealthEndpoints:
    def test_root(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        assert resp.json()["status"] == "running"

    def test_health(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200


class TestDashboard:
    def test_metrics(self, client, auth_headers):
        resp = client.get("/dashboard/metrics", headers=auth_headers)
        assert resp.status_code == 200
        assert "total_tasks" in resp.json()

    def test_list_datasets(self, client, auth_headers):
        resp = client.get("/datasets", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestTaskCreate:
    def test_create_task(self, client, auth_headers):
        resp = client.post("/task/create", json={
            "description": "Validate sales dataset",
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "task_id" in data
        assert data["intent"] == "validate"
        assert len(data["dag"]["nodes"]) >= 1
