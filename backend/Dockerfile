FROM python:3.12-slim

# Set Python to run in unbuffered mode (so print statements show up immediately)
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Make start script executable
COPY start.sh .
RUN chmod +x start.sh

# Railway sets PORT env var - default to 8000 for local
EXPOSE $PORT

# Use bash script to handle PORT env var
CMD ["./start.sh"]
