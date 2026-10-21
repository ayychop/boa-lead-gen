import 'dotenv/config';
import axios from 'axios';
import { createObjectCsvWriter } from 'csv-writer';
import { fileURLToPath } from 'node:url';

const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

// Only request the fields we need (name, address, phone, website, rating, review count).
// The Places API (New) field mask is the equivalent of the legacy `fields` parameter.
const FIELD_MASK = [
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'nextPageToken',
].join(',');

// Text Search returns at most 20 results per page and 60 in total.
const MAX_PAGES = 3;

async function fetchAllPlaces(textQuery, apiKey) {
  const places = [];
  let pageToken;

  for (let page = 0; page < MAX_PAGES; page++) {
    const body = { textQuery, regionCode: 'gb', pageSize: 20 };
    if (pageToken) body.pageToken = pageToken;

    const { data } = await axios.post(TEXT_SEARCH_URL, body, {
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
    });

    places.push(...(data.places ?? []));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return places;
}

function toLead(place) {
  return {
    name: place.displayName?.text ?? '',
    formatted_address: place.formattedAddress ?? '',
    formatted_phone_number: place.nationalPhoneNumber ?? '',
    website: place.websiteUri ?? '',
    rating: place.rating ?? null,
    user_ratings_total: place.userRatingCount ?? 0,
  };
}

// Rank by rating weighted by review volume, so a 4.8 with 120 reviews
// beats a 5.0 with 1 review. Ties fall back to raw review count.
function leadScore(lead) {
  return (lead.rating ?? 0) * Math.log10(lead.user_ratings_total + 1);
}

export async function findLeads(postcode, keyword) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || apiKey === 'your_api_key_here') {
    throw new Error('GOOGLE_MAPS_API_KEY is not set. Add it to your .env file.');
  }

  const places = await fetchAllPlaces(`${keyword} in ${postcode}`, apiKey);

  return places
    .map(toLead)
    .filter((lead) => !lead.website || lead.website.trim() === '')
    .sort((a, b) => leadScore(b) - leadScore(a) || b.user_ratings_total - a.user_ratings_total);
}

function slugify(value) {
  return value.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
}

export async function exportLeadsToCsv(leads, postcode, keyword) {
  const path = `leads-${slugify(keyword).toLowerCase()}-${slugify(postcode).toUpperCase()}.csv`;

  const writer = createObjectCsvWriter({
    path,
    header: [
      { id: 'name', title: 'Business Name' },
      { id: 'formatted_address', title: 'Address' },
      { id: 'formatted_phone_number', title: 'Phone Number' },
      { id: 'rating', title: 'Rating' },
      { id: 'user_ratings_total', title: 'Reviews' },
      { id: 'website', title: 'Website' },
    ],
  });

  await writer.writeRecords(leads);
  return path;
}

async function main() {
  const [postcode, keyword] = process.argv.slice(2);
  if (!postcode || !keyword) {
    console.error('Usage: node find-leads.js "<postcode>" "<keyword>"');
    console.error('Example: node find-leads.js "HP13 5AB" "plumber"');
    process.exit(1);
  }

  try {
    console.log(`Searching for "${keyword}" near ${postcode}...`);
    const leads = await findLeads(postcode, keyword);
    const path = await exportLeadsToCsv(leads, postcode, keyword);
    console.log(`Found ${leads.length} businesses without a website. Saved to ${path}`);
  } catch (err) {
    const apiError = err.response?.data?.error?.message;
    console.error(`Error: ${apiError ?? err.message}`);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
