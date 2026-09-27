import json, hashlib, urllib.request, concurrent.futures, math
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFont
import numpy as np

ROOT=Path(__file__).parent
rows=json.loads((ROOT/'snapshot.json').read_text())
refs=json.loads((ROOT/'references.json').read_text())
(ROOT/'images').mkdir(exist_ok=True)
def filename(url): return ROOT/'images'/(hashlib.sha256(url.encode()).hexdigest()[:24]+'.img')
urls=set()
for r in rows:
 s=r['scene']; u=s.get('final_result_url') or s.get('result_url')
 if u: urls.add(u)
 for u in (r['job'].get('input') or {}).get('ref_images',[]): urls.add(u)
 for u in (r['job'].get('output') or {}).get('x_unused',[]): pass
used=set(i for r in rows for i in (r['scene'].get('input_reference_asset_ids') or [])+(r['plan'].get('reference_asset_ids') or []))
for r in refs:
 if r['id'] in used: urls.add(r['result_url'])
def fetch(u):
 p=filename(u)
 try:
  if not p.exists():
   with urllib.request.urlopen(u,timeout=45) as x: p.write_bytes(x.read())
  with Image.open(p) as im: im.load()
  return u,None
 except Exception as e:return u,str(e)
errors=dict((u,e) for u,e in concurrent.futures.ThreadPoolExecutor(max_workers=8).map(fetch,urls) if e)
(ROOT/'download-errors.json').write_text(json.dumps(errors,indent=2))
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',18)
small=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',15)
vectors={}; measures=[]
for r in rows:
 s=r['scene']; p=r['plan']; u=s.get('final_result_url') or s.get('result_url'); n=p['sequence_index']
 m={'shot':n,'scene_id':s['id'],'strategy':s['render_strategy'],'model':s.get('render_model'),'url':u,'start':p['start_seconds'],'end':p['end_seconds'],'qa':s['qa_status'],'status':s['status']}
 if u and u not in errors:
  im=Image.open(filename(u)).convert('RGB'); w,h=im.size; a=np.asarray(im.resize((128,72)).convert('L'),dtype=float)
  v=np.asarray(im.resize((9,8)).convert('L')); dh=(v[:,1:]>v[:,:-1]).flatten()
  vectors[n]=(a,dh)
  m.update(width=w,height=h,ratio=w/h,ratio_valid=abs(w/h/(16/9)-1)<=.01,pixel_sha256=hashlib.sha256(im.tobytes()).hexdigest(),std=float(a.std()),edge_variance=float(np.var(a[1:-1,:-2]+a[1:-1,2:]+a[:-2,1:-1]+a[2:,1:-1]-4*a[1:-1,1:-1])),local_file=str(filename(u)))
 measures.append(m)
(ROOT/'measurements.json').write_text(json.dumps(measures,indent=2))
def tile(r,w=480,h=325):
 p=r['plan']; s=r['scene']; u=s.get('final_result_url') or s.get('result_url'); out=Image.new('RGB',(w,h),'#eeeeee');d=ImageDraw.Draw(out)
 title=f"{p['sequence_index']:03} {s['render_strategy']} | {s['qa_status'] or s['status']}"
 d.text((7,4),title,fill='black',font=font)
 if u and u not in errors:
  im=Image.open(filename(u)).convert('RGB');im.thumbnail((w-8,260));out.paste(im,((w-im.width)//2,29+(260-im.height)//2))
 else:d.text((10,110),'NO OUTPUT',fill='red',font=font)
 d.text((7,294),p['communication_goal'][:58],fill='black',font=small)
 return out
for st in range(0,len(rows),12):
 page=Image.new('RGB',(1440,1300),'white')
 for i,r in enumerate(rows[st:st+12]):page.paste(tile(r),((i%3)*480,(i//3)*325))
 page.save(ROOT/f'contact-{st+1:03}-{min(st+12,len(rows)):03}.jpg',quality=94)
edits=[r for r in rows if r['scene']['render_strategy']=='EDIT']
for st in range(0,len(edits),4):
 page=Image.new('RGB',(1440,4*340),'#eeeeee');d=ImageDraw.Draw(page)
 for i,r in enumerate(edits[st:st+4]):
  us=(r['job'].get('input') or {}).get('ref_images',[]);target=r['scene'].get('final_result_url') or r['scene'].get('result_url')
  for j,u in enumerate([(us or [None])[0],target]):
   if u and u not in errors:
    im=Image.open(filename(u)).convert('RGB');im.thumbnail((700,265));page.paste(im,(j*720+(720-im.width)//2,i*340+30))
  d.text((8,i*340+5),f"SHOT {r['plan']['sequence_index']} SOURCE -> RESULT",fill='black',font=font)
  prompt=(r['job'].get('prompt') or r['scene'].get('prompt_snapshot') or '')
  d.text((8,i*340+300),prompt[:155],fill='black',font=small)
 page.save(ROOT/f'edits-{st+1:02}.jpg',quality=94)
pairs=[]
for i in range(1,137):
 for j in range(i+1,min(i+8,137)):
  if i in vectors and j in vectors:
   a,ha=vectors[i];b,hb=vectors[j];corr=float(np.corrcoef(a.flatten(),b.flatten())[0,1]) if a.std() and b.std() else None
   pairs.append({'a':i,'b':j,'dhash_distance':int(np.count_nonzero(ha!=hb)),'gray_correlation':corr})
(ROOT/'similarity.json').write_text(json.dumps(pairs,indent=2))
usedrefs=[r for r in refs if r['id'] in used]
for st in range(0,len(usedrefs),12):
 page=Image.new('RGB',(1440,1200),'white');d=ImageDraw.Draw(page)
 for i,r in enumerate(usedrefs[st:st+12]):
  x=(i%3)*480;y=(i//3)*300;u=r['result_url']
  d.text((x+5,y+4),r['entity_id']+' '+r['angle_or_view'],fill='black',font=small)
  if u not in errors:
   im=Image.open(filename(u)).convert('RGB');im.thumbnail((475,270));page.paste(im,(x,y+28))
 page.save(ROOT/f'refs-{st+1:02}.jpg',quality=94)
print(json.dumps({'scenes':len(rows),'downloads':len(urls),'errors':len(errors),'valid':sum(m.get('ratio_valid',False) for m in measures),'invalid':[{'shot':m['shot'],'width':m['width'],'height':m['height'],'strategy':m['strategy']} for m in measures if m.get('ratio_valid') is False]},indent=2))
