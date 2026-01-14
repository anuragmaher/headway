FROM python:3.12.3-slim-bookworm

# Prevent Python from buffering stdout/stderr
ENV PYTHONUNBUFFERED=1

# Set default PORT (Railway overrides this automatically)
ENV PORT=8000

WORKDIR /app

# Upgrade pip first (important for py3.12)
RUN pip install --upgrade pip setuptools wheel

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Make start script executable
RUN chmod +x start.sh

EXPOSE 8000

CMD ["./start.sh"]
