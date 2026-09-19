const BASE = import.meta.env.VITE_API_URL || '/api/v1';
const ACCESS_KEY='nawi-access-token'; const REFRESH_KEY='nawi-refresh-token';
const jsonHeaders={'Content-Type':'application/json'};
async function request(path,options={},retry=true){
  const headers={...(options.body instanceof FormData?{}:jsonHeaders),...(options.headers||{})};
  const token=localStorage.getItem(ACCESS_KEY); if(token) headers.Authorization=`Bearer ${token}`;
  let res=await fetch(`${BASE}${path}`,{...options,headers});
  if(res.status===401 && retry && localStorage.getItem(REFRESH_KEY)){
    const rr=await fetch(`${BASE}/auth/refresh`,{method:'POST',headers:jsonHeaders,body:JSON.stringify({refresh_token:localStorage.getItem(REFRESH_KEY)})});
    if(rr.ok){const d=await rr.json(); setTokens(d); return request(path,options,false);}
  }
  if(!res.ok){let msg=`Request failed (${res.status})`; try{const d=await res.json(); msg=d.detail||msg;}catch{} throw new Error(msg);}
  return res.status===204?null:res.json();
}
export function setTokens(d){localStorage.setItem(ACCESS_KEY,d.access_token);localStorage.setItem(REFRESH_KEY,d.refresh_token);localStorage.setItem('nawi-authenticated','1');localStorage.setItem('nawi-user',JSON.stringify(d.user||{}));}
export function clearTokens(){[ACCESS_KEY,REFRESH_KEY,'nawi-authenticated','nawi-user'].forEach(k=>localStorage.removeItem(k));}
export const api={
 login:(email,password)=>request('/auth/login',{method:'POST',body:JSON.stringify({email,password})}),
 me:()=>request('/users/me'),
 instruments:(q='')=>request(`/instruments?q=${encodeURIComponent(q)}`),
 createInstrument:(x)=>request('/instruments',{method:'POST',body:JSON.stringify(x)}),
 sessions:()=>request('/sessions'),
 session:(id)=>request(`/sessions/${id}`),
 createSession:(x)=>request('/sessions',{method:'POST',body:JSON.stringify(x)}),
 environment:(id,x)=>request(`/sessions/${id}/environment`,{method:'PATCH',body:JSON.stringify(x)}),
 observations:(id)=>request(`/sessions/${id}/observations`),
 addObservation:(id,x)=>request(`/sessions/${id}/observations`,{method:'POST',body:JSON.stringify(x)}),
 drift:(id)=>request(`/sessions/${id}/drift`),
 finalize:(id)=>request(`/sessions/${id}/finalize`,{method:'POST'}),
 reports:()=>request('/reports'),
 downloadUrl:(id)=>`${BASE}/reports/${encodeURIComponent(id)}/download`,
 verify:(id)=>request(`/public/verify/${encodeURIComponent(id)}`),
 audit:()=>request('/users/audit'),
 auditVerify:()=>request('/users/audit/verify'),
 sign:(sessionId,signer,designation)=>request(`/reports/sessions/${sessionId}/sign?signer=${encodeURIComponent(signer)}&designation=${encodeURIComponent(designation)}`,{method:'POST'}),
 upload:async(sessionId,file)=>{const f=new FormData();f.append('session_id',sessionId);f.append('file',file);return request('/attachments',{method:'POST',body:f})}
};
export async function downloadReport(id){const token=localStorage.getItem(ACCESS_KEY);const r=await fetch(`${BASE}/reports/${encodeURIComponent(id)}/download`,{headers:{Authorization:`Bearer ${token}`}});if(!r.ok)throw new Error('Unable to download report');const blob=await r.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${id}.pdf`;a.click();URL.revokeObjectURL(url);}
export async function health(){const base=import.meta.env.VITE_API_URL||'/api/v1'; try{const r=await fetch(`${base.replace('/api/v1','')}/health`);return r.ok;}catch{return false;}}
