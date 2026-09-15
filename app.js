import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const escapeHtml = value => String(value ?? '').replace(/[&<>\"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[ch]));

let supabase;
let currentUser = null;
let currentProfile = null;
let authMode = 'signin';
let currentView = 'home';
let postImageFile = null;
let profileImageFile = null;
let feedRows = [];
let profileMap = new Map();
let commentsByPost = new Map();
let likesByPost = new Map();
let openComments = new Set();
let activeMember = null;
let searchTimer = null;

const toast = $('#toast');
function showToast(message){ toast.textContent = message; toast.classList.add('show'); clearTimeout(showToast.timer); showToast.timer=setTimeout(()=>toast.classList.remove('show'),2600); }
function initials(name='CU'){ return name.trim().split(/\s+/).slice(0,2).map(p=>p[0]?.toUpperCase()).join('') || 'CU'; }
function timeAgo(value){ const d=new Date(value), s=Math.max(0,Math.floor((Date.now()-d)/1000)); if(s<60)return 'just now'; if(s<3600)return `${Math.floor(s/60)}m ago`; if(s<86400)return `${Math.floor(s/3600)}h ago`; if(s<604800)return `${Math.floor(s/86400)}d ago`; return d.toLocaleDateString(); }
function setAvatar(el, profile={}){ if(!el)return; const url=profile.avatar_url||''; el.textContent=url?'':initials(profile.full_name||'CircleUp Member'); el.style.backgroundImage=url?`url(${JSON.stringify(url)})`:''; el.classList.toggle('has-image',!!url); }
function safeFileName(name='image.jpg'){ return name.toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(-90)||'image.jpg'; }

async function init(){
  try{
    const configRes=await fetch('/api/config',{cache:'no-store'});
    if(!configRes.ok) throw new Error('CircleUp connection is not configured yet.');
    const config=await configRes.json();
    supabase=createClient(config.url,config.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const {data:{session}}=await supabase.auth.getSession();
    currentUser=session?.user||null;
    if(currentUser) await enterApp(); else showAuth();
    supabase.auth.onAuthStateChange(async (_event,session)=>{
      const next=session?.user||null;
      if(next?.id===currentUser?.id) return;
      currentUser=next;
      if(currentUser) await enterApp(); else showAuth();
    });
    if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
  }catch(err){
    $('#authMessage').textContent=err.message||'Unable to start CircleUp.';
  }
}

function showAuth(){
  $('#appView').classList.add('hidden');
  $('#authView').classList.remove('hidden');
  currentProfile=null;
}

async function enterApp(){
  $('#authView').classList.add('hidden');
  $('#appView').classList.remove('hidden');
  await ensureProfile();
  updateProfileUI();
  await Promise.allSettled([loadFeed(),loadUnreadActivityCount()]);
  switchView('home');
}

async function ensureProfile(){
  const {data,error}=await supabase.from('kt_profiles').select('*').eq('id',currentUser.id).maybeSingle();
  if(error) throw error;
  if(data){ currentProfile=data; return data; }
  const emailPrefix=(currentUser.email||'member').split('@')[0].replace(/[^A-Za-z0-9_]/g,'').slice(0,18)||'member';
  const base=(emailPrefix.length>=3?emailPrefix:`member${emailPrefix}`).slice(0,20);
  let created=null;
  for(let i=0;i<5&&!created;i++){
    const username=`${base}${i?Math.floor(Math.random()*9000+1000):''}`.slice(0,30);
    const fullName=currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || emailPrefix || 'CircleUp Member';
    const {data:row,error:insertError}=await supabase.from('kt_profiles').insert({id:currentUser.id,full_name:fullName.slice(0,80),username,bio:'',location:''}).select('*').single();
    if(!insertError) created=row;
    else if(insertError.code!=='23505') throw insertError;
  }
  if(!created) throw new Error('Could not create your CircleUp profile.');
  currentProfile=created;
  return created;
}

$('#authForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const email=$('#emailInput').value.trim();
  const password=$('#passwordInput').value;
  const button=$('#authSubmit');
  const msg=$('#authMessage');
  button.disabled=true; msg.textContent='';
  try{
    if(authMode==='signin'){
      const {error}=await supabase.auth.signInWithPassword({email,password}); if(error) throw error;
    }else{
      const {data,error}=await supabase.auth.signUp({email,password}); if(error) throw error;
      if(!data.session){ msg.textContent='Check your email to confirm your account, then sign in.'; return; }
    }
  }catch(err){ msg.textContent=err.message||'Sign-in failed.'; }
  finally{ button.disabled=false; }
});

$('#toggleAuthMode').addEventListener('click',()=>{
  authMode=authMode==='signin'?'signup':'signin';
  $('#authTitle').textContent=authMode==='signin'?'Welcome back':'Join CircleUp';
  $('#authSubtitle').textContent=authMode==='signin'?'Sign in to continue to CircleUp.':'Create your community account.';
  $('#authSubmit').textContent=authMode==='signin'?'Sign in':'Create account';
  $('#toggleAuthMode').textContent=authMode==='signin'?'Create a new account':'I already have an account';
  $('#authMessage').textContent='';
});

$('#signOutButton').addEventListener('click',()=>supabase.auth.signOut());
$('#brandHome').addEventListener('click',()=>switchView('home'));
$('#topProfileButton').addEventListener('click',()=>switchView('profile'));
$$('.nav-item').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.view)));

async function switchView(view){
  currentView=view;
  $$('.view').forEach(v=>v.classList.add('hidden'));
  $(`#${view}View`)?.classList.remove('hidden');
  $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  if(view==='home') await loadFeed($('#searchInput').value.trim());
  if(view==='groups') await loadGroups();
  if(view==='activity') await loadActivity();
  if(view==='profile') await loadOwnProfileView();
  window.scrollTo({top:0,behavior:'smooth'});
}

function updateProfileUI(){
  if(!currentProfile)return;
  setAvatar($('#topAvatar'),currentProfile); setAvatar($('#composerAvatar'),currentProfile); setAvatar($('#profileAvatar'),currentProfile); setAvatar($('#profilePhotoPreview'),currentProfile);
  $('#profileDisplayName').textContent=currentProfile.full_name;
  $('#profileHandle').textContent=`@${currentProfile.username}`;
  $('#profileBioText').textContent=currentProfile.bio||'Add a short bio so people know a little about you.';
  $('#profileLocation').textContent=currentProfile.location||'';
  $('#profileLocation').classList.toggle('hidden',!currentProfile.location);
  $('#profileNameInput').value=currentProfile.full_name||'';
  $('#profileUsernameInput').value=currentProfile.username||'';
  $('#profileLocationInput').value=currentProfile.location||'';
  $('#profileBioInput').value=currentProfile.bio||'';
}

$('#editProfileButton').addEventListener('click',()=>{ updateProfileUI(); $('#profileForm').classList.remove('hidden'); $('#profileForm').scrollIntoView({behavior:'smooth',block:'start'}); });
$('#cancelEditProfile').addEventListener('click',()=>{ $('#profileForm').classList.add('hidden'); profileImageFile=null; updateProfileUI(); });
$('#profilePhotoInput').addEventListener('change',e=>{
  profileImageFile=e.target.files?.[0]||null;
  if(!profileImageFile)return;
  if(profileImageFile.size>5*1024*1024){ showToast('Profile photo must be 5 MB or smaller.'); profileImageFile=null; e.target.value=''; return; }
  $('#profilePhotoPreview').style.backgroundImage=`url(${JSON.stringify(URL.createObjectURL(profileImageFile))})`; $('#profilePhotoPreview').textContent=''; $('#profilePhotoPreview').classList.add('has-image');
});

$('#profileForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const msg=$('#profileMessage'); const save=$('#saveProfileButton'); msg.textContent=''; save.disabled=true;
  const full_name=$('#profileNameInput').value.trim();
  const username=$('#profileUsernameInput').value.trim();
  const location=$('#profileLocationInput').value.trim();
  const bio=$('#profileBioInput').value.trim();
  if(!/^[A-Za-z0-9_]{3,30}$/.test(username)){ msg.textContent='Username must be 3–30 letters, numbers, or underscores.'; save.disabled=false; return; }
  try{
    let avatar_url=currentProfile.avatar_url||null;
    if(profileImageFile){
      const path=`${currentUser.id}/${Date.now()}-${safeFileName(profileImageFile.name)}`;
      const {error:uploadError}=await supabase.storage.from('kt-profile-images').upload(path,profileImageFile,{contentType:profileImageFile.type||'image/jpeg',upsert:false});
      if(uploadError) throw uploadError;
      avatar_url=supabase.storage.from('kt-profile-images').getPublicUrl(path).data.publicUrl;
    }
    const {data,error}=await supabase.from('kt_profiles').update({full_name,username,location,bio,avatar_url}).eq('id',currentUser.id).select('*').single();
    if(error) throw error;
    currentProfile=data; profileImageFile=null; $('#profilePhotoInput').value=''; updateProfileUI(); $('#profileForm').classList.add('hidden'); msg.textContent=''; showToast('Profile saved.');
    await Promise.allSettled([loadFeed($('#searchInput').value.trim()),loadOwnProfileStats()]);
  }catch(err){ msg.textContent=err.code==='23505'?'That username is already taken.':(err.message||'Could not save profile.'); }
  finally{ save.disabled=false; }
});

$('#postImageInput').addEventListener('change',e=>{
  postImageFile=e.target.files?.[0]||null;
  const preview=$('#postImagePreview');
  if(!postImageFile){ preview.classList.add('hidden'); preview.innerHTML=''; return; }
  if(postImageFile.size>10*1024*1024){ showToast('Post photo must be 10 MB or smaller.'); postImageFile=null; e.target.value=''; return; }
  preview.innerHTML=`<img alt="Selected post photo" src="${URL.createObjectURL(postImageFile)}">`; preview.classList.remove('hidden');
});

$('#publishButton').addEventListener('click',async()=>{
  const body=$('#postBody').value.trim(); const category=$('#postCategory').value; const msg=$('#postMessage'); const button=$('#publishButton');
  if(!body&&!postImageFile){ msg.textContent='Write something or add a photo.'; return; }
  button.disabled=true; msg.textContent='Posting…';
  try{
    let image_url=null;
    if(postImageFile){
      const path=`${currentUser.id}/${Date.now()}-${safeFileName(postImageFile.name)}`;
      const {error:uploadError}=await supabase.storage.from('kt-post-images').upload(path,postImageFile,{contentType:postImageFile.type||'image/jpeg',upsert:false}); if(uploadError) throw uploadError;
      image_url=supabase.storage.from('kt-post-images').getPublicUrl(path).data.publicUrl;
    }
    const {error}=await supabase.from('kt_posts').insert({user_id:currentUser.id,body,category,image_url,image_urls:image_url?[image_url]:[]}); if(error) throw error;
    $('#postBody').value=''; $('#postImageInput').value=''; postImageFile=null; $('#postImagePreview').innerHTML=''; $('#postImagePreview').classList.add('hidden'); msg.textContent=''; showToast('Posted to CircleUp.'); await loadFeed($('#searchInput').value.trim());
  }catch(err){ msg.textContent=err.message||'Could not publish your post.'; }
  finally{ button.disabled=false; }
});

async function loadFeed(search=''){
  const loading=$('#feedLoading'), empty=$('#feedEmpty'), feed=$('#feed'); loading.classList.remove('hidden'); empty.classList.add('hidden'); feed.innerHTML='';
  try{
    const {data:posts,error}=await supabase.from('kt_posts').select('*').order('created_at',{ascending:false}).limit(60); if(error) throw error;
    const postIds=(posts||[]).map(p=>p.id); const userIds=new Set((posts||[]).map(p=>p.user_id));
    let comments=[]; let likes=[];
    if(postIds.length){
      const [{data:c,error:ce},{data:l,error:le}]=await Promise.all([
        supabase.from('kt_comments').select('*').in('post_id',postIds).order('created_at',{ascending:true}),
        supabase.from('kt_likes').select('*').in('post_id',postIds)
      ]); if(ce)throw ce; if(le)throw le; comments=c||[]; likes=l||[]; comments.forEach(c=>userIds.add(c.user_id));
    }
    profileMap=new Map();
    if(userIds.size){ const {data:profiles,error:pe}=await supabase.from('kt_profiles').select('*').in('id',[...userIds]); if(pe)throw pe; (profiles||[]).forEach(p=>profileMap.set(p.id,p)); }
    commentsByPost=new Map(); comments.forEach(c=>{ if(!commentsByPost.has(c.post_id))commentsByPost.set(c.post_id,[]); commentsByPost.get(c.post_id).push(c); });
    likesByPost=new Map(); likes.forEach(l=>{ if(!likesByPost.has(l.post_id))likesByPost.set(l.post_id,[]); likesByPost.get(l.post_id).push(l); });
    feedRows=posts||[];
    const q=search.toLowerCase();
    const filtered=q?feedRows.filter(p=>{ const pr=profileMap.get(p.user_id)||{}; return [p.body,p.category,pr.full_name,pr.username].some(v=>String(v||'').toLowerCase().includes(q)); }):feedRows;
    renderFeed(filtered,feed);
    empty.classList.toggle('hidden',filtered.length>0); loading.classList.add('hidden');
    const summary=$('#searchSummary'); summary.classList.toggle('hidden',!q); if(q) summary.textContent=`${filtered.length} result${filtered.length===1?'':'s'} for “${search}”`;
  }catch(err){ loading.textContent=err.message||'Could not load posts.'; }
}

function renderFeed(posts,container){ container.innerHTML=''; posts.forEach(post=>container.appendChild(renderPost(post))); }
function renderPost(post){
  const profile=profileMap.get(post.user_id)||{full_name:'CircleUp Member',username:'member'};
  const likes=likesByPost.get(post.id)||[]; const comments=commentsByPost.get(post.id)||[]; const liked=likes.some(l=>l.user_id===currentUser.id);
  const card=document.createElement('article'); card.className='card post-card'; card.dataset.postId=post.id;
  const image=(post.image_urls?.[0]||post.image_url||'');
  card.innerHTML=`
    <div class="post-head"><button class="author-button" type="button"><span class="avatar author-avatar"></span><span class="author-copy"><span><strong>${escapeHtml(profile.full_name)}</strong><span class="category-chip">${escapeHtml(post.category||'General')}</span></span><p>${escapeHtml(timeAgo(post.created_at))} · @${escapeHtml(profile.username||'member')}</p></span></button></div>
    ${post.body?`<div class="post-body">${escapeHtml(post.body)}</div>`:''}
    ${image?`<img class="post-photo" src="${escapeHtml(image)}" alt="Post photo" loading="lazy">`:''}
    <div class="post-actions"><div class="action-group"><button class="post-action like-button ${liked?'liked':''}" type="button">♡ <span>${likes.length}</span></button><button class="post-action comments-button" type="button">◯ <span>${comments.length}</span></button></div><button class="post-action share-post-button" type="button">↗ Share</button></div>
    <div class="comments-wrap ${openComments.has(post.id)?'':'hidden'}"><div class="comments-list"></div><form class="comment-form"><input maxlength="500" placeholder="Write a comment…" aria-label="Write a comment"><button class="button primary small" type="submit">Send</button></form></div>`;
  setAvatar(card.querySelector('.author-avatar'),profile);
  card.querySelector('.author-button').addEventListener('click',()=>openMember(profile));
  card.querySelector('.like-button').addEventListener('click',()=>toggleLike(post.id,liked));
  card.querySelector('.comments-button').addEventListener('click',()=>{ if(openComments.has(post.id))openComments.delete(post.id); else openComments.add(post.id); card.querySelector('.comments-wrap').classList.toggle('hidden',!openComments.has(post.id)); renderComments(card,post.id); });
  card.querySelector('.share-post-button').addEventListener('click',()=>sharePost(post,profile));
  card.querySelector('.comment-form').addEventListener('submit',e=>submitComment(e,post.id));
  if(openComments.has(post.id)) renderComments(card,post.id);
  return card;
}

function renderComments(card,postId){
  const list=card.querySelector('.comments-list'); if(!list)return; const rows=commentsByPost.get(postId)||[];
  list.innerHTML=rows.length?'':'<p class="muted">No comments yet.</p>';
  rows.forEach(c=>{ const p=profileMap.get(c.user_id)||{full_name:'Member'}; const row=document.createElement('div'); row.className='comment'; row.innerHTML='<span class="avatar comment-avatar"></span><div class="comment-bubble"><strong></strong><p></p></div>'; setAvatar(row.querySelector('.comment-avatar'),p); row.querySelector('strong').textContent=p.full_name; row.querySelector('p').textContent=c.body; list.appendChild(row); });
}

async function submitComment(e,postId){ e.preventDefault(); const input=e.currentTarget.querySelector('input'); const body=input.value.trim(); if(!body)return; const button=e.currentTarget.querySelector('button'); button.disabled=true; try{ const {error}=await supabase.from('kt_comments').insert({post_id:postId,user_id:currentUser.id,body}); if(error)throw error; input.value=''; openComments.add(postId); await loadFeed($('#searchInput').value.trim()); }catch(err){showToast(err.message||'Could not add comment.')}finally{button.disabled=false;} }
async function toggleLike(postId,liked){ try{ const query=supabase.from('kt_likes'); const {error}=liked?await query.delete().eq('post_id',postId).eq('user_id',currentUser.id):await query.insert({post_id:postId,user_id:currentUser.id}); if(error)throw error; await loadFeed($('#searchInput').value.trim()); }catch(err){showToast(err.message||'Could not update like.')} }
async function sharePost(post,profile){ const text=`${profile.full_name} on CircleUp: ${post.body||'Photo post'}`; const url=location.href; try{ if(navigator.share) await navigator.share({title:'CircleUp',text,url}); else{await navigator.clipboard.writeText(`${text}\n${url}`); showToast('Post link copied.');} }catch(err){ if(err.name!=='AbortError')showToast('Could not share this post.'); } }

$('#shareAppButton').addEventListener('click',async()=>{ try{ if(navigator.share) await navigator.share({title:'CircleUp',text:'Join me on CircleUp',url:location.origin}); else{await navigator.clipboard.writeText(location.origin);showToast('CircleUp link copied.');} }catch(err){} });
$('#searchInput').addEventListener('input',e=>{ clearTimeout(searchTimer); searchTimer=setTimeout(()=>{ if(currentView!=='home')switchView('home'); else loadFeed(e.target.value.trim()); },250); });

async function loadOwnProfileStats(){
  const uid=currentUser.id;
  const [{count:posts},{count:followers},{count:following}]=await Promise.all([
    supabase.from('kt_posts').select('*',{count:'exact',head:true}).eq('user_id',uid),
    supabase.from('kt_follows').select('*',{count:'exact',head:true}).eq('following_id',uid),
    supabase.from('kt_follows').select('*',{count:'exact',head:true}).eq('follower_id',uid)
  ]);
  $('#profilePostCount').textContent=posts||0; $('#profileFollowerCount').textContent=followers||0; $('#profileFollowingCount').textContent=following||0;
}

async function loadOwnProfileView(){
  const {data,error}=await supabase.from('kt_profiles').select('*').eq('id',currentUser.id).single(); if(!error&&data)currentProfile=data; updateProfileUI(); await loadOwnProfileStats();
  const {data:posts,error:pe}=await supabase.from('kt_posts').select('*').eq('user_id',currentUser.id).order('created_at',{ascending:false});
  if(pe){showToast(pe.message);return;} const container=$('#profilePosts'); const empty=$('#profilePostsEmpty');
  if(!posts?.length){container.innerHTML='';empty.classList.remove('hidden');return;} empty.classList.add('hidden');
  if(!profileMap.size) await loadFeed($('#searchInput').value.trim());
  renderFeed(posts,container);
}

async function openMember(profile){
  if(!profile?.id)return; if(profile.id===currentUser.id){switchView('profile');return;}
  activeMember=profile; setAvatar($('#memberAvatar'),profile); $('#memberName').textContent=profile.full_name; $('#memberUsername').textContent=`@${profile.username}`; $('#memberBio').textContent=profile.bio||'No bio yet.';
  $('#memberLocation').textContent=profile.location||''; $('#memberLocation').classList.toggle('hidden',!profile.location);
  const [{count:posts},{count:followers},{count:following},{data:followRow}]=await Promise.all([
    supabase.from('kt_posts').select('*',{count:'exact',head:true}).eq('user_id',profile.id),
    supabase.from('kt_follows').select('*',{count:'exact',head:true}).eq('following_id',profile.id),
    supabase.from('kt_follows').select('*',{count:'exact',head:true}).eq('follower_id',profile.id),
    supabase.from('kt_follows').select('*').eq('follower_id',currentUser.id).eq('following_id',profile.id).maybeSingle()
  ]);
  $('#memberPostCount').textContent=posts||0; $('#memberFollowerCount').textContent=followers||0; $('#memberFollowingCount').textContent=following||0; $('#memberFollowButton').textContent=followRow?'Following':'Follow'; $('#memberFollowButton').dataset.following=followRow?'1':'0';
  $('#memberDialog').showModal();
}
$('#closeMemberDialog').addEventListener('click',()=>$('#memberDialog').close());
$('#memberFollowButton').addEventListener('click',async()=>{ if(!activeMember)return; const following=$('#memberFollowButton').dataset.following==='1'; const btn=$('#memberFollowButton');btn.disabled=true;try{ const {error}=following?await supabase.from('kt_follows').delete().eq('follower_id',currentUser.id).eq('following_id',activeMember.id):await supabase.from('kt_follows').insert({follower_id:currentUser.id,following_id:activeMember.id}); if(error)throw error; await openMember(activeMember); }catch(err){showToast(err.message||'Could not update follow.')}finally{btn.disabled=false;} });

async function loadGroups(){
  const loading=$('#groupsLoading'),empty=$('#groupsEmpty'),list=$('#groupsList');loading.classList.remove('hidden');empty.classList.add('hidden');list.innerHTML='';
  try{
    const {data:memberships,error}=await supabase.from('kt_group_members').select('group_id,role,joined_at').eq('user_id',currentUser.id).order('joined_at',{ascending:false}); if(error)throw error;
    const ids=(memberships||[]).map(m=>m.group_id); if(!ids.length){loading.classList.add('hidden');empty.classList.remove('hidden');return;}
    const {data:groups,error:ge}=await supabase.from('kt_groups').select('*').in('id',ids); if(ge)throw ge;
    const byId=new Map((groups||[]).map(g=>[g.id,g])); memberships.forEach(m=>{const g=byId.get(m.group_id);if(!g)return;const card=document.createElement('article');card.className='card group-card';card.innerHTML=`<h3>${escapeHtml(g.name)}</h3><p>${escapeHtml(m.role)} · Joined ${escapeHtml(new Date(m.joined_at).toLocaleDateString())}</p>`;list.appendChild(card);}); loading.classList.add('hidden'); empty.classList.toggle('hidden',list.children.length>0);
  }catch(err){loading.textContent=err.message||'Could not load groups.';}
}

async function loadUnreadActivityCount(){
  const {count}=await supabase.from('kt_notifications').select('*',{count:'exact',head:true}).eq('recipient_id',currentUser.id).is('read_at',null); const n=count||0; $('#activityBadge').textContent=n>99?'99+':n; $('#activityBadge').classList.toggle('hidden',!n);
}
async function loadActivity(){
  const loading=$('#activityLoading'),empty=$('#activityEmpty'),list=$('#activityList');loading.classList.remove('hidden');empty.classList.add('hidden');list.innerHTML='';
  try{
    const {data:rows,error}=await supabase.from('kt_notifications').select('*').eq('recipient_id',currentUser.id).order('created_at',{ascending:false}).limit(60);if(error)throw error;
    const actors=[...new Set((rows||[]).map(r=>r.actor_id))];const actorsMap=new Map();if(actors.length){const {data:p}=await supabase.from('kt_profiles').select('*').in('id',actors);(p||[]).forEach(x=>actorsMap.set(x.id,x));}
    (rows||[]).forEach(n=>{const p=actorsMap.get(n.actor_id)||{full_name:'A CircleUp member'};const card=document.createElement('article');card.className=`card activity-card ${n.read_at?'':'unread'}`;const verb=n.type==='like'?'liked your post':n.type==='comment'?'commented on your post':n.type==='follow'?'started following you':String(n.type||'interacted with you').replace(/_/g,' ');card.innerHTML='<span class="avatar activity-avatar"></span><div class="activity-copy"><p></p><small></small></div>';setAvatar(card.querySelector('.activity-avatar'),p);card.querySelector('p').innerHTML=`<strong>${escapeHtml(p.full_name)}</strong> ${escapeHtml(verb)}`;card.querySelector('small').textContent=timeAgo(n.created_at);list.appendChild(card);});
    loading.classList.add('hidden');empty.classList.toggle('hidden',(rows||[]).length>0);
    if(rows?.some(r=>!r.read_at)){await supabase.from('kt_notifications').update({read_at:new Date().toISOString()}).eq('recipient_id',currentUser.id).is('read_at',null);await loadUnreadActivityCount();}
  }catch(err){loading.textContent=err.message||'Could not load activity.';}
}
$('#refreshActivity').addEventListener('click',loadActivity);

init();
