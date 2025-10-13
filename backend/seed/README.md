# Seed helper

This folder contains a SQL seed script and helper to create and populate the local `SpecialProgramsDb` for development.

Files:
- `run-seed-and-test.ps1` - PowerShell helper that starts LocalDB (if needed), runs the SQL seed script using the LocalDB pipe, and then POSTs to the API `/api/auth/login` to verify the seeded `admin` account.
- `../src/SpecialPrograms.Api/seed/seed_specialprograms.sql` - Single idempotent SQL file that creates the database schema, inserts sample data, and ensures the seeded admin password is stored as a bcrypt hash.

Usage (PowerShell, from repo root):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\backend\seed\run-seed-and-test.ps1
```

Backend API (Swagger):

https://localhost:7140/swagger/index.html

If `sqlcmd` fails to connect by instance name, the helper will detect the LocalDB instance pipe and connect using `np:\\\.\pipe\LOCALDB#...\tsql\query` which is more reliable for LocalDB instances.
