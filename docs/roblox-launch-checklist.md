# Blocky Stories: launch checklist

What happens at launch, in order, and what must be true before it. Nothing here is done until the
owner says so. Items are added as they come up; launch prep walks through every one.

## Before launch: the owner's own final test

See "The final test" at the end. Launch only after it passes.

## At launch, in this order

1. **Spending limits: say them out loud first.** (Owner, 2026-10-08: "remind me of it during launch
   prep".) What is in force today:
   - No global daily cap and no test-ledger total ("No global hard cap on normal use", 2026-10-08).
     The earlier item "Put the daily spending cap back before real users get access" is replaced by
     the two below, unless the owner wants a global cap as well:
     `node scripts/blocky/paid.mjs cap <usd>` (it was $3 a day; `cap none` is set now).
   - A cap per user: $20 of our real cost per user per day (`spendWatch.js#USER_DAILY_USD`).
   - The bug alarm: provider spend more than $10 ahead of what users were charged in 24 hours
     switches paid calls OFF, writes an alert and emails the admin (`AHEAD_ALARM_USD`). With many
     users writing for free and never buying, $10 can be reached without a bug: watch it in the
     first days and raise the number if it trips for that reason.
   - The alarm's email goes to the address in the `CONTACT_TO_EMAIL` secret (or `BLOCKY_ALERT_EMAIL`
     if that is set). Check it is an inbox the owner reads.
2. **The alarm on /admin/ops.** Built (2026-10-08): the card "Blocky Stories · alarm" shows the paid
   switch, what users cost us against what they were charged in 24 hours, and any open alert. The
   card reaches the live website with the merge in step 3; `node scripts/blocky/paid.mjs status`
   shows the same numbers. The alarm itself is checked while a story is being made (it runs inside
   the sweep of jobs in flight); the card's numbers are read fresh every time it is opened.
3. **Merge `laptop-transfer` into `main`** (a pull request; the owner looks at the file list first).
   Merging to main is what deploys the website. Blocky's two functions, its tables, its price rows and
   its render image are already live, so the merge only brings the page and the menu entries.
   The merge also carries a few files that are not Blocky's: the menus (`CreateMenu.jsx`,
   `MobileBottomNav.jsx`, `toolshell.jsx`, `layout.jsx`, the route in `App.jsx`), three blog pages,
   `components/Figma/Final.jsx`, `routeSeoPolicy.js`, `supabase/config.toml`, the pre-commit hook and
   `.gitignore`. Read that part of the diff before merging.
4. **Switch paid calls on:** `node scripts/blocky/paid.mjs on` (they are off by default).
5. **Turn the switch on for everyone:** `global_feature_flags.blocky_v1 = true` (one row in the
   platform's switch table; until then only accounts with their own `blocky_v1` switch see Blocky).
6. **Check, right after:**
   - `node scripts/blocky/verifyLive.mjs` (the live functions are the repo's);
   - `node scripts/blocky/smokeBlockyLive.mjs` needs paid calls OFF, so run it just before step 4;
   - `node scripts/blocky/privacyCheck.mjs` (a second account sees nothing of another's);
   - open `/workspace/blocky-stories` as an account that is not the owner's, on a phone too;
   - `node scripts/blocky/paid.mjs status` a few times in the first hours.

## Known and accepted, or still open

- **V3 (Veo 3.1 Lite)** has its new wording (a locked frame, faces unchanged, a flat mouth) but no clip
  has been made with it. The owner tests V3 on localhost before it goes to anyone else.
- **Pictures, clips and videos open for anyone who has their exact address.** They sit in a public
  folder under a long random name; nobody can list them, and the tables and the API show them only to
  their owner (`privacyCheck.mjs`). The owner, 2026-10-08: they stay public with random names for now.
- **Redraws are ours to pay.** In the shot test 4 of 6 first pictures failed their check and were drawn
  again once (about $0.035 each, not in the 2× prices). Watch the real rate after launch.
- **Prices** are 2× our real cost at $1 = €0.894: `node scripts/blocky/priceOptions.mjs` prints them
  again when the dollar or a model's price moves. VAT is not in them.
- **Series** stays off (`blocky_series_v1`).
- If a global daily cap comes back: it counts running jobs at $0.0101 a credit (`blocky_paid_state`),
  which is too low at the 2× prices (a credit costs us about $0.0134). Correct it then.

## The final test (the owner, before launch)

Paid calls are needed: `node scripts/blocky/paid.mjs on`, and `off` when done. One full V2 story
costs about $1.35 of ours and 103 credits; the whole test about $3 to $4.

1. Open `/workspace/blocky-stories` on the computer. The page opens on **Ideas**, and nothing loads
   until you press **Give me ideas**.
2. Press it. Five ideas with characters from the new library. Pick one: the bar shows the
   **quality** (V2 / V3 / V4) and the **length** (20 sec to 1 min) with the full cost, and under
   them **Write 3 versions, free**.
3. Press it. Three cards appear, then fill in one by one. Read them; press **Use this version**.
4. The storyboard opens with **Make scene pictures** and its cost (31 credits for 30 seconds).
   Press it. Check the balance went down by exactly that.
5. Look at the pictures: scene 1 should be a wide shot; the others a mix of chest-up, close-up,
   reaction and over-the-shoulder; hats and accessories inside the frame; flat mouths with no tongue.
   **Tap a picture** to see it big; move with the arrows.
6. Regenerate one picture (3 credits). Then **Animate**. Check the charge against the button.
7. Watch the clips: the voice, the mouth moving with the words, nobody leaving the frame, no drawn
   subtitles. Tap the corner button on a clip to see it big.
8. The final video builds by itself. On the final page: the whole video is on the screen; Download,
   Captions and Cover are next to it; the post text has copy buttons. Download it and look for black
   bars at the sides (there should be none) and for one caption track only.
9. Do steps 1 to 4 again on a **phone**, with **Describe it** this time. Check the buttons and the
   final page there (video, then actions, then post text).
10. Try V3 once on localhost if you want it at launch (it is yours alone until you say so).
11. Close the tab in the middle of an animate step, wait two minutes, come back: the clips and the
    final video are there.
12. `node scripts/blocky/paid.mjs status`: "charges are ahead of spend" and no alarm. Then `off`.
