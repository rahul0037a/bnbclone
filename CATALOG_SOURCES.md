# Catalog provenance and preview seeding

Verified on **28 October 2026**. The preview catalog contains **72 real, named properties across 66 destinations in 13 countries**: 50 Zostel properties, 14 Generator properties and 8 Taj Hotels properties.

## What is sourced

Property identities, destination names and direct official property URLs were checked against these official operator directories using the Firecrawl skill:

- [Zostel property directory](https://www.zostel.com/zostel)
- [Generator destinations](https://staygenerator.com/hostels)
- [Taj Hotels in India](https://www.tajhotels.com/en-in/destination/hotels-in-india)

Directory content was retrieved; the 72 individual property pages were not each fetched separately. The per-record `sourceUrl` is a direct official property link published by its operator, and `sourceAccessedAt` records the directory verification date. Future-opening Generator London Greenwich was excluded.

Descriptions are short original summaries. We did not import guest reviews, star ratings, review scores or quoted room availability.

## Demonstration values and imagery

- All `price` values are **indicative demonstration amounts in INR per room/night**, not live rates, scraped offers or quotations. `ratesIndicative: true` marks this on every catalog record.
- `totalRooms: 8` and `maxGuests: 16` define **simulated inventory and concurrent property capacity**, not the actual operator's stock. Reservations in this preview do not book with the named property.
- Images are varied illustrative stock photographs served by Unsplash. They **do not depict the listed properties**. Every record sets `image.isIllustrative: true` and an explicit `imageAttribution` caption; no operator property photography was copied.
- All map coordinates are **approximate destination/neighbourhood points**, not verified hotel entrances or navigation directions. Every row sets `coordinatesApproximate: true`.
- Names identify real properties for browsing; this project has no operator affiliation. The seeded curator account is not a real-property owner.
- Countries: India, Thailand, Nepal, Netherlands, Spain, Germany, Denmark, Ireland, United Kingdom, United States, France, Italy and Sweden.

## Safe commands

Run from the project checkout with a separate preview database configured in `.env`. The seed loads this file using dotenv.

```powershell
node init/index.js --validate-only
node init/index.js
node init/index.js --apply
```

1. `--validate-only` performs Joi, uniqueness and Mongoose document validation **offline**, without database connections or network requests.
2. Without `--apply`, the seed validates, prints the explicit target database name and exits without connecting.
3. `--apply` requires `ATLASDB_URL` and an explicit `DB_NAME` matching `wanderlust_preview_<lowercase suffix>`. The seed always passes that name as Mongoose's `dbName` override, regardless of the URI's default database. It refuses all other database names.
4. It initializes the catalog indexes, creates a dedicated `wanderlust-catalog` curator with a strong random password that is never printed, and validates each listing with that actual user reference.
5. It upserts records by unique `catalogSlug`, only when marked `isCatalog` and owned by that curator. It refuses collisions with unrelated listings and never deletes listings, reviews, bookings or users. Repeated runs do not duplicate the catalog or reset existing review arrays.
6. Writes are sequential and resumable, not one all-or-nothing transaction. If a write fails, resolve the error and run again; already upserted entries remain.

This seed intentionally has no `deleteMany`, hardcoded existing owner ID or localhost database fallback. It refuses non-preview databases, including when run from the main checkout.

## Geocoding maintenance

```powershell
node init/geocode.js --dry-run
node init/geocode.js --apply
```

This utility uses the same explicit preview database guard, excludes sourced catalog records and only considers non-catalog listings without coordinates. The default/dry run performs a database read without geocoding requests or document writes; `autoIndex: false` prevents index creation during that read. The explicit apply run uses a 10-second request timeout, checks response status and coordinate bounds, and pauses 1.1 seconds between Nominatim calls. Results remain approximate.

## Per-property source links

| Property | Destination | Country | Official source |
|---|---|---|---|
| Zostel Agra | Agra | India | [Zostel](https://www.zostel.com/destination/agra/stay/zostel-agra-agrh035) |
| Zostel Alleppey | Alleppey | India | [Zostel](https://www.zostel.com/destination/alleppey/stay/alleppey-allh830) |
| Zostel Bangalore (Indiranagar) | Bengaluru | India | [Zostel](https://www.zostel.com/destination/bangalore/stay/bangalore-bngh107) |
| Zostel Bundi | Bundi | India | [Zostel](https://www.zostel.com/destination/bundi/stay/zostel-bundi-bndh020) |
| Zostel Chennai (Anna Nagar) | Chennai | India | [Zostel](https://www.zostel.com/destination/chennai/stay/zostel-chennai-anna-nagar-chnh551) |
| Zostel Chitkul | Chitkul | India | [Zostel](https://www.zostel.com/destination/chitkul/stay/chitkul-chth585) |
| Zostel Coorg (Madikeri) | Madikeri | India | [Zostel](https://www.zostel.com/destination/coorg/stay/zostel-coorg-madikeri-crgh495) |
| Zostel Delhi | Delhi | India | [Zostel](https://www.zostel.com/destination/delhi/stay/delhi-dlhh524) |
| Zostel Dharamkot (Bhagsu) | Dharamkot | India | [Zostel](https://www.zostel.com/destination/dharamkot/stay/zostel-bhagsu-bhgh906) |
| Zostel Gangtok | Gangtok | India | [Zostel](https://www.zostel.com/destination/gangtok/stay/gangtok-gngh967) |
| Zostel Goa (Morjim) | Morjim, Goa | India | [Zostel](https://www.zostel.com/destination/goa/stay/zostel-goa-morjim-goah407) |
| Zostel Gokarna | Gokarna | India | [Zostel](https://www.zostel.com/destination/gokarna/stay/gokarna-gkrh533) |
| Zostel Guwahati | Guwahati | India | [Zostel](https://www.zostel.com/destination/guwahati/stay/zostel-guwahati-gwhh030) |
| Zostel Hampi (Gangavathi) | Hampi | India | [Zostel](https://www.zostel.com/destination/hampi/stay/zostel-hampi-gangavathi-hmph144) |
| Zostel Hyderabad | Hyderabad | India | [Zostel](https://www.zostel.com/destination/hyderabad/stay/zostel-hyderabad-hydh476) |
| Zostel Jaipur (Hawa Mahal) | Jaipur | India | [Zostel](https://www.zostel.com/destination/jaipur/stay/jaipur-jprh038) |
| Zostel Jaisalmer | Jaisalmer | India | [Zostel](https://www.zostel.com/destination/jaisalmer/stay/jaisalmer-jslh404) |
| Zostel Jodhpur (Clock Tower) | Jodhpur | India | [Zostel](https://www.zostel.com/destination/jodhpur/stay/jodhpur-jdhh559) |
| Zostel Kalpa | Kalpa | India | [Zostel](https://www.zostel.com/destination/kalpa/stay/zostel-kalpa-klph572) |
| Zostel Kasol | Kasol | India | [Zostel](https://www.zostel.com/destination/kasol/stay/zostel-kasol-kslh734) |
| Zostel Kochi (Fort Kochi) | Fort Kochi | India | [Zostel](https://www.zostel.com/destination/kochi/stay/zostel-kochi-fort-kochi-kchh080) |
| Zostel Kodaikanal | Kodaikanal | India | [Zostel](https://www.zostel.com/destination/kodaikanal/stay/kodaikanal-kdkh541) |
| Zostel Kolad | Kolad | India | [Zostel](https://www.zostel.com/destination/kolad/stay/kolad-kldh813) |
| Zostel Kolkata | Kolkata | India | [Zostel](https://www.zostel.com/destination/kolkata/stay/zostel-kolkata-klkh729) |
| Zostel Leh (Main Market) | Leh | India | [Zostel](https://www.zostel.com/destination/leh/stay/zostel-leh-main-market-lehh532) |
| Zostel Manali (Vashisht) | Manali | India | [Zostel](https://www.zostel.com/destination/vashisht/stay/zostel-manali-vashisht-vshh380) |
| Zostel Mcleodganj | McLeod Ganj | India | [Zostel](https://www.zostel.com/destination/mcleodganj/stay/zostel-mcleodganj-mclh045) |
| Zostel Mumbai | Mumbai | India | [Zostel](https://www.zostel.com/destination/mumbai/stay/mumbai-mmbh714) |
| Zostel Munnar | Munnar | India | [Zostel](https://www.zostel.com/destination/munnar/stay/zostel-munnar-pallivasal-mnnh779) |
| Zostel Mussoorie (Mall Road) | Mussoorie | India | [Zostel](https://www.zostel.com/destination/mussoorie/stay/zostel-mussoorie-mall-road-mssh686) |
| Zostel Mysore | Mysuru | India | [Zostel](https://www.zostel.com/destination/mysore/stay/mysore-mysh811) |
| Zostel Nashik | Nashik | India | [Zostel](https://www.zostel.com/destination/nashik/stay/zostel-nashik-nshh386) |
| Zostel Nubra | Nubra Valley | India | [Zostel](https://www.zostel.com/destination/nubra/stay/zostel-nubra-nbrh614) |
| Zostel Ooty | Ooty | India | [Zostel](https://www.zostel.com/destination/ooty/stay/ooty-otyh641) |
| Zostel Pahalgam | Pahalgam | India | [Zostel](https://www.zostel.com/destination/pahalgam/stay/zostel-pahalgam-phlh309) |
| Zostel Phuket | Phuket | Thailand | [Zostel](https://www.zostel.com/destination/phuket/stay/zostel-phuket-phkh951) |
| Zostel Pokhara | Pokhara | Nepal | [Zostel](https://www.zostel.com/destination/pokhara/stay/zostel-pokhara-pkhh648) |
| Zostel Pondicherry (Auroville Road) | Puducherry | India | [Zostel](https://www.zostel.com/destination/pondicherry/stay/zostel-pondicherry-pndh771) |
| Zostel Port Blair | Port Blair | India | [Zostel](https://www.zostel.com/destination/port-blair/stay/zostel-port-blair-prth967) |
| Zostel Pune (Viman Nagar) | Pune | India | [Zostel](https://www.zostel.com/destination/pune/stay/zostel-pune-viman-nagar-punh925) |
| Zostel Pushkar | Pushkar | India | [Zostel](https://www.zostel.com/destination/pushkar/stay/zostel-pushkar-pshh956) |
| Zostel Rishikesh (Laxman Jhula) | Rishikesh | India | [Zostel](https://www.zostel.com/destination/rishikesh/stay/zostel-rishikesh-laxman-jhula-rshh304) |
| Zostel Shangarh | Shangarh | India | [Zostel](https://www.zostel.com/destination/shangarh/stay/shangarh-kullu-shnh319) |
| Zostel Shillong | Shillong | India | [Zostel](https://www.zostel.com/destination/shillong/stay/zostel-shillong-shlh305) |
| Zostel Shoja (Jibhi) | Shoja | India | [Zostel](https://www.zostel.com/destination/shoja/stay/zostel-shoja-jibhi-shjh523) |
| Zostel Sissu (Khangsar) | Sissu | India | [Zostel](https://www.zostel.com/destination/sissu/stay/zostel-sissu-sssh294) |
| Zostel Srinagar | Srinagar | India | [Zostel](https://www.zostel.com/destination/srinagar/stay/srinagar-srnh885) |
| Zostel Udaipur | Udaipur | India | [Zostel](https://www.zostel.com/destination/udaipur/stay/udaipur-udph705) |
| Zostel Varanasi | Varanasi | India | [Zostel](https://www.zostel.com/destination/varanasi/stay/zostel-varanasi-vrnh142) |
| Zostel Varkala | Varkala | India | [Zostel](https://www.zostel.com/destination/varkala/stay/varkala-vrkh781) |
| Generator Amsterdam | Amsterdam | Netherlands | [Generator](https://staygenerator.com/hostels/amsterdam) |
| Generator Barcelona | Barcelona | Spain | [Generator](https://staygenerator.com/hostels/barcelona) |
| Generator Berlin Alexanderplatz | Berlin | Germany | [Generator](https://staygenerator.com/hostels/berlin/alexanderplatz) |
| Generator Berlin Mitte | Berlin | Germany | [Generator](https://staygenerator.com/hostels/berlin/mitte) |
| Generator Copenhagen | Copenhagen | Denmark | [Generator](https://staygenerator.com/hostels/copenhagen) |
| Generator Dublin | Dublin | Ireland | [Generator](https://staygenerator.com/hostels/dublin) |
| Generator Hamburg | Hamburg | Germany | [Generator](https://staygenerator.com/hostels/hamburg) |
| Generator London King's Cross | London | United Kingdom | [Generator](https://staygenerator.com/hostels/london/kingscross) |
| Generator Madrid | Madrid | Spain | [Generator](https://staygenerator.com/hostels/madrid) |
| Paramount Times Square - A Generator Hotel | New York | United States | [Generator](https://staygenerator.com/hotels/paramount-times-square) |
| Generator Paris | Paris | France | [Generator](https://staygenerator.com/hostels/paris) |
| Generator Rome | Rome | Italy | [Generator](https://staygenerator.com/hostels/rome) |
| Generator Stockholm | Stockholm | Sweden | [Generator](https://staygenerator.com/hostels/stockholm) |
| Generator Venice | Venice | Italy | [Generator](https://staygenerator.com/hostels/venice) |
| The Taj Mahal Palace, Mumbai | Mumbai | India | [Taj Hotels](https://www.tajhotels.com/en-in/hotels/taj-mahal-palace-mumbai) |
| Taj Lake Palace, Udaipur | Udaipur | India | [Taj Hotels](https://www.tajhotels.com/en-in/hotels/taj-lake-palace-udaipur) |
| Rambagh Palace, Jaipur | Jaipur | India | [Taj Hotels](https://www.tajhotels.com/en-in/hotels/rambagh-palace-jaipur) |
| Taj Falaknuma Palace, Hyderabad | Hyderabad | India | [Taj Hotels](https://www.tajhotels.com/en-in/hotels/taj-falaknuma-palace-hyderabad) |
| Taj Exotica Resort & Spa, Goa | Benaulim, Goa | India | [Taj Hotels](https://www.tajhotels.com/en-in/hotels/taj-exotica-goa) |
| Taj Bekal Resort & Spa, Kerala | Bekal | India | [Taj Hotels](https://www.tajhotels.com/en-in/hotels/taj-bekal-kerala) |
| Jai Mahal Palace, Jaipur | Jaipur | India | [Taj Hotels](https://www.tajhotels.com/en-in/hotels/jai-mahal-palace-jaipur) |
| Taj Mahal, New Delhi | New Delhi | India | [Taj Hotels](https://www.tajhotels.com/en-in/hotels/taj-mahal-new-delhi) |
