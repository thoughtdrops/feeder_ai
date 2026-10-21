# ForteWEB export (.4te)

The studio can hand a design to Weyerhaeuser's ForteWEB, which sizes engineered-lumber members (TJI joists, Microllam LVL, Parallam PSL, TimberStrand LSL) and prints a report for each one.

## For the visitor

1. Open **Reports → Continue with ForteWEB** and click **Download ForteWEB file (.4te)**.
2. Log into ForteWEB, open the **File Manager**, choose **Import** and pick the file.
3. ForteWEB lists each member under its level (Main floor, Upper floor, Third floor, Roof). Design them and print the reports.

## What the file contains

The file is plain XML in Forte's job file format, version 5.5. That format comes from the Forte File Format Utility, which Weyerhaeuser supplies. `rust-app/src/forte.rs` writes it from the studio's own model, and every export checks out against `ForteSchema.xsd`. Weyerhaeuser's files (schema, product list, converter and utility) are not committed to the repo.

Each member carries every node the utility's own default problems carry, because ForteWEB's importer expects them even where the schema marks them optional. Leaving them out made the first test import fail with "Object reference not set to an instance of an object". The nodes are:

- floor performance settings;
- two hanger connector slots;
- the multi-ply fastener list;
- loads that list all six load classes.

Units follow Forte's own: lengths in inches, and area loads in psi over a tributary width in inches. For example, 40 psf is 0.277778 psi.

| Member | Source in the studio | Supports | Loads |
| --- | --- | --- | --- |
| **Main floor joists:** one per distinct bay. | Floor panels between the foundation girders (every 16 ft). | Plate on the steel beam's treated nailer, an LVL girder, or a stud wall (crawlspace). | Floor live and dead psf from the design (40 / 20 by default), at 16 in o.c. |
| **Upper floor joists:** one per distinct bay and support pair. | The studio's floor deck spans and girder lines. | Stud wall, or a face-mount hanger on the LVL girder. | Same as the main floor. |
| **Upper floor girders:** flush LVL. | Each girder line. Posts sit where they stack down to the piers. | Stud wall at the ends, posts between. | Floor live and dead over the girder's tributary width. |
| **Foundation girders:** LVL pier beams only. | Each girder line. | Pier-cap posts. | Main-floor tributary. Posts from above must be added in ForteWEB. |
| **Headers:** one per opening width on each outside wall, per floor. | Door, window and passage openings. | Jack studs (1.5 in, or 3 in over 6 ft). | Roof: 20 psf live, 30 psf snow, 15 psf dead over half the run plus the overhang, on eave walls. Floors above: half the end bay, on walls the joists bear on. Walls above: 10 psf over the wall height. |
| **Roof rafters:** I-joist rafters. | Common rafter from the eave wall to the ridge, at the design's pitch, 16 in o.c. | Beveled plate at the wall; face-mount hanger on the LVL ridge. | 20 psf roof live, 30 psf snow, 15 psf dead. |

Project settings:

The project settings are the utility's own defaults, so ForteWEB reads them the same way it reads its own files:

- **Building code:** IBC. Pick the code edition in ForteWEB's project settings. The studio itself checks to the 2024 IRC.
- **Wind and loads:** 90 mph basic wind speed, Exposure B, and standard load duration factors. Set the site's wind speed in ForteWEB.
- **Hangers:** Simpson.

The product lists are left empty, so ForteWEB considers every product. Each joist's notes name the studio's own preliminary span-table pick, for example the 16 in TJI 110.

## Not included yet

- **Eave overhangs on rafters.** The overhang's span rule hasn't been confirmed with Weyerhaeuser yet.
- **Not yet exported:** bump-outs, L/T/U additions, the ridge beam, posts, studs, dormers, porches and decks.
- **Site loads.** Snow, wind and seismic loads for the actual lot are not set; confirm them in ForteWEB.

## Next step: the ForteWEB API

Once a test import works, ask Weyerhaeuser for API access and sample code. With the API, the studio can send this same file and get back the design results and a PDF report for each member, without a manual import. Weyerhaeuser asks to be consulted before any commercial release of .4te import or export features.
