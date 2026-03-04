class TestAuth:
    def test_login_success(self, client):
        response = client.post('/api/auth/login', json={
            'username': 'admin',
            'password': 'admin123'
        })
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert 'access_token' in data

    def test_login_invalid_credentials(self, client):
        response = client.post('/api/auth/login', json={
            'username': 'admin',
            'password': 'wrongpassword'
        })
        assert response.status_code == 401

    def test_protected_route_without_token(self, client):
        response = client.get('/api/auth/me')
        assert response.status_code == 401

    def test_protected_route_with_token(self, client, auth_headers):
        response = client.get('/api/auth/me', headers=auth_headers)
        assert response.status_code == 200