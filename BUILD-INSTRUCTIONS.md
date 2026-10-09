# spotDada (Pulse) – Docker build & run

Stack: React (Vite) frontend -> Nginx, Node/Express backend, MongoDB. All three run via docker compose.

## Layout (put these files into your project)

```
spotDada/
  docker-compose.yml
  .env.example
  backend/
    Dockerfile
    .dockerignore
  frontend/
    Dockerfile
    .dockerignore
    nginx.conf
```

## Steps

1. Install Docker Desktop (or Docker Engine + Compose plugin) and check:
   `docker --version` and `docker compose version`

2. Unzip the project and copy the files above into the `spotDada/` folder (merge with the existing `backend/` and `frontend/`).

3. Create the env file next to docker-compose.yml:
   ```
   cp .env.example .env
   ```
   Edit `.env` and set a long random `JWT_SECRET`. Generate one with:
   `openssl rand -hex 32`

4. Build and start everything:
   ```
   docker compose up -d --build
   ```

5. Check status and logs:
   ```
   docker compose ps
   docker compose logs -f backend
   ```

6. Open http://localhost:8080 (or the APP_PORT you chose). Health check: http://localhost:8080/api/health

## Build images individually (optional)

```
docker build -t spotdada-backend  ./backend
docker build -t spotdada-frontend ./frontend
```

## Day-to-day commands

| Task | Command |
|---|---|
| Stop | `docker compose down` |
| Stop and delete DB + uploads | `docker compose down -v` |
| Rebuild after code change | `docker compose up -d --build` |
| Shell into backend | `docker compose exec backend sh` |

## How it works

- Frontend calls relative `/api` and `/uploads`. Nginx proxies both to `backend:5000`, so no CORS or URL changes are needed.
- The backend's `.env` is NOT baked into the image. Compose injects `MONGO_URI` (pointing to the `mongo` service), `JWT_SECRET` and `PORT=5000`.
- Uploaded media lives in the `uploads_data` volume and the database in `mongo_data`, so both survive rebuilds.
- Existing sample files in `backend/uploads/` are excluded from the image (~20 MB video). To keep them, copy them in with
  `docker cp backend/uploads/. spotdada-backend:/app/uploads/`

## Troubleshooting

- Backend exits immediately: `JWT_SECRET` missing in `.env`.
- Port already in use: change `APP_PORT` in `.env`.
- 413 error on upload: Nginx limit is 55 MB; raise `client_max_body_size` in `frontend/nginx.conf`.
- Using MongoDB Atlas instead: remove the `mongo` service and `depends_on`, and set `MONGO_URI` to your Atlas string.
