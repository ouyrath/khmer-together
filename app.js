import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let supabase;
let currentUser = null;
let currentProfile = null;
let authMode = 'signin';
let feedMode = 'all';
let activeSharedPostId = null;
let selectedPostImages = [];
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
let selectedChatImages = [];
let photoViewerUrls = [];
let photoViewerIndex = 0;
let recordedChatAudioBlob = null;
let recordedChatAudioPreviewUrl = null;
let recordedChatAudioDuration = 0;
let chatMediaRecorder = null;
let chatMediaStream = null;
let chatAudioChunks = [];
let chatRecordingStartedAt = 0;
let chatRecordingTimer = null;
let cancelCurrentChatRecording = false;
const messageAttachmentUrlCache = new Map();
const CHAT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const MAX_PHOTOS_PER_ITEM = 5;
const MAX_PHOTO_TOTAL_BYTES = 30 * 1024 * 1024;
const CHAT_AUDIO_MAX_BYTES = 15 * 1024 * 1024;
const CHAT_AUDIO_MAX_SECONDS = 5 * 60;
const recentCommentSubmissions = new Map();
const CALL_MESSAGE_PREFIX = '[[KT_CALL_V1]]';
let callButtonBusy = false;
let feedState = { profiles: new Map(), posts: [], comments: [], likes: [], follows: [], blocks: [] };

const els = {
  toast: $('#toast'), connectionBanner: $('#connectionBanner'),
  authView: $('#authView'), appView: $('#appView'),
  topActions: $('#topActions'), authForm: $('#authForm'),
  email: $('#emailInput'), password: $('#passwordInput'),
  authButton: $('#emailAuthButton'), toggleMode: $('#toggleAuthMode'),
  google: $('#googleButton'), authMessage: $('#authMessage'),
  signOut: $('#signOutButton'), mobileSignOut: $('#mobileSignOutButton'), myName: $('#myName'),
  myUsername: $('#myUsername'), myAvatar: $('#myAvatar'),
  composerAvatar: $('#composerAvatar'), feed: $('#feed'),
  loading: $('#loadingFeed'), empty: $('#emptyFeed'),
  feedTitle: $('#feedTitle'), feedSubtitle: $('#feedSubtitle'),
  sharedPostBack: $('#sharedPostBackButton'),
  refresh: $('#refreshButton'), postDialog: $('#postDialog'),
  postForm: $('#postForm'), postBody: $('#postBody'),
  postImage: $('#postImage'), postMessage: $('#postMessage'),
  publish: $('#publishButton'), imagePreviewWrap: $('#imagePreviewWrap'),
  imagePreviewGrid: $('#imagePreviewGrid'), postPhotoCount: $('#postPhotoCount'),
  removeImage: $('#removeImageButton'),
  profileForm: $('#profileForm'), profileSettingsCard: $('#profileSettingsCard'),
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
  chatMemberUsername: $('#chatMemberUsername'),
  chatVoiceCallButton: $('#chatVoiceCallButton'),
  chatVideoCallButton: $('#chatVideoCallButton'),
  chatReportButton: $('#chatReportButton'),
  chatBlockButton: $('#chatBlockButton'), chatPrivacyNote: $('#chatPrivacyNote'),
  chatBlockedNotice: $('#chatBlockedNotice'), chatLoading: $('#chatLoading'),
  chatEmpty: $('#chatEmpty'), chatMessages: $('#chatMessages'),
  chatComposer: $('#chatComposer'), chatMessageInput: $('#chatMessageInput'),
  sendMessageButton: $('#sendMessageButton'), chatMessageStatus: $('#chatMessageStatus'),
  chatPhotoInput: $('#chatPhotoInput'), chatPhotoButton: $('#chatPhotoButton'),
  chatVoiceButton: $('#chatVoiceButton'), chatAttachmentPreview: $('#chatAttachmentPreview'),
  chatImageDraft: $('#chatImageDraft'), chatImageDraftGrid: $('#chatImageDraftGrid'),
  chatImageDraftInfo: $('#chatImageDraftInfo'), chatAudioDraft: $('#chatAudioDraft'),
  chatAudioDraftPlayer: $('#chatAudioDraftPlayer'), chatAudioDraftInfo: $('#chatAudioDraftInfo'),
  removeChatAttachment: $('#removeChatAttachmentButton'),
  chatRecordingPanel: $('#chatRecordingPanel'), chatRecordingTime: $('#chatRecordingTime'),
  stopVoiceRecording: $('#stopVoiceRecordingButton'),
  cancelVoiceRecording: $('#cancelVoiceRecordingButton'),
  conversationReportDialog: $('#conversationReportDialog'),
  conversationReportForm: $('#conversationReportForm'),
  conversationReportReason: $('#conversationReportReason'),
  conversationReportDetails: $('#conversationReportDetails'),
  conversationReportMessage: $('#conversationReportMessage'),
  submitConversationReport: $('#submitConversationReportButton'),
  reportedConversationMember: $('#reportedConversationMember'),
  accountSettingsNav: $('#accountSettingsNav'),
  accountSettingsView: $('#accountSettingsView'),
  settingsCurrentEmail: $('#settingsCurrentEmail'),
  settingsProvider: $('#settingsProvider'),
  changeEmailForm: $('#changeEmailForm'), newEmail: $('#newEmailInput'),
  changeEmailMessage: $('#changeEmailMessage'), changeEmailButton: $('#changeEmailButton'),
  changePasswordForm: $('#changePasswordForm'), currentPassword: $('#currentPasswordInput'),
  newPassword: $('#newPasswordInput'), confirmPassword: $('#confirmPasswordInput'),
  passwordNonce: $('#passwordNonceInput'), changePasswordButton: $('#changePasswordButton'),
  sendPasswordCode: $('#sendPasswordCodeButton'), changePasswordMessage: $('#changePasswordMessage'),
  signOutEverywhere: $('#signOutEverywhereButton'),
  signOutEverywhereMessage: $('#signOutEverywhereMessage'),
  openDeleteAccount: $('#openDeleteAccountButton'), deleteAccountDialog: $('#deleteAccountDialog'),
  deleteAccountForm: $('#deleteAccountForm'), deleteExpectedUsername: $('#deleteExpectedUsername'),
  deleteUsername: $('#deleteUsernameInput'), deleteWord: $('#deleteWordInput'),
  deleteUnderstanding: $('#deleteUnderstandingCheckbox'),
  deleteAccountMessage: $('#deleteAccountMessage'),
  confirmDeleteAccount: $('#confirmDeleteAccountButton'),
  photoViewerDialog: $('#photoViewerDialog'), photoViewerImage: $('#photoViewerImage'),
  photoViewerCaption: $('#photoViewerCaption'), closePhotoViewer: $('#closePhotoViewerButton'),
  previousPhoto: $('#previousPhotoButton'), nextPhoto: $('#nextPhotoButton'),
  mobileBottomNav: $('#mobileBottomNav'), mobileFeedNav: $('#mobileFeedNav'),
  mobileMessagesNav: $('#mobileMessagesNav'), mobileMessageBadge: $('#mobileMessageBadge'),
  mobileCreatePost: $('#mobileCreatePostButton'),
  mobileNotificationsNav: $('#mobileNotificationsNav'),
  mobileNotificationBadge: $('#mobileNotificationBadge'),
  mobileMoreButton: $('#mobileMoreButton'), mobileMoreDialog: $('#mobileMoreDialog'),
  mobileMoreProfile: $('#mobileMoreProfileButton'), mobileMoreAvatar: $('#mobileMoreAvatar'),
  mobileMoreName: $('#mobileMoreName'), mobileMoreUsername: $('#mobileMoreUsername'),
  mobileMoreAdmin: $('#mobileMoreAdminButton'), mobileMoreSignOut: $('#mobileMoreSignOutButton')
};

function updateConnectionStatus(announce = false) {
  const offline = !navigator.onLine;
  els.connectionBanner.classList.toggle('hidden', !offline);

  if (announce && !offline) {
    showToast('Back online. Refreshing Khmer Together…');
    if (currentUser) {
      Promise.allSettled([
        loadFeed(),
        loadNotificationCount(),
        loadUnreadMessageCount()
      ]);
    }
  }
}

function closeMobileMoreMenu() {
  if (els.mobileMoreDialog.open) els.mobileMoreDialog.close();
}

function openMobileMoreMenu() {
  updateMyProfileUI();
  if (!els.mobileMoreDialog.open) els.mobileMoreDialog.showModal();
}

function syncMobileNavigation(mode) {
  const moreModes = new Set([
    'following', 'members', 'blocked', 'settings', 'admin', 'profile'
  ]);
  els.mobileMoreButton.classList.toggle('active', moreModes.has(mode));
  els.mobileBottomNav.dataset.activeMode = mode;
}

function refreshCurrentView() {
  if (!currentUser) return;
  if (feedMode === 'messages') return loadConversations();
  if (feedMode === 'notifications') return loadNotifications();
  if (feedMode === 'blocked') return loadBlockedUsers();
  if (feedMode === 'admin' && isAdmin) return loadAdminReports();
  return loadFeed();
}

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

function postPath(postId = '') {
  return `/p/${encodeURIComponent(postId)}`;
}

function isDeepLinkPath() {
  return /^\/(?:u|p)\//i.test(location.pathname);
}

function sharedPostUrl(postId) {
  return `${location.origin}${postPath(postId)}`;
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  input.style.pointerEvents = 'none';
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  if (!copied) throw new Error('Copy was not supported by this browser.');
}

async function copyPostLink(postId) {
  try {
    await copyTextToClipboard(sharedPostUrl(postId));
    showToast('Post link copied.');
  } catch (error) {
    showToast(error.message || 'Unable to copy the post link.');
  }
}

async function sharePostThroughApps(post, profile) {
  const url = sharedPostUrl(post.id);
  const authorName = profile?.full_name || 'Khmer Together Member';
  const body = String(post.body || '').trim();
  const shareData = {
    title: `${authorName} on Khmer Together`,
    text: body
      ? body.slice(0, 180)
      : `${authorName} shared photos on Khmer Together.`,
    url
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }

  await copyPostLink(post.id);
}

async function loadSharedPostData(postId) {
  let post = feedState.posts.find(item => item.id === postId);
  if (post) return post;

  const { data: fetchedPost, error: postError } = await supabase
    .from('kt_posts')
    .select('*')
    .eq('id', postId)
    .maybeSingle();

  if (postError || !fetchedPost) return null;

  const [commentsResult, likesResult, profileResult] = await Promise.all([
    supabase
      .from('kt_comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true }),
    supabase
      .from('kt_likes')
      .select('*')
      .eq('post_id', postId),
    supabase
      .from('kt_profiles')
      .select('*')
      .eq('id', fetchedPost.user_id)
      .maybeSingle()
  ]);

  if (commentsResult.error || likesResult.error || profileResult.error) {
    return null;
  }

  feedState.posts = [
    fetchedPost,
    ...feedState.posts.filter(item => item.id !== fetchedPost.id)
  ];
  feedState.comments = [
    ...feedState.comments.filter(item => item.post_id !== postId),
    ...(commentsResult.data || [])
  ];
  feedState.likes = [
    ...feedState.likes.filter(item => item.post_id !== postId),
    ...(likesResult.data || [])
  ];
  if (profileResult.data) {
    feedState.profiles.set(profileResult.data.id, profileResult.data);
  }

  return fetchedPost;
}

function showSharedPostUnavailable() {
  activeSharedPostId = null;
  switchView('post', false, false);
  els.empty.classList.add('hidden');
  els.feed.innerHTML = `
    <section class="card shared-post-unavailable">
      <div class="empty-icon">⌁</div>
      <h3>Post unavailable</h3>
      <p>The post may have been deleted, or you may not have permission to view it.</p>
      <button class="button primary" type="button">Return to community feed</button>
    </section>
  `;
  els.feed.querySelector('button')?.addEventListener('click', returnToCommunityFeed);
}

async function openSharedPost(postId, options = {}) {
  const { pushHistory = true } = options;
  if (!postId) return showSharedPostUnavailable();

  const post = await loadSharedPostData(postId);
  if (!post) {
    if (pushHistory) history.pushState({}, '', postPath(postId));
    showSharedPostUnavailable();
    return;
  }

  activeSharedPostId = post.id;
  if (pushHistory) history.pushState({}, '', postPath(post.id));
  switchView('post', false, false);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function returnToCommunityFeed() {
  activeSharedPostId = null;
  history.pushState({}, '', '/');
  switchView('all', false, false);
}

async function handleLocationRoute() {
  if (!currentUser) return;

  const postMatch = location.pathname.match(/^\/p\/([^/]+)\/?$/i);
  if (postMatch) {
    await openSharedPost(decodeURIComponent(postMatch[1]), {
      pushHistory: false
    });
    return;
  }

  const profileMatch = location.pathname.match(/^\/u\/([^/]+)\/?$/i);
  if (!profileMatch) {
    if (feedMode === 'profile' || feedMode === 'post') {
      activeSharedPostId = null;
      switchView('all', false, false);
    }
    return;
  }

  const username = decodeURIComponent(profileMatch[1]).toLowerCase();
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
      showMemberProfileError(
        'This profile is unavailable or the member has blocked access.'
      );
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

function allowedPhotoType(file) {
  return ['image/jpeg','image/png','image/gif','image/webp'].includes(
    String(file?.type || '').toLowerCase()
  );
}

function uniqueSelectedFiles(existingEntries, files) {
  const existingKeys = new Set(existingEntries.map(entry =>
    `${entry.file.name}:${entry.file.size}:${entry.file.lastModified}`
  ));
  return files.filter(file => {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (existingKeys.has(key)) return false;
    existingKeys.add(key);
    return true;
  });
}

function postImageUrls(post) {
  const arrayUrls = Array.isArray(post?.image_urls) ? post.image_urls : [];
  return [...new Set([
    ...arrayUrls,
    ...(post?.image_url ? [post.image_url] : [])
  ].filter(Boolean))].slice(0, MAX_PHOTOS_PER_ITEM);
}

function openPhotoViewer(urls, index = 0) {
  photoViewerUrls = [...new Set((urls || []).filter(Boolean))];
  if (!photoViewerUrls.length) return;
  photoViewerIndex = Math.max(0, Math.min(index, photoViewerUrls.length - 1));
  updatePhotoViewer();
  els.photoViewerDialog.showModal();
}

function updatePhotoViewer() {
  const url = photoViewerUrls[photoViewerIndex];
  if (!url) return;
  els.photoViewerImage.src = url;
  els.photoViewerCaption.textContent =
    `Photo ${photoViewerIndex + 1} of ${photoViewerUrls.length}`;
  const multiple = photoViewerUrls.length > 1;
  els.previousPhoto.classList.toggle('hidden', !multiple);
  els.nextPhoto.classList.toggle('hidden', !multiple);
}

function movePhotoViewer(direction) {
  if (photoViewerUrls.length < 2) return;
  photoViewerIndex =
    (photoViewerIndex + direction + photoViewerUrls.length) % photoViewerUrls.length;
  updatePhotoViewer();
}

function closePhotoViewer() {
  if (els.photoViewerDialog.open) els.photoViewerDialog.close();
  els.photoViewerImage.removeAttribute('src');
  photoViewerUrls = [];
  photoViewerIndex = 0;
}

function renderPhotoGallery(container, urls, classPrefix = 'post') {
  container.innerHTML = '';
  const photos = [...new Set((urls || []).filter(Boolean))]
    .slice(0, MAX_PHOTOS_PER_ITEM);
  container.classList.toggle('hidden', !photos.length);
  container.dataset.count = String(photos.length);

  photos.forEach((url, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `${classPrefix}-gallery-item`;
    button.setAttribute('aria-label', `Open photo ${index + 1} of ${photos.length}`);

    const image = document.createElement('img');
    image.src = url;
    image.alt = `Photo ${index + 1} of ${photos.length}`;
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';

    button.appendChild(image);
    button.addEventListener('click', () => openPhotoViewer(photos, index));
    container.appendChild(button);
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
  const signOutUser = () => supabase.auth.signOut({ scope: 'local' });
  els.signOut.addEventListener('click', signOutUser);
  els.mobileSignOut.addEventListener('click', signOutUser);
  els.mobileMoreSignOut.addEventListener('click', signOutUser);
  els.refresh.addEventListener('click', refreshCurrentView);
  els.sharedPostBack.addEventListener('click', returnToCommunityFeed);
  $('#newPostTop').addEventListener('click', openComposer);
  els.mobileCreatePost.addEventListener('click', openComposer);
  els.mobileMoreButton.addEventListener('click', openMobileMoreMenu);
  els.mobileMoreProfile.addEventListener('click', () => {
    closeMobileMoreMenu();
    openMemberProfile(currentUser.id, { returnMode: 'all' });
  });
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
    if (isDeepLinkPath()) history.pushState({}, '', '/');
    switchView('notifications');
  });
  els.notificationsRefreshButton.addEventListener('click', loadNotifications);
  els.markAllNotificationsRead.addEventListener('click', markAllNotificationsAsRead);
  els.messageTopButton.addEventListener('click', () => {
    if (isDeepLinkPath()) history.pushState({}, '', '/');
    switchView('messages');
  });
  els.messagesRefreshButton.addEventListener('click', loadConversations);
  els.findMembersForMessages.addEventListener('click', () => switchView('members'));
  els.chatBackButton.addEventListener('click', () => { clearChatAttachmentDraft(); switchView('messages'); });
  els.chatMemberButton.addEventListener('click', () => {
    if (activeChatProfile?.id) openMemberProfile(activeChatProfile.id, { returnMode: 'messages' });
  });
  els.chatVoiceCallButton.addEventListener('click', () => startChatCall('voice'));
  els.chatVideoCallButton.addEventListener('click', () => startChatCall('video'));
  els.chatReportButton.addEventListener('click', openConversationReportDialog);
  els.chatBlockButton.addEventListener('click', blockActiveChatMember);
  els.chatComposer.addEventListener('submit', sendChatMessage);
  els.chatPhotoButton.addEventListener('click', () => els.chatPhotoInput.click());
  els.chatPhotoInput.addEventListener('change', selectChatPhoto);
  els.chatVoiceButton.addEventListener('click', startChatVoiceRecording);
  els.stopVoiceRecording.addEventListener('click', () => stopChatVoiceRecording(true));
  els.cancelVoiceRecording.addEventListener('click', () => stopChatVoiceRecording(false));
  els.removeChatAttachment.addEventListener('click', clearChatAttachmentDraft);
  els.conversationReportForm.addEventListener('submit', submitConversationReport);
  els.changeEmailForm.addEventListener('submit', changeAccountEmail);
  els.changePasswordForm.addEventListener('submit', changeAccountPassword);
  els.sendPasswordCode.addEventListener('click', sendPasswordVerificationCode);
  els.signOutEverywhere.addEventListener('click', signOutOnAllDevices);
  els.openDeleteAccount.addEventListener('click', openDeleteAccountDialog);
  els.deleteAccountForm.addEventListener('submit', permanentlyDeleteAccount);
  els.closePhotoViewer.addEventListener('click', closePhotoViewer);
  els.previousPhoto.addEventListener('click', () => movePhotoViewer(-1));
  els.nextPhoto.addEventListener('click', () => movePhotoViewer(1));
  els.photoViewerDialog.addEventListener('click', event => {
    if (event.target === els.photoViewerDialog) closePhotoViewer();
  });
  document.addEventListener('keydown', event => {
    if (!els.photoViewerDialog.open) return;
    if (event.key === 'ArrowLeft') movePhotoViewer(-1);
    if (event.key === 'ArrowRight') movePhotoViewer(1);
  });
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
  window.addEventListener('offline', () => updateConnectionStatus());
  window.addEventListener('online', () => updateConnectionStatus(true));
  window.addEventListener('resize', () => {
    if (window.innerWidth > 600) closeMobileMoreMenu();
  });
  updateConnectionStatus();
  $$('.close-button').forEach(button => {
    button.addEventListener('click', () => button.closest('dialog')?.close());
  });

  document.addEventListener('click', () => {
    closeCommentMenus();
    closePostMenus();
    closeShareMenus();
  });

  $$('[data-feed]').forEach(button => {
    button.addEventListener('click', () => {
      closeMobileMoreMenu();
      if (isDeepLinkPath()) history.pushState({}, '', '/');
      switchView(button.dataset.feed);

      if (button.closest('.mobile-bottom-nav')) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
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
    els.mobileMoreAdmin.classList.add('hidden');
    els.authView.classList.remove('hidden');
    els.appView.classList.add('hidden');
    els.topActions.classList.add('hidden');
    els.mobileBottomNav.classList.add('hidden');
    closeMobileMoreMenu();
    return;
  }

  els.authView.classList.add('hidden');
  els.appView.classList.remove('hidden');
  els.topActions.classList.remove('hidden');
  els.mobileBottomNav.classList.remove('hidden');

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
  els.mobileMoreAdmin.classList.toggle('hidden', !isAdmin);
}

function switchView(mode, load = true, updateHistory = true) {
  if (mode === 'admin' && !isAdmin) return;

  feedMode = mode;
  $$('[data-feed]').forEach(item => {
    const activeMode =
      mode === 'profile' ? 'members'
      : mode === 'chat' ? 'messages'
      : mode === 'post' ? 'all'
      : mode;
    item.classList.toggle('active', item.dataset.feed === activeMode);
  });
  syncMobileNavigation(mode);

  const adminMode = mode === 'admin';
  const blockedMode = mode === 'blocked';
  const membersMode = mode === 'members';
  const profileMode = mode === 'profile';
  const notificationsMode = mode === 'notifications';
  const messagesMode = mode === 'messages';
  const chatMode = mode === 'chat';
  const settingsMode = mode === 'settings';
  const postMode = mode === 'post';
  const specialMode = adminMode || blockedMode || membersMode || profileMode || notificationsMode || messagesMode || chatMode || settingsMode;

  els.composerCard.classList.toggle('hidden', specialMode || postMode);
  els.feedHeading.classList.toggle('hidden', specialMode);
  els.feed.classList.toggle('hidden', specialMode);
  els.adminReportsView.classList.toggle('hidden', !adminMode);
  els.blockedUsersView.classList.toggle('hidden', !blockedMode);
  els.membersView.classList.toggle('hidden', !membersMode);
  els.memberProfileView.classList.toggle('hidden', !profileMode);
  els.notificationsView.classList.toggle('hidden', !notificationsMode);
  els.messagesView.classList.toggle('hidden', !messagesMode);
  els.chatView.classList.toggle('hidden', !chatMode);
  els.accountSettingsView.classList.toggle('hidden', !settingsMode);

  if (updateHistory && !profileMode && !postMode && isDeepLinkPath()) {
    history.pushState({}, '', '/');
    activeSharedPostId = null;
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

  if (settingsMode) {
    els.loading.classList.add('hidden');
    els.empty.classList.add('hidden');
    renderAccountSettings();
    return;
  }

  if (postMode) {
    els.loading.classList.add('hidden');
    els.feedTitle.textContent = 'Shared post';
    els.feedSubtitle.textContent = 'A direct post from the Khmer Together community.';
    els.sharedPostBack.classList.remove('hidden');
    renderFeed();
    return;
  }

  els.sharedPostBack.classList.add('hidden');
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
  setAvatar(els.mobileMoreAvatar, currentProfile || { full_name: name });
  els.mobileMoreName.textContent = name;
  els.mobileMoreUsername.textContent = `@${username}`;
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

function openComposer() {
  closeMobileMoreMenu();
  setMessage(els.postMessage);
  els.postDialog.showModal();
  setTimeout(() => els.postBody.focus(), 50);
}
function openProfile() {
  closeMobileMoreMenu();
  if (isDeepLinkPath()) history.pushState({}, '', '/');
  switchView('settings');
  updateMyProfileUI();
  setMessage(els.profileMessage);
  requestAnimationFrame(() => {
    els.profileSettingsCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => els.profileName?.focus(), 350);
  });
}

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

function renderSelectedPostImages() {
  els.imagePreviewGrid.innerHTML = '';
  els.imagePreviewWrap.classList.toggle('hidden', !selectedPostImages.length);
  els.postPhotoCount.textContent =
    `${selectedPostImages.length} of ${MAX_PHOTOS_PER_ITEM} photos selected`;

  selectedPostImages.forEach((entry, index) => {
    const item = document.createElement('div');
    item.className = 'multi-image-preview-item';

    const image = document.createElement('img');
    image.src = entry.previewUrl;
    image.alt = `Selected photo ${index + 1}`;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'multi-image-remove';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove selected photo ${index + 1}`);
    remove.addEventListener('click', () => {
      URL.revokeObjectURL(entry.previewUrl);
      selectedPostImages.splice(index, 1);
      renderSelectedPostImages();
    });

    item.append(image, remove);
    els.imagePreviewGrid.appendChild(item);
  });
}

function previewImage() {
  const chosen = [...(els.postImage.files || [])];
  els.postImage.value = '';
  if (!chosen.length) return;

  const invalid = chosen.find(file => !allowedPhotoType(file));
  if (invalid) {
    return setMessage(els.postMessage, 'Choose only JPG, PNG, GIF, or WebP photos.');
  }

  const tooLarge = chosen.find(file => file.size > CHAT_IMAGE_MAX_BYTES);
  if (tooLarge) {
    return setMessage(els.postMessage, 'Each photo must be 10 MB or smaller.');
  }

  const additions = uniqueSelectedFiles(selectedPostImages, chosen);
  if (selectedPostImages.length + additions.length > MAX_PHOTOS_PER_ITEM) {
    return setMessage(els.postMessage, 'You can select up to five photos.');
  }

  const totalBytes = [
    ...selectedPostImages.map(entry => entry.file),
    ...additions
  ].reduce((sum, file) => sum + file.size, 0);

  if (totalBytes > MAX_PHOTO_TOTAL_BYTES) {
    return setMessage(els.postMessage, 'The five photos must total 30 MB or less.');
  }

  additions.forEach(file => {
    selectedPostImages.push({ file, previewUrl: URL.createObjectURL(file) });
  });
  setMessage(els.postMessage);
  renderSelectedPostImages();
}

function clearSelectedImage() {
  selectedPostImages.forEach(entry => URL.revokeObjectURL(entry.previewUrl));
  selectedPostImages = [];
  els.postImage.value = '';
  renderSelectedPostImages();
}

async function uploadPostPhoto(file) {
  const extension = extensionForAttachment('image', file.type);
  const path = `${currentUser.id}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from('kt-post-images')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type
    });
  if (error) throw error;
  return {
    path,
    url: supabase.storage.from('kt-post-images').getPublicUrl(path).data.publicUrl
  };
}

async function createPost(event) {
  event.preventDefault();
  const body = els.postBody.value.trim();
  if (!body && !selectedPostImages.length) {
    return setMessage(els.postMessage, 'Write a message or add at least one photo.');
  }

  els.publish.disabled = true;
  els.publish.textContent = selectedPostImages.length ? 'Uploading photos…' : 'Publishing…';
  setMessage(els.postMessage);
  const uploads = [];

  try {
    for (let index = 0; index < selectedPostImages.length; index += 1) {
      els.publish.textContent = `Uploading ${index + 1} of ${selectedPostImages.length}…`;
      uploads.push(await uploadPostPhoto(selectedPostImages[index].file));
    }

    els.publish.textContent = 'Publishing…';
    const imageUrls = uploads.map(item => item.url);
    const { error } = await supabase.from('kt_posts').insert({
      user_id: currentUser.id,
      body,
      image_url: imageUrls[0] || null,
      image_urls: imageUrls
    });
    if (error) throw error;

    els.postBody.value = '';
    clearSelectedImage();
    els.postDialog.close();
    showToast('Your post was published.');
    await loadFeed();
  } catch (error) {
    if (uploads.length) {
      await supabase.storage
        .from('kt-post-images')
        .remove(uploads.map(item => item.path));
    }
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
    setMessage(els.profileMessage, 'Your profile was updated successfully.', true);
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
  if (['admin','blocked','members','profile','notifications','messages','chat','settings'].includes(feedMode)) return;
  els.feed.innerHTML = '';
  const followingIds = new Set(feedState.follows.filter(f => f.follower_id === currentUser.id).map(f => f.following_id));
  followingIds.add(currentUser.id);
  const posts =
    feedMode === 'post'
      ? feedState.posts.filter(post => post.id === activeSharedPostId)
      : feedMode === 'following'
        ? feedState.posts.filter(post => followingIds.has(post.user_id))
        : feedState.posts;
  els.empty.classList.toggle('hidden', posts.length > 0);
  for (const post of posts) els.feed.appendChild(renderPost(post, followingIds));
}

function closeShareMenus(exceptMenu = null) {
  $$('.post-share-menu.open').forEach(menu => {
    if (menu === exceptMenu) return;
    menu.classList.remove('open');
    const trigger = menu.closest('.post-actions')?.querySelector('.share-button');
    trigger?.setAttribute('aria-expanded', 'false');
  });
}

function attachPostShareMenu(node, post, profile) {
  const trigger = $('.share-button', node);
  const actions = $('.post-actions', node);
  if (!trigger || !actions) return;

  const menu = document.createElement('div');
  menu.className = 'post-share-menu';
  menu.setAttribute('role', 'menu');

  const addItem = (label, action) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'post-share-menu-item';
    button.setAttribute('role', 'menuitem');
    button.textContent = label;
    button.addEventListener('click', async event => {
      event.stopPropagation();
      menu.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
      await action();
    });
    menu.appendChild(button);
  };

  addItem('Share through apps', () => sharePostThroughApps(post, profile));
  addItem('Copy post link', () => copyPostLink(post.id));
  addItem('Open this post', () => openSharedPost(post.id));

  actions.appendChild(menu);

  trigger.addEventListener('click', event => {
    event.stopPropagation();
    const opening = !menu.classList.contains('open');
    closeShareMenus(menu);
    closeCommentMenus();
    closePostMenus();
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

  const postGallery = $('.post-gallery',node);
  renderPhotoGallery(postGallery, postImageUrls(post), 'post');

  $('.like-count',node).textContent = `${postLikes.length} ${postLikes.length === 1 ? 'like':'likes'}`;
  $('.comment-count',node).textContent = `${postComments.length} ${postComments.length === 1 ? 'comment':'comments'}`;

  attachPostShareMenu(node, post, profile);

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
  const galleryElement = $('.post-gallery', postNode);
  const originalUrls = postImageUrls(post);
  let workingItems = originalUrls.map(url => ({
    kind: 'existing',
    url,
    id: crypto.randomUUID()
  }));
  let newPreviewUrls = [];

  bodyElement.classList.add('hidden');
  galleryElement.classList.add('hidden');

  const form = document.createElement('form');
  form.className = 'post-edit-form';

  const textLabel = document.createElement('label');
  textLabel.textContent = originalUrls.length
    ? 'Edit post text or photo caption'
    : 'Edit post text';

  const textarea = document.createElement('textarea');
  textarea.className = 'post-edit-textarea';
  textarea.maxLength = 2000;
  textarea.rows = 4;
  textarea.value = post.body || '';
  textarea.placeholder = 'Write your post or photo caption…';
  textLabel.appendChild(textarea);

  const mediaSection = document.createElement('section');
  mediaSection.className = 'post-edit-media';

  const heading = document.createElement('div');
  heading.className = 'post-edit-media-heading';
  const title = document.createElement('strong');
  title.textContent = 'Photos';
  const status = document.createElement('span');
  status.className = 'post-edit-media-status';
  heading.append(title, status);

  const grid = document.createElement('div');
  grid.className = 'post-edit-multi-grid';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.multiple = true;
  fileInput.accept = 'image/jpeg,image/png,image/gif,image/webp';
  fileInput.className = 'post-edit-file-input';

  const mediaButtons = document.createElement('div');
  mediaButtons.className = 'post-edit-media-buttons';

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'post-edit-photo-button';
  addButton.textContent = 'Add photos';

  const removeAllButton = document.createElement('button');
  removeAllButton.type = 'button';
  removeAllButton.className = 'post-edit-photo-button danger';
  removeAllButton.textContent = 'Remove all';

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.className = 'post-edit-photo-button';
  resetButton.textContent = 'Reset photos';

  mediaButtons.append(addButton, removeAllButton, resetButton);
  mediaSection.append(heading, grid, fileInput, mediaButtons);
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
  postNode.insertBefore(form, galleryElement);

  function revokeNewPreviewUrls() {
    newPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    newPreviewUrls = [];
  }

  function currentUrlsForComparison() {
    return workingItems
      .filter(item => item.kind === 'existing')
      .map(item => item.url);
  }

  function renderEditorPhotos() {
    grid.innerHTML = '';
    status.textContent = `${workingItems.length} of ${MAX_PHOTOS_PER_ITEM} photos`;
    addButton.disabled = workingItems.length >= MAX_PHOTOS_PER_ITEM;
    removeAllButton.classList.toggle('hidden', !workingItems.length);
    resetButton.classList.toggle(
      'hidden',
      JSON.stringify(currentUrlsForComparison()) === JSON.stringify(originalUrls)
      && !workingItems.some(item => item.kind === 'new')
    );

    if (!workingItems.length) {
      const empty = document.createElement('div');
      empty.className = 'post-edit-image-empty';
      empty.innerHTML = '<span>＋</span><strong>No photos</strong>';
      grid.appendChild(empty);
      return;
    }

    workingItems.forEach((item, index) => {
      const wrap = document.createElement('div');
      wrap.className = 'post-edit-multi-item';

      const image = document.createElement('img');
      image.src = item.kind === 'existing' ? item.url : item.previewUrl;
      image.alt = `Post photo ${index + 1}`;

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'multi-image-remove';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remove photo ${index + 1}`);
      remove.addEventListener('click', () => {
        if (item.kind === 'new') {
          URL.revokeObjectURL(item.previewUrl);
          newPreviewUrls = newPreviewUrls.filter(url => url !== item.previewUrl);
        }
        workingItems.splice(index, 1);
        renderEditorPhotos();
      });

      wrap.append(image, remove);
      grid.appendChild(wrap);
    });
  }

  addButton.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const files = [...(fileInput.files || [])];
    fileInput.value = '';
    if (!files.length) return;

    if (files.some(file => !allowedPhotoType(file))) {
      showToast('Choose only JPG, PNG, GIF, or WebP photos.');
      return;
    }
    if (files.some(file => file.size > CHAT_IMAGE_MAX_BYTES)) {
      showToast('Each photo must be 10 MB or smaller.');
      return;
    }
    if (workingItems.length + files.length > MAX_PHOTOS_PER_ITEM) {
      showToast('A post can contain up to five photos.');
      return;
    }

    const existingNewBytes = workingItems
      .filter(item => item.kind === 'new')
      .reduce((sum, item) => sum + item.file.size, 0);
    const incomingBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (existingNewBytes + incomingBytes > MAX_PHOTO_TOTAL_BYTES) {
      showToast('Newly selected photos must total 30 MB or less.');
      return;
    }

    files.forEach(file => {
      const previewUrl = URL.createObjectURL(file);
      newPreviewUrls.push(previewUrl);
      workingItems.push({
        kind: 'new',
        file,
        previewUrl,
        id: crypto.randomUUID()
      });
    });
    renderEditorPhotos();
  });

  removeAllButton.addEventListener('click', () => {
    workingItems
      .filter(item => item.kind === 'new')
      .forEach(item => URL.revokeObjectURL(item.previewUrl));
    newPreviewUrls = [];
    workingItems = [];
    renderEditorPhotos();
  });

  resetButton.addEventListener('click', () => {
    revokeNewPreviewUrls();
    workingItems = originalUrls.map(url => ({
      kind: 'existing',
      url,
      id: crypto.randomUUID()
    }));
    renderEditorPhotos();
  });

  function closeEditor() {
    revokeNewPreviewUrls();
    form.remove();
    bodyElement.classList.toggle('hidden', !post.body);
    galleryElement.classList.toggle('hidden', !originalUrls.length);
  }

  cancelButton.addEventListener('click', closeEditor);

  form.addEventListener('submit', async event => {
    event.preventDefault();

    const newBody = textarea.value.trim();
    if (!newBody && !workingItems.length) {
      showToast('Keep some text or at least one photo before saving.');
      return;
    }

    const existingUrlsKept = workingItems
      .filter(item => item.kind === 'existing')
      .map(item => item.url);
    const newItems = workingItems.filter(item => item.kind === 'new');
    const photosChanged =
      JSON.stringify(existingUrlsKept) !== JSON.stringify(originalUrls)
      || newItems.length > 0;
    const bodyChanged = newBody !== (post.body || '');

    if (!bodyChanged && !photosChanged) {
      closeEditor();
      return;
    }

    textarea.disabled = true;
    fileInput.disabled = true;
    addButton.disabled = true;
    removeAllButton.disabled = true;
    resetButton.disabled = true;
    cancelButton.disabled = true;
    saveButton.disabled = true;
    saveButton.textContent = newItems.length ? 'Uploading photos…' : 'Saving…';

    const uploads = [];

    try {
      for (let index = 0; index < newItems.length; index += 1) {
        saveButton.textContent = `Uploading ${index + 1} of ${newItems.length}…`;
        uploads.push(await uploadPostPhoto(newItems[index].file));
      }

      const finalUrls = [];
      let uploadIndex = 0;
      workingItems.forEach(item => {
        if (item.kind === 'existing') finalUrls.push(item.url);
        else {
          finalUrls.push(uploads[uploadIndex].url);
          uploadIndex += 1;
        }
      });

      saveButton.textContent = 'Saving…';
      const { error } = await supabase
        .from('kt_posts')
        .update({
          body: newBody,
          image_url: finalUrls[0] || null,
          image_urls: finalUrls
        })
        .eq('id', post.id)
        .eq('user_id', currentUser.id);
      if (error) throw error;

      const removedUrls = originalUrls.filter(url => !finalUrls.includes(url));
      const removedPaths = removedUrls
        .map(url => storagePathFromPublicUrl(url, 'kt-post-images'))
        .filter(Boolean);
      if (removedPaths.length) {
        await supabase.storage.from('kt-post-images').remove(removedPaths);
      }

      revokeNewPreviewUrls();
      showToast('Post updated.');
      await loadFeed();
    } catch (error) {
      if (uploads.length) {
        await supabase.storage
          .from('kt-post-images')
          .remove(uploads.map(item => item.path));
      }

      textarea.disabled = false;
      fileInput.disabled = false;
      addButton.disabled = workingItems.length >= MAX_PHOTOS_PER_ITEM;
      removeAllButton.disabled = false;
      resetButton.disabled = false;
      cancelButton.disabled = false;
      saveButton.disabled = false;
      saveButton.textContent = 'Save changes';
      showToast(error.message || 'Unable to update the post.');
    }
  });

  renderEditorPhotos();
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

    const paths = postImageUrls(post)
      .map(url => storagePathFromPublicUrl(url, 'kt-post-images'))
      .filter(Boolean);
    if (paths.length) {
      await supabase.storage.from('kt-post-images').remove(paths);
    }

    showToast('Post deleted.');
    if (activeSharedPostId === post.id) {
      returnToCommunityFeed();
    }
    await loadFeed();
  } catch (error) {
    showToast(error.message || 'Unable to delete post.');
  }
}






function formatFileSize(bytes = 0) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatVoiceDuration(seconds = 0) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
}

function normalizeAttachmentMime(mime = '') {
  return String(mime).split(';')[0].trim().toLowerCase();
}

function extensionForAttachment(type, mime) {
  const normalized = normalizeAttachmentMime(mime);
  const extensions = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'audio/webm': 'webm',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/aac': 'aac'
  };
  return extensions[normalized] || (type === 'image' ? 'jpg' : 'webm');
}

function messageAttachments(message) {
  if (Array.isArray(message?.attachments) && message.attachments.length) {
    return message.attachments.slice(0, MAX_PHOTOS_PER_ITEM);
  }
  if (message?.attachment_path && message?.attachment_type) {
    return [{
      type: message.attachment_type,
      path: message.attachment_path,
      mime: message.attachment_mime,
      size: message.attachment_size_bytes,
      duration: message.audio_duration_seconds
    }];
  }
  return [];
}

function parseCallInvitation(messageOrBody) {
  const body = typeof messageOrBody === 'string'
    ? messageOrBody
    : String(messageOrBody?.body || '');
  if (!body.startsWith(CALL_MESSAGE_PREFIX)) return null;

  try {
    const invitation = JSON.parse(body.slice(CALL_MESSAGE_PREFIX.length));
    const type = invitation?.type === 'voice' ? 'voice' : 'video';
    const url = String(invitation?.url || '');

    if (!url.startsWith('https://meet.jit.si/')) return null;

    return {
      type,
      url,
      room: String(invitation?.room || ''),
      startedAt: invitation?.startedAt || null
    };
  } catch {
    return null;
  }
}

function createCallRoomName() {
  const conversationPart = String(activeConversation?.id || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 18);
  const randomPart = crypto.randomUUID().replaceAll('-', '');
  return `KhmerTogether-${conversationPart}-${randomPart}`;
}

function callMeetingUrl(room, type) {
  const base = `https://meet.jit.si/${encodeURIComponent(room)}`;
  const config = type === 'voice'
    ? '#config.startWithVideoMuted=true&config.prejoinPageEnabled=true'
    : '#config.prejoinPageEnabled=true';
  return `${base}${config}`;
}

function openCallLink(url) {
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) {
    copyTextToClipboard(url)
      .then(() => showToast('Call link copied. Open it in a new browser tab.'))
      .catch(() => showToast('Your browser blocked the call window.'));
  }
}

async function shareCallLink(invitation) {
  const label = invitation.type === 'voice' ? 'voice call' : 'video call';
  const shareData = {
    title: `Khmer Together ${label}`,
    text: `Join my Khmer Together ${label}.`,
    url: invitation.url
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }

  await copyTextToClipboard(invitation.url);
  showToast('Call link copied.');
}

function setCallButtonsBusy(busy) {
  callButtonBusy = busy;
  els.chatVoiceCallButton.disabled = busy || !activeChatMessagingAllowed;
  els.chatVideoCallButton.disabled = busy || !activeChatMessagingAllowed;
}

async function startChatCall(type) {
  if (
    callButtonBusy ||
    !activeConversation ||
    !activeChatProfile ||
    !activeChatMessagingAllowed
  ) return;

  const normalizedType = type === 'voice' ? 'voice' : 'video';
  const room = createCallRoomName();
  const url = callMeetingUrl(room, normalizedType);
  const invitation = {
    type: normalizedType,
    room,
    url,
    startedAt: new Date().toISOString()
  };

  // Open immediately so mobile browsers treat it as a direct user action.
  openCallLink(url);
  setCallButtonsBusy(true);

  try {
    const { error } = await supabase.from('kt_messages').insert({
      conversation_id: activeConversation.id,
      sender_id: currentUser.id,
      recipient_id: activeChatProfile.id,
      body: `${CALL_MESSAGE_PREFIX}${JSON.stringify(invitation)}`,
      attachments: []
    });
    if (error) throw error;

    showToast(
      normalizedType === 'voice'
        ? 'Voice-call invitation sent.'
        : 'Video-call invitation sent.'
    );
    await openConversation(activeConversation, activeChatProfile);
  } catch (error) {
    try {
      await copyTextToClipboard(url);
      showToast('The call opened, but the invitation could not be sent. Link copied.');
    } catch {
      showToast(error.message || 'Unable to send the call invitation.');
    }
  } finally {
    setCallButtonsBusy(false);
  }
}

function renderCallInvitation(bubble, invitation, mine) {
  const card = document.createElement('section');
  card.className = `chat-call-card ${invitation.type}`.trim();

  const icon = document.createElement('span');
  icon.className = 'chat-call-card-icon';
  icon.textContent = invitation.type === 'voice' ? '📞' : '🎥';

  const content = document.createElement('div');
  content.className = 'chat-call-card-content';

  const title = document.createElement('strong');
  title.textContent = invitation.type === 'voice'
    ? `${mine ? 'You started' : 'Incoming'} voice call`
    : `${mine ? 'You started' : 'Incoming'} video call`;

  const note = document.createElement('small');
  note.textContent = 'Anyone who receives this private link can join the meeting.';

  content.append(title, note);

  const actions = document.createElement('div');
  actions.className = 'chat-call-card-actions';

  const join = document.createElement('button');
  join.type = 'button';
  join.className = 'chat-call-join';
  join.textContent = mine ? 'Open call' : 'Join call';
  join.addEventListener('click', () => openCallLink(invitation.url));

  const share = document.createElement('button');
  share.type = 'button';
  share.className = 'chat-call-share';
  share.textContent = 'Share link';
  share.addEventListener('click', () => shareCallLink(invitation));

  actions.append(join, share);
  card.append(icon, content, actions);
  bubble.appendChild(card);
}

function messagePreviewText(message) {
  const callInvitation = parseCallInvitation(message);
  if (callInvitation) {
    return callInvitation.type === 'voice'
      ? '📞 Voice-call invitation'
      : '🎥 Video-call invitation';
  }

  const body = String(message?.body || '').trim();
  const attachments = messageAttachments(message);
  const imageCount = attachments.filter(item => item.type === 'image').length;
  const hasAudio = attachments.some(item => item.type === 'audio');
  if (imageCount) {
    const label = imageCount === 1 ? '📷 Photo' : `📷 ${imageCount} photos`;
    return body ? `${label} · ${body}` : label;
  }
  if (hasAudio) return body ? `🎙 ${body}` : '🎙 Voice message';
  return body || 'Message';
}

function revokeChatDraftUrls() {
  selectedChatImages.forEach(entry => URL.revokeObjectURL(entry.previewUrl));
  if (recordedChatAudioPreviewUrl) {
    URL.revokeObjectURL(recordedChatAudioPreviewUrl);
    recordedChatAudioPreviewUrl = null;
  }
}

function clearChatAttachmentDraft() {
  if (chatMediaRecorder?.state === 'recording') {
    stopChatVoiceRecording(false);
  }

  revokeChatDraftUrls();
  selectedChatImages = [];
  recordedChatAudioBlob = null;
  recordedChatAudioDuration = 0;
  els.chatPhotoInput.value = '';
  updateChatAttachmentDraft();
}

function clearSelectedChatPhoto() {
  selectedChatImages.forEach(entry => URL.revokeObjectURL(entry.previewUrl));
  selectedChatImages = [];
  els.chatPhotoInput.value = '';
}

function clearRecordedChatAudio() {
  if (recordedChatAudioPreviewUrl) URL.revokeObjectURL(recordedChatAudioPreviewUrl);
  recordedChatAudioPreviewUrl = null;
  recordedChatAudioBlob = null;
  recordedChatAudioDuration = 0;
  els.chatAudioDraftPlayer.removeAttribute('src');
  els.chatAudioDraftPlayer.load();
}

function updateChatAttachmentDraft() {
  const hasImages = selectedChatImages.length > 0;
  const hasAudio = Boolean(recordedChatAudioBlob && recordedChatAudioPreviewUrl);
  const hasAttachment = hasImages || hasAudio;

  els.chatAttachmentPreview.classList.toggle('hidden', !hasAttachment);
  els.chatImageDraft.classList.toggle('hidden', !hasImages);
  els.chatAudioDraft.classList.toggle('hidden', !hasAudio);
  els.chatImageDraftGrid.innerHTML = '';

  if (hasImages) {
    const totalBytes = selectedChatImages.reduce((sum, entry) => sum + entry.file.size, 0);
    els.chatImageDraftInfo.textContent =
      `${selectedChatImages.length} of ${MAX_PHOTOS_PER_ITEM} photos · ${formatFileSize(totalBytes)}`;

    selectedChatImages.forEach((entry, index) => {
      const item = document.createElement('div');
      item.className = 'chat-image-draft-item';

      const image = document.createElement('img');
      image.src = entry.previewUrl;
      image.alt = `Private photo ${index + 1}`;

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remove private photo ${index + 1}`);
      remove.addEventListener('click', () => {
        URL.revokeObjectURL(entry.previewUrl);
        selectedChatImages.splice(index, 1);
        updateChatAttachmentDraft();
      });

      item.append(image, remove);
      els.chatImageDraftGrid.appendChild(item);
    });
  }

  if (hasAudio) {
    els.chatAudioDraftPlayer.src = recordedChatAudioPreviewUrl;
    els.chatAudioDraftInfo.textContent =
      `${formatVoiceDuration(recordedChatAudioDuration)} · ${formatFileSize(recordedChatAudioBlob.size)}`;
  }
}


function selectChatPhoto() {
  const files = [...(els.chatPhotoInput.files || [])];
  els.chatPhotoInput.value = '';
  if (!files.length) return;

  if (files.some(file => !allowedPhotoType(file))) {
    showToast('Choose only JPG, PNG, GIF, or WebP photos.');
    return;
  }
  if (files.some(file => file.size > CHAT_IMAGE_MAX_BYTES)) {
    showToast('Each private photo must be 10 MB or smaller.');
    return;
  }

  const additions = uniqueSelectedFiles(selectedChatImages, files);
  if (selectedChatImages.length + additions.length > MAX_PHOTOS_PER_ITEM) {
    showToast('You can send up to five photos in one private message.');
    return;
  }

  const totalBytes = [
    ...selectedChatImages.map(entry => entry.file),
    ...additions
  ].reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_PHOTO_TOTAL_BYTES) {
    showToast('The private photos must total 30 MB or less.');
    return;
  }

  if (chatMediaRecorder?.state === 'recording') stopChatVoiceRecording(false);
  clearRecordedChatAudio();

  additions.forEach(file => {
    selectedChatImages.push({
      file,
      previewUrl: URL.createObjectURL(file)
    });
  });
  updateChatAttachmentDraft();
}


function supportedVoiceMimeType() {
  if (!window.MediaRecorder) return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/mp4',
    'audio/webm',
    'audio/ogg;codecs=opus'
  ];
  return candidates.find(type => MediaRecorder.isTypeSupported?.(type)) || '';
}

function resetRecordingUI() {
  if (chatRecordingTimer) {
    clearInterval(chatRecordingTimer);
    chatRecordingTimer = null;
  }
  chatMediaStream?.getTracks().forEach(track => track.stop());
  chatMediaStream = null;
  chatMediaRecorder = null;
  chatAudioChunks = [];
  chatRecordingStartedAt = 0;
  els.chatRecordingPanel.classList.add('hidden');
  els.chatRecordingTime.textContent = '0:00';
  els.chatPhotoButton.disabled = false;
  els.chatVoiceButton.disabled = false;
  els.sendMessageButton.disabled = false;
}

async function startChatVoiceRecording() {
  if (!activeConversation || !activeChatMessagingAllowed) return;
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    setMessage(els.chatMessageStatus, 'Voice recording is not supported by this browser.');
    return;
  }
  if (chatMediaRecorder?.state === 'recording') return;

  clearSelectedChatPhoto();
  clearRecordedChatAudio();
  updateChatAttachmentDraft();
  setMessage(els.chatMessageStatus);

  try {
    chatMediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    const preferredMime = supportedVoiceMimeType();
    const options = { audioBitsPerSecond: 64000 };
    if (preferredMime) options.mimeType = preferredMime;

    chatAudioChunks = [];
    cancelCurrentChatRecording = false;
    chatMediaRecorder = new MediaRecorder(chatMediaStream, options);
    chatRecordingStartedAt = Date.now();

    chatMediaRecorder.addEventListener('dataavailable', event => {
      if (event.data?.size) chatAudioChunks.push(event.data);
    });

    chatMediaRecorder.addEventListener('stop', () => {
      const recorderMime = normalizeAttachmentMime(
        chatMediaRecorder?.mimeType || preferredMime || 'audio/webm'
      );
      const duration = Math.max(
        1,
        Math.min(CHAT_AUDIO_MAX_SECONDS, Math.round((Date.now() - chatRecordingStartedAt) / 1000))
      );
      const audioBlob = new Blob(chatAudioChunks, { type: recorderMime });
      const cancelled = cancelCurrentChatRecording;

      resetRecordingUI();

      if (cancelled) {
        updateChatAttachmentDraft();
        return;
      }
      if (!audioBlob.size) {
        setMessage(els.chatMessageStatus, 'No voice audio was recorded. Please try again.');
        return;
      }
      if (audioBlob.size > CHAT_AUDIO_MAX_BYTES) {
        setMessage(els.chatMessageStatus, 'The voice recording is too large. Record a shorter message.');
        return;
      }

      recordedChatAudioBlob = audioBlob;
      recordedChatAudioDuration = duration;
      recordedChatAudioPreviewUrl = URL.createObjectURL(audioBlob);
      updateChatAttachmentDraft();
      setMessage(els.chatMessageStatus, 'Voice message ready to send.', true);
    });

    chatMediaRecorder.addEventListener('error', event => {
      resetRecordingUI();
      setMessage(els.chatMessageStatus, event.error?.message || 'Voice recording failed.');
    });

    chatMediaRecorder.start(250);
    els.chatRecordingPanel.classList.remove('hidden');
    els.chatPhotoButton.disabled = true;
    els.chatVoiceButton.disabled = true;
    els.sendMessageButton.disabled = true;

    const updateTimer = () => {
      const elapsed = Math.min(
        CHAT_AUDIO_MAX_SECONDS,
        Math.floor((Date.now() - chatRecordingStartedAt) / 1000)
      );
      els.chatRecordingTime.textContent = formatVoiceDuration(elapsed);
      if (elapsed >= CHAT_AUDIO_MAX_SECONDS) stopChatVoiceRecording(true);
    };
    updateTimer();
    chatRecordingTimer = window.setInterval(updateTimer, 250);
  } catch (error) {
    resetRecordingUI();
    const denied = error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError';
    setMessage(
      els.chatMessageStatus,
      denied
        ? 'Microphone permission was denied. Allow microphone access in your browser settings.'
        : (error.message || 'Unable to start voice recording.')
    );
  }
}

function stopChatVoiceRecording(saveRecording = true) {
  if (!chatMediaRecorder || chatMediaRecorder.state !== 'recording') return;
  cancelCurrentChatRecording = !saveRecording;
  chatMediaRecorder.stop();
}

function setChatComposerBusy(busy, label = 'Send') {
  els.chatMessageInput.disabled = busy;
  els.chatPhotoButton.disabled = busy;
  els.chatVoiceButton.disabled = busy;
  els.removeChatAttachment.disabled = busy;
  els.sendMessageButton.disabled = busy;
  els.sendMessageButton.textContent = busy ? label : 'Send';
}

async function privateMessageAttachmentUrl(path) {
  if (!path) return null;
  const cached = messageAttachmentUrlCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const { data, error } = await supabase.storage
    .from('kt-message-attachments')
    .createSignedUrl(path, 3600);
  if (error) throw error;

  const url = data?.signedUrl || null;
  if (url) {
    messageAttachmentUrlCache.set(path, {
      url,
      expiresAt: Date.now() + 50 * 60 * 1000
    });
  }
  return url;
}

async function renderPrivateMessageAttachments(container, message) {
  const attachments = messageAttachments(message);
  if (!attachments.length) return;

  const loading = document.createElement('div');
  loading.className = 'chat-attachment-loading';
  loading.textContent = attachments.some(item => item.type === 'audio')
    ? 'Loading voice message…'
    : `Loading ${attachments.length === 1 ? 'private photo' : 'private photos'}…`;
  container.appendChild(loading);

  try {
    const resolved = await Promise.all(
      attachments.map(async item => ({
        ...item,
        signedUrl: await privateMessageAttachmentUrl(item.path)
      }))
    );
    if (!container.isConnected) return;
    loading.remove();

    const images = resolved.filter(item => item.type === 'image' && item.signedUrl);
    const audioItem = resolved.find(item => item.type === 'audio' && item.signedUrl);

    if (images.length) {
      const gallery = document.createElement('div');
      gallery.className = 'chat-private-gallery';
      gallery.dataset.count = String(images.length);

      images.forEach((item, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chat-private-gallery-item';
        button.setAttribute('aria-label', `Open private photo ${index + 1} of ${images.length}`);

        const image = document.createElement('img');
        image.src = item.signedUrl;
        image.alt = `Private message photo ${index + 1}`;
        image.loading = 'lazy';
        image.referrerPolicy = 'no-referrer';

        button.appendChild(image);
        button.addEventListener('click', () =>
          openPhotoViewer(images.map(photo => photo.signedUrl), index)
        );
        gallery.appendChild(button);
      });
      container.appendChild(gallery);
    }

    if (audioItem) {
      const voice = document.createElement('div');
      voice.className = 'chat-voice-attachment';

      const label = document.createElement('span');
      label.className = 'chat-voice-label';
      label.innerHTML = '<span aria-hidden="true">🎙</span><strong>Voice message</strong>';

      const audio = document.createElement('audio');
      audio.controls = true;
      audio.preload = 'metadata';
      audio.src = audioItem.signedUrl;

      const duration = document.createElement('small');
      duration.textContent = formatVoiceDuration(audioItem.duration || 0);

      voice.append(label, audio, duration);
      container.appendChild(voice);
    }
  } catch (error) {
    if (!container.isConnected) return;
    loading.className = 'chat-attachment-error';
    loading.textContent = 'This private attachment is unavailable.';
  }
}


function updateMessageBadges() {
  const count = Math.max(0, Number(unreadMessageCount) || 0);
  const label = count > 99 ? '99+' : String(count);

  for (const badge of [
    els.messageTopBadge,
    els.messageNavBadge,
    els.mobileMessageBadge
  ]) {
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
      preview.textContent = `${prefix}${messagePreviewText(latest)}`;
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

  const changingConversation = activeConversation?.id !== conversation.id;
  if (changingConversation) clearChatAttachmentDraft();
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
  setCallButtonsBusy(callButtonBusy);
  if (!activeChatMessagingAllowed) clearChatAttachmentDraft();
}

function renderChatMessages() {
  els.chatMessages.innerHTML = '';
  els.chatEmpty.classList.toggle('hidden', activeChatMessages.length > 0);

  for (const message of activeChatMessages) {
    const mine = message.sender_id === currentUser.id;
    const row = document.createElement('div');
    row.className = `chat-message-row ${mine ? 'mine' : 'theirs'}`;
    row.dataset.messageId = message.id;

    const bubble = document.createElement('div');
    const attachments = messageAttachments(message);
    bubble.className = `chat-message-bubble ${attachments.length ? 'has-attachment' : ''}`.trim();

    if (attachments.length) {
      const attachment = document.createElement('div');
      attachment.className = 'chat-message-attachment';
      bubble.appendChild(attachment);
      renderPrivateMessageAttachments(attachment, message);
    }

    const callInvitation = parseCallInvitation(message);
    if (callInvitation) {
      renderCallInvitation(bubble, callInvitation, mine);
    } else if (message.body) {
      const body = document.createElement('p');
      body.textContent = message.body;
      bubble.appendChild(body);
    }

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

    bubble.appendChild(meta);
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

  if (chatMediaRecorder?.state === 'recording') {
    setMessage(els.chatMessageStatus, 'Stop the voice recording before sending.');
    return;
  }

  const body = els.chatMessageInput.value.trim();
  const imageEntries = selectedChatImages.map(entry => ({
    type: 'image',
    blob: entry.file,
    mime: normalizeAttachmentMime(entry.file.type),
    size: entry.file.size,
    duration: null
  }));
  const audioEntries = recordedChatAudioBlob
    ? [{
        type: 'audio',
        blob: recordedChatAudioBlob,
        mime: normalizeAttachmentMime(recordedChatAudioBlob.type || 'audio/webm'),
        size: recordedChatAudioBlob.size,
        duration: Math.max(
          1,
          Math.min(CHAT_AUDIO_MAX_SECONDS, Math.round(recordedChatAudioDuration))
        )
      }]
    : [];
  const attachmentEntries = imageEntries.length ? imageEntries : audioEntries;

  if (!body && !attachmentEntries.length) {
    setMessage(
      els.chatMessageStatus,
      'Write a message, add up to five photos, or record a voice message.'
    );
    return;
  }

  const uploads = [];
  setChatComposerBusy(true, attachmentEntries.length ? 'Uploading…' : 'Sending…');
  setMessage(els.chatMessageStatus);

  try {
    for (let index = 0; index < attachmentEntries.length; index += 1) {
      const attachment = attachmentEntries[index];
      const extension = extensionForAttachment(attachment.type, attachment.mime);
      const path =
        `${currentUser.id}/${activeConversation.id}/${crypto.randomUUID()}.${extension}`;

      els.sendMessageButton.textContent =
        attachmentEntries.length > 1
          ? `Uploading ${index + 1}/${attachmentEntries.length}`
          : 'Uploading…';

      const { error: uploadError } = await supabase.storage
        .from('kt-message-attachments')
        .upload(path, attachment.blob, {
          cacheControl: '3600',
          upsert: false,
          contentType: attachment.mime
        });
      if (uploadError) throw uploadError;

      uploads.push({
        type: attachment.type,
        path,
        mime: attachment.mime,
        size: attachment.size,
        duration: attachment.duration
      });
    }

    els.sendMessageButton.textContent = 'Sending…';
    const first = uploads[0] || null;
    const { error } = await supabase.from('kt_messages').insert({
      conversation_id: activeConversation.id,
      sender_id: currentUser.id,
      recipient_id: activeChatProfile.id,
      body: body || null,
      attachments: uploads,
      attachment_type: first?.type || null,
      attachment_path: first?.path || null,
      attachment_mime: first?.mime || null,
      attachment_size_bytes: first?.size || null,
      audio_duration_seconds: first?.duration || null
    });
    if (error) throw error;

    els.chatMessageInput.value = '';
    clearChatAttachmentDraft();
    await openConversation(activeConversation, activeChatProfile);
  } catch (error) {
    if (uploads.length) {
      await supabase.storage
        .from('kt-message-attachments')
        .remove(uploads.map(item => item.path));
    }
    setMessage(els.chatMessageStatus, error.message || 'Unable to send this message.');
  } finally {
    setChatComposerBusy(false);
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

    const attachmentPaths = messageAttachments(message)
      .map(item => item.path)
      .filter(Boolean);
    attachmentPaths.forEach(path => messageAttachmentUrlCache.delete(path));
    if (attachmentPaths.length) {
      const { error: storageError } = await supabase.storage
        .from('kt-message-attachments')
        .remove(attachmentPaths);
      if (storageError) {
        console.warn('Unable to remove deleted message attachments:', storageError);
      }
    }

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
    .on('postgres_changes', {
      event: 'DELETE', schema: 'public', table: 'kt_messages'
    }, async payload => {
      const oldMessage = payload.old || {};
      messageAttachments(oldMessage)
        .map(item => item.path)
        .filter(Boolean)
        .forEach(path => messageAttachmentUrlCache.delete(path));
      if (activeConversation?.id === oldMessage.conversation_id && feedMode === 'chat') {
        activeChatMessages = activeChatMessages.filter(item => item.id !== oldMessage.id);
        renderChatMessages();
      }
      if (feedMode === 'messages') await loadConversations();
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
  if (chatMediaRecorder?.state === 'recording') stopChatVoiceRecording(false);
  clearChatAttachmentDraft();
  messageAttachmentUrlCache.clear();
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

  for (const badge of [
    els.notificationBellBadge,
    els.notificationNavBadge,
    els.mobileNotificationBadge
  ]) {
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

function accountProviderLabel() {
  const provider = currentUser?.app_metadata?.provider || 'email';
  const labels = {
    email: 'Email and password',
    google: 'Google',
    facebook: 'Facebook',
    apple: 'Apple',
    github: 'GitHub'
  };
  return labels[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
}

function renderAccountSettings() {
  if (!currentUser) return;
  updateMyProfileUI();
  els.settingsCurrentEmail.textContent = currentUser.email || 'No email available';
  els.settingsProvider.textContent = accountProviderLabel();
}

async function changeAccountEmail(event) {
  event.preventDefault();
  const email = els.newEmail.value.trim().toLowerCase();

  if (!email) {
    setMessage(els.changeEmailMessage, 'Enter a new email address.');
    return;
  }
  if (email === String(currentUser.email || '').toLowerCase()) {
    setMessage(els.changeEmailMessage, 'That is already your current email address.');
    return;
  }

  els.changeEmailButton.disabled = true;
  els.changeEmailButton.textContent = 'Updating…';
  setMessage(els.changeEmailMessage);

  try {
    const { data, error } = await supabase.auth.updateUser({ email });
    if (error) throw error;

    currentUser = data.user || currentUser;
    els.newEmail.value = '';
    renderAccountSettings();
    setMessage(
      els.changeEmailMessage,
      'Email update requested. Check your inbox and complete any confirmation link.',
      true
    );
  } catch (error) {
    setMessage(els.changeEmailMessage, error.message || 'Unable to update your email.');
  } finally {
    els.changeEmailButton.disabled = false;
    els.changeEmailButton.textContent = 'Update email';
  }
}

async function sendPasswordVerificationCode() {
  els.sendPasswordCode.disabled = true;
  els.sendPasswordCode.textContent = 'Sending…';
  setMessage(els.changePasswordMessage);

  try {
    const { error } = await supabase.auth.reauthenticate();
    if (error) throw error;
    setMessage(
      els.changePasswordMessage,
      'Verification code sent. Check your email, enter the code above, then update your password.',
      true
    );
  } catch (error) {
    setMessage(els.changePasswordMessage, error.message || 'Unable to send a verification code.');
  } finally {
    els.sendPasswordCode.disabled = false;
    els.sendPasswordCode.textContent = 'Send verification code';
  }
}

async function changeAccountPassword(event) {
  event.preventDefault();

  const currentPassword = els.currentPassword.value;
  const password = els.newPassword.value;
  const confirmation = els.confirmPassword.value;
  const nonce = els.passwordNonce.value.trim();

  if (password.length < 12) {
    setMessage(els.changePasswordMessage, 'Use at least 12 characters for the new password.');
    return;
  }
  if (password !== confirmation) {
    setMessage(els.changePasswordMessage, 'The new passwords do not match.');
    return;
  }

  const attributes = { password };
  if (currentPassword) attributes.current_password = currentPassword;
  if (nonce) attributes.nonce = nonce;

  els.changePasswordButton.disabled = true;
  els.sendPasswordCode.disabled = true;
  els.changePasswordButton.textContent = 'Updating…';
  setMessage(els.changePasswordMessage);

  try {
    const { data, error } = await supabase.auth.updateUser(attributes);
    if (error) throw error;

    currentUser = data.user || currentUser;
    els.currentPassword.value = '';
    els.newPassword.value = '';
    els.confirmPassword.value = '';
    els.passwordNonce.value = '';
    setMessage(els.changePasswordMessage, 'Your password was updated.', true);
  } catch (error) {
    const message = error.message || 'Unable to update your password.';
    setMessage(
      els.changePasswordMessage,
      message.toLowerCase().includes('nonce') || message.toLowerCase().includes('reauth')
        ? `${message} Tap “Send verification code,” then try again.`
        : message
    );
  } finally {
    els.changePasswordButton.disabled = false;
    els.sendPasswordCode.disabled = false;
    els.changePasswordButton.textContent = 'Update password';
  }
}

async function signOutOnAllDevices() {
  if (!confirm('Sign out of Khmer Together on this device and all other devices?')) return;

  els.signOutEverywhere.disabled = true;
  els.signOutEverywhere.textContent = 'Signing out…';
  setMessage(els.signOutEverywhereMessage);

  try {
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) throw error;
  } catch (error) {
    els.signOutEverywhere.disabled = false;
    els.signOutEverywhere.textContent = 'Sign out on all devices';
    setMessage(els.signOutEverywhereMessage, error.message || 'Unable to sign out all devices.');
  }
}

function openDeleteAccountDialog() {
  const username = currentProfile?.username || '';
  els.deleteExpectedUsername.textContent = username;
  els.deleteUsername.value = '';
  els.deleteWord.value = '';
  els.deleteUnderstanding.checked = false;
  setMessage(els.deleteAccountMessage);
  els.deleteAccountDialog.showModal();
  setTimeout(() => els.deleteUsername.focus(), 0);
}

async function deleteStorageFolder(bucket, userId) {
  let rounds = 0;

  while (rounds < 50) {
    rounds += 1;
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(userId, {
        limit: 1000,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (error) throw error;

    const paths = (data || [])
      .filter(item => item?.name && item.name !== '.emptyFolderPlaceholder')
      .map(item => `${userId}/${item.name}`);

    if (!paths.length) return;

    const { error: removeError } = await supabase.storage
      .from(bucket)
      .remove(paths);

    if (removeError) throw removeError;
    if (paths.length < 1000) return;
  }

  throw new Error(`Too many files remain in ${bucket}. Please contact support before deleting the account.`);
}

async function deleteOwnPrivateMessageAttachments() {
  const paths = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('kt_messages')
      .select('attachment_path,attachments')
      .eq('sender_id', currentUser.id)
      .range(from, from + pageSize - 1);

    if (error) throw error;
    const rows = data || [];
    paths.push(
      ...rows.flatMap(row => messageAttachments(row).map(item => item.path)).filter(Boolean)
    );
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  for (let index = 0; index < paths.length; index += 100) {
    const batch = paths.slice(index, index + 100);
    const { error } = await supabase.storage
      .from('kt-message-attachments')
      .remove(batch);
    if (error) throw error;
  }
}

async function permanentlyDeleteAccount(event) {
  event.preventDefault();

  const expectedUsername = currentProfile?.username || '';
  const username = els.deleteUsername.value.trim();
  const word = els.deleteWord.value.trim();

  if (username.toLowerCase() !== expectedUsername.toLowerCase()) {
    setMessage(els.deleteAccountMessage, 'The username does not match your account.');
    return;
  }
  if (word !== 'DELETE') {
    setMessage(els.deleteAccountMessage, 'Type DELETE exactly as shown.');
    return;
  }
  if (!els.deleteUnderstanding.checked) {
    setMessage(els.deleteAccountMessage, 'Confirm that you understand this cannot be undone.');
    return;
  }

  els.confirmDeleteAccount.disabled = true;
  els.confirmDeleteAccount.textContent = 'Deleting photos…';
  setMessage(els.deleteAccountMessage, 'Removing your uploaded photos. Keep this page open.');

  try {
    await Promise.all([stopNotificationUpdates(), stopMessageUpdates()]);
    await deleteStorageFolder('kt-post-images', currentUser.id);
    await deleteStorageFolder('kt-profile-images', currentUser.id);
    els.confirmDeleteAccount.textContent = 'Deleting private attachments…';
    setMessage(els.deleteAccountMessage, 'Removing your sent message photos and voice recordings.');
    await deleteOwnPrivateMessageAttachments();

    els.confirmDeleteAccount.textContent = 'Deleting account…';
    setMessage(els.deleteAccountMessage, 'Removing your account and community data.');

    const { data, error } = await supabase.rpc('kt_delete_my_account', {
      expected_username: username
    });

    if (error) throw error;
    if (!data?.deleted) throw new Error('The account deletion was not completed.');

    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (_error) {
      // The user record has already been deleted. Reloading clears client state.
    }

    location.replace('/');
  } catch (error) {
    els.confirmDeleteAccount.disabled = false;
    els.confirmDeleteAccount.textContent = 'Permanently delete account';
    setMessage(
      els.deleteAccountMessage,
      error.message || 'Unable to delete the account. Your account remains active.'
    );
    startNotificationUpdates();
    startMessageUpdates();
  }
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
