"""Add a cold-start model and declared accounting snapshots to the demo."""
from pathlib import Path
from datetime import date,timedelta
import json,sys
import numpy as np
from sklearn.ensemble import RandomForestRegressor
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(Path(__file__).resolve().parent))
import montecarlo
path=ROOT/'dist/data.json'
data=json.loads(path.read_text(encoding='utf-8'))
data['shops']=[s for s in data['shops'] if s['id']!='novo']
rng=np.random.default_rng(2026)
asof=date.fromisoformat(data['asof'])
N=360; H=60
dates=[asof-timedelta(days=N-i) for i in range(N)]
def feat(y,t,d):
 return [d.weekday(),d.day,d.month,float(np.mean(y[t-7:t])),float(np.mean(y[t-14:t])),float(np.std(y[t-14:t]))]
X=[];Y=[]
for p in range(18):
 scale=rng.uniform(600,1700)
 sales=np.array([max(0,scale*[.75,.82,.91,1,1.2,1.45,.85][d.weekday()]*(1.1 if d.day<11 else .95)+rng.normal(0,scale*.15)) for d in dates])
 for t in range(14,N-H+1,7):X.append(feat(sales,t,dates[t]));Y.append(sales[t:t+H])
model=RandomForestRegressor(n_estimators=100,max_depth=10,min_samples_leaf=3,random_state=2026,n_jobs=-1).fit(X,Y)
histdates=[asof-timedelta(days=14-i) for i in range(14)]
y=np.array([max(0,900*[.75,.82,.91,1,1.2,1.45,.85][d.weekday()]+rng.normal(0,90)) for d in histdates])
forecast=model.predict([feat(y,14,asof)])[0]
mix=[.3,.4,.25,.05];rates=[0,.012,.025,.032];delays=[0,1,30,30];receivables=np.zeros(H)
for i,gross in enumerate(y):
 for m,share in enumerate(mix):
  parts=3 if m==3 else 1
  for p in range(parts):
   due=i-14+delays[m]+30*p
   if 0<=due<H:receivables[due]+=gross*share*(1-rates[m])/parts
expenses=[]
for ds in data['dates']:
 d=date.fromisoformat(ds)
 expenses.append({'date':ds,'operating':260,'supplier':2800 if d.weekday()==4 else 0,'fixed':3500 if d.day in [5,20] else 0})
exp_total=np.array([e['operating']+e['supplier']+e['fixed'] for e in expenses])
resid=rng.normal(0,0.18*float(np.mean(forecast)),400)  # sem holdout: dispersão ~18% dos pares sintéticos
unc=montecarlo.banda_incerteza(forecast,resid,mix,rates,delays,receivables,exp_total,6500,data['dates'],rng)
unc['method']='Início de operação: faixa maior, resíduos estimados pela dispersão dos negócios sintéticos de referência (~18%). Sem validação independente; trate como ponto de partida.'
# diagnóstico timing vs margem em 90 dias: valor líquido da produção prevista vs despesas (previsão estendida plana)
fc90=np.concatenate([forecast,[float(np.mean(forecast))]*30])
net_pg=sum(mix[m]*(1-rates[m]) for m in range(len(mix)))
exp90=sum(260+(2800 if (asof+timedelta(days=i)).weekday()==4 else 0)+(3500 if (asof+timedelta(days=i)).day in [5,20] else 0) for i in range(90))
diagnosis={'entradas90':round(float(np.sum(fc90))*net_pg,2),'saidas90':round(float(exp90),2)}
new={'id':'novo','name':'Café Primeiro Passo','sector':'Alimentação','age':1,'balance':6500,'mix':mix,'rates':rates,'delays':delays,'history':[{'date':d.isoformat(),'sales':round(float(v),2)} for d,v in zip(histdates,y)],'forecast':forecast.round(2).tolist(),'receivables':receivables.round(2).tolist(),'expenses':expenses,'coldStart':True,'peerCount':18,'trainSamples':len(X),'historyDays':14,'metrics':None,'uncertainty':unc,'diagnosis':diagnosis,'importance':[{'name':n,'value':round(float(v),4)} for n,v in zip(['Dia da semana','Dia do mês','Mês','Média de 7 dias','Média de 14 dias','Variação de 14 dias'],model.feature_importances_)]}
data['shops'].append(new)
for s,stock,pme,pmp,liabilities,debts in zip(data['shops'],[6500,22000,4000,3000],[8,35,5,7],[14,21,20,14],[13000,26000,9000,5500],[1200,4500,1000,0]):
 beyond=0
 for item in s['history']:
  offset=(date.fromisoformat(item['date'])-asof).days
  for m,share in enumerate(s['mix']):
   parts=3 if m==3 else 1
   for p in range(parts):
    if offset+s['delays'][m]+30*p>=60:beyond+=item['sales']*share*(1-s['rates'][m])/parts
 s['receivablesBeyondWindow']=round(beyond,2)
 s['finance']={'stock':stock,'pme':pme,'pmp':pmp,'operatingLiabilities':liabilities,'financialDebt':debts,'otherReceivables':0}
 s['historyDays']=s.get('historyDays',620)
 s['coldStart']=s.get('coldStart',False)
path.write_text(json.dumps(data,ensure_ascii=False),encoding='utf-8')
import csv
csvpath=ROOT/'dist/pagamentos_sinteticos.csv'
with csvpath.open(encoding='utf-8-sig',newline='') as f: rows=list(csv.reader(f))
rows=[r for r in rows if r and r[0]!='novo']
for d,gross in zip(histdates,y):
 for m,share in enumerate(mix): rows.append(['novo',d.isoformat(),['pix','debito','credito_vista','credito_3x'][m],round(float(gross)*share,2),rates[m],3 if m==3 else 1,delays[m]])
with csvpath.open('w',encoding='utf-8-sig',newline='') as f:csv.writer(f).writerows(rows)
print('Added cold-start Random Forest: 18 synthetic peers,',len(X),'training examples; 14 days for new shop.')
