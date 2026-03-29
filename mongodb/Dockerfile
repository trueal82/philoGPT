FROM mongo:latest

RUN apt-get update \
    && apt-get install -y --no-install-recommends nodejs npm \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

COPY backend/package*.json /workspace/backend/
RUN cd /workspace/backend && npm install

COPY backend/tsconfig.json /workspace/backend/tsconfig.json
COPY backend/src /workspace/backend/src
COPY mongodb /workspace/mongodb

RUN chmod +x /workspace/mongodb/entrypoint.sh

EXPOSE 27017

CMD ["/workspace/mongodb/entrypoint.sh"]
