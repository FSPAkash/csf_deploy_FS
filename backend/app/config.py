import os
from datetime import timedelta

class Config:
    # Server settings - Render provides PORT
    PORT = int(os.environ.get('PORT', 5000))
    
    # Security keys
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key-change-in-production')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=1)
    JWT_BLACKLIST_ENABLED = True
    JWT_BLACKLIST_TOKEN_CHECKS = ['access', 'refresh']
    
    # CORS settings - handles both local and production
    @property
    def CORS_ORIGINS(self):
        origins = os.environ.get('CORS_ORIGINS', '')
        frontend_url = os.environ.get('FRONTEND_URL', '')
        
        # Default local origins
        default_origins = ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173']
        
        # Parse environment origins
        env_origins = [o.strip() for o in origins.split(',') if o.strip()]
        
        # Add frontend URL if provided
        if frontend_url:
            env_origins.append(frontend_url)
        
        # Combine all origins
        all_origins = list(set(default_origins + env_origins))
        
        return all_origins
    
    # Data storage
    DATA_DIR = os.environ.get('DATA_DIR', os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data'))
    
    # Upload settings
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    ALLOWED_EXTENSIONS = {'xlsx', 'xls'}
    
    # Environment detection
    IS_RENDER = bool(os.environ.get('RENDER'))
    DEBUG = not IS_RENDER


# Make CORS_ORIGINS work as a class attribute
_config = Config()
Config.CORS_ORIGINS = _config.CORS_ORIGINS