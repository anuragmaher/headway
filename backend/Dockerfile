FROM python:3.12-slim

# Set Python to run in unbuffered mode (so print statements show up immediately)
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Railway sets PORT env var - default to 8000 for local
EXPOSE $PORT

# Start uvicorn with PORT from environment
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
