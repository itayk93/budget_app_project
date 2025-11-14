# Bank-Scraper → Upload ETL Automation

This document explains the end-to-end automation that now runs when you click the “🤖 הרץ כרייה + טעינה אוטומטית” button on `/upload`. It is meant for developers who need to maintain or extend the flow.

## Overview

The button replaces three manual steps:

1. **Bulk scrape** every active bank-scraper configuration.
2. **Queue** all scraped transactions into the pending-approval table.
3. **Auto-import** the pending queue straight into the main cash-flow.

`handleFullBankScraperPipeline` inside `client/src/pages/Upload/Upload.js` orchestrates these steps entirely on the client using the existing REST APIs.

## Execution Sequence

| Step | Action | Endpoint / Function | Purpose |
| --- | --- | --- | --- |
| 1 | Run scrapers | `POST /bank-scraper/configs/bulk/scrape` | Triggers every active configuration with a 30-day backfill window. |
| 2 | Queue for approval | `POST /bank-scraper/configs/bulk/queue-for-approval` | Moves each configuration’s converted transactions into the staging table. |
| 3 | Import to cash-flow | `handleAutoImportPendingToMain({ silent: true })` | Reuses the upload modal logic (duplicate check, hidden-business filter, etc.) and calls `uploadAPI.finalizeImport`. |

The handler aborts on the first failure, shows the error to the user, and re-enables the button. When the run succeeds, a success alert confirms that the data has been loaded into the default cash-flow.

## Front-End Implementation

- **New state flags:** `isRunningFullPipeline` blocks double-clicks; `etlStatusMessage` surfaces the current stage (“מריץ כריית נתונים…”, “מכניס לתור…”, “מייבא…”). These flags sit next to the existing `isAutoImportingPending` and `finalImportMutation.isLoading` guards.
- **Silent auto-import:** `handleAutoImportPendingToMain` now accepts `{ silent: true }`. In silent mode it throws errors (missing default cash-flow, empty queue, API failure) instead of alerting, so the outer pipeline handler can manage the flow.
- **Button wiring:** Added to the upload header beside “מיזוג קבצים” / “📥 טען ממתינים” / “⚡ טען ואשר לתזרים הראשי”. Uses the “btn-warning” style to stand out.

## API Requirements

Ensure these endpoints are available on the backend (`server/routes/israeliBankScraper.js`):

- `POST /api/bank-scraper/configs/bulk/scrape`
- `POST /api/bank-scraper/configs/bulk/queue-for-approval`
- `GET /api/bank-scraper/pending?limit=500`

All calls attach the JWT from `localStorage` via `Authorization: Bearer <token>`.

## Error Handling

- Each fetch checks both the HTTP status and the `success` flag in the JSON response.
- Any thrown error (network failure, validation, duplicate import issues) stops the pipeline immediately and resets `etlStatusMessage`.
- Auto-import still applies the same duplicate filtering/hidden-business removal as the manual modal, guaranteeing parity with the previous review flow.

## Extensibility Tips

- Update the `startDate` calculation if you want a longer backfill window.
- Hook telemetry/logs into the three stages by watching `etlStatusMessage` or wrapping the fetch calls.
- For server-side automation, replicate the same API sequence (scrape → queue → finalize) using the user’s token or a service credential.
