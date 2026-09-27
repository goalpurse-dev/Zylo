"""Read existing provider output image files; never submit inference requests."""
import json, hashlib, urllib.request, concurrent.futures
from pathlib import Path
from PIL import Image
R=Path(__file__).parent
rows=json.loads((R/'snapshot.json').read_text())
def read(r):
 n=r['plan']['sequence_index'];job=r['job'];out=(job.get('output') or {}).get('data',[])
 urls=[d['imageURL'] for d in out if d.get('imageURL')]
 result={'shot':n,'provider':job.get('provider'),'model':r['scene'].get('render_model'),'requested_width':(job.get('input') or {}).get('width'),'requested_height':(job.get('input') or {}).get('height'),'raw_outputs':[]}
 for url in urls:
  try:
   p=R/'images'/(hashlib.sha256(url.encode()).hexdigest()[:24]+'.img')
   if not p.exists():
    with urllib.request.urlopen(url,timeout=30) as x:p.write_bytes(x.read())
   with Image.open(p) as im:
    result['raw_outputs'].append({'url':url,'width':im.width,'height':im.height,'pixel_sha256':hashlib.sha256(im.convert('RGB').tobytes()).hexdigest()})
  except Exception as e:result['raw_outputs'].append({'url':url,'error':str(e)})
 return result
results=list(concurrent.futures.ThreadPoolExecutor(max_workers=8).map(read,rows))
(R/'raw-dimensions.json').write_text(json.dumps(results,indent=2))
print(json.dumps({'raw_images':sum(len(x['raw_outputs']) for x in results),'errors':[x for x in results if any('error' in a for a in x['raw_outputs'])]}))
