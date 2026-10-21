# General budget tracker

Budget covers all personal income and expenses, in PHP. Add salary, freelance income, groceries, rent, transport, utilities, or a custom category. Transactions can be backdated, edited, deleted with confirmation, and restored immediately with Undo. Completed transactions cannot be dated in the future through the entry form.

## Balances and planning

- **Recorded balance:** opening balance plus all income minus all expenses through today (or the selected historical month-end). Balances carry forward across months. Opening balance means funds held before the earliest recorded transaction; do not add it every month.
- **Monthly net:** income minus expenses in the selected month. This differs from the running balance.
- **Monthly expense budget:** one total spending limit covering every category. The limit carries forward each month; editing it changes the reference limit for all months. Existing cigarette-only limits are preserved and can be changed to a full household limit.
- **Category limits:** optional allocations inside the overall expense budget. The app flags overspending and warns if allocations exceed the overall limit. Limits are not additional funds.
- **Daily allowance:** the lesser of unspent monthly budget and available recorded balance after reserving the savings target, floored at zero, divided across remaining calendar days including today. Income not yet received is excluded. Without a saved expense budget, available recorded funds are the constraint.
- **Savings target:** a monthly planning reserve. Progress is based on positive monthly net income, not a verified savings account or transfer.
- **Projection:** recorded expense total divided by elapsed calendar days times days in the month. Historical months show actual totals. Missing records and one-off expenses affect estimates.

All monthly boundaries use the profile timezone. The month selector, search, type/category filters, and CSV export help review history. Amounts in transactions use at most two decimal places; calculations sum integer centavos.

## Cigarette expenses

Cigarette consumption remains an optional automatic expense category using the original price saved with each log. Edits and deletions update totals without creating duplicate ledger records. Automatic entries link to cigarette history for correction. Disable **Include cigarette logs as automatic expenses** if entering cigarette pack purchases manually; otherwise both consumption and purchases count. The source setting applies to all months. Zero-priced entries are flagged.

## Storage and backups

Financial transactions and settings are local to the device and available offline. They do not sync to accounts or connect to banks. Settings → Export JSON includes all transactions and budget settings; the Budget page's CSV export includes only the selected month and filters. Spreadsheet formula characters in text are escaped. Merge restores refuse differing IDs atomically; Replace restores remove local financial records absent from the backup, including when restoring an older backup without finances. Both Settings deletion and Profile reset remove financial data.

IndexedDB version 4 adds a finance table without modifying cigarette history or existing budget limits. Rollbacks must preserve version-4 database support. Unit/database tests cover arithmetic, month/timezone boundaries, cash constraints, validation, duplicate prevention, stale edits, backup rollback, data erasure, and migration from version 3. Browser tests exercise desktop/mobile offline entry, editing, deletion/undo, filters, category limits, CSV download, and switching expense sources.
