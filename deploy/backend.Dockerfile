FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt "psycopg[binary]"

COPY src ./src
COPY scripts ./scripts

# Runtime artifacts live on named volumes (compose mounts /app/reports, /app/uploads).
ENV REPORTS_DIR=/app/reports UPLOADS_DIR=/app/uploads

EXPOSE 8000
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
