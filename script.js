const hero = document.querySelector(".hero");
const crochetThreadField = document.querySelector(".crochet-threads");
const footer = document.querySelector(".site-footer");
const galleryStage = document.querySelector(".gallery-stage");
const galleryTrack = document.querySelector(".gallery-track");
const galleryCards = galleryTrack ? Array.from(galleryTrack.children) : [];
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let layoutFrame = null;

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const threadState = {
  target: 0,
  current: 0,
  frame: null,
};

const galleryState = {
  dragging: false,
  startX: 0,
  previousX: 0,
  currentX: 0,
  velocity: 0,
  loopDistance: 0,
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

function requestThreadUpdate() {
  setThreadTarget();

  if (!threadState.frame) {
    threadState.frame = window.requestAnimationFrame(renderCrochetThreads);
  }
}

function updateGalleryDepth() {
  if (!galleryStage || !galleryCards.length) {
    return;
  }

  const stageRect = galleryStage.getBoundingClientRect();
  const center = stageRect.left + stageRect.width / 2;

  galleryCards.forEach((card) => {
    const rect = card.getBoundingClientRect();
    const cardCenter = rect.left + rect.width / 2;
    const distance = (cardCenter - center) / stageRect.width;
    const clamped = clamp(distance, -1, 1);
    const depthRatio = 1 - Math.abs(clamped);

    card.style.transform = `rotateY(${clamped * -34}deg) rotateX(${Math.abs(clamped) * 5}deg) translateY(${depthRatio * -18}px) translateZ(${depthRatio * 130 - 120}px) scale(${0.86 + depthRatio * 0.2})`;
    card.style.zIndex = `${Math.round(depthRatio * 10)}`;
  });
}

function wrapGalleryPosition(value) {
  if (!galleryState.loopDistance) {
    return value;
  }

  if (value <= -galleryState.loopDistance) {
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
  if (!galleryTrack || galleryCards.length < 6) {
    return;
  }

  galleryState.loopDistance = galleryCards[5].offsetLeft - galleryCards[0].offsetLeft;
  renderGallery();
}

function startMomentum() {
  window.cancelAnimationFrame(galleryState.frame);

  if (prefersReducedMotion) {
    return;
  }

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

function endGalleryDrag(event) {
  if (!galleryState.dragging) {
    return;
  }

  galleryState.dragging = false;
  galleryStage.classList.remove("is-dragging");

  if (event?.pointerId !== undefined && galleryStage.hasPointerCapture(event.pointerId)) {
    galleryStage.releasePointerCapture(event.pointerId);
  }

  startMomentum();
}

function scheduleLayoutUpdate() {
  if (layoutFrame) {
    return;
  }

  layoutFrame = window.requestAnimationFrame(() => {
    layoutFrame = null;
    setGalleryLoopDistance();
    measureThreadField();

    if (!prefersReducedMotion) {
      requestThreadUpdate();
    }
  });
}

if (galleryStage && galleryTrack) {
  galleryStage.addEventListener("pointerdown", (event) => {
    galleryState.dragging = true;
    galleryState.startX = event.clientX;
    galleryState.previousX = event.clientX;
    galleryState.velocity = 0;
    galleryStage.classList.add("is-dragging");
    galleryStage.setPointerCapture(event.pointerId);
    window.cancelAnimationFrame(galleryState.frame);
  });

  galleryStage.addEventListener("pointermove", (event) => {
    if (!galleryState.dragging) {
      return;
    }

    const delta = event.clientX - galleryState.previousX;
    galleryState.currentX += delta;
    galleryState.velocity = delta;
    galleryState.previousX = event.clientX;
    renderGallery();
  });

  galleryStage.addEventListener("pointerup", endGalleryDrag);
  galleryStage.addEventListener("pointercancel", endGalleryDrag);
  galleryStage.addEventListener("pointerleave", endGalleryDrag);
}

window.addEventListener("load", scheduleLayoutUpdate, { once: true });
window.addEventListener("resize", scheduleLayoutUpdate, { passive: true });

if (!prefersReducedMotion && crochetThreadField) {
  window.addEventListener("scroll", requestThreadUpdate, { passive: true });
}

scheduleLayoutUpdate();
