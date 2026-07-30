import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let supabase;
let currentUser = null;
let currentProfile = null;
let authMode = 'signin';
let feedMode = 'all';
let selectedImage = null;
let feedState = { profiles: new Map(), posts: [], comments: [], likes: [], follows: [] };

const els = {
  toast: $('#toast'), authView: $('#authView'), appView: $('#appView'),
  topActions: $('#topActions'), authForm: $('#authForm'),
  email: $('#emailInput'), password: $('#passwordInput'),
  authButton: $('#emailAuthButton'), toggleMode: $('#toggleAuthMode'),
  google: $('#googleButton'), authMessage: $('#authMessage'),
  signOut: $('#signOutButton'), myName: $('#myName'),
  myUsername: $('#myUsername'), myAvatar: $('#myAvatar'),
  composerAvatar: $('#composerAvatar'), feed: $('#feed'),
  loading: $('#loadingFeed'), empty: $('#emptyFeed'),
  feedTitle: $('#feedTitle'), feedSubtitle: $('#feedSubtitle'),
  refresh: $('#refreshButton'), postDialog: $('#postDialog'),
  postForm: $('#postForm'), postBody: $('#postBody'),
  postImage: $('#postImage'), postMessage: $('#postMessage'),
  publish: $('#publishButton'), imagePreviewWrap: $('#imagePreviewWrap'),
  imagePreview: $('#imagePreview'), removeImage: $('#removeImageButton'),
  profileDialog: $('#profileDialog'), profileForm: $('#profileForm'),
  profileName: $('#profileName'), profileUsername: $('#profileUsername'),
  profileBio: $('#profileBio'), profileMessage: $('#profileMessage'),
  saveProfile: $('#saveProfileButton')
};

function initials(name = 'KT') {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'KT';
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 2800);
}

function setMessage(element, message = '', good = false) {
  element.textContent = message;
  element.classList.toggle('good', good);
}

function timeAgo(iso) {
  const date = new Date(iso);
  const seconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  const units = [['year',31536000],['month',2592000],['week',604800],['day',86400],['hour',3600],['minute',60]];
  for (const [unit,size] of units) {
    const amount = Math.floor(seconds / size);
    if (amount >= 1) return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-amount, unit);
  }
  return 'just now';
}

async function init() {
  try {
    const response = await fetch('/api/config', { cache: 'no-store' });
    const config = await response.json();

    if (!response.ok) {
      throw new Error(config.error || 'Unable to load the Supabase connection.');
    }

    if (!config.url || !config.key) {
      throw new Error('The Supabase publishable key has not been added in Vercel yet.');
    }

    supabase = createClient(config.url, config.key, {
      auth: { persistSession: true, detectSessionInUrl: true, autoRefreshToken: true }
    });
    bindEvents();
    const { data: { session } } = await supabase.auth.getSession();
    await handleSession(session);
    supabase.auth.onAuthStateChange(async (_event, session) => handleSession(session));
  } catch (error) {
    document.body.innerHTML = `<main style="font-family:Arial,sans-serif;max-width:680px;margin:70px auto;padding:24px">
      <h1>Khmer Together setup is not finished</h1>
      <p>${String(error.message || error)}</p>
      <p>Add <strong>SUPABASE_PUBLISHABLE_KEY</strong> in the Vercel Environment Variables, then redeploy.</p>
    </main>`;
  }
}

function bindEvents() {
  els.authForm.addEventListener('submit', handleEmailAuth);
  els.toggleMode.addEventListener('click', toggleAuthMode);
  els.google.addEventListener('click', signInWithGoogle);
  els.signOut.addEventListener('click', () => supabase.auth.signOut());
  els.refresh.addEventListener('click', loadFeed);
  $('#newPostTop').addEventListener('click', openComposer);
  $('#openComposerButton').addEventListener('click', openComposer);
  $('#emptyCreatePost').addEventListener('click', openComposer);
  $('#editProfileButton').addEventListener('click', openProfile);
  els.postForm.addEventListener('submit', createPost);
  els.profileForm.addEventListener('submit', saveProfile);
  els.postImage.addEventListener('change', previewImage);
  els.removeImage.addEventListener('click', clearSelectedImage);

  $$('[data-feed]').forEach(button => {
    button.addEventListener('click', () => {
      feedMode = button.dataset.feed;
      $$('[data-feed]').forEach(item => item.classList.toggle('active', item === button));
      els.feedTitle.textContent = feedMode === 'all' ? 'Community feed' : 'Following';
      els.feedSubtitle.textContent = feedMode === 'all'
        ? 'Latest posts from Khmer Together members.'
        : 'Posts from people you follow.';
      renderFeed();
    });
  });
}

async function handleSession(session) {
  currentUser = session?.user || null;
  if (!currentUser) {
    currentProfile = null;
    els.authView.classList.remove('hidden');
    els.appView.classList.add('hidden');
    els.topActions.classList.add('hidden');
    return;
  }
  els.authView.classList.add('hidden');
  els.appView.classList.remove('hidden');
  els.topActions.classList.remove('hidden');
  await ensureProfile();
  updateMyProfileUI();
  await loadFeed();
}

async function ensureProfile() {
  const { data, error } = await supabase.from('kt_profiles').select('*').eq('id', currentUser.id).maybeSingle();
  if (error) throw error;
  if (data) { currentProfile = data; return; }

  const base = (currentUser.email?.split('@')[0] || 'member').replace(/[^a-zA-Z0-9_]/g,'').slice(0,18) || 'member';
  const username = `${base}_${currentUser.id.replaceAll('-','').slice(0,5)}`;
  const fullName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || 'Khmer Together Member';

  const result = await supabase.from('kt_profiles')
    .insert({ id: currentUser.id, full_name: fullName, username })
    .select('*').single();
  if (result.error) throw result.error;
  currentProfile = result.data;
}

function updateMyProfileUI() {
  const name = currentProfile?.full_name || 'Khmer Together Member';
  const username = currentProfile?.username || 'member';
  els.myName.textContent = name;
  els.myUsername.textContent = `@${username}`;
  els.myAvatar.textContent = initials(name);
  els.composerAvatar.textContent = initials(name);
  els.profileName.value = name;
  els.profileUsername.value = username;
  els.profileBio.value = currentProfile?.bio || '';
}

async function handleEmailAuth(event) {
  event.preventDefault();
  setMessage(els.authMessage);
  els.authButton.disabled = true;
  try {
    const email = els.email.value.trim();
    const password = els.password.value;
    if (authMode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } else {
      const { data, error } = await supabase.auth.signUp({
        email, password, options: { emailRedirectTo: location.origin }
      });
      if (error) throw error;
      if (!data.session) setMessage(els.authMessage, 'Check your email and confirm your new account.', true);
    }
  } catch (error) {
    setMessage(els.authMessage, error.message || 'Unable to continue.');
  } finally {
    els.authButton.disabled = false;
  }
}

function toggleAuthMode() {
  authMode = authMode === 'signin' ? 'signup' : 'signin';
  els.authButton.textContent = authMode === 'signin' ? 'Sign in' : 'Create account';
  els.toggleMode.textContent = authMode === 'signin'
    ? 'New here? Create an account'
    : 'Already have an account? Sign in';
  els.password.autocomplete = authMode === 'signin' ? 'current-password' : 'new-password';
  setMessage(els.authMessage);
}

async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google', options: { redirectTo: location.origin }
  });
  if (error) setMessage(els.authMessage, error.message);
}

function openComposer() { setMessage(els.postMessage); els.postDialog.showModal(); setTimeout(() => els.postBody.focus(), 50); }
function openProfile() { updateMyProfileUI(); setMessage(els.profileMessage); els.profileDialog.showModal(); }

function previewImage() {
  const file = els.postImage.files?.[0];
  if (!file) return clearSelectedImage();
  if (file.size > 8*1024*1024) {
    els.postImage.value = '';
    return setMessage(els.postMessage, 'The photo must be 8 MB or smaller.');
  }
  selectedImage = file;
  els.imagePreview.src = URL.createObjectURL(file);
  els.imagePreviewWrap.classList.remove('hidden');
}

function clearSelectedImage() {
  if (els.imagePreview.src) URL.revokeObjectURL(els.imagePreview.src);
  selectedImage = null;
  els.postImage.value = '';
  els.imagePreview.removeAttribute('src');
  els.imagePreviewWrap.classList.add('hidden');
}

async function createPost(event) {
  event.preventDefault();
  const body = els.postBody.value.trim();
  if (!body && !selectedImage) return setMessage(els.postMessage, 'Write a message or add a photo.');

  els.publish.disabled = true;
  els.publish.textContent = 'Publishing…';
  setMessage(els.postMessage);

  try {
    let imageUrl = null;
    if (selectedImage) {
      const extension = selectedImage.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${currentUser.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('kt-post-images').upload(path, selectedImage, { cacheControl:'3600', upsert:false });
      if (uploadError) throw uploadError;
      imageUrl = supabase.storage.from('kt-post-images').getPublicUrl(path).data.publicUrl;
    }

    const { error } = await supabase.from('kt_posts').insert({
      user_id: currentUser.id, body, image_url: imageUrl
    });
    if (error) throw error;

    els.postBody.value = '';
    clearSelectedImage();
    els.postDialog.close();
    showToast('Your post was published.');
    await loadFeed();
  } catch (error) {
    setMessage(els.postMessage, error.message || 'Unable to publish this post.');
  } finally {
    els.publish.disabled = false;
    els.publish.textContent = 'Publish post';
  }
}

async function saveProfile(event) {
  event.preventDefault();
  els.saveProfile.disabled = true;
  setMessage(els.profileMessage);
  try {
    const fullName = els.profileName.value.trim();
    const username = els.profileUsername.value.trim().toLowerCase();
    const bio = els.profileBio.value.trim();
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) throw new Error('Username must contain 3–30 letters, numbers, or underscores.');

    const { data, error } = await supabase.from('kt_profiles')
      .update({ full_name:fullName, username, bio, updated_at:new Date().toISOString() })
      .eq('id', currentUser.id).select('*').single();
    if (error) throw error;
    currentProfile = data;
    updateMyProfileUI();
    els.profileDialog.close();
    showToast('Profile updated.');
    await loadFeed();
  } catch (error) {
    setMessage(els.profileMessage, error.message || 'Unable to update profile.');
  } finally {
    els.saveProfile.disabled = false;
  }
}

async function loadFeed() {
  if (!currentUser) return;
  els.loading.classList.remove('hidden');
  els.empty.classList.add('hidden');
  els.feed.innerHTML = '';
  try {
    const [postsResult, commentsResult, likesResult, followsResult, profilesResult] = await Promise.all([
      supabase.from('kt_posts').select('*').order('created_at',{ascending:false}).limit(60),
      supabase.from('kt_comments').select('*').order('created_at',{ascending:true}).limit(500),
      supabase.from('kt_likes').select('*').limit(2000),
      supabase.from('kt_follows').select('*').limit(2000),
      supabase.from('kt_profiles').select('*').limit(1000)
    ]);
    for (const result of [postsResult, commentsResult, likesResult, followsResult, profilesResult]) {
      if (result.error) throw result.error;
    }

    feedState = {
      posts: postsResult.data || [],
      comments: commentsResult.data || [],
      likes: likesResult.data || [],
      follows: followsResult.data || [],
      profiles: new Map((profilesResult.data || []).map(profile => [profile.id, profile]))
    };
    renderFeed();
  } catch (error) {
    els.feed.innerHTML = `<section class="card loading-card">Unable to load the feed: ${String(error.message || error)}</section>`;
  } finally {
    els.loading.classList.add('hidden');
  }
}

function renderFeed() {
  els.feed.innerHTML = '';
  const followingIds = new Set(feedState.follows.filter(f => f.follower_id === currentUser.id).map(f => f.following_id));
  followingIds.add(currentUser.id);
  const posts = feedMode === 'following'
    ? feedState.posts.filter(post => followingIds.has(post.user_id))
    : feedState.posts;
  els.empty.classList.toggle('hidden', posts.length > 0);
  for (const post of posts) els.feed.appendChild(renderPost(post, followingIds));
}

function renderPost(post, followingIds) {
  const node = $('#postTemplate').content.firstElementChild.cloneNode(true);
  const profile = feedState.profiles.get(post.user_id) || { full_name:'Khmer Together Member', username:'member' };
  const postComments = feedState.comments.filter(c => c.post_id === post.id);
  const postLikes = feedState.likes.filter(l => l.post_id === post.id);
  const liked = postLikes.some(l => l.user_id === currentUser.id);
  const isMine = post.user_id === currentUser.id;
  const following = followingIds.has(post.user_id);

  $('.post-avatar',node).textContent = initials(profile.full_name);
  $('.post-name',node).textContent = profile.full_name;
  $('.post-username',node).textContent = `@${profile.username}`;
  $('.post-time',node).textContent = timeAgo(post.created_at);
  $('.post-time',node).dateTime = post.created_at;
  $('.post-body',node).textContent = post.body || '';
  $('.post-body',node).classList.toggle('hidden', !post.body);

  const image = $('.post-image',node);
  if (post.image_url) { image.src = post.image_url; image.classList.remove('hidden'); }

  $('.like-count',node).textContent = `${postLikes.length} ${postLikes.length === 1 ? 'like':'likes'}`;
  $('.comment-count',node).textContent = `${postComments.length} ${postComments.length === 1 ? 'comment':'comments'}`;

  const likeButton = $('.like-button',node);
  likeButton.classList.toggle('liked',liked);
  likeButton.querySelector('span').textContent = liked ? '♥':'♡';
  likeButton.addEventListener('click', () => toggleLike(post.id,liked));

  const followButton = $('.follow-button',node);
  followButton.classList.toggle('hidden',isMine);
  followButton.textContent = following ? 'Following':'Follow';
  followButton.addEventListener('click', () => toggleFollow(post.user_id,following));

  const deleteButton = $('.delete-post',node);
  deleteButton.classList.toggle('hidden',!isMine);
  deleteButton.addEventListener('click', () => deletePost(post.id));

  const commentsWrap = $('.comments',node);
  for (const comment of postComments.slice(-6)) commentsWrap.appendChild(renderComment(comment));

  const commentInput = $('.comment-input',node);
  $('.comment-focus',node).addEventListener('click', () => commentInput.focus());
  $('.comment-avatar',node).textContent = initials(currentProfile.full_name);
  $('.comment-form',node).addEventListener('submit', event => {
    event.preventDefault();
    createComment(post.id,commentInput);
  });

  return node;
}

function renderComment(comment) {
  const profile = feedState.profiles.get(comment.user_id) || { full_name:'Khmer Together Member' };
  const wrap = document.createElement('div');
  wrap.className = 'comment';

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.style.width = '32px'; avatar.style.height = '32px'; avatar.style.fontSize = '11px';
  avatar.textContent = initials(profile.full_name);

  const bubble = document.createElement('div');
  bubble.className = 'comment-bubble';
  const strong = document.createElement('strong');
  strong.textContent = profile.full_name;
  const body = document.createElement('span');
  body.textContent = comment.body;
  bubble.append(strong,body);
  wrap.append(avatar,bubble);
  return wrap;
}

async function toggleLike(postId,liked) {
  try {
    const query = liked
      ? supabase.from('kt_likes').delete().eq('post_id',postId).eq('user_id',currentUser.id)
      : supabase.from('kt_likes').insert({post_id:postId,user_id:currentUser.id});
    const {error} = await query;
    if (error) throw error;
    await loadFeed();
  } catch (error) { showToast(error.message || 'Unable to update like.'); }
}

async function toggleFollow(userId,following) {
  try {
    const query = following
      ? supabase.from('kt_follows').delete().eq('follower_id',currentUser.id).eq('following_id',userId)
      : supabase.from('kt_follows').insert({follower_id:currentUser.id,following_id:userId});
    const {error} = await query;
    if (error) throw error;
    showToast(following ? 'Unfollowed.' : 'You are now following this member.');
    await loadFeed();
  } catch (error) { showToast(error.message || 'Unable to update follow.'); }
}

async function createComment(postId,input) {
  const body = input.value.trim();
  if (!body) return;
  input.disabled = true;
  try {
    const {error} = await supabase.from('kt_comments').insert({
      post_id:postId,user_id:currentUser.id,body
    });
    if (error) throw error;
    input.value = '';
    await loadFeed();
  } catch (error) { showToast(error.message || 'Unable to add comment.'); }
  finally { input.disabled = false; }
}

async function deletePost(postId) {
  if (!confirm('Delete this post? This cannot be undone.')) return;
  try {
    const {error} = await supabase.from('kt_posts').delete().eq('id',postId);
    if (error) throw error;
    showToast('Post deleted.');
    await loadFeed();
  } catch (error) { showToast(error.message || 'Unable to delete post.'); }
}

init();
