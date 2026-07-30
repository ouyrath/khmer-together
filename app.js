import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let supabase;
let currentUser = null;
let currentProfile = null;
let authMode = 'signin';
let feedMode = 'all';
let selectedImage = null;
let selectedProfileImage = null;
let removeProfileImageRequested = false;
let reportingPostId = null;
let isAdmin = false;
let adminReports = [];
const recentCommentSubmissions = new Map();
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
  saveProfile: $('#saveProfileButton'),
  profilePhotoInput: $('#profilePhotoInput'),
  profilePhotoPreview: $('#profilePhotoPreview'),
  removeProfilePhoto: $('#removeProfilePhotoButton'),
  reportDialog: $('#reportDialog'), reportForm: $('#reportForm'),
  reportReason: $('#reportReason'), reportDetails: $('#reportDetails'),
  reportMessage: $('#reportMessage'), submitReport: $('#submitReportButton'),
  composerCard: $('#composerCard'), feedHeading: $('#feedHeading'),
  adminReportsNav: $('#adminReportsNav'), adminReportsView: $('#adminReportsView'),
  adminReportsList: $('#adminReportsList'), adminReportsLoading: $('#adminReportsLoading'),
  adminReportsEmpty: $('#adminReportsEmpty'), adminStatusFilter: $('#adminStatusFilter'),
  adminRefreshButton: $('#adminRefreshButton'), adminSummary: $('#adminSummary')
};

function initials(name = 'KT') {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'KT';
}

function setAvatar(element, profile = {}) {
  if (!element) return;
  const name = profile.full_name || 'Khmer Together Member';
  const url = profile.avatar_url || '';
  element.textContent = url ? '' : initials(name);
  element.style.backgroundImage = url ? `url(${JSON.stringify(url)})` : '';
  element.classList.toggle('has-image', Boolean(url));
}

function storagePathFromPublicUrl(url, bucket) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = url.indexOf(marker);
  if (index < 0) return null;
  return decodeURIComponent(url.slice(index + marker.length).split('?')[0]);
}

function resetProfilePhotoEditor() {
  selectedProfileImage = null;
  removeProfileImageRequested = false;
  els.profilePhotoInput.value = '';
  setAvatar(els.profilePhotoPreview, currentProfile || {});
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
  els.profilePhotoInput.addEventListener('change', previewProfilePhoto);
  els.removeProfilePhoto.addEventListener('click', removeProfilePhotoPreview);
  els.reportForm.addEventListener('submit', submitPostReport);
  els.adminStatusFilter.addEventListener('change', renderAdminReports);
  els.adminRefreshButton.addEventListener('click', loadAdminReports);
  $$('.close-button').forEach(button => {
    button.addEventListener('click', () => button.closest('dialog')?.close());
  });

  document.addEventListener('click', () => {
    closeCommentMenus();
  });

  $$('[data-feed]').forEach(button => {
    button.addEventListener('click', () => switchView(button.dataset.feed));
  });
}

async function handleSession(session) {
  currentUser = session?.user || null;
  if (!currentUser) {
    currentProfile = null;
    isAdmin = false;
    adminReports = [];
    els.adminReportsNav.classList.add('hidden');
    els.authView.classList.remove('hidden');
    els.appView.classList.add('hidden');
    els.topActions.classList.add('hidden');
    return;
  }
  els.authView.classList.add('hidden');
  els.appView.classList.remove('hidden');
  els.topActions.classList.remove('hidden');
  await ensureProfile();
  await checkAdminAccess();
  updateMyProfileUI();
  switchView('all', false);
  await loadFeed();
}

async function checkAdminAccess() {
  const { data, error } = await supabase
    .from('kt_admins')
    .select('user_id')
    .eq('user_id', currentUser.id)
    .maybeSingle();

  if (error) throw error;
  isAdmin = Boolean(data);
  els.adminReportsNav.classList.toggle('hidden', !isAdmin);
}

function switchView(mode, load = true) {
  if (mode === 'admin' && !isAdmin) return;

  feedMode = mode;
  $$('[data-feed]').forEach(item => item.classList.toggle('active', item.dataset.feed === mode));

  const adminMode = mode === 'admin';
  els.composerCard.classList.toggle('hidden', adminMode);
  els.feedHeading.classList.toggle('hidden', adminMode);
  els.feed.classList.toggle('hidden', adminMode);
  els.adminReportsView.classList.toggle('hidden', !adminMode);

  if (adminMode) {
    els.loading.classList.add('hidden');
    els.empty.classList.add('hidden');
    if (load) loadAdminReports();
    return;
  }

  els.feedTitle.textContent = mode === 'all' ? 'Community feed' : 'Following';
  els.feedSubtitle.textContent = mode === 'all'
    ? 'Latest posts from Khmer Together members.'
    : 'Posts from people you follow.';
  renderFeed();
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
  setAvatar(els.myAvatar, currentProfile || { full_name: name });
  setAvatar(els.composerAvatar, currentProfile || { full_name: name });
  els.profileName.value = name;
  els.profileUsername.value = username;
  els.profileBio.value = currentProfile?.bio || '';
  resetProfilePhotoEditor();
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

function previewProfilePhoto() {
  const file = els.profilePhotoInput.files?.[0];
  if (!file) return resetProfilePhotoEditor();
  if (file.size > 5 * 1024 * 1024) {
    els.profilePhotoInput.value = '';
    return setMessage(els.profileMessage, 'The profile picture must be 5 MB or smaller.');
  }
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
    els.profilePhotoInput.value = '';
    return setMessage(els.profileMessage, 'Please choose a JPG, PNG, or WebP picture.');
  }
  selectedProfileImage = file;
  removeProfileImageRequested = false;
  const previewUrl = URL.createObjectURL(file);
  setAvatar(els.profilePhotoPreview, { full_name: els.profileName.value || currentProfile?.full_name, avatar_url: previewUrl });
  setTimeout(() => URL.revokeObjectURL(previewUrl), 60000);
  setMessage(els.profileMessage);
}

function removeProfilePhotoPreview() {
  selectedProfileImage = null;
  removeProfileImageRequested = true;
  els.profilePhotoInput.value = '';
  setAvatar(els.profilePhotoPreview, { full_name: els.profileName.value || currentProfile?.full_name, avatar_url: null });
  setMessage(els.profileMessage, 'The picture will be removed after you tap Save profile.', true);
}

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
  els.saveProfile.textContent = 'Saving…';
  setMessage(els.profileMessage);

  const oldAvatarUrl = currentProfile?.avatar_url || null;
  let newAvatarUrl = removeProfileImageRequested ? null : oldAvatarUrl;

  try {
    const fullName = els.profileName.value.trim();
    const username = els.profileUsername.value.trim().toLowerCase();
    const bio = els.profileBio.value.trim();
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      throw new Error('Username must contain 3–30 letters, numbers, or underscores.');
    }

    if (selectedProfileImage) {
      const extension = selectedProfileImage.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${currentUser.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('kt-profile-images')
        .upload(path, selectedProfileImage, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;
      newAvatarUrl = supabase.storage.from('kt-profile-images').getPublicUrl(path).data.publicUrl;
    }

    const { data, error } = await supabase.from('kt_profiles')
      .update({
        full_name: fullName,
        username,
        bio,
        avatar_url: newAvatarUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentUser.id)
      .select('*')
      .single();
    if (error) throw error;

    currentProfile = data;

    if (oldAvatarUrl && oldAvatarUrl !== newAvatarUrl) {
      const oldPath = storagePathFromPublicUrl(oldAvatarUrl, 'kt-profile-images');
      if (oldPath) await supabase.storage.from('kt-profile-images').remove([oldPath]);
    }

    updateMyProfileUI();
    els.profileDialog.close();
    showToast('Profile updated.');
    await loadFeed();
  } catch (error) {
    setMessage(els.profileMessage, error.message || 'Unable to update profile.');
  } finally {
    els.saveProfile.disabled = false;
    els.saveProfile.textContent = 'Save profile';
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
  if (feedMode === 'admin') return;
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

  setAvatar($('.post-avatar',node), profile);
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
  deleteButton.addEventListener('click', () => deletePost(post));

  const reportButton = $('.report-post',node);
  reportButton.classList.toggle('hidden',isMine);
  reportButton.addEventListener('click', () => openReportDialog(post.id));

  const commentsWrap = $('.comments',node);
  for (const comment of postComments.slice(-6)) commentsWrap.appendChild(renderComment(comment));

  const commentInput = $('.comment-input',node);
  const commentForm = $('.comment-form',node);
  $('.comment-focus',node).addEventListener('click', () => commentInput.focus());
  setAvatar($('.comment-avatar',node), currentProfile);
  commentForm.addEventListener('submit', event => {
    event.preventDefault();
    createComment(post.id, commentInput, commentForm);
  });

  return node;
}

function closeCommentMenus(exceptMenu = null) {
  $$('.comment-menu.open').forEach(menu => {
    if (menu === exceptMenu) return;
    menu.classList.remove('open');
    const bubble = menu.closest('.comment-content')?.querySelector('.comment-bubble-owner');
    bubble?.setAttribute('aria-expanded', 'false');
  });
}

function renderComment(comment) {
  const profile = feedState.profiles.get(comment.user_id) || { full_name:'Khmer Together Member' };
  const wrap = document.createElement('div');
  wrap.className = 'comment';

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.style.width = '32px';
  avatar.style.height = '32px';
  avatar.style.fontSize = '11px';
  setAvatar(avatar, profile);

  const content = document.createElement('div');
  content.className = 'comment-content';

  const bubble = document.createElement('div');
  bubble.className = 'comment-bubble';

  const strong = document.createElement('strong');
  strong.textContent = profile.full_name;

  const body = document.createElement('span');
  body.className = 'comment-body';
  body.textContent = comment.body;

  bubble.append(strong, body);

  const createdAt = new Date(comment.created_at || 0).getTime();
  const updatedAt = new Date(comment.updated_at || comment.created_at || 0).getTime();
  if (updatedAt - createdAt > 1000) {
    const edited = document.createElement('small');
    edited.className = 'comment-edited-label';
    edited.textContent = 'Edited';
    bubble.appendChild(edited);
  }

  content.appendChild(bubble);
  wrap.append(avatar, content);

  if (comment.user_id === currentUser.id) {
    bubble.classList.add('comment-bubble-owner');
    bubble.setAttribute('role', 'button');
    bubble.setAttribute('tabindex', '0');
    bubble.setAttribute('aria-haspopup', 'menu');
    bubble.setAttribute('aria-expanded', 'false');
    bubble.setAttribute('aria-label', 'Open options for your comment');

    const menu = document.createElement('div');
    menu.className = 'comment-menu comment-bubble-menu';
    menu.setAttribute('role', 'menu');

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'comment-menu-item';
    editButton.setAttribute('role', 'menuitem');
    editButton.textContent = 'Edit comment';
    editButton.addEventListener('click', event => {
      event.stopPropagation();
      menu.classList.remove('open');
      bubble.setAttribute('aria-expanded', 'false');
      beginEditComment(comment, content, bubble);
    });

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'comment-menu-item danger';
    deleteButton.setAttribute('role', 'menuitem');
    deleteButton.textContent = 'Delete comment';
    deleteButton.addEventListener('click', event => {
      event.stopPropagation();
      menu.classList.remove('open');
      bubble.setAttribute('aria-expanded', 'false');
      deleteComment(comment);
    });

    menu.append(editButton, deleteButton);
    content.appendChild(menu);

    const toggleMenu = event => {
      event.stopPropagation();
      const opening = !menu.classList.contains('open');
      closeCommentMenus(menu);
      menu.classList.toggle('open', opening);
      bubble.setAttribute('aria-expanded', String(opening));

      if (opening) {
        setTimeout(() => editButton.focus(), 0);
      }
    };

    bubble.addEventListener('click', toggleMenu);
    bubble.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleMenu(event);
      } else if (event.key === 'Escape') {
        menu.classList.remove('open');
        bubble.setAttribute('aria-expanded', 'false');
        bubble.focus();
      }
    });

    menu.addEventListener('click', event => event.stopPropagation());
    menu.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        menu.classList.remove('open');
        bubble.setAttribute('aria-expanded', 'false');
        bubble.focus();
      }
    });
  }

  return wrap;
}

function beginEditComment(comment, content, bubble) {
  if (content.querySelector('.comment-edit-form')) return;

  bubble.classList.add('hidden');

  const form = document.createElement('form');
  form.className = 'comment-edit-form';

  const input = document.createElement('textarea');
  input.className = 'comment-edit-input';
  input.maxLength = 500;
  input.rows = 2;
  input.required = true;
  input.value = comment.body;

  const actions = document.createElement('div');
  actions.className = 'comment-edit-actions';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'comment-edit-cancel';
  cancelButton.textContent = 'Cancel';

  const saveButton = document.createElement('button');
  saveButton.type = 'submit';
  saveButton.className = 'comment-edit-save';
  saveButton.textContent = 'Save';

  actions.append(cancelButton, saveButton);
  form.append(input, actions);
  content.appendChild(form);

  cancelButton.addEventListener('click', () => {
    form.remove();
    bubble.classList.remove('hidden');
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const newBody = input.value.trim();

    if (!newBody) {
      showToast('Comment cannot be empty.');
      return;
    }

    if (newBody === comment.body) {
      form.remove();
      bubble.classList.remove('hidden');
      return;
    }

    input.disabled = true;
    saveButton.disabled = true;
    saveButton.textContent = 'Saving…';

    try {
      const { error } = await supabase
        .from('kt_comments')
        .update({ body: newBody })
        .eq('id', comment.id)
        .eq('user_id', currentUser.id);
      if (error) throw error;

      showToast('Comment updated.');
      await loadFeed();
    } catch (error) {
      input.disabled = false;
      saveButton.disabled = false;
      saveButton.textContent = 'Save';
      showToast(error.message || 'Unable to update the comment.');
    }
  });

  setTimeout(() => {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, 0);
}

async function deleteComment(comment) {
  if (!confirm('Delete your comment?')) return;

  try {
    const { error } = await supabase
      .from('kt_comments')
      .delete()
      .eq('id', comment.id)
      .eq('user_id', currentUser.id);
    if (error) throw error;

    showToast('Comment deleted.');
    await loadFeed();
  } catch (error) {
    showToast(error.message || 'Unable to delete the comment.');
  }
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

async function createComment(postId, input, form) {
  const body = input.value.trim();
  if (!body || form.dataset.submitting === 'true') return;

  const submissionKey = `${postId}:${body.toLocaleLowerCase()}`;
  const lastSubmission = recentCommentSubmissions.get(submissionKey) || 0;
  if (Date.now() - lastSubmission < 8000) {
    showToast('That comment is already being posted.');
    return;
  }

  const submitButton = $('.comment-submit', form);
  form.dataset.submitting = 'true';
  form.classList.add('submitting');
  input.disabled = true;
  submitButton.disabled = true;
  recentCommentSubmissions.set(submissionKey, Date.now());

  try {
    const { error } = await supabase.from('kt_comments').insert({
      post_id: postId,
      user_id: currentUser.id,
      body
    });
    if (error) throw error;
    input.value = '';
    await loadFeed();
  } catch (error) {
    recentCommentSubmissions.delete(submissionKey);
    showToast(error.message || 'Unable to add comment.');
  } finally {
    form.dataset.submitting = 'false';
    form.classList.remove('submitting');
    input.disabled = false;
    submitButton.disabled = false;
  }
}

async function deletePost(post) {
  if (!confirm('Delete this post? This cannot be undone.')) return;
  try {
    const { error } = await supabase.from('kt_posts').delete().eq('id', post.id);
    if (error) throw error;

    if (post.image_url) {
      const path = storagePathFromPublicUrl(post.image_url, 'kt-post-images');
      if (path) await supabase.storage.from('kt-post-images').remove([path]);
    }

    showToast('Post deleted.');
    await loadFeed();
  } catch (error) {
    showToast(error.message || 'Unable to delete post.');
  }
}

function openReportDialog(postId) {
  reportingPostId = postId;
  els.reportReason.value = '';
  els.reportDetails.value = '';
  setMessage(els.reportMessage);
  els.reportDialog.showModal();
}

async function submitPostReport(event) {
  event.preventDefault();
  if (!reportingPostId) return;

  const reason = els.reportReason.value;
  const details = els.reportDetails.value.trim();
  if (!reason) return setMessage(els.reportMessage, 'Please select a reason.');

  els.submitReport.disabled = true;
  els.submitReport.textContent = 'Submitting…';
  setMessage(els.reportMessage);

  try {
    const { error } = await supabase.from('kt_reports').insert({
      post_id: reportingPostId,
      reporter_id: currentUser.id,
      reason,
      details
    });
    if (error) {
      if (error.code === '23505') throw new Error('You already reported this post.');
      throw error;
    }

    els.reportDialog.close();
    reportingPostId = null;
    showToast('Report submitted privately.');
  } catch (error) {
    setMessage(els.reportMessage, error.message || 'Unable to submit the report.');
  } finally {
    els.submitReport.disabled = false;
    els.submitReport.textContent = 'Submit report';
  }
}


const REPORT_REASON_LABELS = {
  spam_scam: 'Spam or scam',
  harassment: 'Harassment or bullying',
  hate: 'Hate or dangerous content',
  inappropriate: 'Inappropriate content',
  other: 'Other'
};

async function loadAdminReports() {
  if (!isAdmin) return;

  els.adminReportsLoading.classList.remove('hidden');
  els.adminReportsEmpty.classList.add('hidden');
  els.adminReportsList.innerHTML = '';
  els.adminRefreshButton.disabled = true;

  try {
    const { data: reports, error: reportsError } = await supabase
      .from('kt_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (reportsError) throw reportsError;

    const postIds = [...new Set((reports || []).map(report => report.post_id).filter(Boolean))];
    let posts = [];
    if (postIds.length) {
      const { data, error } = await supabase.from('kt_posts').select('*').in('id', postIds);
      if (error) throw error;
      posts = data || [];
    }

    const userIds = [...new Set([
      ...(reports || []).map(report => report.reporter_id),
      ...posts.map(post => post.user_id)
    ].filter(Boolean))];
    let profiles = [];
    if (userIds.length) {
      const { data, error } = await supabase.from('kt_profiles').select('*').in('id', userIds);
      if (error) throw error;
      profiles = data || [];
    }

    const postMap = new Map(posts.map(post => [post.id, post]));
    const profileMap = new Map(profiles.map(profile => [profile.id, profile]));

    adminReports = (reports || []).map(report => {
      const post = postMap.get(report.post_id) || null;
      return {
        ...report,
        post,
        reporter: profileMap.get(report.reporter_id) || null,
        author: post ? profileMap.get(post.user_id) || null : null
      };
    });

    renderAdminReports();
  } catch (error) {
    els.adminReportsList.innerHTML = '';
    const message = document.createElement('section');
    message.className = 'card admin-error';
    message.textContent = `Unable to load reports: ${error.message || error}`;
    els.adminReportsList.appendChild(message);
  } finally {
    els.adminReportsLoading.classList.add('hidden');
    els.adminRefreshButton.disabled = false;
  }
}

function renderAdminReports() {
  if (!isAdmin) return;

  const filter = els.adminStatusFilter.value;
  const visible = filter === 'all'
    ? adminReports
    : adminReports.filter(report => report.status === filter);

  const openCount = adminReports.filter(report => report.status === 'open').length;
  const reviewingCount = adminReports.filter(report => report.status === 'reviewing').length;
  els.adminSummary.textContent = `${openCount} open · ${reviewingCount} reviewing · ${adminReports.length} total`;
  els.adminReportsList.innerHTML = '';
  els.adminReportsEmpty.classList.toggle('hidden', visible.length > 0);

  for (const report of visible) {
    els.adminReportsList.appendChild(renderAdminReportCard(report));
  }
}

function renderAdminReportCard(report) {
  const card = document.createElement('article');
  card.className = 'card admin-report-card';

  const header = document.createElement('header');
  header.className = 'admin-report-header';

  const titleWrap = document.createElement('div');
  const reason = document.createElement('strong');
  reason.textContent = REPORT_REASON_LABELS[report.reason] || report.reason;
  const meta = document.createElement('span');
  meta.textContent = `${timeAgo(report.created_at)} · Reported by ${report.reporter?.full_name || 'Member'} (@${report.reporter?.username || 'member'})`;
  titleWrap.append(reason, meta);

  const status = document.createElement('span');
  status.className = `report-status status-${report.status}`;
  status.textContent = report.status;
  header.append(titleWrap, status);
  card.appendChild(header);

  if (report.details) {
    const details = document.createElement('p');
    details.className = 'admin-report-details';
    details.textContent = report.details;
    card.appendChild(details);
  }

  const postBox = document.createElement('section');
  postBox.className = 'reported-post-preview';
  const postLabel = document.createElement('small');
  postLabel.textContent = report.author
    ? `Reported post by ${report.author.full_name} (@${report.author.username})`
    : 'Reported post';
  postBox.appendChild(postLabel);

  if (report.post) {
    if (report.post.body) {
      const postBody = document.createElement('p');
      postBody.textContent = report.post.body;
      postBox.appendChild(postBody);
    }
    if (report.post.image_url) {
      const image = document.createElement('img');
      image.src = report.post.image_url;
      image.alt = 'Reported post image';
      image.loading = 'lazy';
      postBox.appendChild(image);
    }
  } else {
    const missing = document.createElement('p');
    missing.className = 'muted';
    missing.textContent = 'This post is no longer available.';
    postBox.appendChild(missing);
  }
  card.appendChild(postBox);

  const actions = document.createElement('div');
  actions.className = 'admin-report-actions';

  if (report.status !== 'reviewing') {
    actions.appendChild(adminActionButton('Start review', () => updateReportStatus(report.id, 'reviewing')));
  }
  if (report.status !== 'resolved') {
    actions.appendChild(adminActionButton('Resolve', () => updateReportStatus(report.id, 'resolved'), 'primary-lite'));
  }
  if (report.status !== 'dismissed') {
    actions.appendChild(adminActionButton('Dismiss', () => updateReportStatus(report.id, 'dismissed')));
  }
  if (report.post) {
    actions.appendChild(adminActionButton('Delete post', () => adminDeleteReportedPost(report), 'danger'));
  }

  card.appendChild(actions);
  return card;
}

function adminActionButton(label, action, variant = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `admin-action-button ${variant}`.trim();
  button.textContent = label;
  button.addEventListener('click', action);
  return button;
}

async function updateReportStatus(reportId, status) {
  try {
    const { error } = await supabase
      .from('kt_reports')
      .update({ status })
      .eq('id', reportId);
    if (error) throw error;

    showToast(`Report marked ${status}.`);
    await loadAdminReports();
  } catch (error) {
    showToast(error.message || 'Unable to update the report.');
  }
}

async function adminDeleteReportedPost(report) {
  if (!report.post || !confirm('Delete this reported post? This cannot be undone.')) return;

  try {
    const { error } = await supabase.from('kt_posts').delete().eq('id', report.post.id);
    if (error) throw error;

    if (report.post.image_url) {
      const path = storagePathFromPublicUrl(report.post.image_url, 'kt-post-images');
      if (path) await supabase.storage.from('kt-post-images').remove([path]);
    }

    showToast('Reported post deleted.');
    await Promise.all([loadAdminReports(), loadFeed()]);
  } catch (error) {
    showToast(error.message || 'Unable to delete the reported post.');
  }
}


init();
