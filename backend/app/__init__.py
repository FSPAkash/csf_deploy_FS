from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from .config import Config
import os
import threading
import time
import urllib.request

jwt = JWTManager()

# In-memory blocklist for revoked tokens
# In production, use Redis or a database
BLOCKLIST = set()

@jwt.token_in_blocklist_loader
def check_if_token_revoked(jwt_header, jwt_payload):
    jti = jwt_payload["jti"]
    return jti in BLOCKLIST

def create_app(config_class=Config):
    # Get the path to frontend dist folder
    frontend_folder = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'frontend', 'dist')
    
    app = Flask(__name__, static_folder=frontend_folder)
    app.config.from_object(config_class)
    
    # Initialize extensions
    CORS(app, origins=app.config.get('CORS_ORIGINS', ['*']), supports_credentials=True)
    jwt.init_app(app)
    
    # Ensure data directory exists
    data_dir = app.config.get('DATA_DIR', os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data'))
    os.makedirs(data_dir, exist_ok=True)
    
    # Register blueprints
    from .routes.auth import auth_bp
    from .routes.forecast import forecast_bp
    from .routes.data import data_bp
    from .routes.admin import admin_bp
    from .routes.chat import chat_bp
    from .routes.beta import beta_bp
    from .routes.intelligence import bp as intelligence_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(forecast_bp, url_prefix='/api/forecast')
    app.register_blueprint(data_bp, url_prefix='/api/data')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(chat_bp, url_prefix='/api/chat')
    app.register_blueprint(beta_bp, url_prefix='/api/beta')
    app.register_blueprint(intelligence_bp)  # Already has /api/intelligence prefix
    
    # Health check endpoint
    @app.route('/api/health')
    def health_check():
        return jsonify({
            'status': 'healthy',
            'message': 'Manufacturer Forecast Simulator API',
            'environment': os.environ.get('RENDER', 'development')
        }), 200
    
    # API root endpoint
    @app.route('/api')
    def api_root():
        return jsonify({
            'name': 'Manufacturer Forecast Simulator API',
            'version': '1.0.0',
            'health': '/api/health'
        }), 200
    
    # Serve frontend for all non-API routes
    @app.route('/')
    def serve_frontend():
        return send_from_directory(app.static_folder, 'index.html')
    
    @app.route('/<path:path>')
    def serve_frontend_files(path):
        # If the path is for a file that exists, serve it
        if os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        # Otherwise serve index.html for client-side routing
        return send_from_directory(app.static_folder, 'index.html')

    # Keep-alive: ping own health endpoint every 10 minutes to prevent
    # Render free-tier spin-down due to inactivity
    def keep_alive():
        render_url = os.environ.get('RENDER_EXTERNAL_URL')
        if not render_url:
            return  # Only run on Render
        health_url = f"{render_url}/api/health"
        while True:
            time.sleep(600)  # 10 minutes
            try:
                urllib.request.urlopen(health_url, timeout=10)
            except Exception:
                pass

    if os.environ.get('RENDER'):
        t = threading.Thread(target=keep_alive, daemon=True)
        t.start()

    return app