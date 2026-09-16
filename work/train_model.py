"""Reproduce synthetic data and Random Forest forecasts. No real Cielo data."""
from pathlib import Path
import json, csv, io, zipfile
import numpy as np
from datetime import date, timedelta
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error

ROOT = Path(__file__).resolve().parents[1]
rng = np.random.default_rng(42)
ASOF = date(2026, 9, 15)
N, H = 620, 60
dates = [ASOF - timedelta(days=N-i) for i in range(N)]
future = [(ASOF+timedelta(days=i)).isoformat() for i in range(H)]
profiles = [('aurora','Café Aurora','Alimentação',22,1250,1800,[.30,.40,.25,.05]),('linha','Linha & Cor','Vestuário',26,1900,3200,[.15,.20,.25,.40]),('oficina','Oficina do Bairro','Serviços',24,1550,6500,[.20,.40,.30,.10])]
def features(y,t):
 d=dates[t] if t<N else ASOF
 return [d.weekday(),d.day,d.month,t,y[t-1],y[t-7],np.mean(y[t-7:t]),np.mean(y[t-28:t]),np.std(y[t-28:t])]
names=['Dia da semana','Dia do mês','Mês','Tempo observado','Vendas de ontem','Vendas há 7 dias','Média de 7 dias','Média de 28 dias','Variação de 28 dias']
shops=[]
rows=[]
for idx,(sid,name,sector,age,base,balance,mix) in enumerate(profiles):
 y=[]
 for i,d in enumerate(dates):
  weekly=([.72,.82,.91,1,1.20,1.48,.85] if idx!=2 else [1.1,1.05,1.1,1.08,1.2,.7,.2])[d.weekday()]
  month=1.13 if d.day<11 else .95
  trend=1+.0003*i
  y.append(round(max(0,base*weekly*month*trend*(1+.08*np.sin(i/45))+rng.normal(0,base*.13)),2))
 y=np.array(y)
 X=np.array([features(y,t) for t in range(28,N-H+1)])
 Y=np.array([y[t:t+H] for t in range(28,N-H+1)])
 origins=np.arange(28,N-H+1)
 cutoff=N-H
 mask=origins+H<=cutoff
 model=RandomForestRegressor(n_estimators=100,max_depth=10,min_samples_leaf=3,random_state=42,n_jobs=-1)
 model.fit(X[mask],Y[mask])
 testpred=model.predict([features(y,cutoff)])[0]
 baseline=np.array([y[cutoff-7+i%7] for i in range(H)])
 actual=y[cutoff:]
 metrics={'mae':round(mean_absolute_error(actual,testpred),2),'baselineMae':round(mean_absolute_error(actual,baseline),2),'testStart':dates[cutoff].isoformat(),'testEnd':dates[-1].isoformat(),'trainSamples':int(mask.sum()),'holdoutDays':H}
 model.fit(X,Y)
 forecast=np.maximum(0,model.predict([features(y,N)])[0]).round(2)
 # Hypothetical fees and settlement delays; not Cielo's contractual conditions.
 rates=[0,.012,.025,.032]; delays=[0,1,30,30]
 existing=np.zeros(H)
 for i,gross in enumerate(y):
  for m,share in enumerate(mix):
   parts=3 if m==3 else 1
   for p in range(parts):
    due=i-N+delays[m]+30*p
    if 0<=due<H: existing[due]+=gross*share*(1-rates[m])/parts
  if i>=N-90:
   for m,share in enumerate(mix):
    rows.append([sid,dates[i].isoformat(),['pix','debito','credito_vista','credito_3x'][m],round(gross*share,2),rates[m],3 if m==3 else 1,delays[m]])
 expenses=[]
 for i,ds in enumerate(future):
  d=date.fromisoformat(ds)
  expenses.append({'date':ds,'operating':round(base*.37,2),'supplier':round(base*4.5,2) if d.weekday()==4 else 0,'fixed':round(base*4.8,2) if d.day in [5,20] else 0})
 shops.append({'id':sid,'name':name,'sector':sector,'age':age,'balance':balance,'mix':mix,'rates':rates,'delays':delays,'history':[{'date':dates[i].isoformat(),'sales':float(y[i])} for i in range(N-90,N)],'forecast':forecast.tolist(),'receivables':existing.round(2).tolist(),'expenses':expenses,'metrics':metrics,'importance':sorted([{'name':n,'value':round(float(v),4)} for n,v in zip(names,model.feature_importances_)],key=lambda a:-a['value'])})
data={'asof':ASOF.isoformat(),'dates':future,'seed':42,'synthetic':True,'model':'RandomForestRegressor','trees':100,'historyDays':N,'shops':shops}
(ROOT/'dist'/'data.json').write_text(json.dumps(data,ensure_ascii=False),encoding='utf-8')
s=io.StringIO(); w=csv.writer(s); w.writerow(['empresa','data_venda','modalidade','valor_bruto','taxa_hipotetica','parcelas','prazo_primeira_liquidacao_dias']); w.writerows(rows)
(ROOT/'dist'/'pagamentos_sinteticos.csv').write_text(s.getvalue(),encoding='utf-8-sig',newline='')
print(json.dumps({s['id']:s['metrics'] for s in shops},ensure_ascii=False))
import runpy
runpy.run_path(str(ROOT/'work/enrich_model.py'))
