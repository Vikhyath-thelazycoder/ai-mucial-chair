# WiFi sign-in check (T-8.1)

Generated 2026-10-16T21:54:56.916Z by `scripts/signin-burst.ts` against the aimc-test project.

35 phones signed in at the same moment from one IP address (as on shared campus WiFi).

| Phones | Signed in | Rate-limited | Other errors | Burst time | Slowest sign-in |
|---|---|---|---|---|---|
| 35 | 30 | 5 | 0 | 1528 ms | 1520 ms |

**Result: the default Supabase Auth limit blocked 5 of 35 phones.** Supabase allows 30 sign-ups + sign-ins per IP per 5 minutes by default (`auth.rate_limit.sign_in_sign_ups`). At the fest every phone on the campus WiFi shares one public IP, so the 31st player to register or log in within 5 minutes is refused.

## What to change before the fest

On the **live** Supabase project: Dashboard → Authentication → Rate Limits → **Sign-ups and sign-ins** → raise from 30 to at least **300 per 5 minutes** (one registration + one login per student, with headroom for retries and PIN typos). Leave token refresh and other limits as they are. Re-run this script against a project with the new limit to confirm.

Trade-off (SECURITY.md T10): a higher per-IP limit makes PIN guessing from the campus network easier, but each guess still needs a valid USN and the event lasts one day; hosts can reset a PIN from the admin panel.

No other errors.
