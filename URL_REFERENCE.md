# URL Sharing Reference

## URL Structure

The app supports shareable URLs for specific performances and song searches.

### Performance URLs (by date)

Format: `?date=YYYYMMDD`

**Examples:**
- `?date=20241205` - Music Hall of Williamsburg show (Dec 5, 2024)
- `?date=20251130` - Default/latest show
- `?date=20251216` - Rockefeller Memorial Chapel (Dec 16, 2025)

### Song Search URLs (by slug)

Format: `?song=SLUG`

**Song Slug Mapping:**

| Song Title | Slug |
|------------|------|
| $0 | `0` |
| Amazing Grace | `amazing` |
| Au Pays du Cocaine | `aupays` |
| Can't Keep Anything | `cantkeep` |
| Cancer Of The Skull | `cancer` |
| Credits | `credits` |
| David | `david` |
| Drinking Age | `drinking` |
| Emperor XIII In Shades | `emperor` |
| Enemy | `enemy` |
| I Don't Wanna | `idontwanna` |
| I Have Waited In The Dark | `ihavewaited` |
| I Will Let You Down | `iwilllet` |
| If You Turn Back Now | `ifyouturn` |
| It All Fell In The River | `itallfell` |
| Its Been Waited For | `itsbeenwaitedfor` |
| John Henry | `johnhenry` |
| Long Island City Here I Come | `lic` |
| Love Takes Miles | `lovetakes` |
| LSD | `lsd` |
| Nausicaa (Love Will Be Revealed) | `nausicaa` |
| Nina + Field Of Cops | `ninafield` |
| Noah | `noah` |
| Please | `please` |
| Sandbag | `sandbag` |
| Serious World | `serious` |
| Shenandoah | `shenandoah` |
| Take It With You | `takeitwithyou` |
| The Rolling Stones | `rollingstones` |
| The Star-Spangled Banner | `thestar` |
| Try As I May | `try` |
| Unreleased 1 | `unreleased1` |
| Unreleased 2 | `unreleased2` |
| Vines | `vines` |
| We're Thinking The Same Thing | `werethinking` |
| Where's Your Love Now | `wheresyour` |

**Examples:**
- `?song=ninafield` - Shows all performances with "Nina + Field Of Cops" (with video)
- `?song=drinking` - Shows all performances with "Drinking Age" (with video)
- `?song=0` - Shows all performances with "$0" (with video)

## How It Works

1. **Automatic URL updates**: When you click a date tab or search for a song, the URL updates automatically
2. **Browser history**: Back/forward buttons work correctly
3. **Direct sharing**: Copy the URL and share it - it will load directly to that view
4. **Filter-aware**: Song URLs only show performances where the song has a video link

## Technical Notes

- Slugs are generated from song titles (lowercase, alphanumeric only, max 8 chars)
- Conflicts resolved by truncating to shorter lengths
- Only one parameter allowed at a time (date OR song)
- Invalid URLs fallback to the default view (20251130)
