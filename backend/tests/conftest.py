import pytest
import os
import sys
import tempfile

# Add the backend directory to Python path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from app import create_app
from app.config import Config

class TestConfig(Config):
    TESTING = True
    JWT_SECRET_KEY = 'test-jwt-secret'
    SECRET_KEY = 'test-secret'
    DATA_DIR = tempfile.mkdtemp()

@pytest.fixture
def app():
    """Create application for testing"""
    application = create_app(TestConfig)
    yield application
    
    import shutil
    if os.path.exists(TestConfig.DATA_DIR):
        shutil.rmtree(TestConfig.DATA_DIR)

@pytest.fixture
def client(app):
    """Create test client"""
    return app.test_client()

@pytest.fixture
def auth_headers(client):
    """Get authentication headers"""
    response = client.post('/api/auth/login', json={
        'username': 'admin',
        'password': 'admin123'
    })
    data = response.get_json()
    token = data['access_token']
    return {'Authorization': f'Bearer {token}'}