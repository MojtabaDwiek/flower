const body = document.body;
const menuPanel = document.querySelector(".menu-panel");
const menuToggle = document.querySelector(".menu-toggle");
const menuClose = document.querySelector(".menu-close");
const menuLinks = document.querySelectorAll(".menu-panel a");
const revealItems = document.querySelectorAll(".reveal");
const sliders = document.querySelectorAll("[data-slider]");
const tabs = document.querySelectorAll(".tab");
const galleryTrack = document.querySelector(".gallery-strip .strip-track");
const testimonialTrack = document.querySelector(".marquee div");
const pageLoader = document.querySelector(".page-loader");
const simpleCursor = document.querySelector(".simple-cursor");
const scrollContainer = document.querySelector("[data-scroll-container]");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let smoothScroll = null;

body.classList.add("is-loading");

if (scrollContainer && window.LocomotiveScroll && !reduceMotion.matches) {
  smoothScroll = new LocomotiveScroll({
    el: scrollContainer,
    smooth: true,
    lerp: 0.08,
    multiplier: 0.9,
    smartphone: {
      smooth: true,
    },
    tablet: {
      smooth: true,
    },
  });
}

function setMenu(open) {
  if (!menuPanel || !menuToggle) {
    return;
  }

  body.classList.toggle("menu-open", open);
  menuPanel.classList.toggle("is-open", open);
  menuPanel.setAttribute("aria-hidden", String(!open));
  menuToggle.setAttribute("aria-expanded", String(open));
}

menuToggle?.addEventListener("click", () => setMenu(true));
menuClose?.addEventListener("click", () => setMenu(false));
menuPanel?.addEventListener("click", (event) => {
  if (event.target === menuPanel) {
    setMenu(false);
  }
});
menuLinks.forEach((link) => link.addEventListener("click", () => setMenu(false)));

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const hash = link.getAttribute("href");

    if (!hash || hash === "#") {
      return;
    }

    const target = document.querySelector(hash);

    if (!target) {
      return;
    }

    event.preventDefault();
    setMenu(false);

    if (smoothScroll) {
      smoothScroll.scrollTo(target, {
        offset: 0,
        duration: 900,
      });
    } else {
      target.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth" });
    }
  });
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((item) => item.classList.remove("is-active"));
    tab.classList.add("is-active");
  });
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setMenu(false);
  }
});

window.addEventListener("load", () => {
  pageLoader?.classList.add("is-hidden");
  body.classList.remove("is-loading");
  smoothScroll?.update();
  revealVisibleItems();
});

window.addEventListener("resize", () => {
  smoothScroll?.update();
}, { passive: true });

if (simpleCursor && window.matchMedia("(pointer: fine)").matches) {
  const cursorDot = simpleCursor.querySelector("span");
  const cursor = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    targetX: window.innerWidth / 2,
    targetY: window.innerHeight / 2,
  };
  let hasPointer = false;

  body.classList.add("custom-cursor-enabled");

  document.addEventListener("pointermove", (event) => {
    cursor.targetX = event.clientX;
    cursor.targetY = event.clientY;
    hasPointer = true;

    if (cursorDot) {
      cursorDot.style.transform = `translate3d(${cursor.targetX - cursor.x}px, ${cursor.targetY - cursor.y}px, 0) translate(-50%, -50%)`;
    }
  }, { passive: true });

  document.addEventListener("pointerover", (event) => {
    simpleCursor.classList.toggle("is-hovering", Boolean(event.target.closest("a, button")));
  });

  document.addEventListener("pointerleave", () => {
    hasPointer = false;
    simpleCursor.style.transform = "translate3d(-100px, -100px, 0)";
  });

  function renderCursor() {
    cursor.x += (cursor.targetX - cursor.x) * 0.1;
    cursor.y += (cursor.targetY - cursor.y) * 0.1;

    if (hasPointer) {
      simpleCursor.style.transform = `translate3d(${cursor.x}px, ${cursor.y}px, 0)`;

      if (cursorDot) {
        cursorDot.style.transform = `translate3d(${cursor.targetX - cursor.x}px, ${cursor.targetY - cursor.y}px, 0) translate(-50%, -50%)`;
      }
    }

    requestAnimationFrame(renderCursor);
  }

  requestAnimationFrame(renderCursor);
}

function revealVisibleItems() {
  revealItems.forEach((item) => {
    if (item.classList.contains("is-visible")) {
      return;
    }

    const rect = item.getBoundingClientRect();
    const triggerPoint = window.innerHeight * 0.84;

    if (rect.top < triggerPoint && rect.bottom > 0) {
      item.classList.add("is-visible");
    }
  });
}

if (smoothScroll) {
  smoothScroll.on("scroll", revealVisibleItems);
  revealVisibleItems();
} else if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.16 }
  );

  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

sliders.forEach((slider) => {
  const track = slider.querySelector(".slider-track");
  const slides = slider.querySelectorAll(".slider article");
  const prev = slider.querySelector("[data-prev]");
  const next = slider.querySelector("[data-next]");
  let index = 0;

  function render() {
    if (!track || !slides.length) {
      return;
    }

    const slide = slides[0];
    const gap = parseFloat(getComputedStyle(slide).marginRight) || 0;
    const distance = slide.getBoundingClientRect().width + gap;
    track.style.transform = `translate3d(${-index * distance}px, 0, 0)`;
  }

  prev?.addEventListener("click", () => {
    index = Math.max(0, index - 1);
    render();
  });

  next?.addEventListener("click", () => {
    index = Math.min(slides.length - 1, index + 1);
    render();
  });

  window.addEventListener("resize", render, { passive: true });
  render();
});

function makeDraggableLoop(track, speed) {
  if (!track) {
    return;
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let position = 0;
  let velocity = reduceMotion.matches ? 0 : speed;
  let lastX = 0;
  let lastMoveTime = 0;
  let lastFrame = performance.now();
  let isDragging = false;

  function loopWidth() {
    return track.scrollWidth / 2;
  }

  function wrapPosition() {
    const width = loopWidth();

    if (!width) {
      return;
    }

    while (position <= -width) {
      position += width;
    }

    while (position > 0) {
      position -= width;
    }
  }

  function renderGallery() {
    wrapPosition();
    track.style.transform = `translate3d(${position}px, 0, 0)`;
  }

  function startDrag(event) {
    isDragging = true;
    lastX = event.clientX;
    lastMoveTime = performance.now();
    velocity = 0;
    track.classList.add("is-dragging");
    track.setPointerCapture?.(event.pointerId);
  }

  function drag(event) {
    if (!isDragging) {
      return;
    }

    const now = performance.now();
    const deltaX = event.clientX - lastX;
    const deltaTime = Math.max(now - lastMoveTime, 16);

    position += deltaX;
    velocity = deltaX / deltaTime;
    lastX = event.clientX;
    lastMoveTime = now;
    renderGallery();
  }

  function endDrag(event) {
    if (!isDragging) {
      return;
    }

    isDragging = false;
    track.classList.remove("is-dragging");
    track.releasePointerCapture?.(event.pointerId);
  }

  function animateGallery(now) {
    const deltaTime = Math.min(now - lastFrame, 32);
    const idleVelocity = reduceMotion.matches ? 0 : speed;

    lastFrame = now;

    if (!isDragging) {
      position += velocity * deltaTime;
      velocity += (idleVelocity - velocity) * 0.025;
      renderGallery();
    }

    requestAnimationFrame(animateGallery);
  }

  track.addEventListener("pointerdown", startDrag);
  track.addEventListener("pointermove", drag);
  track.addEventListener("pointerup", endDrag);
  track.addEventListener("pointercancel", endDrag);
  window.addEventListener("resize", renderGallery, { passive: true });

  renderGallery();
  requestAnimationFrame(animateGallery);
}

makeDraggableLoop(galleryTrack, -0.045);
makeDraggableLoop(testimonialTrack, -0.035);
