FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Railway sets PORT env var - default to 8000 for local
EXPOSE $PORT

# Use python to handle PORT env var expansion
CMD python -c "import os; os.execlp('uvicorn', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', os.environ.get('PORT', '8000'))"
