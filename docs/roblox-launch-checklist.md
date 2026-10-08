# Blocky Stories: launch checklist

Things that must be done before anyone but the owner gets Blocky Stories (the `blocky_v1` switch).
Items are added as they come up during the build; launch prep walks through every one of them.

## Must be done before real users get access

- [ ] **Put the daily spending cap back before real users get access.** (Owner, 2026-10-08.)
  The daily cap and the test ledger's total were removed on 2026-10-08 "for now, while we build and
  test". Today nothing limits what Blocky can spend in a day except the paid-calls switch.
  - Set a cap: `node scripts/blocky/paid.mjs cap <usd>` (it was $3 a day; `cap none` is what is set now).
  - Decide the test ledger's total again: `scripts/blocky/paidGuard.mjs#BLOCKY_TOTAL_USD` (it was $10).
  - The cap counts jobs that are still running at an estimate of $0.0101 a credit
    (`blocky_paid_state`). With the 2× prices of 2026-10-08 a credit costs us about $0.0134, so that
    estimate is too low: correct it when the cap comes back (a change to a database function, so it
    needs its own go).
- [ ] **V3 (Veo 3.1 Lite): the owner has watched a clip made with today's wording** and said it may
  go to others. Until then V3 stays with the owner. (Owner, 2026-10-08: "I'll test V3 myself on
  localhost".)
- [ ] **The avatar library is approved and live.** The sheet of 52 is reviewed by the owner; the
  approved pictures and avatars are written to the library table on the owner's go. Until then the
  library holds three avatars with pictures made before the look fixes.

## To check again at launch

- [ ] The prices are still 2× our real cost: `node scripts/blocky/priceOptions.mjs` (the dollar rate
  and the models' prices move). VAT is not in the prices; the owner adds it on top once registered.
- [ ] Paid calls are switched on (`node scripts/blocky/paid.mjs on`): they are off by default.
