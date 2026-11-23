FROM python:3.12-slim

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential default-libmysqlclient-dev pkg-config \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt gunicorn

COPY backend /app/backend
COPY services /app/services

ENV PYTHONPATH=/app:/app/backend:/app/services/shared
ENV DJANGO_SETTINGS_MODULE=services.django_settings

# Generate URL slices at build time
RUN python -c "from services.service_factory import write_slice_urlmodules; write_slice_urlmodules()"

EXPOSE 8001-8014
CMD ["sh", "-c", "gunicorn services.wsgi:application --bind 0.0.0.0:${MALWA_SERVICE_PORT:-8001} --workers 2"]
