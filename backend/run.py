import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app

app = create_app()

if __name__ == '__main__':
    # Get port from environment (Railway sets this) or default to 5001
    port = int(os.environ.get('PORT', 5001))
    
    # Check if running on Railway (production)
    is_production = os.environ.get('RAILWAY_ENVIRONMENT') == 'production'
    
    if is_production:
        # Production: Railway will use gunicorn via Procfile
        app.run(host='0.0.0.0', port=port, debug=False)
    else:
        # Local development
        if sys.platform == 'win32':
            try:
                from waitress import serve
                print(f"Starting server with Waitress on http://localhost:{port}")
                serve(app, host='0.0.0.0', port=port)
            except ImportError:
                print(f"Starting server with Flask development server on http://localhost:{port}")
                app.run(debug=True, host='0.0.0.0', port=port)
        else:
            print(f"Starting server with Flask development server on http://localhost:{port}")
            app.run(debug=True, host='0.0.0.0', port=port)