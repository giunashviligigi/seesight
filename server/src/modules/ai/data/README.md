# Airport dataset

`airports.json` is generated from [OurAirports](https://ourairports.com/data/) CSVs.

Regenerate:

```bash
# download airports-raw.csv and countries-raw.csv into this folder, then:
node scripts/build-airports-json.js
```

Raw CSVs are gitignored; commit the resulting `airports.json`.
