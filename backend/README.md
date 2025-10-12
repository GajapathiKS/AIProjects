# Special Program Management API

This ASP.NET Core 8 Web API delivers the backend services for the Texas TEKS special program MVP. It exposes onboarding, detailed needs assessment capture, rich goal management, progress tracking (with evidence links), and admin reporting endpoints.

## Prerequisites

- .NET 8 SDK
- SQL Server (or localdb) instance accessible via the configured connection string in `appsettings.json`

## Getting started

```bash
cd backend
dotnet restore
dotnet ef migrations add InitialCreate # optional: generate schema migrations
dotnet ef database update
dotnet run --project src/SpecialPrograms.Api/SpecialPrograms.Api.csproj
```

The API listens on `https://localhost:7140` by default. Swagger UI is enabled for quick exploration.

The application seeds a default admin account with the credentials configured in `appsettings.json` under `SeedUser`. Update these defaults before deploying.

### Key endpoints

- `POST /api/students` – onboarding with campus, guardian, program focus, and review cadence.
- `GET /api/students/{id}` – consolidated profile with assessments, goals, and progress evidence.
- `POST /api/needsassessments` – record instructional strategies, services, and evaluation tools.
- `POST /api/goals` / `PATCH /api/goals/{id}/status` – manage goal lifecycle and alignment.
- `POST /api/goals/{id}/progress` – log progress, artifact URLs, and next actions for each goal.
- `GET /api/admin/dashboard` – aggregate counts plus upcoming review insight for administrators.
