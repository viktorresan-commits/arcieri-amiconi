import sys, re; sys.path.insert(0,'.')
import numpy as np
from za_load import load
from load import A, part
def norm(n): return re.sub(r'\s+',' ',n.lower().replace(' muscle','').strip())
def fit():
    za=load(); bp={}
    for p in A['parts']:
        if p['system']!='muscular': continue
        n=p['name'].lower(); side='l' if re.search(r'\bleft\b',n) else 'r' if re.search(r'\bright\b',n) else ''
        bp[(norm(re.sub(r'\b(left|right)\b ?','',n)),side)]=p
    pairs=[]
    for z in za:
        k=(norm(z['name']), z['side'])
        if k in bp:
            P,_,_=part(bp[k]); pairs.append((z['P'].mean(0), P.astype(np.float64).mean(0), k))
    X=np.array([a for a,_,_ in pairs]); Y=np.array([b for _,b,_ in pairs]); keys=[k for *_,k in pairs]
    m=np.ones(len(X),bool)
    for it in range(6):
        mx,my=X[m].mean(0),Y[m].mean(0); Xc,Yc=X[m]-mx,Y[m]-my
        U,S,Vt=np.linalg.svd(Yc.T@Xc/m.sum()); D=np.eye(3)
        if np.linalg.det(U@Vt)<0: D[2,2]=-1
        R=U@D@Vt; s=np.trace(np.diag(S)@D)/(Xc**2).sum(1).mean(); t=my-s*R@mx
        res=np.linalg.norm((s*(R@X.T)).T+t-Y,axis=1)
        m=res<max(0.012, np.median(res[m])*2.2)
    return s,R,t,res,keys,m
if __name__=='__main__':
    s,R,t,res,keys,m=fit()
    print('scala',round(s,4),'t',t.round(4),'usate',m.sum(),'/',len(m),'residuo mediano mm',round(np.median(res)*1000,1))
    for r,k in sorted(zip(res,keys))[::12]: print(round(r*1000,1), k)
