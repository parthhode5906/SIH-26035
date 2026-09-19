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
export function setTokens(d){localStorage.setItem(ACCESS_KEY,d.access_token);localStorage.setItem(REFRESH_KEY,d.refresh_token);localStorage.setItem('nawi-authenticated','1');localStorage.setItem('nawi-user',JSON.stringify(d.user||{role:d.role,full_name:d.full_name}));}
export function clearTokens(){[ACCESS_KEY,REFRESH_KEY,'nawi-authenticated','nawi-user'].forEach(k=>localStorage.removeItem(k));}
function instrumentView(item){return {...item,asset:item.model,serial:item.serial_number,capacity:item.max_capacity,unit:item.base_unit,e:item.verification_scale_interval,d:item.display_interval||item.verification_scale_interval};}
function sessionView(item){return {...item,state:item.status};}
function instrumentPayload(x){return {manufacturer:x.manufacturer||x.asset||x.model||'Unknown',model:x.model||x.asset||'Unknown',serial_number:x.serial_number||x.serial||'',accuracy_class:x.accuracy_class,max_capacity:String(x.max_capacity||x.capacity||'0').replaceAll(',',''),min_capacity:String(x.min_capacity||'0'),verification_scale_interval:String(x.verification_scale_interval||x.e||'1'),display_interval:x.display_interval||x.d||null,base_unit:x.base_unit||x.unit||'g'};}
function observationPayload(x){const moduleMap={zero:'zero_check',eccentricity:'eccentricity',repeatability:'repeatability',linearity:'weighing_performance',creep:'creep',discrimination:'weighing_performance',verdict:'weighing_performance',identification:'weighing_performance',environment:'weighing_performance'};const module=String(x.module||'weighing_performance');const sequence=Number(String(x.logical_key||'').match(/(\d+)$/)?.[1]||x.sequence_no||0);return {test_type:x.test_type||moduleMap[module]||'weighing_performance',position:x.position||null,sequence_no:sequence,applied_load:String(x.applied_load||x.load||'0'),indication:String(x.indication||'0'),additional_load:String(x.additional_load||'0'),zero_error:String(x.zero_error||'0'),source:x.source||'manual'};}
export const api={
 login:(email,password)=>request('/auth/login',{method:'POST',body:JSON.stringify({email,password})}),
 me:()=>request('/users/me'),
 instruments:(q='')=>request(`/instruments?limit=100&q=${encodeURIComponent(q)}`).then(page=>page.items.map(instrumentView)),
 createInstrument:(x)=>request('/instruments',{method:'POST',body:JSON.stringify(instrumentPayload(x))}).then(instrumentView),
 sessions:()=>request('/sessions?limit=100').then(page=>page.items.map(sessionView)),
 session:(id)=>request(`/sessions/${id}`).then(sessionView),
 createSession:(x)=>request('/sessions',{method:'POST',body:JSON.stringify(x)}).then(sessionView),
 environment:(id,x)=>request(`/sessions/${id}`,{method:'PATCH',body:JSON.stringify(x)}).then(sessionView),
 observations:(id)=>request(`/sessions/${id}/observations`),
 addObservation:(id,x)=>request(`/sessions/${id}/observations`,{method:'POST',body:JSON.stringify(observationPayload(x))}),
 drift:(id)=>request(`/sessions/${id}/drift`),
 finalize:(id)=>request(`/sessions/${id}/finalize`,{method:'POST'}),
 reports:()=>request('/reports'),
 downloadUrl:(id)=>`${BASE}/reports/${encodeURIComponent(id)}/download`,
 verify:(id)=>request(`/public/verify/${encodeURIComponent(id)}`),
 audit:()=>request('/users/audit'),
 auditVerify:()=>request('/users/audit/verify'),
 sign:(sessionId)=>request(`/reports/sessions/${sessionId}/sign`,{method:'POST'}),
 upload:async(sessionId,file)=>{const f=new FormData();f.append('file',file);return request(`/sessions/${sessionId}/attachments`,{method:'POST',body:f})}
};
export async function downloadReport(id){const token=localStorage.getItem(ACCESS_KEY);const r=await fetch(`${BASE}/reports/${encodeURIComponent(id)}/download`,{headers:{Authorization:`Bearer ${token}`}});if(!r.ok)throw new Error('Unable to download report');const blob=await r.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${id}.pdf`;a.click();URL.revokeObjectURL(url);}
export async function health(){const base=import.meta.env.VITE_API_URL||'/api/v1'; try{const r=await fetch(`${base.replace('/api/v1','')}/health`);return r.ok;}catch{return false;}}
