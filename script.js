(async () => {
  function waitForGsap() {
    if (window.gsap) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let timeout = 0;
      let interval = 0;
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        window.clearInterval(interval);
        resolve();
      };

      timeout = window.setTimeout(finish, 700);
      interval = window.setInterval(() => {
        if (window.gsap) finish();
      }, 25);
    });
  }

  await waitForGsap();

  const body = document.body;
  const gsap = window.gsap;
  const hasGsap = Boolean(gsap);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const loader = document.querySelector(".intro-loader");
  const loaderCount = document.querySelector("[data-loader-count]");
  const revealItems = document.querySelectorAll(".js-reveal");
  const caseNodes = Array.from(document.querySelectorAll(".js-case-item"));
  const workList = document.querySelector("[data-work-list]");
  const titleWindow = document.querySelector(".js-project-title");
  const projectHud = document.querySelector(".js-project-details");
  const roleWindow = document.querySelector(".js-roles");
  const titleList = document.querySelector(".js-project-title-list-container");
  const roleList = document.querySelector(".js-project-role-list-container");
  const counter = document.querySelector(".js-project-counter");
  const indexContainer = document.querySelector(".js-current-index");
  const itemList = document.querySelector(".js-item-list");
  const itemListCopy = document.querySelector(".js-item-list-copy");
  const lengthContainer = document.querySelector(".js-current-length");
  const viewToggle = document.querySelector(".js-view-toggle");
  const projectList = document.querySelector(".project-list");
  const mobileToggle = document.querySelector(".mobile-toggle");
  const mobileMenu = document.querySelector(".mobile-menu");
  const aboutPanel = document.querySelector(".about-panel");
  const aboutClose = document.querySelector(".about-close");
  const aboutContent = document.querySelectorAll(".about-panel > div, .about-panel > p");
  const timePanel = document.querySelector(".time-panel");
  const timeButtons = document.querySelectorAll(".time-button, .place-button");
  const cursor = document.querySelector(".cursor-orb");
  const canvas = document.querySelector("[data-canvas]");

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const wrap = (index, length) => ((index % length) + length) % length;
  const isDesktop = () => window.innerWidth >= 1000;

  const projects = caseNodes.map((node, index) => ({
    index,
    title: node.dataset.title || `Project ${index + 1}`,
    year: node.dataset.year || "2026",
    role: node.dataset.role || "Motion, Development",
    src: node.dataset.src || node.dataset.fallback,
    fallback: node.dataset.fallback || node.dataset.src,
  }));

  let items = [];
  let activeIndex = 0;
  let currentX = 0;
  let targetX = 0;
  let isFilm = !isDesktop();
  let dragStart = null;
  let dragTargetStart = 0;
  let snapTimer = 0;
  let titleStep = 18;
  let roleStep = 18;
  let counterStep = 14;
  let detailTweenValue = 0;
  let counterTweenValue = 0;
  let metricsCache = null;
  let metricsDirty = true;
  let needsRender = true;
  let lastRenderedX = Number.NaN;
  let movingTimer = 0;

  function setInline(el, styles) {
    if (el) {
      Object.assign(el.style, styles);
    }
  }

  function gridColumn() {
    const columns = isDesktop() ? 12 : 6;
    const margin = isDesktop() ? 36 : 18;
    const gap = 10;
    return (window.innerWidth - margin * 2 - gap * (columns - 1)) / columns;
  }

  function layoutMetrics() {
    if (metricsCache && !metricsDirty) {
      return metricsCache;
    }

    const col = gridColumn();
    const gap = isDesktop() ? 24 : 12;
    const margin = isDesktop() ? 36 : 18;
    const desiredActiveWidth = isDesktop() ? col * 6 + 10 * 5 : window.innerWidth - margin * 2;
    const maxItemHeight = Math.max(120, window.innerHeight - (isDesktop() ? 176 : 192));
    const activeWidth = Math.min(desiredActiveWidth, maxItemHeight * (16 / 9));
    const inactiveWidth = isFilm ? activeWidth : col;
    const itemHeight = activeWidth * (9 / 16);
    const visibleRange = isFilm ? 2.35 : 3.65;

    metricsCache = {
      activeWidth,
      inactiveWidth,
      itemHeight,
      gap,
      visibleRange,
    };
    metricsDirty = false;

    return metricsCache;
  }

  function centeredPosition(rawPosition, total) {
    let position = rawPosition;

    while (position > total / 2) {
      position -= total;
    }

    while (position < -total / 2) {
      position += total;
    }

    return position;
  }

  function markMoving() {
    if (!body.classList.contains("is-moving")) {
      body.classList.add("is-moving");
    }

    window.clearTimeout(movingTimer);
    movingTimer = window.setTimeout(() => {
      body.classList.remove("is-moving");
    }, 220);
  }

  function setCachedStyle(entry, target, property, value) {
    const cache = target === "image" ? entry.imageStyles : entry.itemStyles;
    const element = target === "image" ? entry.image : entry.item;

    if (cache[property] !== value) {
      cache[property] = value;
      element.style[property] = value;
    }
  }

  function focusProject(index, snapDelay = 80) {
    if (!projects.length) {
      return;
    }

    const total = projects.length;
    const current = wrap(Math.round(-targetX), total);
    let delta = index - current;

    if (delta > total / 2) delta -= total;
    if (delta < -total / 2) delta += total;

    targetX -= delta;
    targetX = Math.round(targetX);
    needsRender = true;
    markMoving();
    scheduleSnap(snapDelay);
  }

  function buildWorkItems() {
    if (!workList || !projects.length) {
      return;
    }

    workList.innerHTML = "";
    items = projects.map((project, index) => {
      const item = document.createElement("button");
      const image = document.createElement("img");

      item.className = "work-item";
      item.type = "button";
      item.setAttribute("aria-label", project.title);
      item.setAttribute("aria-pressed", "false");
      item.dataset.index = String(index);
      image.alt = project.title;
      image.loading = index < 5 ? "eager" : "lazy";
      image.decoding = "async";
      image.fetchPriority = index < 3 ? "high" : "low";

      let triedFallback = false;
      image.addEventListener("load", () => item.classList.add("is-loaded"));
      image.addEventListener("error", () => {
        if (!triedFallback && project.fallback && image.getAttribute("src") !== project.fallback) {
          triedFallback = true;
          image.src = project.fallback;
          return;
        }

        image.hidden = true;
        item.classList.add("is-loaded");
      });

      if (project.src) {
        image.src = project.src;
      } else {
        image.hidden = true;
        item.classList.add("is-loaded");
      }

      item.appendChild(image);
      item.addEventListener("click", () => {
        focusProject(index);
      });

      workList.appendChild(item);
      return { item, image, project, position: 0, itemStyles: {}, imageStyles: {}, active: false, visible: false };
    });
  }

  function buildDetails() {
    if (!projects.length) {
      return;
    }

    if (titleList) {
      titleList.innerHTML = "";
    }

    if (roleList) {
      roleList.innerHTML = "";
    }

    for (let copy = 0; copy < 2; copy += 1) {
      projects.forEach((project) => {
        if (titleList) {
          const link = document.createElement("a");
          link.href = "#work";
          link.textContent = project.title;
          titleList.appendChild(link);
        }

        if (roleList) {
          const row = document.createElement("div");
          row.textContent = `${project.year} - ${project.role}`;
          roleList.appendChild(row);
        }
      });
    }

    if (itemList) {
      itemList.innerHTML = projects.map((_, index) => `<div>${index + 1}</div>`).join("");
    }

    if (itemListCopy) {
      itemListCopy.innerHTML = projects.map((_, index) => `<div>${index + 1}</div>`).join("");
    }

    if (lengthContainer) {
      lengthContainer.textContent = String(projects.length);
    }

    if (projectList) {
      projectList.innerHTML = projects
        .map(
          (project, index) => `
            <button type="button" data-project-trigger="${index}">
              <span>${String(index + 1).padStart(2, "0")}</span>
              <span>${project.title}</span>
              <span>${project.role}</span>
              <span>${project.year}</span>
            </button>
          `,
        )
        .join("");

      projectList.querySelectorAll("[data-project-trigger]").forEach((button) => {
        button.addEventListener("click", () => {
          const index = Number(button.dataset.projectTrigger);
          focusProject(index, 0);
        });
      });
    }

    requestAnimationFrame(() => {
      titleStep = titleList?.children[1]?.offsetTop - titleList?.children[0]?.offsetTop || 18;
      roleStep = roleList?.children[1]?.offsetTop - roleList?.children[0]?.offsetTop || 18;
      counterStep = itemList?.children[1]?.offsetTop - itemList?.children[0]?.offsetTop || 14;
      setDetails(0, true);
    });
  }

  function updateProjectListSelection() {
    projectList?.querySelectorAll("[data-project-trigger]").forEach((row, index) => {
      row.classList.toggle("is-selected", index === activeIndex);
    });
  }

  function setDetails(index, immediate = false) {
    if (!projects.length) {
      return;
    }

    if (!projectHud || window.getComputedStyle(projectHud).display === "none") {
      detailTweenValue = index;
      counterTweenValue = index;
      updateProjectListSelection();
      return;
    }

    const total = projects.length;
    let titleTarget = index;
    let counterTarget = index;

    if (!immediate) {
      const titleCurrent = ((detailTweenValue % total) + total) % total;
      const counterCurrent = ((counterTweenValue % total) + total) % total;
      let titleDelta = index - titleCurrent;
      let counterDelta = index - counterCurrent;

      if (titleDelta < 0) titleDelta += total;
      if (counterDelta < 0) counterDelta += total;

      titleTarget = detailTweenValue + titleDelta;
      counterTarget = counterTweenValue + counterDelta;
    }

    function renderTitle(value) {
      if (titleList) {
        titleList.style.transform = `translateY(${-value * titleStep}px)`;
      }

      if (roleList) {
        roleList.style.transform = `translateY(${-value * roleStep}px)`;
      }
    }

    function renderCounter(value) {
      if (indexContainer) {
        indexContainer.style.transform = `translateY(${-value * counterStep}px)`;
      }
    }

    if (!hasGsap || reduceMotion || immediate) {
      detailTweenValue = index;
      counterTweenValue = index;
      renderTitle(index);
      renderCounter(index);
      updateProjectListSelection();
      return;
    }

    gsap.to({ value: detailTweenValue }, {
      value: titleTarget,
      duration: 0.95,
      ease: "expo.out",
      onUpdate() {
        renderTitle(this.targets()[0].value);
      },
      onComplete() {
        detailTweenValue = index;
        renderTitle(index);
      },
    });

    gsap.to({ value: counterTweenValue }, {
      value: counterTarget,
      duration: 0.95,
      ease: "expo.out",
      onUpdate() {
        renderCounter(this.targets()[0].value);
      },
      onComplete() {
        counterTweenValue = index;
        renderCounter(index);
      },
    });

    detailTweenValue = titleTarget;
    counterTweenValue = counterTarget;
    updateProjectListSelection();
  }

  function renderWorkItems() {
    if (!items.length) {
      return;
    }

    const metrics = layoutMetrics();
    const total = items.length;
    const nextActive = wrap(Math.round(-currentX), total);

    if (nextActive !== activeIndex) {
      activeIndex = nextActive;
      setDetails(activeIndex);
    }

    items.forEach((entry, index) => {
      const rawPosition = index + currentX;
      const position = centeredPosition(rawPosition, total);
      const abs = Math.abs(position);
      const sign = Math.sign(position);
      const isActive = index === activeIndex;
      const visible = abs < metrics.visibleRange;
      const wasVisible = entry.visible;
      const width = isFilm
        ? metrics.activeWidth
        : isActive
          ? metrics.activeWidth
          : metrics.inactiveWidth;
      const spacing = isFilm
        ? metrics.activeWidth + metrics.gap
        : metrics.inactiveWidth + metrics.gap;
      const sidePush = isFilm ? 0 : sign * ((metrics.activeWidth - metrics.inactiveWidth) / 2) * clamp(abs, 0, 1);
      const x = position * spacing + sidePush;
      const opacity = visible ? (isFilm ? (abs < 2.05 ? 1 : 0.12) : 1) : 0;
      const itemTransform = `translate3d(calc(-50% + ${x.toFixed(3)}px), -50%, 0)`;
      const imageTransform = "none";

      entry.position = position;

      if (entry.active !== isActive) {
        entry.active = isActive;
        entry.item.classList.toggle("is-active", isActive);
        entry.item.setAttribute("aria-pressed", String(isActive));
      }

      if (entry.visible !== visible) {
        entry.visible = visible;
        entry.item.classList.toggle("is-visible", visible);
      }

      if (!visible && !wasVisible) {
        setCachedStyle(entry, "item", "opacity", "0");
        setCachedStyle(entry, "item", "pointerEvents", "none");
        return;
      }

      entry.item.dataset.position = String(position);
      setCachedStyle(entry, "item", "width", `${width.toFixed(3)}px`);
      setCachedStyle(entry, "item", "height", `${metrics.itemHeight.toFixed(3)}px`);
      setCachedStyle(entry, "item", "opacity", String(opacity));
      setCachedStyle(entry, "item", "zIndex", String(100 - Math.round(abs * 10)));
      setCachedStyle(entry, "item", "pointerEvents", visible ? "auto" : "none");
      setCachedStyle(entry, "item", "transform", itemTransform);

      if (visible) {
        setCachedStyle(entry, "image", "transform", imageTransform);
      }
    });
  }

  function tickWork() {
    const ease = workList?.classList.contains("is-dragging") ? 0.2 : 0.16;
    currentX += (targetX - currentX) * (reduceMotion ? 1 : ease);

    if (Math.abs(targetX - currentX) < 0.0008) {
      currentX = targetX;
    }

    if (needsRender || Math.abs(currentX - lastRenderedX) > 0.0008) {
      renderWorkItems();
      lastRenderedX = currentX;
      needsRender = false;
    }

    requestAnimationFrame(tickWork);
  }

  function scheduleSnap(delay = 160) {
    window.clearTimeout(snapTimer);
    snapTimer = window.setTimeout(() => {
      targetX = Math.round(targetX);
      needsRender = true;
    }, delay);
  }

  function setFilmMode(nextFilm) {
    isFilm = nextFilm;
    metricsDirty = true;
    needsRender = true;
    body.classList.toggle("film-mode", isFilm);
    viewToggle?.setAttribute("aria-pressed", String(isFilm));

    if (hasGsap && !reduceMotion) {
      gsap.to(".js-left", { x: isFilm ? "-0.625rem" : "-0.375rem", duration: 0.75, ease: "expo.out" });
      gsap.to(".js-middle-left", { x: isFilm ? "-0.21875rem" : "0rem", duration: 0.75, ease: "expo.out" });
      gsap.to(".js-middle-right", { x: isFilm ? "0.21875rem" : "0rem", duration: 0.75, ease: "expo.out" });
      gsap.to(".js-right", { x: isFilm ? "0.625rem" : "0.375rem", duration: 0.75, ease: "expo.out" });
      gsap.fromTo(items.map((entry) => entry.item), { filter: "brightness(1.2)" }, { filter: "brightness(1)", duration: 0.85, ease: "expo.out" });
    }

    renderWorkItems();
  }

  function bindWorkInputs() {
    if (!workList) {
      return;
    }

    window.addEventListener(
      "wheel",
      (event) => {
        if (body.classList.contains("time-open") || body.classList.contains("about-open") || body.classList.contains("menu-open")) {
          return;
        }

        event.preventDefault();
        const divider = 380 + (isFilm ? 520 : 0);
        const delta = clamp((-event.deltaY - event.deltaX) / divider, -0.14, 0.14);

        if (delta) {
          targetX += delta;
          needsRender = true;
          markMoving();
          scheduleSnap();
        }
      },
      { passive: false },
    );

    workList.addEventListener("pointerdown", (event) => {
      dragStart = { x: event.clientX, y: event.clientY };
      dragTargetStart = targetX;
      workList.classList.add("is-dragging");
      markMoving();
      workList.setPointerCapture?.(event.pointerId);
    });

    workList.addEventListener("pointermove", (event) => {
      if (!dragStart) {
        return;
      }

      const deltaX = event.clientX - dragStart.x;
      const deltaY = event.clientY - dragStart.y;
      targetX = dragTargetStart + (deltaX + (isDesktop() ? 0 : deltaY)) / (145 + (isFilm ? 360 : 0));
      needsRender = true;
      markMoving();
    });

    function endDrag(event) {
      if (!dragStart) {
        return;
      }

      dragStart = null;
      workList.classList.remove("is-dragging");
      workList.releasePointerCapture?.(event.pointerId);
      scheduleSnap(0);
    }

    workList.addEventListener("pointerup", endDrag);
    workList.addEventListener("pointercancel", endDrag);

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setMobileMenu(false);
        setTimePanel(false);
        setAboutPanel(false);
        return;
      }

      if (body.classList.contains("time-open") || body.classList.contains("about-open") || body.classList.contains("menu-open")) {
        return;
      }

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        targetX -= 1;
        needsRender = true;
        markMoving();
        scheduleSnap(0);
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        targetX += 1;
        needsRender = true;
        markMoving();
        scheduleSnap(0);
      }
    });

    window.addEventListener(
      "resize",
      () => {
        const shouldFilm = !isDesktop();
        if (shouldFilm && !isFilm) {
          setFilmMode(true);
        }
        metricsDirty = true;
        needsRender = true;
        renderWorkItems();
      },
      { passive: true },
    );
  }

  function revealInterface(delay = 0) {
    if (!hasGsap || reduceMotion) {
      revealItems.forEach((item) => {
        setInline(item, { transform: "translateY(0)", clipPath: "inset(0% 0% 0% 0%)" });
      });
      setInline(viewToggle, { transform: "translateY(0)", clipPath: "inset(-10% 0% -10% 0%)" });
      setInline(counter, { transform: "translateY(0)", clipPath: "inset(0% 0% 0% 0%)" });
      setInline(titleWindow, { transform: "translateY(0)", clipPath: "inset(-10% 0% -10% 0%)" });
      setInline(roleWindow, { transform: "translateY(0)", clipPath: "inset(-10% 0% -10% 0%)" });
      return;
    }

    gsap.to(revealItems, {
      y: 0,
      yPercent: 0,
      clipPath: "inset(-10% 0% -10% 0%)",
      duration: 1.15,
      stagger: 0.055,
      delay,
      ease: "expo.out",
    });
    gsap.fromTo(
      [viewToggle, counter, titleWindow, roleWindow].filter(Boolean),
      { yPercent: 100, clipPath: "inset(-10% 0% 110% 0%)" },
      { yPercent: 0, clipPath: "inset(-10% 0% -10% 0%)", duration: 1.25, stagger: 0.04, delay: delay + 0.08, ease: "expo.out" },
    );
  }

  function runIntro() {
    body.classList.add("is-loading");
    setFilmMode(isFilm);
    renderWorkItems();

    if (!loader || !hasGsap || reduceMotion) {
      loader?.remove();
      body.classList.remove("is-loading");
      revealInterface();
      return;
    }

    const counterState = { value: 0 };
    gsap.set(".intro-logo span", { scaleY: 0 });
    gsap.set(".intro-mask", { scaleY: 1, transformOrigin: "top" });

    const tl = gsap.timeline({
      defaults: { ease: "expo.out" },
      onComplete: () => {
        loader.remove();
        body.classList.remove("is-loading");
      },
    });

    tl.to(".intro-logo span", { scaleY: 1, duration: 0.74, stagger: 0.08 }, 0.12);
    tl.to(
      counterState,
      {
        value: 100,
        duration: 1.35,
        ease: "power2.out",
        onUpdate: () => {
          if (loaderCount) loaderCount.textContent = Math.round(counterState.value);
        },
      },
      0,
    );
    tl.to(".intro-mask", { scaleY: 0, duration: 0.85 }, 0.78);
    tl.to(".intro-counter", { yPercent: -120, clipPath: "inset(0% 0% 100% 0%)", duration: 0.7 }, 1.06);
    tl.to(".intro-loader", { clipPath: "inset(0% 0% 100% 0%)", duration: 1.05 }, 1.2);
    tl.add(() => revealInterface(), 0.94);
  }

  function setMobileMenu(open) {
    body.classList.toggle("menu-open", open);
    mobileToggle?.setAttribute("aria-expanded", String(open));
    mobileMenu?.setAttribute("aria-hidden", String(!open));

    if (!mobileMenu) return;

    if (hasGsap && !reduceMotion) {
      gsap.to(mobileMenu, {
        clipPath: open ? "inset(0% 0% 0% 0%)" : "inset(0% 0% 100% 0%)",
        pointerEvents: open ? "auto" : "none",
        duration: 0.75,
        ease: "expo.inOut",
      });
    } else {
      setInline(mobileMenu, {
        clipPath: open ? "inset(0% 0% 0% 0%)" : "inset(0% 0% 100% 0%)",
        pointerEvents: open ? "auto" : "none",
      });
    }
  }

  function setTimePanel(open, skipCrossClose = false) {
    if (!timePanel) return;

    if (open && !skipCrossClose) {
      setMobileMenu(false);
      setAboutPanel(false, true);
    }

    body.classList.toggle("time-open", open);
    timePanel.setAttribute("aria-hidden", String(!open));
    timeButtons.forEach((button) => button.setAttribute("aria-expanded", String(open)));

    if (!hasGsap || reduceMotion) {
      setInline(timePanel, {
        clipPath: open ? "inset(0% 0% 0% 0%)" : "inset(100% 0% 0% 0%)",
        pointerEvents: open ? "auto" : "none",
      });
      return;
    }

    gsap.to(timePanel, {
      clipPath: open ? "inset(0% 0% 0% 0%)" : "inset(100% 0% 0% 0%)",
      pointerEvents: open ? "auto" : "none",
      duration: 0.86,
      ease: "expo.inOut",
    });
    gsap.fromTo(
      ".big-time span, .time-meta span, .time-panel p",
      { yPercent: open ? 110 : 0, opacity: open ? 0 : 1 },
      { yPercent: open ? 0 : -110, opacity: open ? 1 : 0, duration: 0.82, stagger: 0.025, ease: "expo.out" },
    );
  }

  function setAboutPanel(open, skipCrossClose = false) {
    if (!aboutPanel) return;

    if (open && !skipCrossClose) {
      setMobileMenu(false);
      setTimePanel(false, true);
    }

    body.classList.toggle("about-open", open);
    aboutPanel.setAttribute("aria-hidden", String(!open));

    if (!hasGsap || reduceMotion) {
      setInline(aboutPanel, {
        clipPath: open ? "inset(0% 0% 0% 0%)" : "inset(0% 0% 100% 0%)",
        pointerEvents: open ? "auto" : "none",
      });
      aboutContent.forEach((item) => {
        setInline(item, { opacity: open ? "1" : "0", transform: open ? "translateY(0)" : "translateY(2rem)" });
      });
      return;
    }

    if (open) {
      gsap.to(aboutPanel, {
        clipPath: "inset(0% 0% 0% 0%)",
        pointerEvents: "auto",
        duration: 0.88,
        ease: "expo.inOut",
      });
      gsap.to(aboutContent, { y: 0, opacity: 1, duration: 1, stagger: 0.08, delay: 0.22, ease: "expo.out" });
      return;
    }

    gsap.to(aboutContent, { y: -28, opacity: 0, duration: 0.28, stagger: 0.04, ease: "power2.in" });
    gsap.to(aboutPanel, {
      clipPath: "inset(0% 0% 100% 0%)",
      pointerEvents: "none",
      duration: 0.78,
      delay: 0.08,
      ease: "expo.inOut",
    });
  }

  function bindNavigation() {
    mobileToggle?.addEventListener("click", () => setMobileMenu(!body.classList.contains("menu-open")));
    viewToggle?.addEventListener("click", () => setFilmMode(!isFilm));
    aboutClose?.addEventListener("click", () => setAboutPanel(false));

    document.querySelectorAll('a[href="#about"]').forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        setAboutPanel(true);
      });
    });

    document.querySelectorAll('a[href="#work"]').forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        setAboutPanel(false);
        setMobileMenu(false);
        setTimePanel(false);
      });
    });

    timeButtons.forEach((button) => {
      button.addEventListener("click", () => setTimePanel(!body.classList.contains("time-open")));
    });
  }

  function updateClock() {
    const now = new Date();
    const timeParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Amsterdam",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).formatToParts(now);
    const dateParts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Amsterdam",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).formatToParts(now);
    const zonePart = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Amsterdam",
      timeZoneName: "short",
    })
      .formatToParts(now)
      .find((part) => part.type === "timeZoneName");

    const part = (parts, type) => parts.find((item) => item.type === type)?.value || "";
    const hour = part(timeParts, "hour");
    const minute = part(timeParts, "minute");
    const second = part(timeParts, "second");
    const dayPeriod = part(timeParts, "dayPeriod");
    const day = part(dateParts, "day");
    const month = part(dateParts, "month");
    const year = part(dateParts, "year");
    const zone = (zonePart?.value || "CET").replace("GMT+1", "CET").replace("GMT+2", "CEST");
    const hourNumber = Number(hour);
    const headerTime = `${Number.isNaN(hourNumber) ? hour : String(hourNumber)}:${minute}${dayPeriod} ${zone}`;

    document.querySelectorAll("[data-time]").forEach((node) => {
      node.textContent = headerTime;
    });
    document.querySelectorAll("[data-date]").forEach((node) => {
      node.textContent = `${day} ${month}`;
    });
    document.querySelectorAll("[data-year]").forEach((node) => {
      node.textContent = year;
    });

    const twoDigitHour = String(hourNumber || 12).padStart(2, "0");
    const hourOne = document.querySelector("[data-hour-one]");
    const hourTwo = document.querySelector("[data-hour-two]");
    const minuteOne = document.querySelector("[data-minute-one]");
    const minuteTwo = document.querySelector("[data-minute-two]");
    const secondsEl = document.querySelector("[data-seconds]");
    const ampmEl = document.querySelector("[data-ampm]");

    if (hourOne) hourOne.textContent = twoDigitHour[0];
    if (hourTwo) hourTwo.textContent = twoDigitHour[1];
    if (minuteOne) minuteOne.textContent = minute[0];
    if (minuteTwo) minuteTwo.textContent = minute[1];
    if (secondsEl) secondsEl.textContent = second;
    if (ampmEl) ampmEl.textContent = dayPeriod;
  }

  function initCursor() {
    if (!cursor || reduceMotion || !window.matchMedia("(pointer: fine)").matches) return;

    let cursorX = window.innerWidth / 2;
    let cursorY = window.innerHeight / 2;
    let targetX = cursorX;
    let targetY = cursorY;
    let hasPointer = false;

    window.addEventListener(
      "pointermove",
      (event) => {
        targetX = event.clientX;
        targetY = event.clientY;
        hasPointer = true;
        document.documentElement.style.setProperty("--orb-x", `${event.clientX}px`);
        document.documentElement.style.setProperty("--orb-y", `${event.clientY}px`);
      },
      { passive: true },
    );

    window.addEventListener("pointerleave", () => {
      hasPointer = false;
      cursor.style.opacity = "0";
    });

    function tick() {
      cursorX += (targetX - cursorX) * 0.18;
      cursorY += (targetY - cursorY) * 0.18;

      if (hasPointer) {
        cursor.style.opacity = "1";
        cursor.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0) translate(-50%, -50%)`;
      }

      requestAnimationFrame(tick);
    }

    tick();
  }

  function initCanvas() {
    if (!canvas || reduceMotion) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let time = 0;
    let lastDraw = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw(now = 0) {
      const frameGap = body.classList.contains("is-moving") ? 120 : 66;

      if (document.hidden || now - lastDraw < frameGap) {
        requestAnimationFrame(draw);
        return;
      }

      lastDraw = now;
      time += 0.006;
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < 12; i += 1) {
        const y = (height / 12) * i + Math.sin(time + i * 0.45) * 18;
        const alpha = 0.012 + (i % 3) * 0.003;
        ctx.beginPath();
        ctx.moveTo(0, y);

        for (let x = 0; x <= width; x += 150) {
          ctx.lineTo(x, y + Math.sin(time * 1.6 + x * 0.004 + i) * 20);
        }

        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      requestAnimationFrame(draw);
    }

    window.addEventListener("resize", resize, { passive: true });
    resize();
    draw();
  }

  buildWorkItems();
  buildDetails();
  bindWorkInputs();
  bindNavigation();
  updateClock();
  window.setInterval(updateClock, 1000);
  initCursor();
  initCanvas();
  tickWork();
  runIntro();
})();
