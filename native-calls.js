import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DIRECT_ONLY_ICE_CONFIG = { iceServers: [] };
const RING_SECONDS = 90;
const CONNECT_WARNING_SECONDS = 15;
const INCOMING_POLL_MS = 3000;
const ACTIVE_CALL_POLL_MS = 2000;

let supabase = null;
let currentUser = null;
let activeCall = null;
let activePeerProfile = null;
let peerConnection = null;
let localStream = null;
let remoteStream = null;
let signalChannel = null;
let callChannel = null;
let ringTimer = null;
let connectWarningTimer = null;
let incomingPollTimer = null;
let activeCallPollTimer = null;
let processedSignalIds = new Set();
let queuedIceCandidates = [];
let endingCall = false;

const ui = {};

function installStyles() {
  if (document.getElementById('ktNativeCallStyles')) return;
  const style = document.createElement('style');
  style.id = 'ktNativeCallStyles';
  style.textContent = `
    .kt-native-call-overlay[hidden],
    .kt-native-call-actions[hidden]{display:none!important}
    .kt-native-call-overlay{
      position:fixed;inset:0;z-index:100000;
      display:grid;place-items:center;padding:20px;
      background:rgba(8,22,40,.72);backdrop-filter:blur(8px)
    }
    .kt-native-call-card{
      width:min(430px,100%);border-radius:28px;padding:28px 22px 22px;
      background:#fff;color:#132038;text-align:center;
      box-shadow:0 28px 80px rgba(0,0,0,.35)
    }
    .kt-native-call-avatar{
      width:92px;height:92px;margin:0 auto 14px;border-radius:50%;
      display:grid;place-items:center;background:linear-gradient(135deg,#0f4c81,#1e88d8);
      background-size:cover;background-position:center;color:#fff;
      font-size:34px;font-weight:800
    }
    .kt-native-call-card h2{margin:0 0 5px;font-size:28px}
    .kt-native-call-card p{margin:0;color:#65748a;font-size:16px}
    .kt-native-call-status{min-height:26px;margin-top:14px!important;font-weight:700;color:#0f4c81!important}
    .kt-native-call-actions{
      display:flex;justify-content:center;gap:14px;flex-wrap:wrap;margin-top:24px
    }
    .kt-native-call-button{
      min-width:112px;border:0;border-radius:999px;padding:14px 20px;
      font:inherit;font-weight:800;cursor:pointer
    }
    .kt-native-call-button:disabled{opacity:.55;cursor:not-allowed}
    .kt-native-call-accept{background:#159447;color:#fff}
    .kt-native-call-decline,.kt-native-call-end{background:#c62828;color:#fff}
    .kt-native-call-mute{background:#eaf2fb;color:#123a60}
    .kt-native-call-note{
      margin-top:18px!important;font-size:13px!important;line-height:1.45
    }
    .kt-native-call-ringing{animation:ktCallPulse 1.3s ease-in-out infinite}
    @keyframes ktCallPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
  `;
  document.head.appendChild(style);
}

function installUi() {
  if (document.getElementById('ktNativeCallOverlay')) return;

  const overlay = document.createElement('section');
  overlay.id = 'ktNativeCallOverlay';
  overlay.className = 'kt-native-call-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="kt-native-call-card" role="dialog" aria-modal="true" aria-labelledby="ktNativeCallName">
      <div id="ktNativeCallAvatar" class="kt-native-call-avatar">KT</div>
      <h2 id="ktNativeCallName">Khmer Together Member</h2>
      <p id="ktNativeCallType">Private voice call</p>
      <p id="ktNativeCallStatus" class="kt-native-call-status">Connecting…</p>

      <div id="ktIncomingCallActions" class="kt-native-call-actions" hidden>
        <button id="ktDeclineCallButton" class="kt-native-call-button kt-native-call-decline" type="button">Decline</button>
        <button id="ktAcceptCallButton" class="kt-native-call-button kt-native-call-accept" type="button">Accept</button>
      </div>

      <div id="ktActiveCallActions" class="kt-native-call-actions" hidden>
        <button id="ktMuteCallButton" class="kt-native-call-button kt-native-call-mute" type="button">Mute</button>
        <button id="ktEndCallButton" class="kt-native-call-button kt-native-call-end" type="button">End call</button>
      </div>

      <p class="kt-native-call-note">
        Direct encrypted browser-to-browser call. Calls are not recorded.
      </p>
      <audio id="ktRemoteCallAudio" autoplay playsinline></audio>
    </div>
  `;
  document.body.appendChild(overlay);

  ui.overlay = overlay;
  ui.avatar = overlay.querySelector('#ktNativeCallAvatar');
  ui.name = overlay.querySelector('#ktNativeCallName');
  ui.type = overlay.querySelector('#ktNativeCallType');
  ui.status = overlay.querySelector('#ktNativeCallStatus');
  ui.incomingActions = overlay.querySelector('#ktIncomingCallActions');
  ui.activeActions = overlay.querySelector('#ktActiveCallActions');
  ui.accept = overlay.querySelector('#ktAcceptCallButton');
  ui.decline = overlay.querySelector('#ktDeclineCallButton');
  ui.mute = overlay.querySelector('#ktMuteCallButton');
  ui.end = overlay.querySelector('#ktEndCallButton');
  ui.remoteAudio = overlay.querySelector('#ktRemoteCallAudio');

  ui.accept.addEventListener('click', acceptIncomingCall);
  ui.decline.addEventListener('click', declineIncomingCall);
  ui.mute.addEventListener('click', toggleMute);
  ui.end.addEventListener('click', () => endCall('ended'));
}

function initials(name = 'KT') {
  return String(name || 'KT')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('') || 'KT';
}

function setCallPerson(profile = {}) {
  const name = profile.full_name || 'Khmer Together Member';
  ui.name.textContent = name;
  ui.avatar.textContent = profile.avatar_url ? '' : initials(name);
  ui.avatar.style.backgroundImage = profile.avatar_url
    ? `url(${JSON.stringify(profile.avatar_url)})`
    : '';
}

function setStatus(message) {
  ui.status.textContent = message;
}

function showIncomingUi(profile) {
  setCallPerson(profile);
  ui.overlay.hidden = false;
  ui.avatar.classList.add('kt-native-call-ringing');
  ui.incomingActions.hidden = false;
  ui.activeActions.hidden = true;
  setStatus('Incoming voice call…');
}

function showActiveUi(profile, message = 'Connecting…') {
  setCallPerson(profile);
  ui.overlay.hidden = false;
  ui.avatar.classList.remove('kt-native-call-ringing');
  ui.incomingActions.hidden = true;
  ui.activeActions.hidden = false;
  setStatus(message);
}

function hideCallUi() {
  ui.overlay.hidden = true;
  ui.avatar.classList.remove('kt-native-call-ringing');
  ui.incomingActions.hidden = true;
  ui.activeActions.hidden = true;
  ui.mute.textContent = 'Mute';
}

async function loadConfig() {
  const response = await fetch('/api/config', { cache: 'no-store' });
  const config = await response.json();
  if (!response.ok || !config.url || !config.key) {
    throw new Error(config.error || 'Khmer Together configuration is unavailable.');
  }
  return config;
}

async function loadProfile(userId) {
  if (!userId) return null;
  const { data } = await supabase
    .from('kt_profiles')
    .select('id, full_name, username, avatar_url')
    .eq('id', userId)
    .maybeSingle();
  return data || { id: userId, full_name: 'Khmer Together Member', username: 'member' };
}

async function resolveOpenChat() {
  const username = String(
    document.getElementById('chatMemberUsername')?.textContent || ''
  ).trim().replace(/^@/, '');

  if (!username || username === 'member') {
    throw new Error('Open a member conversation first.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('kt_profiles')
    .select('id, full_name, username, avatar_url')
    .eq('username', username)
    .maybeSingle();

  if (profileError || !profile?.id) {
    throw new Error('This member profile could not be found.');
  }

  const pairFilter =
    `and(user_one.eq.${currentUser.id},user_two.eq.${profile.id}),` +
    `and(user_one.eq.${profile.id},user_two.eq.${currentUser.id})`;

  const { data: conversation, error: conversationError } = await supabase
    .from('kt_conversations')
    .select('*')
    .or(pairFilter)
    .maybeSingle();

  if (conversationError || !conversation?.id) {
    throw new Error('This private conversation could not be found.');
  }

  return { profile, conversation };
}

async function sendSignal(signalType, payload = {}) {
  if (!activeCall || !activePeerProfile) return;
  const { error } = await supabase.from('kt_call_signals').insert({
    call_id: activeCall.id,
    sender_id: currentUser.id,
    recipient_id: activePeerProfile.id,
    signal_type: signalType,
    payload
  });
  if (error) throw error;
}

async function setupLocalAudio() {
  if (localStream) return localStream;

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });
    return localStream;
  } catch (error) {
    if (error?.name === 'NotAllowedError') {
      throw new Error('Microphone permission was denied.');
    }
    throw new Error('The microphone could not be opened.');
  }
}

async function createPeerConnection() {
  if (peerConnection) return peerConnection;

  peerConnection = new RTCPeerConnection(DIRECT_ONLY_ICE_CONFIG);
  remoteStream = new MediaStream();
  ui.remoteAudio.srcObject = remoteStream;

  const stream = await setupLocalAudio();
  stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

  peerConnection.addEventListener('track', event => {
    event.streams[0]?.getTracks().forEach(track => {
      if (!remoteStream.getTracks().some(item => item.id === track.id)) {
        remoteStream.addTrack(track);
      }
    });
    ui.remoteAudio.play().catch(() => {});
  });

  peerConnection.addEventListener('icecandidate', event => {
    if (!event.candidate) return;
    sendSignal('ice', event.candidate.toJSON()).catch(console.error);
  });

  peerConnection.addEventListener('connectionstatechange', () => {
    const state = peerConnection?.connectionState;
    if (state === 'connected') {
      clearTimeout(connectWarningTimer);
      setStatus('Connected');
    } else if (state === 'connecting') {
      setStatus('Connecting…');
    } else if (state === 'failed') {
      setStatus('Direct connection failed. End the call and try on the same Wi-Fi.');
    } else if (state === 'disconnected') {
      setStatus('Connection interrupted…');
    } else if (state === 'closed') {
      setStatus('Call ended');
    }
  });

  connectWarningTimer = setTimeout(() => {
    if (peerConnection?.connectionState !== 'connected') {
      setStatus('Still connecting. For this first test, use the same Wi-Fi.');
    }
  }, CONNECT_WARNING_SECONDS * 1000);

  return peerConnection;
}

async function addQueuedIce() {
  if (!peerConnection?.remoteDescription) return;
  const pending = [...queuedIceCandidates];
  queuedIceCandidates = [];
  for (const candidate of pending) {
    try {
      await peerConnection.addIceCandidate(candidate);
    } catch (error) {
      console.warn('Unable to add queued ICE candidate', error);
    }
  }
}

async function processSignal(signal) {
  if (!signal?.id || processedSignalIds.has(signal.id)) return;
  processedSignalIds.add(signal.id);

  if (signal.sender_id === currentUser.id) return;

  if (signal.signal_type === 'hangup' || signal.signal_type === 'busy') {
    setStatus(signal.signal_type === 'busy' ? 'Call declined' : 'Call ended');
    setTimeout(cleanupCall, 900);
    return;
  }

  const pc = await createPeerConnection();

  if (signal.signal_type === 'offer') {
    await pc.setRemoteDescription(signal.payload);
    await addQueuedIce();
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await sendSignal('answer', pc.localDescription.toJSON());
    setStatus('Connecting…');
    return;
  }

  if (signal.signal_type === 'answer') {
    if (!pc.currentRemoteDescription) {
      await pc.setRemoteDescription(signal.payload);
      await addQueuedIce();
    }
    setStatus('Connecting…');
    return;
  }

  if (signal.signal_type === 'ice') {
    const candidate = new RTCIceCandidate(signal.payload);
    if (pc.remoteDescription) {
      await pc.addIceCandidate(candidate).catch(console.warn);
    } else {
      queuedIceCandidates.push(candidate);
    }
  }
}

async function fetchExistingSignals() {
  if (!activeCall) return;
  const { data, error } = await supabase
    .from('kt_call_signals')
    .select('*')
    .eq('call_id', activeCall.id)
    .order('created_at', { ascending: true });

  if (error) throw error;
  for (const signal of data || []) {
    await processSignal(signal);
  }
}

function subscribeToSignals() {
  if (!activeCall) return;

  if (signalChannel) supabase.removeChannel(signalChannel);
  signalChannel = supabase
    .channel(`kt-call-signals-${activeCall.id}-${currentUser.id}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'kt_call_signals',
        filter: `call_id=eq.${activeCall.id}`
      },
      payload => processSignal(payload.new).catch(console.error)
    )
    .subscribe();
}

function stopActiveCallPolling() {
  clearInterval(activeCallPollTimer);
  activeCallPollTimer = null;
}

function startActiveCallPolling() {
  stopActiveCallPolling();
  activeCallPollTimer = setInterval(async () => {
    if (!activeCall || !supabase || !currentUser) return;

    const { data } = await supabase
      .from('kt_calls')
      .select('*')
      .eq('id', activeCall.id)
      .maybeSingle();

    if (!data) return;
    activeCall = data;

    if (data.status === 'accepted') {
      clearTimeout(ringTimer);
      if (!peerConnection?.remoteDescription) {
        fetchExistingSignals().catch(console.error);
      }
    } else if (['declined', 'missed', 'ended', 'failed'].includes(data.status)) {
      setStatus(
        data.status === 'declined' ? 'Call declined'
          : data.status === 'missed' ? 'No answer'
          : 'Call ended'
      );
      setTimeout(cleanupCall, 800);
    }
  }, ACTIVE_CALL_POLL_MS);
}

async function startVoiceCall() {
  if (activeCall) {
    setStatus('A call is already active.');
    return;
  }

  const button = document.getElementById('chatVoiceCallButton');
  if (button) button.disabled = true;

  try {
    const { profile, conversation } = await resolveOpenChat();
    activePeerProfile = profile;
    showActiveUi(profile, 'Starting private voice call…');

    const { data: call, error } = await supabase
      .from('kt_calls')
      .insert({
        conversation_id: conversation.id,
        caller_id: currentUser.id,
        callee_id: profile.id,
        call_type: 'voice',
        status: 'ringing'
      })
      .select('*')
      .single();

    if (error) {
      if (String(error.message || '').toLowerCase().includes('duplicate')) {
        throw new Error('A call is already active in this conversation.');
      }
      throw error;
    }

    activeCall = call;
    processedSignalIds = new Set();
    queuedIceCandidates = [];
    subscribeToSignals();
    startActiveCallPolling();

    const pc = await createPeerConnection();
    const offer = await pc.createOffer({ offerToReceiveAudio: true });
    await pc.setLocalDescription(offer);
    await sendSignal('offer', pc.localDescription.toJSON());

    setStatus(`Calling ${profile.full_name || 'member'}…`);

    ringTimer = setTimeout(async () => {
      if (!activeCall || activeCall.status !== 'ringing') return;
      await supabase
        .from('kt_calls')
        .update({ status: 'missed', ended_at: new Date().toISOString() })
        .eq('id', activeCall.id)
        .eq('status', 'ringing');
      setStatus('No answer');
      setTimeout(cleanupCall, 1200);
    }, RING_SECONDS * 1000);
  } catch (error) {
    setStatus(error.message || 'Unable to start the call.');
    setTimeout(cleanupCall, 1800);
  } finally {
    if (button) button.disabled = false;
  }
}

async function acceptIncomingCall() {
  if (!activeCall || !activePeerProfile) return;

  ui.accept.disabled = true;
  ui.decline.disabled = true;
  try {
    showActiveUi(activePeerProfile, 'Opening microphone…');
    await setupLocalAudio();

    const { error } = await supabase
      .from('kt_calls')
      .update({
        status: 'accepted',
        answered_at: new Date().toISOString()
      })
      .eq('id', activeCall.id)
      .eq('callee_id', currentUser.id)
      .eq('status', 'ringing');

    if (error) throw error;

    activeCall.status = 'accepted';
    subscribeToSignals();
    startActiveCallPolling();
    await createPeerConnection();
    await fetchExistingSignals();
    setStatus('Connecting…');
  } catch (error) {
    setStatus(error.message || 'Unable to answer the call.');
    setTimeout(() => endCall('failed'), 1300);
  } finally {
    ui.accept.disabled = false;
    ui.decline.disabled = false;
  }
}

async function declineIncomingCall() {
  if (!activeCall) return;
  ui.accept.disabled = true;
  ui.decline.disabled = true;
  try {
    await sendSignal('busy', {});
    await supabase
      .from('kt_calls')
      .update({
        status: 'declined',
        ended_at: new Date().toISOString()
      })
      .eq('id', activeCall.id)
      .eq('callee_id', currentUser.id);
  } finally {
    cleanupCall();
    ui.accept.disabled = false;
    ui.decline.disabled = false;
  }
}

function toggleMute() {
  const track = localStream?.getAudioTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  ui.mute.textContent = track.enabled ? 'Mute' : 'Unmute';
  setStatus(track.enabled ? 'Connected' : 'Microphone muted');
}

async function endCall(status = 'ended') {
  if (endingCall) return;
  endingCall = true;

  try {
    if (activeCall && activePeerProfile) {
      await sendSignal('hangup', {}).catch(() => {});
      await supabase
        .from('kt_calls')
        .update({
          status,
          ended_at: new Date().toISOString()
        })
        .eq('id', activeCall.id)
        .in('status', ['ringing', 'accepted']);
    }
  } finally {
    setStatus('Call ended');
    setTimeout(cleanupCall, 500);
    endingCall = false;
  }
}

function cleanupCall() {
  clearTimeout(ringTimer);
  clearTimeout(connectWarningTimer);
  ringTimer = null;
  connectWarningTimer = null;
  stopActiveCallPolling();

  if (signalChannel && supabase) {
    supabase.removeChannel(signalChannel);
  }
  signalChannel = null;

  if (peerConnection) {
    peerConnection.ontrack = null;
    peerConnection.onicecandidate = null;
    peerConnection.close();
  }
  peerConnection = null;

  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
  localStream = null;

  if (remoteStream) {
    remoteStream.getTracks().forEach(track => track.stop());
  }
  remoteStream = null;

  if (ui.remoteAudio) {
    ui.remoteAudio.pause();
    ui.remoteAudio.srcObject = null;
  }

  activeCall = null;
  activePeerProfile = null;
  processedSignalIds = new Set();
  queuedIceCandidates = [];
  endingCall = false;
  hideCallUi();
}

async function handleIncomingCall(call) {
  if (!call || call.status !== 'ringing') return;
  if (new Date(call.expires_at).getTime() <= Date.now()) return;

  if (activeCall?.id === call.id) return;

  if (activeCall && activeCall.id !== call.id) {
    await supabase
      .from('kt_calls')
      .update({ status: 'declined', ended_at: new Date().toISOString() })
      .eq('id', call.id)
      .eq('status', 'ringing');
    return;
  }

  activeCall = call;
  activePeerProfile = await loadProfile(call.caller_id);
  processedSignalIds = new Set();
  queuedIceCandidates = [];
  showIncomingUi(activePeerProfile);
  subscribeToSignals();
  startActiveCallPolling();

  if (navigator.vibrate) navigator.vibrate([250, 150, 250]);

  ringTimer = setTimeout(async () => {
    if (!activeCall || activeCall.id !== call.id) return;
    await supabase
      .from('kt_calls')
      .update({ status: 'missed', ended_at: new Date().toISOString() })
      .eq('id', call.id)
      .eq('status', 'ringing');
    cleanupCall();
  }, Math.max(1000, new Date(call.expires_at).getTime() - Date.now()));
}

async function checkExistingIncomingCall() {
  if (!supabase || !currentUser || activeCall) return;

  const { data, error } = await supabase
    .from('kt_calls')
    .select('*')
    .eq('callee_id', currentUser.id)
    .eq('status', 'ringing')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('Incoming-call check failed:', error.message);
    return;
  }

  if (data) await handleIncomingCall(data);
}

function stopIncomingPolling() {
  clearInterval(incomingPollTimer);
  incomingPollTimer = null;
}

function startIncomingPolling() {
  stopIncomingPolling();
  incomingPollTimer = setInterval(() => {
    checkExistingIncomingCall().catch(console.error);
  }, INCOMING_POLL_MS);
}

function subscribeToCalls() {
  if (callChannel) supabase.removeChannel(callChannel);

  callChannel = supabase
    .channel(`kt-native-calls-${currentUser.id}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'kt_calls',
        filter: `callee_id=eq.${currentUser.id}`
      },
      payload => handleIncomingCall(payload.new).catch(console.error)
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'kt_calls',
        filter: `caller_id=eq.${currentUser.id}`
      },
      payload => {
        if (!activeCall || payload.new.id !== activeCall.id) return;
        activeCall = payload.new;
        if (payload.new.status === 'accepted') {
          clearTimeout(ringTimer);
          setStatus('Connecting…');
          fetchExistingSignals().catch(console.error);
        } else if (['declined', 'missed', 'ended', 'failed'].includes(payload.new.status)) {
          setStatus(
            payload.new.status === 'declined' ? 'Call declined'
              : payload.new.status === 'missed' ? 'No answer'
              : 'Call ended'
          );
          setTimeout(cleanupCall, 900);
        }
      }
    )
    .subscribe();

  startIncomingPolling();
}

function configureButtons() {
  const voiceButton = document.getElementById('chatVoiceCallButton');
  const videoButton = document.getElementById('chatVideoCallButton');

  if (voiceButton) {
    voiceButton.hidden = false;
    voiceButton.style.display = '';
    voiceButton.removeAttribute('aria-hidden');
    voiceButton.tabIndex = 0;
    const label = voiceButton.querySelector('strong');
    if (label) label.textContent = 'Voice';
    voiceButton.title = 'Start private voice call';
    voiceButton.setAttribute('aria-label', 'Start private voice call');
  }

  if (videoButton) {
    videoButton.hidden = true;
    videoButton.style.display = 'none';
    videoButton.setAttribute('aria-hidden', 'true');
    videoButton.tabIndex = -1;
  }

  const note = document.getElementById('chatPrivacyNote');
  if (note) {
    note.textContent = 'Only you and this member can read these messages. Voice calls are direct and are not recorded.';
  }
}

function interceptLegacyCallButtons() {
  document.addEventListener('click', event => {
    const voiceButton = event.target.closest('#chatVoiceCallButton');
    const videoButton = event.target.closest('#chatVideoCallButton');

    if (!voiceButton && !videoButton) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (videoButton) return;
    startVoiceCall();
  }, true);
}

async function initialize() {
  if (!('RTCPeerConnection' in window) || !navigator.mediaDevices?.getUserMedia) {
    return;
  }

  installStyles();
  installUi();
  configureButtons();
  interceptLegacyCallButtons();

  try {
    const config = await loadConfig();
    supabase = createClient(config.url, config.key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    const { data } = await supabase.auth.getSession();
    currentUser = data.session?.user || null;

    supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user || null;
      const changed = nextUser?.id !== currentUser?.id;
      currentUser = nextUser;

      if (!currentUser) {
        cleanupCall();
        stopIncomingPolling();
        if (callChannel) supabase.removeChannel(callChannel);
        callChannel = null;
        return;
      }

      if (changed || !callChannel) {
        subscribeToCalls();
        checkExistingIncomingCall().catch(console.error);
      }
    });

    if (currentUser) {
      subscribeToCalls();
      await checkExistingIncomingCall();
    }
  } catch (error) {
    console.error('Native voice call setup failed:', error);
  }
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && currentUser) {
    checkExistingIncomingCall().catch(console.error);
    if (activeCall) fetchExistingSignals().catch(console.error);
  }
});

window.addEventListener('beforeunload', () => {
  localStream?.getTracks().forEach(track => track.stop());
  peerConnection?.close();
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize, { once: true });
} else {
  initialize();
}
