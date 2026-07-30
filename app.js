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
let reportingMemberId = null;
let reportingMemberProfile = null;
let isAdmin = false;
let adminReports = [];
let blockedUsers = [];
let activeMemberProfile = null;
let activeMemberPosts = [];
let activeMemberStats = { posts: 0, followers: 0, following: 0 };
let memberProfileReturnMode = 'members';
let memberSearchTerm = '';
let notifications = [];
let notificationProfiles = new Map();
let notificationPosts = new Map();
let notificationFilter = 'all';
let unreadNotificationCount = 0;
let notificationChannel = null;
let notificationPollTimer = null;
let conversations = [];
let conversationProfiles = new Map();
let conversationMessages = [];
let activeConversation = null;
let activeChatProfile = null;
let activeChatMessages = [];
let activeChatMessagingAllowed = true;
let unreadMessageCount = 0;
let messageChannel = null;
let messagePollTimer = null;
let reportingConversationId = null;
let reportingConversationMember = null;
const recentCommentSubmissions = new Map();
let feedState = { profiles: new Map(), posts: [], comments: [], likes: [], follows: [], blocks: [] };

const els = {
  toast: $('#toast'), authView: $('#authView'), appView: $('#appView'),
  topActions: $('#topActions'), authForm: $('#authForm'),
  email: $('#emailInput'), password: $('#passwordInput'),
  authButton: $('#emailAuthButton'), toggleMode: $('#toggleAuthMode'),
  google: $('#googleButton'), authMessage: $('#authMessage'),
  signOut: $('#signOutButton'), mobileSignOut: $('#mobileSignOutButton'), myName: $('#myName'),
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
  adminRefreshButton: $('#adminRefreshButton'), adminSummary: $('#adminSummary'),
  blockedUsersNav: $('#blockedUsersNav'), blockedUsersView: $('#blockedUsersView'),
  blockedUsersList: $('#blockedUsersList'), blockedUsersLoading: $('#blockedUsersLoading'),
  blockedUsersEmpty: $('#blockedUsersEmpty'), blockedUsersSummary: $('#blockedUsersSummary'),
  blockedUsersRefreshButton: $('#blockedUsersRefreshButton'),
  membersNav: $('#membersNav'), membersView: $('#membersView'), membersList: $('#membersList'),
  membersLoading: $('#membersLoading'), membersEmpty: $('#membersEmpty'),
  membersRefreshButton: $('#membersRefreshButton'), memberSearchInput: $('#memberSearchInput'),
  memberSearchClear: $('#memberSearchClearButton'), memberSearchSummary: $('#memberSearchSummary'),
  memberProfileView: $('#memberProfileView'), memberProfileBack: $('#memberProfileBackButton'),
  memberProfileLoading: $('#memberProfileLoading'), memberProfileError: $('#memberProfileError'),
  memberProfileErrorText: $('#memberProfileErrorText'), memberProfileCard: $('#memberProfileCard'),
  memberProfileAvatar: $('#memberProfileAvatar'), memberProfileName: $('#memberProfileName'),
  memberProfileUsername: $('#memberProfileUsername'), memberProfileBio: $('#memberProfileBio'),
  memberProfileActions: $('#memberProfileActions'), memberProfileYouBadge: $('#memberProfileYouBadge'),
  memberProfilePostCount: $('#memberProfilePostCount'),
  memberProfileFollowerCount: $('#memberProfileFollowerCount'),
  memberProfileFollowingCount: $('#memberProfileFollowingCount'),
  memberPostsHeading: $('#memberPostsHeading'), memberPostsSummary: $('#memberPostsSummary'),
  memberPostsEmpty: $('#memberPostsEmpty'), memberPostsList: $('#memberPostsList'),
  memberReportDialog: $('#memberReportDialog'), memberReportForm: $('#memberReportForm'),
  memberReportReason: $('#memberReportReason'), memberReportDetails: $('#memberReportDetails'),
  memberReportMessage: $('#memberReportMessage'),
  submitMemberReport: $('#submitMemberReportButton'),
  reportedMemberPreview: $('#reportedMemberPreview'),
  myProfileSummary: $('#myProfileSummary'),
  notificationBell: $('#notificationBell'),
  notificationBellBadge: $('#notificationBellBadge'),
  notificationsNav: $('#notificationsNav'),
  notificationNavBadge: $('#notificationNavBadge'),
  notificationsView: $('#notificationsView'),
  notificationsList: $('#notificationsList'),
  notificationsLoading: $('#notificationsLoading'),
  notificationsEmpty: $('#notificationsEmpty'),
  notificationsEmptyTitle: $('#notificationsEmptyTitle'),
  notificationsEmptyText: $('#notificationsEmptyText'),
  notificationsSummary: $('#notificationsSummary'),
  notificationsRefreshButton: $('#notificationsRefreshButton'),
  markAllNotificationsRead: $('#markAllNotificationsRead'),
  messageTopButton: $('#messageTopButton'), messageTopBadge: $('#messageTopBadge'),
  messagesNav: $('#messagesNav'), messageNavBadge: $('#messageNavBadge'),
  messagesView: $('#messagesView'), messagesSummary: $('#messagesSummary'),
  messagesLoading: $('#messagesLoading'), messagesEmpty: $('#messagesEmpty'),
  conversationsList: $('#conversationsList'), messagesRefreshButton: $('#messagesRefreshButton'),
  findMembersForMessages: $('#findMembersForMessages'), chatView: $('#chatView'),
  chatBackButton: $('#chatBackButton'), chatMemberButton: $('#chatMemberButton'),
  chatMemberAvatar: $('#chatMemberAvatar'), chatMemberName: $('#chatMemberName'),
  chatMemberUsername: $('#chatMemberUsername'), chatReportButton: $('#chatReportButton'),
  chatBlockButton: $('#chatBlockButton'), chatPrivacyNote: $('#chatPrivacyNote'),
  chatBlockedNotice: $('#chatBlockedNotice'), chatLoading: $('#chatLoading'),
  chatEmpty: $('#chatEmpty'), chatMessages: $('#chatMessages'),
  chatComposer: $('#chatComposer'), chatMessageInput: $('#chatMessageInput'),
  sendMessageButton: $('#sendMessageButton'), chatMessageStatus: $('#chatMessageStatus'),
  conversationReportDialog: $('#conversationReportDialog'),
  conversationReportForm: $('#conversationReportForm'),
  conversationReportReason: $('#conversationReportReason'),
  conversationReportDetails: $('#conversationReportDetails'),
  conversationReportMessage: $('#conversationReportMessage'),
  submitConversationReport: $('#submitConversationReportButton'),
  reportedConversationMember: $('#reportedConversationMember')
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

function makeProfileTrigger(element, userId) {
  if (!element || !userId) return;
  element.classList.add('profile-trigger');
  element.setAttribute('role', 'button');
  element.setAttribute('tabindex', '0');

  const open = event => {
    event?.stopPropagation();
    openMemberProfile(userId);
  };

  element.addEventListener('click', open);
  element.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open(event);
    }
  });
}

function profilePath(username = '') {
  return `/u/${encodeURIComponent(username)}`;
}

async function handleLocationRoute() {
  if (!currentUser) return;
  const match = location.pathname.match(/^\/u\/([^/]+)\/?$/i);

  if (!match) {
    if (feedMode === 'profile') switchView('all', false, false);
    return;
  }

  const username = decodeURIComponent(match[1]).toLowerCase();
  let profile = [...feedState.profiles.values()]
    .find(item => String(item.username || '').toLowerCase() === username);

  if (!profile) {
    const { data, error } = await supabase
      .from('kt_profiles')
      .select('*')
      .ilike('username', username)
      .maybeSingle();

    if (error || !data) {
      switchView('profile', false, false);
      showMemberProfileError('This profile is unavailable or the member has blocked access.');
      return;
    }
    profile = data;
    feedState.profiles.set(profile.id, profile);
  }

  await openMemberProfile(profile.id, {
    pushHistory: false,
    returnMode: 'all'
  });
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
  const signOutUser = () => supabase.auth.signOut();
  els.signOut.addEventListener('click', signOutUser);
  els.mobileSignOut.addEventListener('click', signOutUser);
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
  els.blockedUsersRefreshButton.addEventListener('click', loadBlockedUsers);
  els.membersRefreshButton.addEventListener('click', loadFeed);
  els.memberSearchInput.addEventListener('input', () => {
    memberSearchTerm = els.memberSearchInput.value.trim();
    els.memberSearchClear.classList.toggle('hidden', !memberSearchTerm);
    renderMemberDirectory();
  });
  els.memberSearchClear.addEventListener('click', () => {
    memberSearchTerm = '';
    els.memberSearchInput.value = '';
    els.memberSearchClear.classList.add('hidden');
    renderMemberDirectory();
    els.memberSearchInput.focus();
  });
  els.memberProfileBack.addEventListener('click', () => {
    history.pushState({}, '', '/');
    switchView(memberProfileReturnMode, true, false);
  });
  els.memberReportForm.addEventListener('submit', submitMemberReport);
  els.myProfileSummary.addEventListener('click', () => openMemberProfile(currentUser.id));
  els.notificationBell.addEventListener('click', () => {
    if (location.pathname.startsWith('/u/')) history.pushState({}, '', '/');
    switchView('notifications');
  });
  els.notificationsRefreshButton.addEventListener('click', loadNotifications);
  els.markAllNotificationsRead.addEventListener('click', markAllNotificationsAsRead);
  els.messageTopButton.addEventListener('click', () => {
    if (location.pathname.startsWith('/u/')) history.pushState({}, '', '/');
    switchView('messages');
  });
  els.messagesRefreshButton.addEventListener('click', loadConversations);
  els.findMembersForMessages.addEventListener('click', () => switchView('members'));
  els.chatBackButton.addEventListener('click', () => switchView('messages'));
  els.chatMemberButton.addEventListener('click', () => {
    if (activeChatProfile?.id) openMemberProfile(activeChatProfile.id, { returnMode: 'messages' });
  });
  els.chatReportButton.addEventListener('click', openConversationReportDialog);
  els.chatBlockButton.addEventListener('click', blockActiveChatMember);
  els.chatComposer.addEventListener('submit', sendChatMessage);
  els.conversationReportForm.addEventListener('submit', submitConversationReport);
  $$('[data-notification-filter]').forEach(button => {
    button.addEventListener('click', () => {
      notificationFilter = button.dataset.notificationFilter;
      $$('[data-notification-filter]').forEach(item =>
        item.classList.toggle('active', item === button)
      );
      renderNotifications();
    });
  });
  window.addEventListener('popstate', handleLocationRoute);
  $$('.close-button').forEach(button => {
    button.addEventListener('click', () => button.closest('dialog')?.close());
  });

  document.addEventListener('click', () => {
    closeCommentMenus();
    closePostMenus();
  });

  $$('[data-feed]').forEach(button => {
    button.addEventListener('click', () => {
      if (location.pathname.startsWith('/u/')) history.pushState({}, '', '/');
      switchView(button.dataset.feed);
    });
  });
}

async function handleSession(session) {
  await Promise.all([stopNotificationUpdates(), stopMessageUpdates()]);

  currentUser = session?.user || null;
  if (!currentUser) {
    currentProfile = null;
    isAdmin = false;
    adminReports = [];
    blockedUsers = [];
    activeMemberProfile = null;
    activeMemberPosts = [];
    notifications = [];
    notificationProfiles = new Map();
    notificationPosts = new Map();
    unreadNotificationCount = 0;
    conversations = [];
    conversationProfiles = new Map();
    conversationMessages = [];
    activeConversation = null;
    activeChatProfile = null;
    activeChatMessages = [];
    unreadMessageCount = 0;
    updateNotificationBadges();
    updateMessageBadges();
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
  switchView('all', false, false);
  await Promise.all([loadFeed(), loadNotificationCount(), loadUnreadMessageCount()]);
  startNotificationUpdates();
  startMessageUpdates();
  await handleLocationRoute();
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

function switchView(mode, load = true, updateHistory = true) {
  if (mode === 'admin' && !isAdmin) return;

  feedMode = mode;
  $$('[data-feed]').forEach(item => {
    const activeMode = mode === 'profile' ? 'members' : mode === 'chat' ? 'messages' : mode;
    item.classList.toggle('active', item.dataset.feed === activeMode);
  });

  const adminMode = mode === 'admin';
  const blockedMode = mode === 'blocked';
  const membersMode = mode === 'members';
  const profileMode = mode === 'profile';
  const notificationsMode = mode === 'notifications';
  const messagesMode = mode === 'messages';
  const chatMode = mode === 'chat';
  const specialMode = adminMode || blockedMode || membersMode || profileMode || notificationsMode || messagesMode || chatMode;

  els.composerCard.classList.toggle('hidden', specialMode);
  els.feedHeading.classList.toggle('hidden', specialMode);
  els.feed.classList.toggle('hidden', specialMode);
  els.adminReportsView.classList.toggle('hidden', !adminMode);
  els.blockedUsersView.classList.toggle('hidden', !blockedMode);
  els.membersView.classList.toggle('hidden', !membersMode);
  els.memberProfileView.classList.toggle('hidden', !profileMode);
  els.notificationsView.classList.toggle('hidden', !notificationsMode);
  els.messagesView.classList.toggle('hidden', !messagesMode);
  els.chatView.classList.toggle('hidden', !chatMode);

  if (updateHistory && !profileMode && location.pathname.startsWith('/u/')) {
    history.pushState({}, '', '/');
  }

  if (adminMode) {
    els.loading.classList.add('hidden');
    els.empty.classList.add('hidden');
    if (load) loadAdminReports();
    return;
  }

  if (blockedMode) {
    els.loading.classList.add('hidden');
    els.empty.classList.add('hidden');
    if (load) loadBlockedUsers();
    return;
  }

  if (membersMode) {
    els.loading.classList.add('hidden');
    els.empty.classList.add('hidden');
    renderMemberDirectory();
    if (load && !feedState.profiles.size) loadFeed();
    return;
  }

  if (profileMode || chatMode) {
    els.loading.classList.add('hidden');
    els.empty.classList.add('hidden');
    return;
  }

  if (notificationsMode) {
    els.loading.classList.add('hidden');
    els.empty.classList.add('hidden');
    if (load) loadNotifications();
    else renderNotifications();
    return;
  }

  if (messagesMode) {
    els.loading.classList.add('hidden');
    els.empty.classList.add('hidden');
    if (load) loadConversations();
    else renderConversations();
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

  if (feedMode === 'all' || feedMode === 'following') {
    els.feed.innerHTML = '';
  }

  try {
    const [
      postsResult,
      commentsResult,
      likesResult,
      followsResult,
      profilesResult,
      blocksResult
    ] = await Promise.all([
      supabase.from('kt_posts').select('*').order('created_at',{ascending:false}).limit(100),
      supabase.from('kt_comments').select('*').order('created_at',{ascending:true}).limit(1000),
      supabase.from('kt_likes').select('*').limit(4000),
      supabase.from('kt_follows').select('*').limit(4000),
      supabase.from('kt_profiles').select('*').limit(2000),
      supabase.from('kt_blocks')
        .select('blocked_id,created_at')
        .eq('blocker_id', currentUser.id)
        .limit(2000)
    ]);

    for (const result of [
      postsResult,
      commentsResult,
      likesResult,
      followsResult,
      profilesResult,
      blocksResult
    ]) {
      if (result.error) throw result.error;
    }

    feedState = {
      posts: postsResult.data || [],
      comments: commentsResult.data || [],
      likes: likesResult.data || [],
      follows: followsResult.data || [],
      profiles: new Map((profilesResult.data || []).map(profile => [profile.id, profile])),
      blocks: blocksResult.data || []
    };

    renderFeed();
    if (feedMode === 'members') renderMemberDirectory();
  } catch (error) {
    if (feedMode === 'all' || feedMode === 'following') {
      els.feed.innerHTML = `<section class="card loading-card">Unable to load the feed: ${String(error.message || error)}</section>`;
    } else {
      showToast(error.message || 'Unable to refresh community information.');
    }
  } finally {
    els.loading.classList.add('hidden');
  }
}

function renderFeed() {
  if (['admin','blocked','members','profile','notifications','messages','chat'].includes(feedMode)) return;
  els.feed.innerHTML = '';
  const followingIds = new Set(feedState.follows.filter(f => f.follower_id === currentUser.id).map(f => f.following_id));
  followingIds.add(currentUser.id);
  const posts = feedMode === 'following'
    ? feedState.posts.filter(post => followingIds.has(post.user_id))
    : feedState.posts;
  els.empty.classList.toggle('hidden', posts.length > 0);
  for (const post of posts) els.feed.appendChild(renderPost(post, followingIds));
}

function closePostMenus(exceptMenu = null) {
  $$('.post-owner-menu.open').forEach(menu => {
    if (menu === exceptMenu) return;
    menu.classList.remove('open');
    const trigger = menu.closest('.post-actions-top')?.querySelector('.post-menu-trigger');
    trigger?.setAttribute('aria-expanded', 'false');
  });
}

function renderPost(post, followingIds) {
  const node = $('#postTemplate').content.firstElementChild.cloneNode(true);
  node.dataset.postId = post.id;
  const profile = feedState.profiles.get(post.user_id) || { full_name:'Khmer Together Member', username:'member' };
  const postComments = feedState.comments.filter(c => c.post_id === post.id);
  const postLikes = feedState.likes.filter(l => l.post_id === post.id);
  const liked = postLikes.some(l => l.user_id === currentUser.id);
  const isMine = post.user_id === currentUser.id;
  const following = followingIds.has(post.user_id);

  setAvatar($('.post-avatar',node), profile);
  $('.post-name',node).textContent = profile.full_name;
  $('.post-username',node).textContent = `@${profile.username}`;
  makeProfileTrigger($('.post-author',node), post.user_id);

  const timeElement = $('.post-time',node);
  timeElement.textContent = timeAgo(post.created_at);
  timeElement.dateTime = post.created_at;

  const createdAt = new Date(post.created_at || 0).getTime();
  const updatedAt = new Date(post.updated_at || post.created_at || 0).getTime();
  if (updatedAt - createdAt > 1000) {
    const edited = document.createElement('small');
    edited.className = 'post-edited-label';
    edited.textContent = ' · Edited';
    timeElement.parentElement.appendChild(edited);
  }

  $('.post-body',node).textContent = post.body || '';
  $('.post-body',node).classList.toggle('hidden', !post.body);

  const image = $('.post-image',node);
  if (post.image_url) {
    image.src = post.image_url;
    image.classList.remove('hidden');
  }

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

  const reportButton = $('.report-post',node);
  reportButton.classList.toggle('hidden', isMine);

  const oldDeleteButton = $('.delete-post',node);
  oldDeleteButton.classList.toggle('hidden', !isMine);

  const createPostMenu = (trigger, items) => {
    trigger.textContent = '⋯';
    trigger.classList.remove('danger');
    trigger.classList.add('post-menu-trigger');
    trigger.setAttribute('aria-label', 'Post options');
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');

    const menu = document.createElement('div');
    menu.className = 'post-owner-menu';
    menu.setAttribute('role', 'menu');

    for (const item of items) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `post-owner-menu-item ${item.danger ? 'danger' : ''}`.trim();
      button.setAttribute('role', 'menuitem');
      button.textContent = item.label;
      button.addEventListener('click', event => {
        event.stopPropagation();
        menu.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
        item.action();
      });
      menu.appendChild(button);
    }

    $('.post-actions-top',node).appendChild(menu);

    trigger.addEventListener('click', event => {
      event.stopPropagation();
      const opening = !menu.classList.contains('open');
      closePostMenus(menu);
      closeCommentMenus();
      menu.classList.toggle('open', opening);
      trigger.setAttribute('aria-expanded', String(opening));
      if (opening) setTimeout(() => menu.querySelector('button')?.focus(), 0);
    });

    menu.addEventListener('click', event => event.stopPropagation());
    menu.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        menu.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.focus();
      }
    });
  };

  if (isMine) {
    createPostMenu(oldDeleteButton, [
      { label: 'Edit post', action: () => beginEditPost(post, node) },
      { label: 'Delete post', danger: true, action: () => deletePost(post) }
    ]);
  } else {
    createPostMenu(reportButton, [
      { label: 'Report post', action: () => openReportDialog(post.id) },
      {
        label: `Block @${profile.username}`,
        danger: true,
        action: () => blockUser(post.user_id, profile)
      }
    ]);
  }

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

function beginEditPost(post, postNode) {
  if (postNode.querySelector('.post-edit-form')) return;

  const bodyElement = $('.post-body', postNode);
  const imageElement = $('.post-image', postNode);

  let selectedEditImage = null;
  let removeImageRequested = false;
  let previewObjectUrl = null;

  bodyElement.classList.add('hidden');
  imageElement.classList.add('hidden');

  const form = document.createElement('form');
  form.className = 'post-edit-form';

  const textLabel = document.createElement('label');
  textLabel.textContent = post.image_url ? 'Edit post text or photo caption' : 'Edit post text';

  const textarea = document.createElement('textarea');
  textarea.className = 'post-edit-textarea';
  textarea.maxLength = 2000;
  textarea.rows = 4;
  textarea.value = post.body || '';
  textarea.placeholder = 'Write your post or photo caption…';
  textLabel.appendChild(textarea);

  const mediaSection = document.createElement('section');
  mediaSection.className = 'post-edit-media';

  const mediaHeading = document.createElement('div');
  mediaHeading.className = 'post-edit-media-heading';
  const mediaTitle = document.createElement('strong');
  mediaTitle.textContent = 'Photo';
  const mediaStatus = document.createElement('span');
  mediaStatus.className = 'post-edit-media-status';
  mediaHeading.append(mediaTitle, mediaStatus);

  const preview = document.createElement('div');
  preview.className = 'post-edit-image-preview';

  const previewImage = document.createElement('img');
  previewImage.alt = 'Post photo preview';

  const emptyPreview = document.createElement('div');
  emptyPreview.className = 'post-edit-image-empty';
  emptyPreview.innerHTML = '<span>＋</span><strong>No photo</strong>';

  preview.append(previewImage, emptyPreview);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/jpeg,image/png,image/gif,image/webp';
  fileInput.className = 'post-edit-file-input';

  const mediaButtons = document.createElement('div');
  mediaButtons.className = 'post-edit-media-buttons';

  const choosePhotoButton = document.createElement('button');
  choosePhotoButton.type = 'button';
  choosePhotoButton.className = 'post-edit-photo-button';
  choosePhotoButton.textContent = post.image_url ? 'Replace photo' : 'Add photo';

  const removePhotoButton = document.createElement('button');
  removePhotoButton.type = 'button';
  removePhotoButton.className = 'post-edit-photo-button danger';
  removePhotoButton.textContent = 'Remove photo';

  const keepOriginalButton = document.createElement('button');
  keepOriginalButton.type = 'button';
  keepOriginalButton.className = 'post-edit-photo-button';
  keepOriginalButton.textContent = 'Keep original photo';

  mediaButtons.append(choosePhotoButton, removePhotoButton, keepOriginalButton);
  mediaSection.append(mediaHeading, preview, fileInput, mediaButtons);
  form.append(textLabel, mediaSection);

  const actions = document.createElement('div');
  actions.className = 'post-edit-actions';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'post-edit-cancel';
  cancelButton.textContent = 'Cancel';

  const saveButton = document.createElement('button');
  saveButton.type = 'submit';
  saveButton.className = 'post-edit-save';
  saveButton.textContent = 'Save changes';

  actions.append(cancelButton, saveButton);
  form.appendChild(actions);
  postNode.insertBefore(form, imageElement);

  function revokePreviewUrl() {
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = null;
    }
  }

  function effectivePhotoUrl() {
    if (selectedEditImage && previewObjectUrl) return previewObjectUrl;
    if (removeImageRequested) return null;
    return post.image_url || null;
  }

  function updatePhotoEditor() {
    const url = effectivePhotoUrl();
    previewImage.classList.toggle('hidden', !url);
    emptyPreview.classList.toggle('hidden', Boolean(url));

    if (url) previewImage.src = url;
    else previewImage.removeAttribute('src');

    if (selectedEditImage) {
      mediaStatus.textContent = 'New photo selected';
    } else if (removeImageRequested && post.image_url) {
      mediaStatus.textContent = 'Photo will be removed';
    } else if (post.image_url) {
      mediaStatus.textContent = 'Current photo';
    } else {
      mediaStatus.textContent = 'No photo';
    }

    choosePhotoButton.textContent = url ? 'Replace photo' : 'Add photo';
    removePhotoButton.classList.toggle('hidden', !url);
    keepOriginalButton.classList.toggle(
      'hidden',
      !post.image_url || (!selectedEditImage && !removeImageRequested)
    );
  }

  choosePhotoButton.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      fileInput.value = '';
      showToast('Choose a JPG, PNG, GIF, or WebP photo.');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      fileInput.value = '';
      showToast('The photo must be 8 MB or smaller.');
      return;
    }

    revokePreviewUrl();
    selectedEditImage = file;
    removeImageRequested = false;
    previewObjectUrl = URL.createObjectURL(file);
    updatePhotoEditor();
  });

  removePhotoButton.addEventListener('click', () => {
    revokePreviewUrl();
    selectedEditImage = null;
    removeImageRequested = true;
    fileInput.value = '';
    updatePhotoEditor();
  });

  keepOriginalButton.addEventListener('click', () => {
    revokePreviewUrl();
    selectedEditImage = null;
    removeImageRequested = false;
    fileInput.value = '';
    updatePhotoEditor();
  });

  function closeEditor() {
    revokePreviewUrl();
    form.remove();
    bodyElement.classList.toggle('hidden', !post.body);
    imageElement.classList.toggle('hidden', !post.image_url);
  }

  cancelButton.addEventListener('click', closeEditor);

  form.addEventListener('submit', async event => {
    event.preventDefault();

    const newBody = textarea.value.trim();
    let newImageUrl = removeImageRequested ? null : (post.image_url || null);
    let newlyUploadedPath = null;

    if (!newBody && !selectedEditImage && !newImageUrl) {
      showToast('Keep some text or add a photo before saving.');
      return;
    }

    const bodyChanged = newBody !== (post.body || '');
    const photoChanged = Boolean(selectedEditImage) || removeImageRequested;

    if (!bodyChanged && !photoChanged) {
      closeEditor();
      return;
    }

    textarea.disabled = true;
    fileInput.disabled = true;
    choosePhotoButton.disabled = true;
    removePhotoButton.disabled = true;
    keepOriginalButton.disabled = true;
    cancelButton.disabled = true;
    saveButton.disabled = true;
    saveButton.textContent = 'Saving…';

    try {
      if (selectedEditImage) {
        const typeToExtension = {
          'image/jpeg': 'jpg',
          'image/png': 'png',
          'image/gif': 'gif',
          'image/webp': 'webp'
        };
        const extension = typeToExtension[selectedEditImage.type] || 'jpg';
        newlyUploadedPath = `${currentUser.id}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from('kt-post-images')
          .upload(newlyUploadedPath, selectedEditImage, {
            cacheControl: '3600',
            upsert: false,
            contentType: selectedEditImage.type
          });

        if (uploadError) throw uploadError;

        newImageUrl = supabase.storage
          .from('kt-post-images')
          .getPublicUrl(newlyUploadedPath).data.publicUrl;
      }

      if (!newBody && !newImageUrl) {
        throw new Error('A post must contain text or a photo.');
      }

      const { error } = await supabase
        .from('kt_posts')
        .update({
          body: newBody,
          image_url: newImageUrl
        })
        .eq('id', post.id)
        .eq('user_id', currentUser.id);

      if (error) throw error;

      if (post.image_url && post.image_url !== newImageUrl) {
        const oldPath = storagePathFromPublicUrl(post.image_url, 'kt-post-images');
        if (oldPath) {
          await supabase.storage.from('kt-post-images').remove([oldPath]);
        }
      }

      revokePreviewUrl();
      showToast('Post updated.');
      await loadFeed();
    } catch (error) {
      if (newlyUploadedPath) {
        await supabase.storage.from('kt-post-images').remove([newlyUploadedPath]);
      }

      textarea.disabled = false;
      fileInput.disabled = false;
      choosePhotoButton.disabled = false;
      removePhotoButton.disabled = false;
      keepOriginalButton.disabled = false;
      cancelButton.disabled = false;
      saveButton.disabled = false;
      saveButton.textContent = 'Save changes';
      showToast(error.message || 'Unable to update the post.');
    }
  });

  updatePhotoEditor();

  setTimeout(() => {
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, 0);
}

function closeCommentMenus(exceptMenu = null) {
  $$('.comment-menu.open').forEach(menu => {
    if (menu === exceptMenu) return;
    menu.classList.remove('open');
    const trigger = menu.closest('.comment-owner-controls')?.querySelector('.comment-menu-button');
    trigger?.setAttribute('aria-expanded', 'false');
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
  makeProfileTrigger(avatar, comment.user_id);
  makeProfileTrigger(strong, comment.user_id);
  strong.addEventListener('click', event => event.stopPropagation());

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
    const controls = document.createElement('div');
    controls.className = 'comment-owner-controls';

    const menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.className = 'comment-menu-button';
    menuButton.textContent = '⋯';
    menuButton.setAttribute('aria-label', 'Comment options');
    menuButton.setAttribute('aria-haspopup', 'menu');
    menuButton.setAttribute('aria-expanded', 'false');

    const menu = document.createElement('div');
    menu.className = 'comment-menu';
    menu.setAttribute('role', 'menu');

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'comment-menu-item';
    editButton.setAttribute('role', 'menuitem');
    editButton.textContent = 'Edit comment';
    editButton.addEventListener('click', event => {
      event.stopPropagation();
      menu.classList.remove('open');
      menuButton.setAttribute('aria-expanded', 'false');
      beginEditComment(comment, content, bubble, controls);
    });

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'comment-menu-item danger';
    deleteButton.setAttribute('role', 'menuitem');
    deleteButton.textContent = 'Delete comment';
    deleteButton.addEventListener('click', event => {
      event.stopPropagation();
      menu.classList.remove('open');
      menuButton.setAttribute('aria-expanded', 'false');
      deleteComment(comment);
    });

    menu.append(editButton, deleteButton);
    controls.append(menuButton, menu);
    wrap.appendChild(controls);

    menuButton.addEventListener('click', event => {
      event.stopPropagation();
      const opening = !menu.classList.contains('open');
      closeCommentMenus(menu);
      menu.classList.toggle('open', opening);
      menuButton.setAttribute('aria-expanded', String(opening));

      if (opening) {
        setTimeout(() => editButton.focus(), 0);
      }
    });

    menu.addEventListener('click', event => event.stopPropagation());
    menu.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        menu.classList.remove('open');
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.focus();
      }
    });
  }

  return wrap;
}

function beginEditComment(comment, content, bubble, controls = null) {
  if (content.querySelector('.comment-edit-form')) return;

  bubble.classList.add('hidden');
  controls?.classList.add('hidden');

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
    controls?.classList.remove('hidden');
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
      controls?.classList.remove('hidden');
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

async function toggleFollow(userId, following) {
  try {
    const query = following
      ? supabase.from('kt_follows').delete().eq('follower_id',currentUser.id).eq('following_id',userId)
      : supabase.from('kt_follows').insert({follower_id:currentUser.id,following_id:userId});
    const { error } = await query;
    if (error) throw error;

    showToast(following ? 'Unfollowed.' : 'You are now following this member.');
    await loadFeed();
    return true;
  } catch (error) {
    showToast(error.message || 'Unable to update follow.');
    return false;
  }
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





function updateMessageBadges() {
  const count = Math.max(0, Number(unreadMessageCount) || 0);
  const label = count > 99 ? '99+' : String(count);

  for (const badge of [els.messageTopBadge, els.messageNavBadge]) {
    badge.textContent = label;
    badge.classList.toggle('hidden', count === 0);
  }

  els.messageTopButton.setAttribute(
    'aria-label',
    count ? `Open messages, ${count} unread` : 'Open messages'
  );
}

async function loadUnreadMessageCount() {
  if (!currentUser) return;
  try {
    const { count, error } = await supabase
      .from('kt_messages')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', currentUser.id)
      .is('read_at', null);
    if (error) throw error;
    unreadMessageCount = count || 0;
    updateMessageBadges();
  } catch (error) {
    console.warn('Unable to load unread message count:', error);
  }
}

function otherConversationUser(conversation) {
  return conversation.user_one === currentUser.id
    ? conversation.user_two
    : conversation.user_one;
}

async function loadConversations() {
  if (!currentUser) return;
  els.messagesLoading.classList.remove('hidden');
  els.messagesEmpty.classList.add('hidden');
  els.conversationsList.innerHTML = '';
  els.messagesRefreshButton.disabled = true;

  try {
    const { data: conversationRows, error: conversationError } = await supabase
      .from('kt_conversations')
      .select('*')
      .or(`user_one.eq.${currentUser.id},user_two.eq.${currentUser.id}`)
      .order('updated_at', { ascending: false })
      .limit(200);
    if (conversationError) throw conversationError;

    conversations = conversationRows || [];
    const conversationIds = conversations.map(item => item.id);
    const otherIds = [...new Set(conversations.map(otherConversationUser))];

    const [messagesResult, profilesResult, unreadResult] = await Promise.all([
      conversationIds.length
        ? supabase.from('kt_messages')
            .select('*')
            .in('conversation_id', conversationIds)
            .order('created_at', { ascending: false })
            .limit(3000)
        : Promise.resolve({ data: [], error: null }),
      otherIds.length
        ? supabase.from('kt_profiles').select('*').in('id', otherIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('kt_messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', currentUser.id)
        .is('read_at', null)
    ]);

    if (messagesResult.error) throw messagesResult.error;
    if (profilesResult.error) throw profilesResult.error;
    if (unreadResult.error) throw unreadResult.error;

    conversationMessages = messagesResult.data || [];
    conversationProfiles = new Map(
      (profilesResult.data || []).map(profile => [profile.id, profile])
    );

    unreadMessageCount = unreadResult.count || 0;
    updateMessageBadges();
    renderConversations();
  } catch (error) {
    els.conversationsList.innerHTML = '';
    const message = document.createElement('section');
    message.className = 'card messages-error';
    message.textContent = `Unable to load messages: ${error.message || error}`;
    els.conversationsList.appendChild(message);
  } finally {
    els.messagesLoading.classList.add('hidden');
    els.messagesRefreshButton.disabled = false;
  }
}

function renderConversations() {
  els.conversationsList.innerHTML = '';
  els.messagesEmpty.classList.toggle('hidden', conversations.length > 0);
  els.messagesSummary.textContent = unreadMessageCount
    ? `${unreadMessageCount} unread ${unreadMessageCount === 1 ? 'message' : 'messages'}`
    : 'Your one-to-one conversations.';

  for (const conversation of conversations) {
    const otherId = otherConversationUser(conversation);
    const profile = conversationProfiles.get(otherId) || {
      id: otherId,
      full_name: 'Khmer Together Member',
      username: 'member'
    };
    const messages = conversationMessages.filter(message => message.conversation_id === conversation.id);
    const latest = messages[0] || null;
    const unread = messages.filter(message =>
      message.recipient_id === currentUser.id && !message.read_at
    ).length;

    const card = document.createElement('button');
    card.type = 'button';
    card.className = `card conversation-card ${unread ? 'unread' : ''}`.trim();
    card.addEventListener('click', () => openConversation(conversation, profile));

    const avatar = document.createElement('span');
    avatar.className = 'avatar conversation-avatar';
    setAvatar(avatar, profile);

    const content = document.createElement('span');
    content.className = 'conversation-content';

    const top = document.createElement('span');
    top.className = 'conversation-topline';
    const name = document.createElement('strong');
    name.textContent = profile.full_name || 'Khmer Together Member';
    const time = document.createElement('time');
    time.textContent = timeAgo(latest?.created_at || conversation.updated_at);
    top.append(name, time);

    const preview = document.createElement('span');
    preview.className = 'conversation-preview';
    if (!latest) {
      preview.textContent = 'Start the conversation.';
    } else {
      const prefix = latest.sender_id === currentUser.id ? 'You: ' : '';
      preview.textContent = `${prefix}${latest.body}`;
    }

    const username = document.createElement('small');
    username.textContent = `@${profile.username || 'member'}`;
    content.append(top, preview, username);

    card.append(avatar, content);
    if (unread) {
      const badge = document.createElement('strong');
      badge.className = 'conversation-unread-badge';
      badge.textContent = unread > 99 ? '99+' : String(unread);
      card.appendChild(badge);
    }
    els.conversationsList.appendChild(card);
  }
}

async function startConversation(profile) {
  if (!profile || profile.id === currentUser.id) return;
  try {
    const { data, error } = await supabase.rpc('kt_get_or_create_conversation', {
      other_user: profile.id
    });
    if (error) throw error;

    const conversation = {
      id: data,
      user_one: currentUser.id < profile.id ? currentUser.id : profile.id,
      user_two: currentUser.id < profile.id ? profile.id : currentUser.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await openConversation(conversation, profile);
  } catch (error) {
    showToast(error.message || 'Unable to start this conversation.');
  }
}

async function openConversation(conversation, profile = null) {
  if (!conversation?.id) return;

  activeConversation = conversation;
  const otherId = otherConversationUser(conversation);
  activeChatProfile = profile || conversationProfiles.get(otherId) || {
    id: otherId,
    full_name: 'Khmer Together Member',
    username: 'member'
  };

  switchView('chat', false, false);
  setAvatar(els.chatMemberAvatar, activeChatProfile);
  els.chatMemberName.textContent = activeChatProfile.full_name || 'Khmer Together Member';
  els.chatMemberUsername.textContent = `@${activeChatProfile.username || 'member'}`;
  els.chatMessages.innerHTML = '';
  els.chatEmpty.classList.add('hidden');
  els.chatLoading.classList.remove('hidden');
  setMessage(els.chatMessageStatus);

  try {
    const [messagesResult, allowedResult] = await Promise.all([
      supabase.from('kt_messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true })
        .limit(1000),
      supabase.rpc('kt_users_blocked', {
        user_a: currentUser.id,
        user_b: otherId
      })
    ]);

    if (messagesResult.error) throw messagesResult.error;
    if (allowedResult.error) throw allowedResult.error;

    activeChatMessages = messagesResult.data || [];
    activeChatMessagingAllowed = !Boolean(allowedResult.data);
    updateChatAvailability();
    await markActiveConversationRead();
    renderChatMessages();
    await loadUnreadMessageCount();
  } catch (error) {
    els.chatMessages.innerHTML = '';
    setMessage(els.chatMessageStatus, error.message || 'Unable to load this conversation.');
  } finally {
    els.chatLoading.classList.add('hidden');
  }
}

function updateChatAvailability() {
  els.chatBlockedNotice.classList.toggle('hidden', activeChatMessagingAllowed);
  els.chatComposer.classList.toggle('hidden', !activeChatMessagingAllowed);
  els.chatBlockButton.textContent = activeChatMessagingAllowed ? 'Block' : 'Blocked';
  els.chatBlockButton.disabled = !activeChatMessagingAllowed;
}

function renderChatMessages() {
  els.chatMessages.innerHTML = '';
  els.chatEmpty.classList.toggle('hidden', activeChatMessages.length > 0);

  for (const message of activeChatMessages) {
    const mine = message.sender_id === currentUser.id;
    const row = document.createElement('div');
    row.className = `chat-message-row ${mine ? 'mine' : 'theirs'}`;

    const bubble = document.createElement('div');
    bubble.className = 'chat-message-bubble';

    const body = document.createElement('p');
    body.textContent = message.body;

    const meta = document.createElement('div');
    meta.className = 'chat-message-meta';
    const time = document.createElement('time');
    time.dateTime = message.created_at;
    time.textContent = timeAgo(message.created_at);
    meta.appendChild(time);

    if (mine) {
      const receipt = document.createElement('span');
      receipt.textContent = message.read_at ? 'Read' : 'Sent';
      meta.append(document.createTextNode(' · '), receipt);

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'delete-chat-message';
      deleteButton.textContent = 'Delete';
      deleteButton.addEventListener('click', () => deleteChatMessage(message));
      meta.append(document.createTextNode(' · '), deleteButton);
    }

    bubble.append(body, meta);
    row.appendChild(bubble);
    els.chatMessages.appendChild(row);
  }

  requestAnimationFrame(() => {
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  });
}

async function sendChatMessage(event) {
  event.preventDefault();
  if (!activeConversation || !activeChatProfile || !activeChatMessagingAllowed) return;

  const body = els.chatMessageInput.value.trim();
  if (!body) return;

  els.sendMessageButton.disabled = true;
  els.sendMessageButton.textContent = 'Sending…';
  setMessage(els.chatMessageStatus);

  try {
    const { error } = await supabase.from('kt_messages').insert({
      conversation_id: activeConversation.id,
      sender_id: currentUser.id,
      recipient_id: activeChatProfile.id,
      body
    });
    if (error) throw error;

    els.chatMessageInput.value = '';
    await openConversation(activeConversation, activeChatProfile);
  } catch (error) {
    setMessage(els.chatMessageStatus, error.message || 'Unable to send this message.');
  } finally {
    els.sendMessageButton.disabled = false;
    els.sendMessageButton.textContent = 'Send';
  }
}

async function markActiveConversationRead() {
  if (!activeConversation) return;
  try {
    const { error } = await supabase.rpc('kt_mark_conversation_read', {
      target_conversation: activeConversation.id
    });
    if (error) throw error;
    const readAt = new Date().toISOString();
    activeChatMessages = activeChatMessages.map(message =>
      message.recipient_id === currentUser.id && !message.read_at
        ? { ...message, read_at: readAt }
        : message
    );
  } catch (error) {
    console.warn('Unable to mark conversation read:', error);
  }
}

async function deleteChatMessage(message) {
  if (message.sender_id !== currentUser.id) return;
  if (!confirm('Delete this message for both people? This cannot be undone.')) return;

  try {
    const { error } = await supabase
      .from('kt_messages')
      .delete()
      .eq('id', message.id)
      .eq('sender_id', currentUser.id);
    if (error) throw error;

    activeChatMessages = activeChatMessages.filter(item => item.id !== message.id);
    renderChatMessages();
    showToast('Message deleted.');
  } catch (error) {
    showToast(error.message || 'Unable to delete this message.');
  }
}

async function blockActiveChatMember() {
  if (!activeChatProfile || !activeChatMessagingAllowed) return;
  const success = await blockUser(activeChatProfile.id, activeChatProfile);
  if (success) {
    activeChatMessagingAllowed = false;
    updateChatAvailability();
  }
}

function openConversationReportDialog() {
  if (!activeConversation || !activeChatProfile) return;
  reportingConversationId = activeConversation.id;
  reportingConversationMember = activeChatProfile;
  els.conversationReportReason.value = '';
  els.conversationReportDetails.value = '';
  setMessage(els.conversationReportMessage);

  els.reportedConversationMember.innerHTML = '';
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  setAvatar(avatar, activeChatProfile);
  const text = document.createElement('div');
  const name = document.createElement('strong');
  name.textContent = activeChatProfile.full_name || 'Khmer Together Member';
  const username = document.createElement('span');
  username.textContent = `@${activeChatProfile.username || 'member'}`;
  text.append(name, username);
  els.reportedConversationMember.append(avatar, text);
  els.conversationReportDialog.showModal();
}

async function submitConversationReport(event) {
  event.preventDefault();
  if (!reportingConversationId || !reportingConversationMember) return;

  const reason = els.conversationReportReason.value;
  const details = els.conversationReportDetails.value.trim();
  if (!reason || !details) {
    setMessage(els.conversationReportMessage, 'Please choose a reason and explain what happened.');
    return;
  }

  els.submitConversationReport.disabled = true;
  els.submitConversationReport.textContent = 'Submitting…';
  setMessage(els.conversationReportMessage);

  try {
    const { error } = await supabase.from('kt_conversation_reports').insert({
      conversation_id: reportingConversationId,
      reporter_id: currentUser.id,
      reported_id: reportingConversationMember.id,
      reason,
      details
    });
    if (error) {
      if (error.code === '23505') throw new Error('You already reported this conversation.');
      throw error;
    }

    els.conversationReportDialog.close();
    showToast('Conversation report submitted privately.');
    reportingConversationId = null;
    reportingConversationMember = null;
  } catch (error) {
    setMessage(els.conversationReportMessage, error.message || 'Unable to submit this report.');
  } finally {
    els.submitConversationReport.disabled = false;
    els.submitConversationReport.textContent = 'Submit conversation report';
  }
}

function startMessageUpdates() {
  if (!currentUser || messageChannel) return;

  messageChannel = supabase
    .channel(`kt-messages-${currentUser.id}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'kt_messages',
      filter: `recipient_id=eq.${currentUser.id}`
    }, async payload => {
      if (activeConversation?.id === payload.new.conversation_id && feedMode === 'chat') {
        await openConversation(activeConversation, activeChatProfile);
      } else {
        unreadMessageCount += 1;
        updateMessageBadges();
        showToast('You received a new private message.');
        if (feedMode === 'messages') await loadConversations();
      }
    })
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'kt_messages',
      filter: `sender_id=eq.${currentUser.id}`
    }, async payload => {
      if (activeConversation?.id === payload.new.conversation_id && feedMode === 'chat') {
        const message = activeChatMessages.find(item => item.id === payload.new.id);
        if (message) Object.assign(message, payload.new);
        renderChatMessages();
      }
    })
    .subscribe();

  messagePollTimer = window.setInterval(async () => {
    await loadUnreadMessageCount();
    if (feedMode === 'messages') await loadConversations();
    if (feedMode === 'chat' && activeConversation) {
      await openConversation(activeConversation, activeChatProfile);
    }
  }, 45000);
}

async function stopMessageUpdates() {
  if (messagePollTimer) {
    clearInterval(messagePollTimer);
    messagePollTimer = null;
  }
  if (messageChannel && supabase) {
    try { await supabase.removeChannel(messageChannel); }
    catch (error) { console.warn('Unable to close message channel:', error); }
  }
  messageChannel = null;
}

function updateNotificationBadges() {
  const count = Math.max(0, Number(unreadNotificationCount) || 0);
  const label = count > 99 ? '99+' : String(count);

  for (const badge of [els.notificationBellBadge, els.notificationNavBadge]) {
    badge.textContent = label;
    badge.classList.toggle('hidden', count === 0);
  }

  els.notificationBell.setAttribute(
    'aria-label',
    count
      ? `Open notifications, ${count} unread`
      : 'Open notifications'
  );
}

async function loadNotificationCount() {
  if (!currentUser) return;

  try {
    const { count, error } = await supabase
      .from('kt_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', currentUser.id)
      .is('read_at', null);

    if (error) throw error;
    unreadNotificationCount = count || 0;
    updateNotificationBadges();
  } catch (error) {
    console.warn('Unable to load notification count:', error);
  }
}

async function loadNotifications() {
  if (!currentUser) return;

  els.notificationsLoading.classList.remove('hidden');
  els.notificationsEmpty.classList.add('hidden');
  els.notificationsList.innerHTML = '';
  els.notificationsRefreshButton.disabled = true;

  try {
    const [notificationsResult, unreadResult] = await Promise.all([
      supabase
        .from('kt_notifications')
        .select('*')
        .eq('recipient_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('kt_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', currentUser.id)
        .is('read_at', null)
    ]);

    if (notificationsResult.error) throw notificationsResult.error;
    if (unreadResult.error) throw unreadResult.error;

    notifications = notificationsResult.data || [];
    unreadNotificationCount = unreadResult.count || 0;
    updateNotificationBadges();

    const actorIds = [...new Set(notifications.map(item => item.actor_id).filter(Boolean))];
    const postIds = [...new Set(notifications.map(item => item.post_id).filter(Boolean))];

    const [profilesResult, postsResult] = await Promise.all([
      actorIds.length
        ? supabase.from('kt_profiles').select('*').in('id', actorIds)
        : Promise.resolve({ data: [], error: null }),
      postIds.length
        ? supabase.from('kt_posts').select('id,body,image_url,user_id,created_at').in('id', postIds)
        : Promise.resolve({ data: [], error: null })
    ]);

    if (profilesResult.error) throw profilesResult.error;
    if (postsResult.error) throw postsResult.error;

    notificationProfiles = new Map(
      (profilesResult.data || []).map(profile => [profile.id, profile])
    );
    notificationPosts = new Map(
      (postsResult.data || []).map(post => [post.id, post])
    );

    renderNotifications();
  } catch (error) {
    els.notificationsList.innerHTML = '';
    const message = document.createElement('section');
    message.className = 'card notifications-error';
    message.textContent = `Unable to load notifications: ${error.message || error}`;
    els.notificationsList.appendChild(message);
  } finally {
    els.notificationsLoading.classList.add('hidden');
    els.notificationsRefreshButton.disabled = false;
  }
}

function notificationMessage(notification, actorName) {
  if (notification.type === 'follow') return `${actorName} started following you.`;
  if (notification.type === 'like') return `${actorName} liked your post.`;
  if (notification.type === 'comment') return `${actorName} commented on your post.`;
  return `${actorName} interacted with your account.`;
}

function notificationIcon(type) {
  if (type === 'follow') return '＋';
  if (type === 'like') return '♥';
  if (type === 'comment') return '◯';
  return '♢';
}

function renderNotifications() {
  if (!currentUser) return;

  const visible = notificationFilter === 'unread'
    ? notifications.filter(item => !item.read_at)
    : notifications;

  els.notificationsList.innerHTML = '';
  els.notificationsEmpty.classList.toggle('hidden', visible.length > 0);
  els.markAllNotificationsRead.disabled = unreadNotificationCount === 0;

  els.notificationsSummary.textContent = unreadNotificationCount
    ? `${unreadNotificationCount} unread ${unreadNotificationCount === 1 ? 'notification' : 'notifications'}`
    : 'You are all caught up.';

  if (!visible.length) {
    const unreadOnly = notificationFilter === 'unread';
    els.notificationsEmptyTitle.textContent = unreadOnly
      ? 'No unread notifications'
      : 'No notifications yet';
    els.notificationsEmptyText.textContent = unreadOnly
      ? 'You have read every notification.'
      : 'New followers, likes, and comments will appear here.';
    return;
  }

  for (const notification of visible) {
    els.notificationsList.appendChild(renderNotificationCard(notification));
  }
}

function renderNotificationCard(notification) {
  const actor = notificationProfiles.get(notification.actor_id) || {
    full_name: 'Khmer Together Member',
    username: 'member'
  };
  const post = notification.post_id
    ? notificationPosts.get(notification.post_id)
    : null;
  const unread = !notification.read_at;

  const card = document.createElement('article');
  card.className = `card notification-card ${unread ? 'unread' : ''}`.trim();
  card.dataset.notificationId = notification.id;

  const openButton = document.createElement('button');
  openButton.type = 'button';
  openButton.className = 'notification-open-button';
  openButton.addEventListener('click', () => openNotification(notification));

  const iconWrap = document.createElement('div');
  iconWrap.className = `notification-type-icon type-${notification.type}`;
  iconWrap.textContent = notificationIcon(notification.type);

  const avatar = document.createElement('div');
  avatar.className = 'avatar notification-avatar';
  setAvatar(avatar, actor);

  const content = document.createElement('div');
  content.className = 'notification-content';

  const message = document.createElement('p');
  const actorName = actor.full_name || 'A member';
  message.textContent = notificationMessage(notification, actorName);

  const meta = document.createElement('div');
  meta.className = 'notification-meta';

  const username = document.createElement('span');
  username.textContent = `@${actor.username || 'member'}`;

  const time = document.createElement('time');
  time.dateTime = notification.created_at;
  time.textContent = timeAgo(notification.created_at);

  meta.append(username, document.createTextNode(' · '), time);
  content.append(message, meta);

  if (post && (post.body || post.image_url)) {
    const preview = document.createElement('small');
    preview.className = 'notification-post-preview';
    preview.textContent = post.body
      ? post.body.slice(0, 120)
      : 'Photo post';
    content.appendChild(preview);
  }

  openButton.append(iconWrap, avatar, content);

  const controls = document.createElement('div');
  controls.className = 'notification-controls';

  if (unread) {
    const unreadDot = document.createElement('span');
    unreadDot.className = 'notification-unread-dot';
    unreadDot.title = 'Unread';

    const markRead = document.createElement('button');
    markRead.type = 'button';
    markRead.className = 'notification-read-button';
    markRead.textContent = 'Mark read';
    markRead.addEventListener('click', event => {
      event.stopPropagation();
      markNotificationAsRead(notification.id);
    });

    controls.append(unreadDot, markRead);
  }

  card.append(openButton, controls);
  return card;
}

async function markNotificationAsRead(notificationId, refreshPage = true) {
  const notification = notifications.find(item => item.id === notificationId);
  if (!notification || notification.read_at) return true;

  try {
    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from('kt_notifications')
      .update({ read_at: readAt })
      .eq('id', notificationId)
      .eq('recipient_id', currentUser.id);

    if (error) throw error;

    notification.read_at = readAt;
    unreadNotificationCount = Math.max(0, unreadNotificationCount - 1);
    updateNotificationBadges();
    if (refreshPage) renderNotifications();
    return true;
  } catch (error) {
    showToast(error.message || 'Unable to mark the notification as read.');
    return false;
  }
}

async function markAllNotificationsAsRead() {
  if (!unreadNotificationCount) return;

  els.markAllNotificationsRead.disabled = true;
  els.markAllNotificationsRead.textContent = 'Marking…';

  try {
    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from('kt_notifications')
      .update({ read_at: readAt })
      .eq('recipient_id', currentUser.id)
      .is('read_at', null);

    if (error) throw error;

    notifications = notifications.map(item => (
      item.read_at ? item : { ...item, read_at: readAt }
    ));
    unreadNotificationCount = 0;
    updateNotificationBadges();
    renderNotifications();
    showToast('All notifications marked as read.');
  } catch (error) {
    showToast(error.message || 'Unable to mark all notifications as read.');
  } finally {
    els.markAllNotificationsRead.textContent = 'Mark all read';
    els.markAllNotificationsRead.disabled = unreadNotificationCount === 0;
  }
}

async function openNotification(notification) {
  await markNotificationAsRead(notification.id, false);

  if (notification.type === 'follow' || !notification.post_id) {
    await openMemberProfile(notification.actor_id, {
      returnMode: 'notifications'
    });
    return;
  }

  history.pushState({}, '', '/');
  switchView('all', false, false);
  await loadFeed();

  const postCard = document.querySelector(
    `[data-post-id="${notification.post_id}"]`
  );

  if (!postCard) {
    showToast('This post is no longer available.');
    return;
  }

  postCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  postCard.classList.add('notification-target-post');
  setTimeout(() => postCard.classList.remove('notification-target-post'), 2800);
}

function startNotificationUpdates() {
  if (!currentUser || notificationChannel) return;

  notificationChannel = supabase
    .channel(`kt-notifications-${currentUser.id}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'kt_notifications',
        filter: `recipient_id=eq.${currentUser.id}`
      },
      async payload => {
        unreadNotificationCount += 1;
        updateNotificationBadges();
        showToast('You have a new notification.');

        if (feedMode === 'notifications') {
          await loadNotifications();
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'kt_notifications',
        filter: `recipient_id=eq.${currentUser.id}`
      },
      async () => {
        await loadNotificationCount();
        if (feedMode === 'notifications') await loadNotifications();
      }
    )
    .subscribe();

  notificationPollTimer = window.setInterval(() => {
    loadNotificationCount();
  }, 45000);
}

async function stopNotificationUpdates() {
  if (notificationPollTimer) {
    clearInterval(notificationPollTimer);
    notificationPollTimer = null;
  }

  if (notificationChannel && supabase) {
    try {
      await supabase.removeChannel(notificationChannel);
    } catch (error) {
      console.warn('Unable to close notification channel:', error);
    }
  }
  notificationChannel = null;
}

function currentFollowingIds() {
  return new Set(
    feedState.follows
      .filter(follow => follow.follower_id === currentUser.id)
      .map(follow => follow.following_id)
  );
}

function currentBlockedIds() {
  return new Set((feedState.blocks || []).map(block => block.blocked_id));
}

function renderMemberDirectory() {
  if (!currentUser) return;

  const followingIds = currentFollowingIds();
  const blockedIds = currentBlockedIds();
  const query = memberSearchTerm.toLocaleLowerCase();

  const allProfiles = [...feedState.profiles.values()]
    .filter(profile => !blockedIds.has(profile.id))
    .filter(profile => {
      if (!query) return true;
      return String(profile.full_name || '').toLocaleLowerCase().includes(query)
        || String(profile.username || '').toLocaleLowerCase().includes(query.replace(/^@/, ''));
    })
    .sort((a, b) => {
      if (a.id === currentUser.id) return -1;
      if (b.id === currentUser.id) return 1;
      return String(a.full_name || '').localeCompare(String(b.full_name || ''));
    });

  els.membersList.innerHTML = '';
  els.membersEmpty.classList.toggle('hidden', allProfiles.length > 0);

  const totalVisible = [...feedState.profiles.values()]
    .filter(profile => !blockedIds.has(profile.id)).length;

  els.memberSearchSummary.textContent = memberSearchTerm
    ? `${allProfiles.length} ${allProfiles.length === 1 ? 'member' : 'members'} found`
    : `${totalVisible} community ${totalVisible === 1 ? 'member' : 'members'}`;

  for (const profile of allProfiles.slice(0, 100)) {
    els.membersList.appendChild(renderMemberCard(profile, followingIds));
  }
}

function renderMemberCard(profile, followingIds) {
  const card = document.createElement('article');
  card.className = 'card member-card';

  const identity = document.createElement('div');
  identity.className = 'member-card-identity';

  const avatar = document.createElement('div');
  avatar.className = 'avatar member-card-avatar';
  setAvatar(avatar, profile);

  const text = document.createElement('div');
  text.className = 'member-card-text';

  const name = document.createElement('strong');
  name.textContent = profile.full_name || 'Khmer Together Member';

  const username = document.createElement('span');
  username.textContent = `@${profile.username || 'member'}`;

  const bio = document.createElement('p');
  bio.textContent = profile.bio || (profile.id === currentUser.id
    ? 'This is your profile.'
    : 'No bio yet.');

  text.append(name, username, bio);
  identity.append(avatar, text);
  makeProfileTrigger(identity, profile.id);

  const actions = document.createElement('div');
  actions.className = 'member-card-actions';

  if (profile.id === currentUser.id) {
    const you = document.createElement('span');
    you.className = 'mini-badge';
    you.textContent = 'YOU';
    actions.appendChild(you);
  } else {
    const following = followingIds.has(profile.id);
    const follow = document.createElement('button');
    follow.type = 'button';
    follow.className = `button small ${following ? 'ghost' : 'primary'}`;
    follow.textContent = following ? 'Following' : 'Follow';
    follow.addEventListener('click', async event => {
      event.stopPropagation();
      follow.disabled = true;
      const success = await toggleFollow(profile.id, following);
      if (!success) follow.disabled = false;
      renderMemberDirectory();
    });
    actions.appendChild(follow);
  }

  card.append(identity, actions);
  return card;
}

function showMemberProfileError(message) {
  els.memberProfileLoading.classList.add('hidden');
  els.memberProfileCard.classList.add('hidden');
  els.memberPostsHeading.classList.add('hidden');
  els.memberPostsEmpty.classList.add('hidden');
  els.memberPostsList.innerHTML = '';
  els.memberProfileErrorText.textContent = message;
  els.memberProfileError.classList.remove('hidden');
}

async function openMemberProfile(userId, options = {}) {
  if (!userId || !currentUser) return;

  const {
    pushHistory = true,
    returnMode = ['all','following','members','notifications','messages'].includes(feedMode)
      ? feedMode
      : memberProfileReturnMode
  } = options;

  memberProfileReturnMode = returnMode || 'members';
  activeMemberProfile = null;
  activeMemberPosts = [];

  switchView('profile', false, false);
  els.memberProfileLoading.classList.remove('hidden');
  els.memberProfileError.classList.add('hidden');
  els.memberProfileCard.classList.add('hidden');
  els.memberPostsHeading.classList.add('hidden');
  els.memberPostsEmpty.classList.add('hidden');
  els.memberPostsList.innerHTML = '';

  try {
    const [
      profileResult,
      postsResult,
      postCountResult,
      followerCountResult,
      followingCountResult,
      followStatusResult,
      blockStatusResult
    ] = await Promise.all([
      supabase.from('kt_profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('kt_posts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('kt_posts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase.from('kt_follows')
        .select('follower_id', { count: 'exact', head: true })
        .eq('following_id', userId),
      supabase.from('kt_follows')
        .select('following_id', { count: 'exact', head: true })
        .eq('follower_id', userId),
      userId === currentUser.id
        ? Promise.resolve({ data: null, error: null })
        : supabase.from('kt_follows')
            .select('following_id')
            .eq('follower_id', currentUser.id)
            .eq('following_id', userId)
            .maybeSingle(),
      userId === currentUser.id
        ? Promise.resolve({ data: null, error: null })
        : supabase.from('kt_blocks')
            .select('blocked_id')
            .eq('blocker_id', currentUser.id)
            .eq('blocked_id', userId)
            .maybeSingle()
    ]);

    for (const result of [
      profileResult,
      postsResult,
      postCountResult,
      followerCountResult,
      followingCountResult,
      followStatusResult,
      blockStatusResult
    ]) {
      if (result.error) throw result.error;
    }

    if (!profileResult.data) {
      showMemberProfileError('This profile is unavailable or the member has blocked access.');
      return;
    }

    const profilePosts = postsResult.data || [];
    const postIds = profilePosts.map(post => post.id);

    let comments = [];
    let likes = [];

    if (postIds.length) {
      const [commentsResult, likesResult] = await Promise.all([
        supabase.from('kt_comments')
          .select('*')
          .in('post_id', postIds)
          .order('created_at', { ascending: true }),
        supabase.from('kt_likes')
          .select('*')
          .in('post_id', postIds)
      ]);

      if (commentsResult.error) throw commentsResult.error;
      if (likesResult.error) throw likesResult.error;
      comments = commentsResult.data || [];
      likes = likesResult.data || [];
    }

    activeMemberProfile = profileResult.data;
    activeMemberPosts = profilePosts;
    activeMemberStats = {
      posts: postCountResult.count || 0,
      followers: followerCountResult.count || 0,
      following: followingCountResult.count || 0,
      followingMember: Boolean(followStatusResult.data),
      blockedByMe: Boolean(blockStatusResult.data)
    };

    feedState.profiles.set(activeMemberProfile.id, activeMemberProfile);

    const profilePostIds = new Set(profilePosts.map(post => post.id));
    feedState.posts = [
      ...profilePosts,
      ...feedState.posts.filter(post => !profilePostIds.has(post.id))
    ];
    feedState.comments = [
      ...comments,
      ...feedState.comments.filter(comment => !profilePostIds.has(comment.post_id))
    ];
    feedState.likes = [
      ...likes,
      ...feedState.likes.filter(like => !profilePostIds.has(like.post_id))
    ];

    if (activeMemberStats.followingMember) {
      const exists = feedState.follows.some(follow =>
        follow.follower_id === currentUser.id
        && follow.following_id === userId
      );
      if (!exists) {
        feedState.follows.push({
          follower_id: currentUser.id,
          following_id: userId
        });
      }
    }

    if (pushHistory) {
      history.pushState(
        { memberId: userId },
        '',
        profilePath(activeMemberProfile.username)
      );
    }

    renderMemberProfile();
  } catch (error) {
    showMemberProfileError(error.message || 'Unable to load this member profile.');
  } finally {
    els.memberProfileLoading.classList.add('hidden');
  }
}

function renderMemberProfile() {
  const profile = activeMemberProfile;
  if (!profile) return;

  const isMine = profile.id === currentUser.id;
  const followingIds = currentFollowingIds();

  els.memberProfileError.classList.add('hidden');
  els.memberProfileCard.classList.remove('hidden');
  els.memberPostsHeading.classList.remove('hidden');

  setAvatar(els.memberProfileAvatar, profile);
  els.memberProfileName.textContent = profile.full_name || 'Khmer Together Member';
  els.memberProfileUsername.textContent = `@${profile.username || 'member'}`;
  els.memberProfileBio.textContent = profile.bio || (isMine
    ? 'Add a bio so community members can know you better.'
    : 'No bio yet.');
  els.memberProfileYouBadge.classList.toggle('hidden', !isMine);

  els.memberProfilePostCount.textContent = String(activeMemberStats.posts || 0);
  els.memberProfileFollowerCount.textContent = String(activeMemberStats.followers || 0);
  els.memberProfileFollowingCount.textContent = String(activeMemberStats.following || 0);
  els.memberPostsSummary.textContent = `${activeMemberStats.posts || 0} total ${activeMemberStats.posts === 1 ? 'post' : 'posts'}`;

  els.memberProfileActions.innerHTML = '';

  if (isMine) {
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'button primary';
    edit.textContent = 'Edit profile';
    edit.addEventListener('click', openProfile);
    els.memberProfileActions.appendChild(edit);
  } else if (activeMemberStats.blockedByMe) {
    const unblock = document.createElement('button');
    unblock.type = 'button';
    unblock.className = 'button ghost';
    unblock.textContent = 'Unblock member';
    unblock.addEventListener('click', async () => {
      await unblockUser(profile.id, profile);
      activeMemberStats.blockedByMe = false;
      await openMemberProfile(profile.id, {
        pushHistory: false,
        returnMode: memberProfileReturnMode
      });
    });
    els.memberProfileActions.appendChild(unblock);
  } else {
    const message = document.createElement('button');
    message.type = 'button';
    message.className = 'button primary';
    message.textContent = 'Message';
    message.addEventListener('click', () => startConversation(profile));

    const follow = document.createElement('button');
    follow.type = 'button';
    follow.className = `button ${activeMemberStats.followingMember ? 'ghost' : 'primary'}`;
    follow.textContent = activeMemberStats.followingMember ? 'Following' : 'Follow';
    follow.addEventListener('click', async () => {
      follow.disabled = true;
      const success = await toggleFollow(profile.id, activeMemberStats.followingMember);
      if (success) {
        await openMemberProfile(profile.id, {
          pushHistory: false,
          returnMode: memberProfileReturnMode
        });
      } else {
        follow.disabled = false;
      }
    });

    const report = document.createElement('button');
    report.type = 'button';
    report.className = 'button ghost';
    report.textContent = 'Report member';
    report.addEventListener('click', () => openMemberReportDialog(profile));

    const block = document.createElement('button');
    block.type = 'button';
    block.className = 'button ghost danger-outline';
    block.textContent = 'Block member';
    block.addEventListener('click', async () => {
      const success = await blockUser(profile.id, profile);
      if (success) {
        history.pushState({}, '', '/');
        switchView('members', true, false);
      }
    });

    els.memberProfileActions.append(message, follow, report, block);
  }

  els.memberPostsList.innerHTML = '';
  els.memberPostsEmpty.classList.toggle('hidden', activeMemberPosts.length > 0);

  for (const post of activeMemberPosts) {
    els.memberPostsList.appendChild(renderPost(post, followingIds));
  }
}

function openMemberReportDialog(profile) {
  if (!profile || profile.id === currentUser.id) return;

  reportingMemberId = profile.id;
  reportingMemberProfile = profile;
  els.memberReportReason.value = '';
  els.memberReportDetails.value = '';
  setMessage(els.memberReportMessage);

  els.reportedMemberPreview.innerHTML = '';
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  setAvatar(avatar, profile);

  const text = document.createElement('div');
  const name = document.createElement('strong');
  name.textContent = profile.full_name || 'Khmer Together Member';
  const username = document.createElement('span');
  username.textContent = `@${profile.username || 'member'}`;
  text.append(name, username);

  els.reportedMemberPreview.append(avatar, text);
  els.memberReportDialog.showModal();
}

async function submitMemberReport(event) {
  event.preventDefault();
  if (!reportingMemberId) return;

  const reason = els.memberReportReason.value;
  const details = els.memberReportDetails.value.trim();

  if (!reason) {
    setMessage(els.memberReportMessage, 'Please select a reason.');
    return;
  }

  els.submitMemberReport.disabled = true;
  els.submitMemberReport.textContent = 'Submitting…';
  setMessage(els.memberReportMessage);

  try {
    const { error } = await supabase.from('kt_member_reports').insert({
      reported_id: reportingMemberId,
      reporter_id: currentUser.id,
      reason,
      details
    });

    if (error) {
      if (error.code === '23505') {
        throw new Error('You already reported this member.');
      }
      throw error;
    }

    els.memberReportDialog.close();
    showToast('Member report submitted privately.');
    reportingMemberId = null;
    reportingMemberProfile = null;
  } catch (error) {
    setMessage(els.memberReportMessage, error.message || 'Unable to submit this report.');
  } finally {
    els.submitMemberReport.disabled = false;
    els.submitMemberReport.textContent = 'Submit member report';
  }
}

async function blockUser(userId, profile = {}) {
  if (!userId || userId === currentUser.id) return false;

  const name = profile.full_name || 'this member';
  const username = profile.username ? ` (@${profile.username})` : '';
  const confirmed = confirm(
    `Block ${name}${username}?\n\n` +
    'Their posts and comments will disappear from your feed. Neither of you will be able to follow, like, or comment on the other person’s posts.'
  );
  if (!confirmed) return false;

  try {
    const { error } = await supabase.from('kt_blocks').insert({
      blocker_id: currentUser.id,
      blocked_id: userId
    });

    if (error) {
      if (error.code === '23505') throw new Error('This member is already blocked.');
      throw error;
    }

    showToast(`${name} was blocked.`);
    await loadFeed();
    if (feedMode === 'blocked') await loadBlockedUsers();
    return true;
  } catch (error) {
    showToast(error.message || 'Unable to block this member.');
    return false;
  }
}

async function unblockUser(userId, profile = {}) {
  const name = profile.full_name || 'this member';
  if (!confirm(`Unblock ${name}? Their posts may appear in your feed again.`)) return;

  try {
    const { error } = await supabase
      .from('kt_blocks')
      .delete()
      .eq('blocker_id', currentUser.id)
      .eq('blocked_id', userId);

    if (error) throw error;

    showToast(`${name} was unblocked.`);
    await Promise.all([loadBlockedUsers(), loadFeed()]);
  } catch (error) {
    showToast(error.message || 'Unable to unblock this member.');
  }
}

async function loadBlockedUsers() {
  if (!currentUser) return;

  els.blockedUsersLoading.classList.remove('hidden');
  els.blockedUsersEmpty.classList.add('hidden');
  els.blockedUsersList.innerHTML = '';
  els.blockedUsersRefreshButton.disabled = true;

  try {
    const { data: blocks, error: blocksError } = await supabase
      .from('kt_blocks')
      .select('blocked_id,created_at')
      .eq('blocker_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (blocksError) throw blocksError;

    const blockedIds = (blocks || []).map(block => block.blocked_id);
    let profiles = [];

    if (blockedIds.length) {
      const { data, error } = await supabase
        .from('kt_profiles')
        .select('*')
        .in('id', blockedIds);
      if (error) throw error;
      profiles = data || [];
    }

    const profileMap = new Map(profiles.map(profile => [profile.id, profile]));
    blockedUsers = (blocks || []).map(block => ({
      ...block,
      profile: profileMap.get(block.blocked_id) || {
        id: block.blocked_id,
        full_name: 'Khmer Together Member',
        username: 'member'
      }
    }));

    renderBlockedUsers();
  } catch (error) {
    els.blockedUsersList.innerHTML = '';
    const message = document.createElement('section');
    message.className = 'card blocked-users-error';
    message.textContent = `Unable to load blocked users: ${error.message || error}`;
    els.blockedUsersList.appendChild(message);
  } finally {
    els.blockedUsersLoading.classList.add('hidden');
    els.blockedUsersRefreshButton.disabled = false;
  }
}

function renderBlockedUsers() {
  els.blockedUsersList.innerHTML = '';
  els.blockedUsersEmpty.classList.toggle('hidden', blockedUsers.length > 0);
  els.blockedUsersSummary.textContent = blockedUsers.length
    ? `${blockedUsers.length} blocked ${blockedUsers.length === 1 ? 'member' : 'members'}. You can unblock them at any time.`
    : 'People you block cannot follow, like, or comment on your posts.';

  for (const entry of blockedUsers) {
    const profile = entry.profile;
    const card = document.createElement('article');
    card.className = 'card blocked-user-card';

    const identity = document.createElement('div');
    identity.className = 'blocked-user-identity';

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    setAvatar(avatar, profile);

    const text = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = profile.full_name || 'Khmer Together Member';
    const username = document.createElement('span');
    username.textContent = `@${profile.username || 'member'}`;
    const date = document.createElement('small');
    date.textContent = `Blocked ${timeAgo(entry.created_at)}`;
    text.append(name, username, date);

    identity.append(avatar, text);

    const unblock = document.createElement('button');
    unblock.type = 'button';
    unblock.className = 'button ghost small unblock-user-button';
    unblock.textContent = 'Unblock';
    unblock.addEventListener('click', () => unblockUser(entry.blocked_id, profile));

    card.append(identity, unblock);
    els.blockedUsersList.appendChild(card);
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
  impersonation: 'Fake account or impersonation',
  unsafe_account: 'Unsafe or suspicious account',
  unsafe_message: 'Threatening or unsafe messages',
  other: 'Other'
};

async function loadAdminReports() {
  if (!isAdmin) return;

  els.adminReportsLoading.classList.remove('hidden');
  els.adminReportsEmpty.classList.add('hidden');
  els.adminReportsList.innerHTML = '';
  els.adminRefreshButton.disabled = true;

  try {
    const [postReportsResult, memberReportsResult, conversationReportsResult] = await Promise.all([
      supabase.from('kt_reports').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('kt_member_reports').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('kt_conversation_reports').select('*').order('created_at', { ascending: false }).limit(200)
    ]);

    if (postReportsResult.error) throw postReportsResult.error;
    if (memberReportsResult.error) throw memberReportsResult.error;
    if (conversationReportsResult.error) throw conversationReportsResult.error;

    const postReports = postReportsResult.data || [];
    const memberReports = memberReportsResult.data || [];
    const conversationReports = conversationReportsResult.data || [];
    const postIds = [...new Set(postReports.map(report => report.post_id).filter(Boolean))];
    let posts = [];

    if (postIds.length) {
      const { data, error } = await supabase.from('kt_posts').select('*').in('id', postIds);
      if (error) throw error;
      posts = data || [];
    }

    const userIds = [...new Set([
      ...postReports.map(report => report.reporter_id),
      ...memberReports.map(report => report.reporter_id),
      ...memberReports.map(report => report.reported_id),
      ...conversationReports.map(report => report.reporter_id),
      ...conversationReports.map(report => report.reported_id),
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

    const preparedPostReports = postReports.map(report => {
      const post = postMap.get(report.post_id) || null;
      return {
        ...report, kind: 'post', post,
        reporter: profileMap.get(report.reporter_id) || null,
        author: post ? profileMap.get(post.user_id) || null : null
      };
    });

    const preparedMemberReports = memberReports.map(report => ({
      ...report, kind: 'member',
      reporter: profileMap.get(report.reporter_id) || null,
      reportedMember: profileMap.get(report.reported_id) || null
    }));

    const preparedConversationReports = conversationReports.map(report => ({
      ...report, kind: 'conversation',
      reporter: profileMap.get(report.reporter_id) || null,
      reportedMember: profileMap.get(report.reported_id) || null
    }));

    adminReports = [
      ...preparedPostReports,
      ...preparedMemberReports,
      ...preparedConversationReports
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

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
  const visible = filter === 'all' ? adminReports : adminReports.filter(report => report.status === filter);
  const openCount = adminReports.filter(report => report.status === 'open').length;
  const reviewingCount = adminReports.filter(report => report.status === 'reviewing').length;
  const conversationCount = adminReports.filter(report => report.kind === 'conversation').length;
  els.adminSummary.textContent = `${openCount} open · ${reviewingCount} reviewing · ${conversationCount} conversation reports · ${adminReports.length} total`;
  els.adminReportsList.innerHTML = '';
  els.adminReportsEmpty.classList.toggle('hidden', visible.length > 0);
  for (const report of visible) els.adminReportsList.appendChild(renderAdminReportCard(report));
}

function renderAdminReportCard(report) {
  const card = document.createElement('article');
  card.className = 'card admin-report-card';
  const header = document.createElement('header');
  header.className = 'admin-report-header';
  const titleWrap = document.createElement('div');
  const reason = document.createElement('strong');
  const kindLabel = report.kind === 'conversation' ? 'Conversation report' : report.kind === 'member' ? 'Member report' : 'Post report';
  reason.textContent = `${kindLabel} · ${REPORT_REASON_LABELS[report.reason] || report.reason}`;
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

  if (report.kind === 'post') {
    const postBox = document.createElement('section');
    postBox.className = 'reported-post-preview';
    const postLabel = document.createElement('small');
    postLabel.textContent = report.author ? `Reported post by ${report.author.full_name} (@${report.author.username})` : 'Reported post';
    postBox.appendChild(postLabel);
    if (report.post) {
      if (report.post.body) { const p=document.createElement('p'); p.textContent=report.post.body; postBox.appendChild(p); }
      if (report.post.image_url) { const img=document.createElement('img'); img.src=report.post.image_url; img.alt='Reported post image'; img.loading='lazy'; postBox.appendChild(img); }
    } else {
      const missing=document.createElement('p'); missing.className='muted'; missing.textContent='This post is no longer available.'; postBox.appendChild(missing);
    }
    card.appendChild(postBox);
  } else {
    const memberBox = document.createElement('section');
    memberBox.className = 'reported-member-admin-preview';
    const member = report.reportedMember;
    const avatar=document.createElement('div'); avatar.className='avatar'; setAvatar(avatar, member || {});
    const identity=document.createElement('div');
    const name=document.createElement('strong'); name.textContent=member?.full_name || 'Member unavailable';
    const username=document.createElement('span'); username.textContent=`@${member?.username || 'member'}`;
    const note=document.createElement('p');
    note.textContent = report.kind === 'conversation'
      ? 'Conversation report only. Private message contents are not shown to administrators.'
      : (member?.bio || 'No bio available.');
    identity.append(name, username, note); memberBox.append(avatar, identity); card.appendChild(memberBox);
  }

  const actions=document.createElement('div'); actions.className='admin-report-actions';
  if (report.status !== 'reviewing') actions.appendChild(adminActionButton('Start review',()=>updateReportStatus(report,'reviewing')));
  if (report.status !== 'resolved') actions.appendChild(adminActionButton('Resolve',()=>updateReportStatus(report,'resolved'),'primary-lite'));
  if (report.status !== 'dismissed') actions.appendChild(adminActionButton('Dismiss',()=>updateReportStatus(report,'dismissed')));
  if (report.kind === 'post' && report.post) actions.appendChild(adminActionButton('Delete post',()=>adminDeleteReportedPost(report),'danger'));
  if ((report.kind === 'member' || report.kind === 'conversation') && report.reportedMember) {
    actions.appendChild(adminActionButton('Open profile',()=>openMemberProfile(report.reportedMember.id,{returnMode:'admin'})));
  }
  card.appendChild(actions);
  return card;
}

function adminActionButton(label, action, variant = '') {
  const button=document.createElement('button'); button.type='button'; button.className=`admin-action-button ${variant}`.trim(); button.textContent=label; button.addEventListener('click',action); return button;
}

async function updateReportStatus(report, status) {
  const table = report.kind === 'conversation' ? 'kt_conversation_reports' : report.kind === 'member' ? 'kt_member_reports' : 'kt_reports';
  try {
    const { error } = await supabase.from(table).update({ status }).eq('id', report.id);
    if (error) throw error;
    showToast(`Report marked ${status}.`);
    await loadAdminReports();
  } catch (error) { showToast(error.message || 'Unable to update the report.'); }
}

async function adminDeleteReportedPost(report) {
  if (!report.post || !confirm('Delete this reported post? This cannot be undone.')) return;
  try {
    const { error } = await supabase.from('kt_posts').delete().eq('id', report.post.id);
    if (error) throw error;
    if (report.post.image_url) {
      const path=storagePathFromPublicUrl(report.post.image_url,'kt-post-images');
      if (path) await supabase.storage.from('kt-post-images').remove([path]);
    }
    showToast('Reported post deleted.');
    await Promise.all([loadAdminReports(),loadFeed()]);
  } catch (error) { showToast(error.message || 'Unable to delete the reported post.'); }
}


init();
