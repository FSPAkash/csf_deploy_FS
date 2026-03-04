from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity, get_jwt
)
from ..utils.auth_utils import (
    verify_password, is_admin, is_beta, check_lockout,
    record_failed_attempt, clear_attempts
)
from .. import BLOCKLIST

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')
    
    if not username or not password:
        return jsonify({
            'success': False,
            'message': 'Username and password are required'
        }), 400
    
    # Check lockout
    is_locked, minutes_left = check_lockout(username)
    if is_locked:
        return jsonify({
            'success': False,
            'message': f'Account locked. Try again in {minutes_left} minute(s)',
            'locked': True,
            'lockout_minutes': minutes_left
        }), 429
    
    # Verify credentials
    if verify_password(username, password):
        clear_attempts(username)
        
        access_token = create_access_token(
            identity=username,
            additional_claims={
                'is_admin': is_admin(username),
                'is_beta': is_beta(username)
            }
        )
        refresh_token = create_refresh_token(identity=username)

        return jsonify({
            'success': True,
            'message': 'Login successful',
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': {
                'username': username,
                'is_admin': is_admin(username),
                'is_beta': is_beta(username)
            }
        }), 200
    else:
        locked, remaining = record_failed_attempt(username)
        
        if locked:
            return jsonify({
                'success': False,
                'message': 'Too many failed attempts. Account locked for 5 minutes.',
                'locked': True
            }), 429
        
        return jsonify({
            'success': False,
            'message': f'Invalid credentials. {remaining} attempt(s) remaining.',
            'attempts_remaining': remaining
        }), 401

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    identity = get_jwt_identity()
    access_token = create_access_token(
        identity=identity,
        additional_claims={
            'is_admin': is_admin(identity),
            'is_beta': is_beta(identity)
        }
    )
    return jsonify({
        'success': True,
        'access_token': access_token
    }), 200

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    identity = get_jwt_identity()
    return jsonify({
        'success': True,
        'user': {
            'username': identity,
            'is_admin': is_admin(identity),
            'is_beta': is_beta(identity)
        }
    }), 200

@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    jti = get_jwt()["jti"]
    BLOCKLIST.add(jti)
    return jsonify({
        'success': True,
        'message': 'Logged out successfully'
    }), 200