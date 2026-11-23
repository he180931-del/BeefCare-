# BeefCare CI/CD

## Pipeline

- Pushes to `dev` and pull requests targeting `dev` or `production` run backend unit tests, a PostgreSQL integration smoke suite, frontend checks, and a backend-image build.
- A push to `production` reruns the same checks, then deploys the backend to Railway and the frontend to Vercel in parallel.
- A failed test, typecheck, build, or Docker image build blocks production deployment. The backend smoke suite covers application startup, PostgreSQL/Testcontainers connectivity, migration timestamps, reports, and farm invitation persistence.

## Known backend test-suite debt

The complete legacy Failsafe suite is not a production gate yet. On the current `dev` baseline it contains generated CRUD resource tests whose expected statuses no longer match the current security/CSRF rules, plus mail tests written for the delivery implementation that existed before the durable email-job refactor. Running the complete suite also exhausts its current 1 GiB test heap after hundreds of Spring contexts. These failures must be repaired as a separate backend test-maintenance change; the workflow does not hide them with `continue-on-error`.

## GitHub production secrets

Create these as repository secrets or secrets on the GitHub environment named `production`:

| Secret | Value |
| --- | --- |
| `RAILWAY_TOKEN` | Railway project token scoped to the production environment |
| `RAILWAY_SERVICE_ID` | Railway backend service name or service ID |
| `VERCEL_TOKEN` | Vercel access token |
| `VERCEL_ORG_ID` | Vercel team/account ID from `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | Vercel project ID from `.vercel/project.json` |

Optionally create the GitHub repository variable `RAILWAY_BACKEND_URL` with the public backend origin. When present, the deployment workflow checks `/management/health` after Railway finishes.

## Railway production variables

Configure these on the Railway backend service. Railway references such as `${{Postgres.PGHOST}}` are entered in the Railway dashboard, not in GitHub secrets.

```dotenv
SPRING_PROFILES_ACTIVE=prod
SPRING_DOCKER_COMPOSE_ENABLED=false
SPRING_DATASOURCE_URL=jdbc:postgresql://${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}
SPRING_DATASOURCE_USERNAME=${{Postgres.PGUSER}}
SPRING_DATASOURCE_PASSWORD=${{Postgres.PGPASSWORD}}
BEEFCARE_PUBLIC_URL=https://<vercel-production-domain>
BEEFCARE_BACKEND_URL=https://<railway-backend-domain>
BEEFCARE_CORS_ORIGINS=https://<vercel-production-domain>
BEEFCARE_LINK_SECRET=<random-value-at-least-32-characters>
BEEFCARE_GOOGLE_ENABLED=false
BEEFCARE_SEPAY_ENVIRONMENT=MOCK
```

Keep the remaining mail, Google OAuth, SePay, JWT, and storage variables configured according to the features enabled in production. Railway provides `PORT`; do not set a fixed production port.

## Vercel production variables

Variables prefixed with `VITE_` are public build-time configuration and must use Vercel's `Config` visibility, not `Secret` visibility.

```dotenv
VITE_BEEFCARE_DATA_SOURCE=backend
VITE_BEEFCARE_API_URL=https://<railway-backend-domain>
```

If the Vercel project is connected directly to GitHub, disable its automatic production deployment so a push does not produce one Vercel deployment from Git integration and another from GitHub Actions.

## Branch protection

Protect `production`, require pull requests, and require these checks before merging:

- `Backend checks`
- `Frontend checks`
- `Backend Docker image`
