from pathlib import Path
from PIL import Image
import hashlib
import io
import json
import struct

root = Path(__file__).resolve().parents[2] / 'public'
manifest = json.loads((root / 'mobile' / 'manifest.json').read_text())


def glb(path):
    data = path.read_bytes()
    assert struct.unpack_from('<III', data, 0) == (0x46546C67, 2, len(data))
    size, kind = struct.unpack_from('<II', data, 12)
    assert kind == 0x4E4F534A
    model = json.loads(data[20:20+size])
    position = 20+size
    size, kind = struct.unpack_from('<II', data, position)
    assert kind == 0x004E4942
    binary = data[position+8:position+8+size]
    views = []
    for view in model['bufferViews']:
        start = view.get('byteOffset', 0)
        assert start % 4 == 0 and start + view['byteLength'] <= len(binary)
        views.append(binary[start:start+view['byteLength']])
    return model, views


for asset in manifest['assets']:
    original = root / asset['path']
    mobile = root / 'mobile' / asset['path']
    assert hashlib.sha256(original.read_bytes()).hexdigest() == asset['sourceSha256']
    assert hashlib.sha256(mobile.read_bytes()).hexdigest() == asset['mobileSha256']
    if original.suffix == '.glb':
        base, base_views = glb(original)
        small, small_views = glb(mobile)
        for key in ['accessors', 'meshes', 'nodes', 'scenes', 'materials', 'textures', 'samplers']:
            assert base.get(key) == small.get(key), (asset['path'], key)
        image_views = {image['bufferView'] for image in small.get('images', [])}
        for index, (before, after) in enumerate(zip(base_views, small_views)):
            if index in image_views:
                assert max(Image.open(io.BytesIO(after)).size) <= manifest['maxTextureEdge']
            else:
                assert before == after, f'Geometry changed in {asset["path"]} view {index}'
    else:
        assert max(Image.open(mobile).size) <= manifest['maxTextureEdge']
print(f'PASS: all {len(manifest["assets"])} mobile assets are bounded to 512px; GLB geometry, transforms, materials and accessor bytes are unchanged.')
