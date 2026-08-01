const shortLinkCache = new Map();

function toast(message) {
  const element = document.getElementById('toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2800);
}

async function copyText(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  if (!copied) throw new Error('Copy is not supported by this browser.');
}

async function shortPostUrl(postId) {
  if (shortLinkCache.has(postId)) return shortLinkCache.get(postId);

  const response = await fetch(
    `/api/short-post?post_id=${encodeURIComponent(postId)}`,
    { cache: 'no-store' }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.path) {
    throw new Error(data.error || 'Unable to prepare the short link.');
  }

  const url = `${location.origin}${data.path}`;
  shortLinkCache.set(postId, url);
  return url;
}

function closeShareMenu(button) {
  const menu = button.closest('.post-share-menu');
  menu?.classList.remove('open');
  const trigger = button
    .closest('[data-post-id]')
    ?.querySelector('.share-button');
  trigger?.setAttribute('aria-expanded', 'false');
}

function shareText(postNode) {
  const author = postNode.querySelector('.post-name')?.textContent?.trim()
    || 'Khmer Together Member';
  const body = postNode.querySelector('.post-body')?.textContent?.trim() || '';
  return {
    title: `${author} on Khmer Together`,
    text: body ? body.slice(0, 180) : `${author} shared photos on Khmer Together.`
  };
}

document.addEventListener('click', async event => {
  const button = event.target.closest('.post-share-menu-item');
  if (!button) return;

  const action = button.textContent.trim();
  if (action !== 'Share through apps' && action !== 'Copy post link') return;

  const postNode = button.closest('[data-post-id]');
  const postId = postNode?.dataset.postId;
  if (!postId) return;

  // Stop the original long-link action in app.js.
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const originalLabel = action;
  button.disabled = true;
  button.textContent = 'Preparing short link…';

  try {
    const url = await shortPostUrl(postId);

    if (action === 'Share through apps' && navigator.share) {
      const details = shareText(postNode);
      try {
        await navigator.share({ ...details, url });
      } catch (error) {
        if (error?.name !== 'AbortError') throw error;
      }
    } else {
      await copyText(url);
      toast('Short post link copied.');
    }
  } catch (error) {
    // Preserve sharing even if the short-link service is temporarily unavailable.
    const normalUrl = `${location.origin}/p/${encodeURIComponent(postId)}`;
    try {
      if (action === 'Share through apps' && navigator.share) {
        const details = shareText(postNode);
        await navigator.share({ ...details, url: normalUrl });
      } else {
        await copyText(normalUrl);
        toast('Normal post link copied.');
      }
    } catch (fallbackError) {
      if (fallbackError?.name !== 'AbortError') {
        toast(error?.message || 'Unable to share this post.');
      }
    }
  } finally {
    closeShareMenu(button);
    button.disabled = false;
    button.textContent = originalLabel;
  }
}, true);

function hideChatCallButtons() {
  ['chatVoiceCallButton', 'chatVideoCallButton'].forEach(id => {
    const button = document.getElementById(id);
    if (!button) return;
    button.hidden = true;
    button.style.display = 'none';
    button.setAttribute('aria-hidden', 'true');
    button.tabIndex = -1;
  });

  const privacyNote = document.getElementById('chatPrivacyNote');
  if (privacyNote) {
    privacyNote.textContent = 'Only you and this member can read these messages.';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', hideChatCallButtons, { once: true });
} else {
  hideChatCallButtons();
}
