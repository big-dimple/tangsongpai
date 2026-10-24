import json,gzip,hashlib,subprocess,itertools
from pathlib import Path
from fractions import Fraction
b=Path('docs/production/evidence/separated-balance-2026-10-21')
read=lambda f:json.loads((b/f).read_text());sha=lambda x:hashlib.sha256(x).hexdigest()
lock=read('lock.json');r=read('results.json');s=read('summary.json');idx=read('index.json');base=lock['baseline'];policy='c61858ef2034b6bb983cf9117f619a647ef8fff5'
assert r['lockSha256']==sha((b/'lock.json').read_bytes()) and r['policyCommit']==policy
assert r['startedAt']>lock['lockedAt'] and r['status']=='COMPLETE'
subprocess.run(['git','merge-base','--is-ancestor',policy,'HEAD'],check=True)
assert subprocess.check_output(['git','diff','--name-only',policy,'HEAD','--','harness/balance-open/policy.ts','harness/balance-open/worker.ts','harness/balance-open/adapters.mjs','harness/balance-open/run.mjs','harness/balance-open/check.mjs'])==b''
assert subprocess.run(['git','cat-file','-e',policy+':'+str(b/'results.json')],capture_output=True).returncode!=0
for f,h in lock['files'].items():assert sha(Path(f).read_bytes())==h,f
assert subprocess.check_output(['git','diff','--name-only',base,'HEAD','--','src','public','package.json','package-lock.json','.github'])==b''
for x in idx['evidence']:assert sha((b/x['file']).read_bytes())==x['sha256'],x['file']
expected={(g,c,seed) for g in ['O','A','B'] for c in (['erxiang'] if g=='B' else lock['characters']) for seed in lock['seeds']}
assert {(c['condition'],c['character'],c['seed']) for c in r['chains']}==expected and len(r['chains'])==39
summary={};restores=0;handoffs=[];qin=0;wen=0
for c in r['chains']:
 assert c['status']=='THREE_CLEARED' and len(c['stages'])==3 and c['storage']['restoreChecks']==3
 assert [x['target'] for x in c['stages']]==(['400','800','1200'] if c['condition']=='A' else ['400','600','800'])
 cp=json.loads(gzip.decompress((b/c['checkpoint']).read_bytes()));assert cp['experiment']==c['condition'] and 'EXPERIMENT' in cp['warning']
 assert cp['checkpoint']['journal'][-len(c['steps']):]==[x['command'] for x in c['steps']]
 state=cp['checkpoint']['state'];assert state['gold']==c['final']['gold'] and state['phase']==c['final']['phase'] and state['commandSeq']==c['final']['seq'] and state['jokers']==c['final']['jokers']
 for i,e in enumerate(c['steps']):
  assert e['command']['expectedSeq']==e['before']['seq'] and e['after']['seq']==e['before']['seq']+1
  if i:assert c['steps'][i-1]['after']['hash']==e['before']['hash'] and c['steps'][i-1]['revision']+1==e['revision']
  a=e['command']['action'];qin+=bool(a.get('touyeBet'));wen+=bool(a.get('azaoRelease'))
  if 'trace' in e:
   assert a['type']=='PlayHand'
   for x in e['trace']['events']:
    if x.get('reasonKey')=='erxiang.handoff':
     value=Fraction(int(x['value']['n']),int(x['value']['d']));saved=e['trace']['erxiangHandoff']['points'];assert value==Fraction(saved,2 if c['condition']=='B' else 1)
     f=lambda v:Fraction(int(v['n']),int(v['d']))
     assert f(x['after']['M'])-f(x['before']['M'])==value and f(x['after']['H'])==f(x['before']['H'])
     handoffs.append((c['condition'],str(value)))
 restores+=c['storage']['restoreChecks']
for g in ['O','A','B']:
 rows=[c for c in r['chains'] if c['condition']==g];st=[x for c in rows for x in c['stages']];actions=[e['command']['action'] for c in rows for e in c['steps']]
 t={'chains':len(rows),'stages':len(st),'firstStageFirstHand':sum(c['stages'][0]['hands']==1 for c in rows),'allStageFirstHands':sum(x['hands']==1 for x in st),'hands':sum(x['hands'] for x in st),'discards':sum(x['discards'] for x in st),'practices':sum(a['type']=='PracticeHand' for a in actions),'burn':sum(a.get('xiemuBurn',0) for a in actions)}
 assert t==s['conditions'][g],(g,t,s['conditions'][g]);summary[g]=t
bo=[c for c in r['chains'] if c['condition']=='O' and c['character']=='erxiang'];assert sum(x['hands']==1 for c in bo for x in c['stages'])==9
assert qin==wen==0 and restores==117
out={'status':'PASS','reviewedHead':'c199c8d850c5c1b98245cc3bb25c4817d2d58ff1','policyCommit':policy,'noResultAtPolicyCommit':True,'sourceFilesLockedAndProductionUnchanged':len([f for f in lock['files'] if f.startswith('src/')]),'allIndexedEvidenceHashes':True,'ledgerCheckpointAndSequenceConsistency':True,'restoresRecorded':restores,'conditionsRecalculated':summary,'baselineLiueFirstHands':9,'qinActualBetCommands':qin,'wenActualReleaseCommands':wen,'ordinaryHandoffEventsChecked':len(handoffs),'scope':'Read-only audit of original39 ledgers/checkpoints, no chain re-execution. Pure adapter arithmetic/public-state checks separately rerun. Fixed three seeds/single route/conservative strategy do not certify six-hero balance or fun; A/B remain experiments.'}
Path('/tmp/pr211-independent-audit.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print(json.dumps(out,ensure_ascii=False,indent=2))
