"""Audit-only report assembly. Judgments below are manual visual annotations, not model QA."""
import json,csv,hashlib,html,collections,statistics
from pathlib import Path
R=Path(__file__).parent
rows=json.loads((R/'snapshot.json').read_text()); ms=json.loads((R/'measurements.json').read_text())
raw=json.loads((R/'raw-dimensions.json').read_text()); vp=json.loads((R/'visual-plan.json').read_text())
claims={c['claimId']:c for c in json.loads((R/'contract.json').read_text())['claims']}
beats={b['id']:b for b in vp['visual_plan']['visualBeats']}
def nums(s):return [int(x) for x in s.split()]
notes={}
manual='''1|Blue oxygen-like vapor replaces the narrated rising wall-light wake cue; opening teaches the wrong mechanism.
2|A coherent illustrated habitat cutaway establishes Mars; viewpoint differs from the requested view through a porthole.
3|Clear oxygen/water/power icons in green/amber/green directly explain the narration; a face is unnecessary in this detail.
4|Identical to Shot 3; acceptable short hold on the same claim, although no promised closer framing occurs.
5|Checklist is the focal evidence but generated lettering is malformed.
6|Edit substantially supplies the requested checklist; punctuation is awkward but the three important items are readable.
7|Checklist edit introduces misspelled readiness/review lettering, making required text unreliable.
8|Reuses Shot 5's checklist while narration introduces the longer Mars sol; no time comparison is shown.
9|A worried face does not demonstrate the two scheduling responses to sol drift.
10|Another similar worried face continues the scheduling claim without explanatory change.
11|Blue-lit crew scene provides a useful visual cue for circadian lighting.
12|Face crop removes much of the lighting context and adds little to the circadian explanation.
13|Warm habitat lighting supplies a useful contrast with the earlier blue-lit frame.
14|A hand at the tablet communicates the junction of human decisions and automation; small glyphs are incidental.
15|Crew member at status icons communicates monitoring; incidental UI need not invalidate the scene.
16|Two near-identical protagonist heads bracket a screen whose central exception-note label is misspelled.
17|Crop enlarges the malformed exception-note label instead of improving the explanation.
18|A complete protagonist turnaround remains visibly pasted beside the habitat scene.
19|A narrow right-side crop of Shot 18 produces a portrait frame and loses the forecast explanation.
20|Crew member checking a tablet is usable for the wake/check/decide recap, with limited explanatory specificity.
21|Valve/component handling gives the life-support maintenance narration a concrete action.
22|A closer hands-and-valve view is a useful detail, with a valid frame ratio.
23|Two crew members at diagnostics support the task; distant/back-facing identity is not strong enough evidence to call cloning.
24|A handheld humidity reading illustrates a manual spot-check; the numerical example is incidental to the narrated action.
25|Edit changes a humidity reading to a pressure trace/anomaly: a real object-state/content change.
26|Hands, cartridge and tools make maintenance concrete; inherited two-character QA is too broad for this shot.
27|The requested cartridge tag appears; screens are unnecessarily blanked, but the maintenance subject remains clear.
28|Crew member recording on a tablet is a usable illustration of routine logging, though visually generic.
29|Exact continuation of Shot 28's logging setup; acceptable as a short hold but contributes no new visual information.
30|Exception label is visibly truncated/misspelled; the targeted log entry is not dependable.
31|A sensor-trace tablet supplies useful detail; tiny unrelated glyphs are a minor issue rather than automatic failure.
32|A full reference sheet occupies the left half, yet current QA explicitly says no leakage and approves it.
33|Crew member at the console is usable for prioritizing/recording work, with only incidental small text.
34|Hands inspecting a filter/port provide clear maintenance action.
35|The important unresolved-anomaly label contains malformed spelling.
36|Tiny malformed handoff-confirmation lettering does not reliably communicate the required confirmation.
37|A greenhouse establishing shot can explain racks and equipment without showing the specialist.
38|A different glasses-wearing scientist and alarm-room setup replace the canonical agricultural specialist and greenhouse context.
39|Back-facing lab-coated figure at an alarm display does not demonstrate the narrated automatic adjustment.
40|Scissors pruning lettuce clearly show the narrated manual crop-care action.
41|Close crop preserves the scissors/plant action; lack of a visible face is appropriate.
42|A small glasses-wearing lab-coated character replaces the bearded green-clad agricultural specialist.
43|Edit largely changes brightness and blanks the alert; wrong specialist remains and no explanatory action is added.
44|Hands adjusting a lamp over a growing tray provide a useful concrete mechanism.
45|Right-third crop becomes portrait and cuts away useful lamp-adjustment context.
46|White-coated protagonist-like character substitutes for the canonical specialist; greenhouse identity is inconsistent.
47|Exact reuse of Shot 46 fails to explain the small continuous-production system introduced by narration.
48|Dark-uniform protagonist-like character substitutes for the green-clad agricultural specialist.
49|Hands harvesting lettuce clearly show the narrated action; background glyphs are incidental.
50|Growth chambers and output/cost motifs broadly support the system tradeoff; educational specificity is limited.
51|No budget-calculation action is visible and the central EVA budget equation is garbled.
52|Crop moves toward the locker/checklist while losing the budget calculation that matters.
67|Generic forecast console does not visibly rank power priorities; central screen text is malformed.
68|Exact repeat of Shot 67 carries a new allocation claim without showing the changed decision.
69|The forecast-screen variation still lacks the narrated priority relationship and contains malformed text.
74|Red alarms around the greenhouse clearly establish the CO2 event; no full character is needed in this insert.
75|Corrective-action log is readable and relevant; incidental background identity is not essential to this information insert.
76|Three gloved hands awkwardly occupy a nominal single-specialist preparation shot; oxygen-high labeling also conflicts with the CO2 event.
77|Valve-position/wear change is not demonstrated; the bag and three-hand setup remain while the alert screen is erased.
78|Requested gasket gap is not clearly shown; the same bag composition persists with screen erasure.
79|A greenhouse cabinet stands exposed on Martian ground, undermining the pressurized growth-chamber setting.
80|Orange grading and blank monitor dominate the edit; the requested sample-label/bag improvement is absent.
81|A flagged suit/control panel replaces the narrated rover drill/sortie context; no rover appears.
82|Suit pressure-fault display contains prominent misspelling, making the required fault evidence unreliable.
83|Crop enlarges and clips the already malformed suit-fault display.
84|A flagged suit in the airlock reasonably establishes the repair delay despite broader inherited cast requirements.
85|Red warning is added, but the diagnostic display is blanked instead of showing the requested regulator-fault icon.
86|Hands on a pressure gauge give a useful bench-test detail; repeated gauge numerals are a minor technical-text defect.
87|Gauge turns green, but the filter is not visibly swapped and the needle/state evidence is inadequate for the requested repair result.
88|Empty airlock doors fail to show the repaired suit or return-to-service event.
89|A green OK indicator is attached to a door, replacing the suit/locker state that the narration needs.
90|Serviceable label edit succeeds locally, but it labels the wrong underlying object/door scene.
91|Reuse of the door indicator does not establish that EVA capability was preserved.
94|A large malformed console table cannot explain the requested power allocation.
95|Crop magnifies the malformed allocation table rather than making the decision intelligible.
99|A glasses-wearing lab-coated character replaces the canonical specialist and weakens continuity of the greenhouse recovery.
100|Hands reseating a seal clearly demonstrate the repair step.
101|Edit softens and smears the hands/line work despite requesting increased sharpness; monitor is blanked.
102|Green indicators and a changed hand position provide a partial but usable verification cue; actuator-open state remains uncertain.
103|CO2 NOMINAL label is readable, but a steeply rising trace gives ambiguous/opposing recovery evidence; two rear heads cannot prove cloning.
104|Generic power-stable display does not explain how automated containment and human verification prevented escalation.
105|Crop repeats the generic stability panel without adding the missing mechanism.
106|Helmeted crew and rover in rocky terrain support EVA activity; identical helmets do not prove identical people.
107|Rock sampling with a rover behind supplies a clear field-work action.
108|A dose-accounting tablet makes the return/check-in concept concrete; minor abstract graph detail is acceptable.
109|Exercise foreground and a matching protagonist in the background lose the intended distinct crew identities; probable cloning.
110|Repeated protagonist figures occupy the exercise stations rather than distinct crew members.
111|Exercise crop inherits repeated protagonist figures and cuts faces; it does not repair identity continuity.
112|Standing protagonist variants replace the distinct crew and do little to illustrate the lighting transition.
113|Top-half crop is extra-wide and cuts bodies/heads, violating final-frame geometry.
114|Three protagonist-like faces, plus a partial foreground person, replace a clearly differentiated three-person check-in.
115|Meal props are added meaningfully, but the duplicated-cast problem remains.
116|Exact reuse of the calm check-in adds no alarm or local response for the new narration.
117|A red table alarm is added, but duplicated characters remain; the image does not depict automated mitigation.
118|Two near-identical crouching protagonists replace the specialist/technician roles.
119|Handheld tester is added, a real local delta; duplicated characters and missing role identity remain.
120|Foreground typing supports messaging, but protagonist-like treadmill duplicates dilute the action and crew continuity.
121|Signed-by field appears on the wall rather than clearly on a fault ticket; cast duplication persists.
122|Stylus is added, but no close-up or signed/saved indicator is delivered; the screen becomes blank.
128|An operator at a sunset console is a usable closeout illustration, though the exact record-keeping action is weak.
129|Crop emphasizes unreadable closeout information without making the log/exception evidence clear.
130|Five near-identical protagonists surround the table where three distinct crew are requested; melted wax/flames also contradict synthetic candles.
131|Multiple separate checklist mini-scenes and repeated people form an unrequested storyboard layout.
132|Edit preserves the multi-panel layout and blacks out the checklist it was supposed to make legible.
133|Split habitat/lab composition includes a headless reference-outfit fragment and fails to show the intended restored systems clearly.
134|Three separate meal mini-scenes replace one coherent communal moment; repeated protagonist representations leak across panels.
135|One face and food become markedly realistic against flat cartoon neighbors; canonical agricultural identity is missing.
136|Coherent cutaway is permissible, but the closing suit/greenhouse/dust-power resolutions are not legibly demonstrated.
'''
for line in manual.strip().splitlines():
 n,t=line.split('|',1);notes[int(n)]=t
issues=collections.defaultdict(set)
def tag(code,shots):
 for n in nums(shots):issues[n].add(code)
tag('ASPECT_RATIO_INVALID','19 45 113');tag('PORTRAIT_OUTPUT','19 45')
tag('MULTI_SCENE_COMPOSITION_LEAK','18 32 131 132 133 134')
tag('REFERENCE_SHEET_VISIBLE','18 32');tag('REFERENCE_BOARD_VISIBLE','133')
# Physical cast duplication excludes sheet drawings and characters repeated only across panels.
tag('CHARACTER_DUPLICATION','16 110 111 112 114 115 116 117 118 119 120 121 122 130')
tag('EXTRA_CHARACTER','16 114 115 116 117 130')
tag('IDENTITY_DRIFT','38 39 42 43 46 47 48 99 109 110 111 112 114 115 116 117 118 119 120 121 122 130 131 132 133 134 135 136')
tag('MISSING_CHARACTER','109 118 119 130 131 132 133 134 135 136')
tag('WRONG_LOCATION','38 79 80')
tag('SEMANTIC_MISMATCH','1 8 9 10 12 18 19 32 38 39 43 47 51 52 67 68 69 76 77 78 79 80 81 87 88 89 90 91 103 104 105 112 116 117 121 122 129 132 133 136')
tag('WRONG_ACTION','1 39 77 78 81 87 88 122 132')
tag('MISSING_REQUIRED_OBJECT','51 52 77 78 80 81 88 89 90 91 133 136')
tag('WRONG_OBJECT','89 90 91')
tag('BAD_CROP','12 17 19 45 52 83 95 113 129');tag('SUBJECT_CROPPED_OUT','19 45 52 113')
tag('TEXT_GIBBERISH_MAJOR','5 7 8 16 17 30 35 36 51 67 68 69 76 82 83 94 95 129')
tag('TEXT_GIBBERISH_MINOR','14 15 23 28 29 31 33 49 86 128')
tag('MISSING_REQUIRED_TEXT','77 78 85 121 122 132')
tag('TEXT_CLIPPING','30 83')
tag('BLURRY_OUTPUT','101');tag('COMPOSITION_AWKWARD','76 77 78')
tag('WRONG_STYLE','38 135');tag('PHOTOREALISM_DRIFT','135')
graphic=[x['plan']['sequence_index'] for x in rows if x['scene']['render_strategy']=='PROGRAMMATIC_GRAPHIC']
blank=nums('63 64 65 66 72 73'); corrupt=nums('54 55 60 92 93 97 123 124 125 127')
for n in graphic:
 issues[n].update(['BAD_GRAPHIC','GRAPHIC_SEMANTIC_MISMATCH'])
 if not ms[n-1].get('url'):notes[n]='No current image; worker exhausted its claims. This is a failed graphic task, not a provider generation failure.'
 elif n in blank:issues[n].add('BLANK_GRAPHIC');notes[n]='Uniform dark frame: no symbols, relationships or text explain the narration; automatically marked Ready.'
 elif n in corrupt:issues[n].update(['CORRUPTED_IMAGE','TEXT_CLIPPING','TEXT_OVERFLOW']);notes[n]='Clipped, oversized, color-fringed bitmap lettering makes the deterministic graphic unusable; automatically marked Ready.'
 else:issues[n].add('GRAPHIC_TOO_TEXT_HEAVY');notes[n]='Readable label-only card does not draw the relationship/mechanism needed by this explanatory beat.'
edit_strength={6:'MEANINGFUL',7:'MINOR',25:'MEANINGFUL',27:'MEANINGFUL',30:'MINOR',35:'MINOR',36:'MINOR',43:'COSMETIC_ONLY',77:'MINOR',78:'MINOR',80:'COSMETIC_ONLY',85:'MINOR',87:'MINOR',90:'MEANINGFUL',101:'MINOR',102:'MEANINGFUL',115:'MEANINGFUL',117:'MEANINGFUL',119:'MEANINGFUL',121:'MINOR',122:'MINOR',132:'MINOR'}
for n,d in edit_strength.items():
 if d!='MEANINGFUL':issues[n].add('FAILED_VISUAL_DELTA')
 if d=='COSMETIC_ONLY':issues[n].add('LIGHTING_ONLY_EDIT')
# Editorial runs are manually confirmed; numerical similarity is provided independently.
run_specs=[(5,8,'HIGH','MINOR','Checklist wording changes; same pose/camera; final reuse crosses into sol-length claim.'),(9,10,'HIGH','COSMETIC_ONLY','Similar worried faces do not demonstrate scheduling approaches.'),(26,30,'MEDIUM','MINOR','Two related work/tablet setups; only a tag and log text change, then a reuse.'),(34,36,'HIGH','MINOR','Identical hands/port; only faulty log labels change.'),(63,66,'EXACT','NONE','Four identical blank frames replace several different power concepts.'),(67,69,'HIGH','MINOR','One exact repeat plus a near-identical console variation; priorities remain unexplained.'),(76,78,'HIGH','MINOR','Bag and three-hand composition stays; requested valve/gasket changes absent.'),(79,80,'HIGH','COSMETIC_ONLY','Orange grade and erased screen; incorrect outdoor cabinet remains.'),(86,87,'HIGH','MINOR','Gauge color changes without a visible filter swap.'),(89,91,'HIGH','MINOR','OK changes to Serviceable, then returns to exact OK source; wrong target object.'),(100,102,'HIGH','MINOR','Same seal/hands; blur in one edit, green LEDs in another; small partial progress.'),(109,113,'MEDIUM','MINOR','Exercise and standing variants/crops retain repeated protagonist figures; little conceptual progress.'),(114,117,'HIGH','MINOR','Same seated crew; plates and alarm added; exact source reused between them.'),(118,119,'HIGH','MEANINGFUL','Tester is added, but same crouching composition and duplicated cast persist.'),(120,122,'HIGH','MINOR','Same typing/gym layout; small field/stylus changes fail to show signed log.'),(131,132,'HIGH','NONE','Same storyboard panels; edit erases the checklist instead of isolating it.')]
for a,b,sim,strength,note in run_specs:
 for n in range(a,b+1):
  issues[n].add('EXCESSIVE_SAME_SETUP_RUN')
  if b-a+1>=3:issues[n].add('LONG_DUPLICATE_RUN')
  if n>a:issues[n].update(['CAMERA_STAGNATION','POSE_STAGNATION'])
  if n>a and sim=='HIGH' and ms[n-1].get('pixel_sha256')!=ms[n-2].get('pixel_sha256'):issues[n].add('NEAR_DUPLICATE_NEIGHBOR')
exact_groups=collections.defaultdict(list)
for m in ms:
 if m.get('pixel_sha256'):exact_groups[(m['width'],m['height'],m['pixel_sha256'])].append(m['shot'])
exact_groups=[v for v in exact_groups.values() if len(v)>1]
for g in exact_groups:
 for a,b in zip(g,g[1:]):
  if b==a+1:issues[b].add('EXACT_DUPLICATE_NEIGHBOR')
good=set(nums('2 3 4 6 11 13 14 15 20 21 22 23 24 25 26 27 28 29 31 33 34 37 40 41 44 49 50 74 75 84 86 100 102 106 107 108 128'))
faces={1:'1',2:'1',3:'0',4:'0',5:'1 partial',6:'1 partial',7:'1 partial',8:'1 partial',9:'1',10:'1',11:'1',12:'1 partial',13:'1',14:'hands only',15:'1 rear',16:'2 partial',17:'hands/partial edges',18:'1 scene + sheet views',19:'partial scene crop',20:'1',21:'1',22:'hands only',23:'2; one distant/rear',24:'1',25:'1',26:'1',27:'1',28:'1',29:'1',30:'1',31:'hands only',32:'1 scene + sheet views',33:'1',34:'1 partial',35:'1 partial',36:'1 partial',37:'0',38:'1',39:'1 rear',40:'hands only',41:'hands only',42:'1',43:'1',44:'hands only',45:'partial hand/plant',46:'1',47:'1',48:'1',49:'hands only',50:'small distant figure',51:'0',52:'0',67:'2',68:'2',69:'2',74:'0',75:'small distant figure',76:'3 hands; owner count indeterminate',77:'3 hands; owner count indeterminate',78:'3 hands; owner count indeterminate',79:'1 suited',80:'1 suited',81:'1 plus empty suit',82:'suit detail',83:'suit detail',84:'1 plus empty suit',85:'1 plus empty suit',86:'hands only',87:'hands only',88:'0',89:'0',90:'0',91:'0',94:'1 partial',95:'screen crop',99:'1',100:'hands only',101:'hands only',102:'hands only',103:'2 rear heads',104:'panel insert',105:'panel crop',106:'3 helmeted',107:'1 suited',108:'1 suited partial',109:'2',110:'3',111:'3 partial',112:'3',113:'3 cropped bodies/heads',114:'3 faces + 1 partial foreground',115:'3 faces + 1 partial foreground',116:'3 faces + 1 partial foreground',117:'3 faces + 1 partial foreground',118:'2',119:'2',120:'3',121:'3',122:'3',128:'1',129:'partial/console crop',130:'5',131:'5 person depictions across panels',132:'5 person depictions across panels',133:'2 + headless outfit fragment',134:'5 person depictions across panels',135:'3',136:'2'}
def clock(t):return f'{int(t)//60:02}:{t%60:06.3f}'
records=[]; edits=[]
for i,(x,m) in enumerate(zip(rows,ms)):
 n=m['shot'];p=x['plan'];s=x['scene'];j=x['job'];b=beats.get(p['visual_beat_id'],{});c=claims.get(p['narration_claim_id'],{})
 verdict='NO_OUTPUT' if not m.get('url') else 'GOOD' if n in good else 'BAD'
 severity='CRITICAL' if verdict=='NO_OUTPUT' or issues[n]&{'ASPECT_RATIO_INVALID','MULTI_SCENE_COMPOSITION_LEAK','CHARACTER_DUPLICATION','CORRUPTED_IMAGE','BLANK_GRAPHIC'} else 'MAJOR' if verdict=='BAD' else 'MINOR' if issues[n] else 'NONE'
 chars=[t for t in ['EXTRA_CHARACTER','MISSING_CHARACTER','IDENTITY_DRIFT'] if t in issues[n]]
 if 'CHARACTER_DUPLICATION' in issues[n]:chars.append('DUPLICATED_CHARACTER')
 if not chars:chars=['NOT_ASSESSABLE' if verdict=='NO_OUTPUT' else 'CHARACTER_COUNT_CORRECT' if n not in [18,19,32,76,77,78,103] else 'NOT_ASSESSABLE']
 record={**m,'timestamp':clock(m['start']),'duration_seconds':round(m['end']-m['start'],3),'audit_verdict':verdict,'severity':severity,'issues':sorted(issues[n]),'observation':notes[n],'composition_class':'NO_OUTPUT' if verdict=='NO_OUTPUT' else 'UNINTENTIONAL_MULTI_PANEL' if 'MULTI_SCENE_COMPOSITION_LEAK' in issues[n] else 'SINGLE_COHERENT_SCENE','character_classifications':chars,'visible_character_count':faces.get(n,'0' if n in graphic else 'not assessable'),'expected_characters':p['qa_expectations'].get('requiredCharacterIds',[]),'expected_location':p['qa_expectations'].get('requiredLocationId'),'contract_version_used_for_audit':'9a3826cd-9a2d-4b48-8275-0b5a8489950e','stored_plan_contract_version':p.get('narration_contract_version_id'),'narration_claim_id':p['narration_claim_id'],'narration':c.get('narrationText',p['communication_goal']),'required_visual_facts':c.get('requiredVisualFacts',[]),'communication_goal':p['communication_goal'],'camera_requested':p['director_meta'].get('cameraFraming'),'visual_form':b.get('contractVisualForm'),'reference_asset_ids':s.get('input_reference_asset_ids'),'reference_bundle_id':s.get('reference_bundle_id'),'input_reference_urls':(j.get('input') or {}).get('ref_images',[]),'provider':j.get('provider') or ('local compositor/source image' if m['strategy'] in ['CROP','REUSE','PROGRAMMATIC_GRAPHIC'] else None),'provider_requested_dimensions':[raw[i]['requested_width'],raw[i]['requested_height']],'raw_provider_outputs':raw[i]['raw_outputs'],'qa_result':s['qa_result'],'plan_id':p['id'],'source_plan_id':p['source_scene_render_plan_id'],'source_scenes':x['source_scenes'],'text_role':'CRITICAL_REQUIRED_TEXT / wrong or malformed' if 'TEXT_GIBBERISH_MAJOR' in issues[n] else 'INCIDENTAL_TEXT / minor glyphs' if 'TEXT_GIBBERISH_MINOR' in issues[n] else 'PROGRAMMATIC_GRAPHIC' if n in graphic else 'No material text defect observed','confidence':'medium on identity/semantic judgment; dimensions and hashes exact' if n in [23,38,39,42,43,46,47,48,50,99,103,109,114,115,116,117,135,136] else 'high on primary defect or usefulness','uncertainty':'Rear/distant or partial faces are not reliable biometric evidence; sheet depictions are not physical crew.' if n in [18,23,32,76,77,78,103,109,131,132,134] else None}
 records.append(record)
 if n in edit_strength:
  e={'shot':n,'source_scene_url':((j.get('input') or {}).get('ref_images') or [None])[0],'result_url':m['url'],'instruction':j.get('prompt'),'camera_changed':False,'pose_changed':n in [7,78,102,119,122],'head_direction_changed':False,'expression_changed':False,'object_state_changed':n not in [43,77,78,80,101,132],'action_changed':n in [119,122],'composition_changed':False,'only_lighting_changed':'predominantly grading/glow, plus unwanted screen erasure' if n in [43,80] else False,'difference_strength':edit_strength[n],'requested_delta_accomplished':n not in [7,30,35,36,43,77,78,80,85,87,101,121,122,132],'failed_delta':n in [7,30,35,36,43,77,78,80,85,87,101,121,122,132],'note':notes[n]}
  if n==102:e['note']+=' Partial/medium confidence: green state is visible; actuator rotation cannot be verified.'
  edits.append(e)
for r in records:
 if r['shot'] in graphic and r['audit_verdict']!='NO_OUTPUT':r['composition_class']='BLANK_NO_SCENE' if r['shot'] in blank else 'SINGLE_FRAME_GRAPHIC'
 if r['shot']==109:r['character_classifications'].append('PROBABLE_DUPLICATED_CHARACTER')
 if r['shot'] in [23,103]:r['character_classifications']=['COUNT_PLAUSIBLE_IDENTITY_UNCERTAIN']
 if r['shot'] in [40,41,44,49,86,100,101,102]:r['character_classifications']=['CHARACTER_COUNT_CORRECT_FOR_DETAIL; identity not assessable from hands']
(R/'per-shot-audit.json').write_text(json.dumps(records,indent=2,ensure_ascii=False),encoding='utf-8')
(R/'edit-audit.json').write_text(json.dumps(edits,indent=2,ensure_ascii=False),encoding='utf-8')
with (R/'per-shot-audit.csv').open('w',newline='',encoding='utf-8-sig') as f:
 fields=[k for k in records[0] if k not in ['source_scenes','qa_result','raw_provider_outputs']];w=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore');w.writeheader()
 for r in records:w.writerow({k:json.dumps(v,ensure_ascii=False) if isinstance(v,(dict,list)) else v for k,v in r.items()})
sim=json.loads((R/'similarity.json').read_text())
pairmap={(p['a'],p['b']):p for p in sim}
windows=[]
for size in [3,5,8]:
 for a in range(1,138-size):
  ns=list(range(a,a+size));pairs=[]
  for i in ns:
   for j in ns:
    if j<=i:continue
    p=pairmap.get((i,j))
    if not p:continue
    exact=bool(ms[i-1].get('pixel_sha256') and ms[i-1].get('pixel_sha256')==ms[j-1].get('pixel_sha256') and ms[i-1].get('width')==ms[j-1].get('width') and ms[i-1].get('height')==ms[j-1].get('height'))
    if exact or (p['dhash_distance']<=10 and (p['gray_correlation'] or 0)>=.85):pairs.append({**p,'exact':exact})
  overlaps=[list(range(max(a,lo),min(a+size-1,hi)+1)) for lo,hi,*_ in run_specs if min(a+size-1,hi)-max(a,lo)+1>=3]
  windows.append({'size':size,'shots':ns,'duration_seconds':round(ms[ns[-1]-1]['end']-ms[a-1]['start'],3),'unavailable_shots':[n for n in ns if not ms[n-1].get('url')],'numeric_similar_pairs':pairs,'manual_stagnation_overlaps':overlaps,'flagged':bool(pairs or overlaps)})
(R/'windows-3-5-8.json').write_text(json.dumps(windows,indent=2))
for r in records:
 n=r['shot'];prev=records[n-2] if n>1 else None
 if prev is None:d='OPENING'
 elif r['audit_verdict']=='NO_OUTPUT' or prev['audit_verdict']=='NO_OUTPUT':d='UNAVAILABLE_BOUNDARY'
 elif any(n in g and n-1 in g for g in exact_groups):d='NONE'
 elif n in edit_strength:d=edit_strength[n]
 elif r['strategy']=='CROP':d='MEANINGFUL' if n in [22,41] else 'MINOR'
 elif n in [10,69,110,112,133,136]:d='MINOR'
 elif r['strategy']=='PROGRAMMATIC_GRAPHIC':d='MINOR'
 else:d='MAJOR'
 r['difference_from_previous']=d
# Rewrite with the sequence annotations included.
(R/'per-shot-audit.json').write_text(json.dumps(records,indent=2,ensure_ascii=False),encoding='utf-8')
with (R/'per-shot-audit.csv').open('w',newline='',encoding='utf-8-sig') as f:
 fields=[k for k in records[0] if k not in ['source_scenes','qa_result','raw_provider_outputs']];w=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore');w.writeheader()
 for r in records:w.writerow({k:json.dumps(v,ensure_ascii=False) if isinstance(v,(dict,list)) else v for k,v in r.items()})
runs=[]
for a,b,level,strength,note in run_specs:
 runs.append({'shots':list(range(a,b+1)),'start':ms[a-1]['start'],'end':ms[b-1]['end'],'duration_seconds':round(ms[b-1]['end']-ms[a-1]['start'],3),'similarity':level,'difference_strength':strength,'edits':sum(n in edit_strength for n in range(a,b+1)),'note':note})
(R/'stagnant-runs.json').write_text(json.dumps(runs,indent=2))
summary={'total':len(records),'available':sum(r['audit_verdict']!='NO_OUTPUT' for r in records),'verdicts':dict(collections.Counter(r['audit_verdict'] for r in records)),'valid_ratio':sum(r.get('ratio_valid',False) for r in records),'strict_exact_16_9':sum(r.get('width',0)*9==r.get('height',-1)*16 for r in records),'issues':dict(collections.Counter(t for r in records for t in r['issues'])),'confusion':dict(collections.Counter(('Failed' if r['audit_verdict']=='NO_OUTPUT' else 'Ready' if r['qa']=='approved' else 'Review')+' / '+r['audit_verdict'] for r in records)),'composition':dict(collections.Counter(r['composition_class'] for r in records)),'exact_groups':exact_groups,'edits':{'total':len(edits),'meaningful':sum(e['difference_strength']=='MEANINGFUL' for e in edits),'failed_delta':sum(e['failed_delta'] for e in edits),'predominantly_lighting':2,'strict_lighting_only':0},'duration_seconds':ms[-1]['end'],'good_duration':round(sum(r['duration_seconds'] for r in records if r['audit_verdict']=='GOOD'),3),'graphic_shots':graphic,'graphic_duration':round(sum(records[n-1]['duration_seconds'] for n in graphic),3),'stagnant_run_count':len(runs),'stagnant_shots':sum('EXCESSIVE_SAME_SETUP_RUN' in r['issues'] for r in records)}
summary['window_counts']={str(k):{'total':sum(w['size']==k for w in windows),'flagged':sum(w['size']==k and w['flagged'] for w in windows)} for k in [3,5,8]}
summary['transition_strength']=dict(collections.Counter(r['difference_from_previous'] for r in records[1:]))
(R/'summary.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary,indent=2))
