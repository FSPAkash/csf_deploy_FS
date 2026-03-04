"""
Feedback Service - Persists user feedback to an Excel file.

Each submission is appended as a new row. The file survives restarts
and redeploys because it lives in the data directory alongside other
persistent artefacts.
"""

import os
from datetime import datetime

import pandas as pd
from openpyxl import load_workbook

from ..config import Config

FEEDBACK_FILE = os.path.join(Config.DATA_DIR, 'user_feedback.xlsx')

COLUMNS = [
    'timestamp',
    'username',
    'category',
    'rating',
    'comment',
]


class FeedbackService:
    """Append-only feedback store backed by a single .xlsx file."""

    def __init__(self, path=FEEDBACK_FILE):
        self._path = path

    def _ensure_file(self):
        """Create the workbook with headers if it doesn't exist yet."""
        if not os.path.exists(self._path):
            df = pd.DataFrame(columns=COLUMNS)
            df.to_excel(self._path, index=False, engine='openpyxl')

    def submit(self, username, category, rating, comment):
        """Append a single feedback row and return the row dict."""
        self._ensure_file()

        row = {
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'username': username or 'anonymous',
            'category': category,
            'rating': rating,
            'comment': comment or '',
        }

        # Use openpyxl to append without rewriting existing rows
        wb = load_workbook(self._path)
        ws = wb.active
        ws.append([row[c] for c in COLUMNS])
        wb.save(self._path)
        wb.close()

        return row

    def get_all(self):
        """Return every feedback row as a list of dicts."""
        self._ensure_file()
        df = pd.read_excel(self._path, engine='openpyxl')
        return df.fillna('').to_dict(orient='records')


feedback_service = FeedbackService()
