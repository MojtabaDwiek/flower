const form = document.querySelector(".order-form");
const hero = document.querySelector(".hero");
const crochetThreadField = document.querySelector(".crochet-threads");
const footer = document.querySelector(".site-footer");
const galleryStage = document.querySelector(".gallery-stage");
const galleryTrack = document.querySelector(".gallery-track");
const galleryState = {
  dragging: false,
  startX: 0,
  previousX: 0,
  currentX: 0,
  velocity: 0,
  loopDistance: 0,
  frame: null,
};

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const threadState = {
  target: 0,
  current: 0,
  frame: null,
};

function measureThreadField() {
  if (!hero || !crochetThreadField) {
    return;
  }

  const heroHeight = hero.offsetHeight || window.innerHeight;
  const threadTop = heroHeight - 2;
  const threadEnd = footer?.offsetTop ?? document.documentElement.scrollHeight;
  crochetThreadField.style.top = `${threadTop}px`;
  crochetThreadField.style.height = `${Math.max(0, threadEnd - threadTop)}px`;
}

function setThreadTarget() {
  if (!hero || !crochetThreadField) {
    return;
  }

  const heroHeight = hero.offsetHeight || window.innerHeight;
  const threadEnd = footer?.offsetTop ?? document.documentElement.scrollHeight;
  const start = heroHeight * 0.42;
  const maxScroll = Math.max(1, threadEnd - window.innerHeight);
  const distance = Math.max(window.innerHeight, maxScroll - start);
  threadState.target = clamp((window.scrollY - start) / distance);
}

function renderCrochetThreads() {
  threadState.frame = null;
  threadState.current += (threadState.target - threadState.current) * 0.14;

  const progress = threadState.current;
  const eased = progress * progress * (3 - 2 * progress);

  crochetThreadField.style.setProperty("--thread-opacity", clamp((progress - 0.04) / 0.28, 0, 0.78).toFixed(3));
  crochetThreadField.style.setProperty("--thread-clip", `${((1 - eased) * 100).toFixed(2)}%`);

  if (Math.abs(threadState.target - threadState.current) > 0.001) {
    threadState.frame = window.requestAnimationFrame(renderCrochetThreads);
  }
}

function requestStringUpdate() {
  setThreadTarget();

  if (threadState.frame) {
    return;
  }

  threadState.frame = window.requestAnimationFrame(renderCrochetThreads);
}

function updateGalleryDepth() {
  if (!galleryStage || !galleryTrack) {
    return;
  }

  const stageRect = galleryStage.getBoundingClientRect();
  const center = stageRect.left + stageRect.width / 2;

  [...galleryTrack.children].forEach((card) => {
    const rect = card.getBoundingClientRect();
    const cardCenter = rect.left + rect.width / 2;
    const distance = (cardCenter - center) / stageRect.width;
    const clamped = Math.max(-1, Math.min(1, distance));
    const rotate = clamped * -34;
    const depth = (1 - Math.abs(clamped)) * 130 - 120;
    const lift = (1 - Math.abs(clamped)) * -18;
    const scale = 0.86 + (1 - Math.abs(clamped)) * 0.2;

    card.style.transform = `rotateY(${rotate}deg) rotateX(${Math.abs(clamped) * 5}deg) translateY(${lift}px) translateZ(${depth}px) scale(${scale})`;
    card.style.zIndex = `${Math.round((1 - Math.abs(clamped)) * 10)}`;
  });
}

function wrapGalleryPosition(value) {
  if (!galleryState.loopDistance) {
    return value;
  }

  const min = -galleryState.loopDistance;
  if (value <= min) {
    return value + galleryState.loopDistance;
  }

  if (value > 0) {
    return value - galleryState.loopDistance;
  }

  return value;
}

function renderGallery() {
  if (!galleryTrack) {
    return;
  }

  galleryState.currentX = wrapGalleryPosition(galleryState.currentX);
  galleryTrack.style.transform = `translate3d(${galleryState.currentX}px, 0, 0)`;
  updateGalleryDepth();
}

function setGalleryLoopDistance() {
  if (!galleryStage || !galleryTrack || galleryTrack.children.length < 6) {
    return;
  }

  const firstCard = galleryTrack.children[0];
  const sixthCard = galleryTrack.children[5];
  galleryState.loopDistance = sixthCard.offsetLeft - firstCard.offsetLeft;
  renderGallery();
}

function startMomentum() {
  window.cancelAnimationFrame(galleryState.frame);

  const step = () => {
    if (galleryState.dragging) {
      return;
    }

    galleryState.currentX += galleryState.velocity;
    galleryState.velocity *= 0.94;
    renderGallery();

    if (Math.abs(galleryState.velocity) > 0.05) {
      galleryState.frame = window.requestAnimationFrame(step);
    }
  };

  galleryState.frame = window.requestAnimationFrame(step);
}

galleryStage?.addEventListener("pointerdown", (event) => {
  galleryState.dragging = true;
  galleryState.startX = event.clientX;
  galleryState.previousX = event.clientX;
  galleryState.velocity = 0;
  galleryStage.classList.add("is-dragging");
  galleryStage.setPointerCapture(event.pointerId);
  window.cancelAnimationFrame(galleryState.frame);
});

galleryStage?.addEventListener("pointermove", (event) => {
  if (!galleryState.dragging) {
    return;
  }

  const delta = event.clientX - galleryState.previousX;
  galleryState.currentX += delta;
  galleryState.velocity = delta;
  galleryState.previousX = event.clientX;
  renderGallery();
});

function endGalleryDrag(event) {
  if (!galleryState.dragging) {
    return;
  }

  galleryState.dragging = false;
  galleryStage?.classList.remove("is-dragging");

  if (event?.pointerId !== undefined && galleryStage?.hasPointerCapture(event.pointerId)) {
    galleryStage.releasePointerCapture(event.pointerId);
  }

  startMomentum();
}

galleryStage?.addEventListener("pointerup", endGalleryDrag);
galleryStage?.addEventListener("pointercancel", endGalleryDrag);
galleryStage?.addEventListener("pointerleave", endGalleryDrag);

window.addEventListener("load", setGalleryLoopDistance);
window.addEventListener("load", () => {
  measureThreadField();
  requestStringUpdate();
});
window.addEventListener("resize", () => {
  setGalleryLoopDistance();
  measureThreadField();
  requestStringUpdate();
});
window.addEventListener("scroll", requestStringUpdate, { passive: true });
setGalleryLoopDistance();
measureThreadField();
requestStringUpdate();

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const button = form.querySelector("button");
  const original = button.textContent;
  button.textContent = "Quote request noted";
  button.disabled = true;

  window.setTimeout(() => {
    button.textContent = original;
    button.disabled = false;
    form.reset();
  }, 1700);
});
