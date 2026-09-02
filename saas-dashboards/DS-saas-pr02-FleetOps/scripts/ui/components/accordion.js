// Margin added to the panel's own transition timing before the collapse is
// completed without a transition event, so the fallback never pre-empts a
// transition that is about to report its own end.
const HIDE_FALLBACK_MARGIN_MS = 50;

const Accordion = {
  init(root) {
    const items = root.querySelectorAll('.accordion-item');
    const rootId = normalizeIdPart(root.id || 'accordion');

    items.forEach((item, index) => {
      const header = item.querySelector('.accordion-header');
      const content = item.querySelector('.accordion-content');
      if (!header || !content) return;

      const panelId = getPanelId(content, `${rootId}-panel-${index + 1}`);
      content.id = panelId;
      header.setAttribute('aria-controls', panelId);
      syncState(header, content, content.classList.contains('open'), true);

      header.addEventListener('click', () => {
        const open = content.classList.contains('open');
        syncState(header, content, !open);
      });
    });
  }
};

function normalizeIdPart(value) {
  return String(value || 'accordion')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'accordion';
}

function getPanelId(content, baseId) {
  if (content.id) return content.id;

  let panelId = baseId;
  let suffix = 2;

  while (document.getElementById(panelId)) {
    panelId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return panelId;
}

function syncState(header, content, open, immediate) {
  content.classList.toggle('open', open);
  header.setAttribute('aria-expanded', String(open));

  cancelScheduledHide(content);

  if (open) {
    content.hidden = false;
    // Force a reflow so the browser registers the unhidden state as a
    // separate frame from the max-height change below; otherwise the two
    // style changes are batched and the open transition never plays.
    void content.offsetHeight;
    content.style.maxHeight = content.scrollHeight + 'px';
  } else {
    content.style.maxHeight = '0';
    if (immediate) {
      content.hidden = true;
    } else {
      scheduleHide(content);
    }
  }
}

// A collapse must always end with the panel out of the accessibility tree, so
// `hidden` cannot depend on a transition that is not guaranteed to happen: when
// a panel is collapsed again before the browser has rendered a frame at the
// opened max-height, the computed value never changes, no transition is created
// and no transition event of any kind is dispatched. `transitionend` is
// therefore only the fast path, and a timer derived from the panel's own
// transition timing is the guaranteed one. `transitioncancel` is deliberately
// not treated as completion: a collapse that interrupts an in-flight open
// cancels that open transition, so completing there would cut the closing
// animation short. A cancelled transition is covered by the timer instead.
function scheduleHide(content) {
  const style = getComputedStyle(content);
  const settleTime =
    (parseFloat(style.transitionDuration) || 0) + (parseFloat(style.transitionDelay) || 0);

  if (settleTime <= 0) {
    content.hidden = true;
    return;
  }

  const finish = () => {
    cancelScheduledHide(content);
    // The collapse may have been superseded by an open while it was pending.
    if (!content.classList.contains('open')) {
      content.hidden = true;
    }
  };

  const handler = (event) => {
    if (event.target !== content || event.propertyName !== 'max-height') return;
    finish();
  };

  content._accordionPendingHide = {
    handler,
    timer: window.setTimeout(finish, settleTime * 1000 + HIDE_FALLBACK_MARGIN_MS),
  };
  content.addEventListener('transitionend', handler);
}

function cancelScheduledHide(content) {
  const pending = content._accordionPendingHide;
  if (!pending) return;

  content._accordionPendingHide = null;
  window.clearTimeout(pending.timer);
  content.removeEventListener('transitionend', pending.handler);
}

export { Accordion };
