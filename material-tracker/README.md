# Material Tracker

Responsive web app for project material planning, consumption tracking and budget control.
Built with **Next.js 16 (App Router) · TypeScript · MongoDB (Mongoose) · Tailwind CSS**.

## Features

- **Two login portals**: `/login` for users, `/admin/login` for administrators. Users can self-register at `/register`.
- **New project wizard**:
  1. Project details: Name, MO Number, CWO Number, Site Name, Location, Vendor, Budget.
  2. Bill of materials: Item Code, Item Description, Category, UOM, Planned Qty, Unit Rate. Type rows in, or click **Import from Excel** to upload an .xlsx/.xls/.csv file from your computer. Columns are matched by their heading, so the order doesn't matter. **Download template** gives you a ready-made sheet.
  3. Review & create.
- **Material usage log**: record consumption (qty, date, remarks). Used, remaining and excess quantities are recalculated automatically.
- **Calculations**: estimated cost (planned qty × rate), consumed cost, balance, utilisation %, budget variance, and a category-wise summary.
- **Dashboard**: search and filter by status and owner, plus totals and CSV export. Project pages can be exported to CSV or printed.
- **Access control**:
  - **User**: sees, edits and deletes only the projects they created.
  - **Admin**: sees and edits everything, and manages users (add, change role, activate/deactivate, reset password, delete).
  - Rules are enforced server-side on every API call. Deactivated users are logged out immediately.

## Setup

```powershell
npm install
copy .env.example .env.local     # then edit values
npm run db:start                 # only if using the bundled local MongoDB
$env:ADMIN_EMAIL="you@company.com"; $env:ADMIN_PASSWORD="StrongPass123"; $env:ADMIN_NAME="Your Name"
npm run seed:admin               # creates/updates the admin account
npm run dev                      # http://localhost:3000
```

Production: `npm run build` then `npm run start`.

### Environment variables (`.env.local`)

| Variable | Description |
| --- | --- |
| `MONGODB_URI` | Local `mongodb://127.0.0.1:27017/material-tracker` or Atlas `mongodb+srv://...` |
| `JWT_SECRET` | Random string of 32+ characters used to sign session cookies |
| `NEXT_PUBLIC_CURRENCY` / `NEXT_PUBLIC_LOCALE` | Display currency and number format (default `INR` / `en-IN`) |

### Switching to MongoDB Atlas

Change `MONGODB_URI` in `.env.local` to your Atlas connection string. Run `npm run seed:admin` again to create the admin in the new database, then restart the app.

## Project structure

```
src/
  proxy.ts                 route protection (redirects by login state / role)
  models/                  Mongoose schemas (User, Project with materials + usage)
  lib/                     db connection, session (JWT), auth guards, validation, calculations
  app/api/                 REST endpoints (auth, projects, usage, users)
  app/(auth)/              login, admin login, register pages
  app/(app)/               dashboard, project create/view/edit, admin user management
  components/              UI kit, app shell/navbar, auth form, project form
scripts/                   seed-admin.mjs, start-mongo.ps1
vendor/                    SheetJS (xlsx) package, installed from the official SheetJS CDN
```
