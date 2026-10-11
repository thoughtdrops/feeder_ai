"""Turn a 360-degree panorama (.hdr, .exr, .jpg or .png) into web-ready backdrop images.

Usage: python3 scripts/make-backdrop.py <panorama> <name> [exposure]
Writes public/backdrop/<name>-8k.jpg and <name>-4k.jpg and points backdrop.json at them.
HDR/EXR input is tone-mapped (ACES filmic) and converted to sRGB first.
"""
import json, os, sys
import cv2, numpy as np

src, name = sys.argv[1], sys.argv[2]
exposure = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
img = cv2.imread(src, cv2.IMREAD_ANYDEPTH | cv2.IMREAD_COLOR)
if img is None:
    sys.exit('Could not read ' + src)
if img.dtype != np.uint8:
    x = img.astype(np.float32) * exposure
    x = np.clip((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0, 1)  # ACES filmic
    x = np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(x, 1 / 2.4) - 0.055)
    img = (x * 255 + 0.5).astype(np.uint8)
out = os.path.join(os.path.dirname(__file__), '..', 'public', 'backdrop')
files = {}
for label, width in (('8k', 8192), ('4k', 4096)):
    w = min(width, img.shape[1])
    resized = cv2.resize(img, (w, w // 2), interpolation=cv2.INTER_AREA)
    files[label] = f'{name}-{label}.jpg'
    cv2.imwrite(os.path.join(out, files[label]), resized, [cv2.IMWRITE_JPEG_QUALITY, 88, cv2.IMWRITE_JPEG_PROGRESSIVE, 1, cv2.IMWRITE_JPEG_OPTIMIZE, 1])
manifest_path = os.path.join(out, 'backdrop.json')
manifest = json.load(open(manifest_path))
manifest.update(image=files['8k'], mobileImage=files['4k'])
json.dump(manifest, open(manifest_path, 'w'), indent=2)
print('Backdrop ready:', files)
