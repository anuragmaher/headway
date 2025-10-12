FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy startup script
COPY start.sh .
RUN chmod +x start.sh

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Start command - use startup script that handles PORT env var
CMD ["./start.sh"]
