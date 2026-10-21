# BOA Lead Gen Engine

Finds local businesses for a UK postcode and category using the Google Places API, keeps only the ones **without a website**, ranks them by rating and review count, and exports them to CSV.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. In Google Cloud Console, enable **Places API (New)** for your project and create an API key.
3. Put the key in `.env`:
   ```
   GOOGLE_MAPS_API_KEY=your_api_key_here
   ```

## Usage

```bash
node find-leads.js "HP13 5AB" "plumber"
```

This writes `leads-plumber-HP13-5AB.csv` with the columns:

| Business Name | Address | Phone Number | Rating | Reviews | Website |
|---|---|---|---|---|---|

The Website column will be blank, because businesses that have one are filtered out.

## Notes

- Text Search returns at most 60 results (3 pages of 20) per query. Run a few nearby postcodes or related keywords ("plumber", "heating engineer") for broader coverage.
- Results are sorted by `rating × log10(reviews + 1)`, so well-reviewed businesses rank above ones with a single 5-star review.
- Requesting the phone number and website fields bills at the Places Text Search **Enterprise** tier. Check current pricing in the Google Cloud console.
