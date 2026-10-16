# Neighborhood backdrop

`public/backdrop/neighborhood-lawn-8k.jpg` (desktop) and `-4k.jpg` (phones) are made from the 8192 × 4096
original in `backdrop-source/`:

1. `python3 -I scripts/backdrop/mirror_street.py backdrop-source/suburban-infill-lot-8k.png /tmp/mirrored.png`
   keeps the street-facing half of the photo and mirrors it to the back (removing the copied sun), so the
   oversized houses that stood right beside the camera are gone.
2. `python3 -I scripts/backdrop/lawn_lot.py /tmp/mirrored.png public/backdrop /tmp/preview.jpg` repaints the
   empty lot as lawn, and behind/beside the lot lays lawn up to the houses (no second street).

`backdrop.json` then tells the viewer where the photo's ground ends (`groundEdge`), the near sidewalk angle
(`lotEdge`) and the photo's natural scale (`scale`) so the street lies flat and straight in front of the
house and the houses across it stand upright at life size.
