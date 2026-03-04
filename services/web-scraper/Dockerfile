FROM python:3.11-slim

RUN useradd -r -s /bin/false appuser

WORKDIR /app

# Install system dependencies for Playwright
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libnss3 \
    libxss1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers - skip dependencies that fail
RUN playwright install chromium --with-deps || playwright install chromium

COPY main.py .

USER appuser

EXPOSE 8001

CMD ["python", "main.py"]