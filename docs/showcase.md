# Showcase videos — adding a video in the Supabase dashboard

The "2D cartoon videos made with Zyvo" row on Home, the "Made with Zyvo" row on
the Long Form page and the "Watch the tutorial" card all read the
`showcase_videos` table. A row appears on the site as soon as it is saved with
**is_active** ticked. There is nothing to deploy.

## Add a video

1. Open the Supabase dashboard → your project → **Storage** → bucket **showcase**
   → folder **thumbnails**.
2. Click **Upload file** and upload the video's thumbnail: a 16:9 JPG or PNG
   (1280×720 is ideal), under 1 MB.
3. Click the uploaded file → **Get URL** (the bucket is public) and copy the
   link. It starts with `https://…supabase.co/storage/v1/object/public/showcase/thumbnails/`.
4. Go to **Table Editor** → table **showcase_videos** → **Insert row**. Fill in:
   - **title**: the video's title, as it should appear on the card.
   - **youtube_url**: the full YouTube link, e.g. `https://www.youtube.com/watch?v=abc123XYZ00`.
   - **thumbnail_url**: the link from step 3. If you leave it empty, the site
     uses YouTube's own thumbnail.
   - **kind**: `example` for a showcase card, `tutorial` for the
     "Watch the tutorial" card on the Long Form page (the site shows the first
     active tutorial).
   - **placements**: where it shows: `{home,long_form}` for both, `{home}` for
     Home only, `{long_form}` for the Long Form page only.
   - **niche**: optional label, e.g. `History`.
   - **sort_order**: lower numbers show first (use 10, 20, 30… so you can slot
     one in between later).
   - **is_active**: ticked to show it, unticked to hide it.
5. Click **Save**. Reload the site to see it.

## Change or hide a video

- **Fix the link or title:** edit the cell in **Table Editor** and save.
- **Hide it:** untick **is_active**. Deleting the row also works, but hiding
  keeps it for later.
- **Reorder:** change **sort_order**.

## The two seeded videos

"Did Vikings Really Wear Horned Helmets?" and "How Did Early Humans Hunt?"
already have our own thumbnails and their real YouTube links. A row whose
**youtube_url** is not a valid YouTube watch link is not shown anywhere on
the site.

## See what gets clicked

**SQL Editor** → run:

```sql
select event, placement, count(*) as clicks, count(distinct user_id) as users
from marketing_events
where created_at > now() - interval '7 days'
group by 1, 2 order by clicks desc;
```

Events:
- `showcase_click` and `tutorial_click`: a card was clicked; `target` holds the YouTube link.
- `try_long_form`: the Home banner, the What's new popup or the Short Form menu card.
- `see_examples`, `whats_new_examples`, `whats_new_shown` and `whats_new_dismiss`: the popup and the banner link.
- `nav_long_form` and `create_new_video`: the Long Form nav item, and Create New Video in the Long Form page.

The same events also go to Vercel Analytics as custom events.

## Launch settings (code)

In `src/components/launch/launch.js`:
- `LONG_FORM_LAUNCH_DATE`: the "NEW" badge on Long Form shows for 30 days (`NEW_BADGE_DAYS`) from this date.
- `LONG_FORM_ANNOUNCEMENT`: the What's new popup's key. Each user sees it once, recorded in `profiles.seen_announcements`. A new key shows a future announcement to everyone once.
