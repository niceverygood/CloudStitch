"""Read PNG alpha bounds for native gallery framing; never edit raster pixels."""
from pathlib import Path
import argparse
import json
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('catalog', nargs='?', default='outputs/combat-vfx/catalog.json')
args = parser.parse_args()
file = ROOT / args.catalog
catalog = json.loads(file.read_text(encoding='utf-8'))
for item in catalog['items']:
    preview = file.parent / item['preview']
    with Image.open(preview) as image:
        image.load()
        bounds = image.getchannel('A').getbbox() if image.mode == 'RGBA' else (0, 0, image.width, image.height)
        assert bounds, item['id'] + ' preview is blank'
        item['preview_image'] = {'width': image.width, 'height': image.height, 'bounds': list(bounds)}
file.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'catalog':args.catalog,'preview_metadata':len(catalog['items']),'raster_modified':False}))
