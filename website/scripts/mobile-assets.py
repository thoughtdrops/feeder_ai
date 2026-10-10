"""Bake bounded mobile textures; preserve all GLB geometry and material assignments.

Run with Python + Pillow after editing source textures. Generated public/mobile
assets are committed, so the production build does not need an image processor.
"""
from pathlib import Path
from PIL import Image
import hashlib
import io
import json
import struct

ROOT = Path(__file__).resolve().parents[1] / 'public'
EDGE = 512
records = []


def shrink(data, mime=None):
    image = Image.open(io.BytesIO(data))
    original = image.size
    image.thumbnail((EDGE, EDGE), Image.Resampling.LANCZOS)
    output = io.BytesIO()
    kind = 'PNG' if mime == 'image/png' or image.format == 'PNG' else 'WEBP' if image.format == 'WEBP' else 'JPEG'
    if kind == 'JPEG':
        image.convert('RGB').save(output, kind, quality=88, subsampling=0)
    else:
        image.save(output, kind, **({'quality': 88} if kind == 'WEBP' else {'optimize': True}))
    return output.getvalue(), original, image.size


def glb(path):
    source = path.read_bytes()
    size, kind = struct.unpack_from('<II', source, 12)
    assert kind == 0x4E4F534A
    model = json.loads(source[20:20 + size])
    position = 20 + size
    binary_size, binary_kind = struct.unpack_from('<II', source, position)
    assert binary_kind == 0x004E4942 and len(model['buffers']) == 1
    binary = source[position + 8:position + 8 + binary_size]
    image_views = {image['bufferView']: image for image in model.get('images', [])}
    new_binary = bytearray()
    images = []
    for index, view in enumerate(model['bufferViews']):
        assert view.get('buffer', 0) == 0
        start = view.get('byteOffset', 0)
        data = binary[start:start + view['byteLength']]
        if index in image_views:
            data, before, after = shrink(data, image_views[index].get('mimeType'))
            images.append({'original': before, 'mobile': after})
        new_binary.extend(b'\0' * (-len(new_binary) % 4))
        view['byteOffset'] = len(new_binary)
        view['byteLength'] = len(data)
        new_binary.extend(data)
    model['buffers'][0]['byteLength'] = len(new_binary)
    new_binary.extend(b'\0' * (-len(new_binary) % 4))
    document = json.dumps(model, separators=(',', ':')).encode()
    document += b' ' * (-len(document) % 4)
    output = struct.pack('<III', 0x46546C67, 2, 28 + len(document) + len(new_binary))
    output += struct.pack('<II', len(document), 0x4E4F534A) + document
    output += struct.pack('<II', len(new_binary), 0x004E4942) + new_binary
    return output, images


def save(path, data, images):
    relative = path.relative_to(ROOT)
    destination = ROOT / 'mobile' / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)
    records.append({'path': str(relative), 'sourceSha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'mobileSha256': hashlib.sha256(data).hexdigest(), 'images': images})


for path in sorted((ROOT / 'models').glob('*.glb')):
    data, images = glb(path)
    save(path, data, images)
for path in sorted((ROOT / 'materials').rglob('*')):
    if path.suffix.lower() in ('.jpg', '.webp'):
        data, original, mobile = shrink(path.read_bytes())
        save(path, data, [{'original': original, 'mobile': mobile}])
(ROOT / 'mobile' / 'manifest.json').write_text(json.dumps({'maxTextureEdge': EDGE, 'assets': records}, indent=2) + '\n')
print(f'Baked {len(records)} mobile assets with texture edges <= {EDGE}px.')
