const body = document.body;
const menuPanel = document.querySelector(".menu-panel");
const menuToggle = document.querySelector(".menu-toggle");
const menuClose = document.querySelector(".menu-close");
const menuLinks = document.querySelectorAll(".menu-panel a");
const revealItems = document.querySelectorAll(".reveal");
const sliders = document.querySelectorAll("[data-slider]");
const tabs = document.querySelectorAll(".tab");

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

if ("IntersectionObserver" in window) {
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
