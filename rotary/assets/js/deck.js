/* ============================================================
   THRIVE-Belize | Rotary Club of Punta Gorda -- deck engine
   ============================================================ */
(function () {
  "use strict";

  var slides = [];
  var currentIndex = 0;
  var notesVisible = false;

  function init() {
    slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
    if (!slides.length) return;
    hydrateVideos();
    setupNavigation();
    setupKeyboard();
    setupRefit();
    protectPhotos();
    goToSlide(0);
  }

  /* --- Fit the slide to the screen ----------------------------------------
     Meeting-room projectors are short (768px is common) and some slides in
     this deck are dense. Rather than let a line disappear below the fold or
     force the speaker to scroll mid-sentence, shrink the slide until it fits.
     Zoom is used, not transform: it re-runs layout, so text stays crisp and
     line breaks stay sensible. The floor keeps text readable; below it the
     slide scrolls as before. */
  /* Height of the visible content, in real screen pixels. scrollHeight cannot
     be used here: the slide centres its children with flexbox, and a
     centre-aligned overflow is reported as no overflow at all. Measuring the
     children's own boxes is the only reading that matches what the room sees. */
  function contentHeight(slide) {
    var kids = slide.children;
    var top = Infinity;
    var bottom = -Infinity;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].classList.contains("speaker-note")) continue;
      var r = kids[i].getBoundingClientRect();
      if (!r.height && !r.width) continue;
      if (r.top < top) top = r.top;
      if (r.bottom > bottom) bottom = r.bottom;
    }
    return isFinite(top) ? bottom - top : 0;
  }

  function fitSlide(slide) {
    if (!slide) return;
    slide.style.zoom = "";
    slide.style.removeProperty("--fit");

    var zoom = 1;
    for (var pass = 0; pass < 6; pass++) {
      var cs = window.getComputedStyle(slide);
      // Padding is declared in the slide's own coordinate space, so it has to
      // be converted back to screen pixels before it can be subtracted.
      var pad = (parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)) * zoom;
      var room = slide.getBoundingClientRect().height - pad;
      var needed = contentHeight(slide);
      if (!needed || needed <= room) break;
      var next = Math.max(0.6, zoom * (room / needed) * 0.99);
      if (next >= zoom - 0.003) break;
      zoom = next;
      slide.style.zoom = zoom;
      // Zooming out enlarges the slide's own coordinate space, so the fixed
      // px max-widths on the wide blocks would leave a dead margin down the
      // side. --fit grows them by the same factor, keeping the layout
      // edge-to-edge. Zoom only ever decreases here, so --fit only ever grows
      // and the loop cannot oscillate.
      slide.style.setProperty("--fit", 1 / zoom);
    }
  }

  function setupRefit() {
    var pending;
    window.addEventListener("resize", function () {
      clearTimeout(pending);
      pending = setTimeout(function () { fitSlide(slides[currentIndex]); }, 120);
    });
  }

  /* --- Video: local file first, public release second, honest message third --- */
  function hydrateVideos() {
    var dataEl = document.getElementById("deck-data");
    if (!dataEl) return;

    var data;
    try { data = JSON.parse(dataEl.textContent); } catch (e) { return; }
    if (!data || !data.videos) return;

    Object.keys(data.videos).forEach(function (key) {
      var rec = data.videos[key] || {};
      var player = document.querySelector('video[data-video="' + key + '"]');
      if (!player) return;

      var fallback = document.getElementById(key + "-fallback");
      var triedRemote = false;

      player.addEventListener("error", function () {
        if (!triedRemote && rec.remote) {
          // Local copy missing -- fall back to streaming from the public release.
          triedRemote = true;
          player.src = rec.remote;
          player.load();
        } else if (fallback) {
          // Neither source is reachable. Say so rather than showing a dead player.
          fallback.classList.add("visible");
        }
      });

      if (rec.filename) {
        player.src = rec.filename;
      } else if (rec.remote) {
        triedRemote = true;
        player.src = rec.remote;
      }
    });
  }

  /* --- Slide movement --- */
  function goToSlide(index) {
    if (index < 0 || index >= slides.length) return;
    pauseAllVideos();
    slides[currentIndex].classList.remove("active");
    currentIndex = index;
    slides[currentIndex].classList.add("active");
    slides[currentIndex].scrollTop = 0;
    fitSlide(slides[currentIndex]);
    updateProgress();
    updateCounter();
    updateNotes();
  }

  function nextSlide() { goToSlide(Math.min(slides.length - 1, currentIndex + 1)); }
  function prevSlide() { goToSlide(Math.max(0, currentIndex - 1)); }

  // Leaving a slide should stop its audio; nothing is more distracting mid-talk.
  function pauseAllVideos() {
    var players = document.querySelectorAll("video");
    for (var i = 0; i < players.length; i++) {
      if (!players[i].paused) players[i].pause();
    }
  }

  function updateProgress() {
    var fill = document.getElementById("progress-fill");
    if (!fill) return;
    fill.style.width = (slides.length > 1 ? (currentIndex / (slides.length - 1)) * 100 : 100) + "%";
  }

  function updateCounter() {
    var el = document.getElementById("slide-counter");
    if (el) el.textContent = (currentIndex + 1) + " / " + slides.length;
    var prev = document.getElementById("prev-btn");
    var next = document.getElementById("next-btn");
    if (prev) prev.disabled = currentIndex === 0;
    if (next) next.disabled = currentIndex === slides.length - 1;
  }

  function setupNavigation() {
    var prev = document.getElementById("prev-btn");
    var next = document.getElementById("next-btn");
    if (prev) prev.addEventListener("click", prevSlide);
    if (next) next.addEventListener("click", nextSlide);
  }

  function setupKeyboard() {
    document.addEventListener("keydown", function (e) {
      var tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      switch (e.key) {
        case "ArrowRight": case "PageDown":
          e.preventDefault(); nextSlide(); break;
        case " ":
          // Space advances, except when the focus is on the video or a button.
          if (tag !== "video" && tag !== "button") { e.preventDefault(); nextSlide(); }
          break;
        case "ArrowLeft": case "PageUp":
          e.preventDefault(); prevSlide(); break;
        case "Home": e.preventDefault(); goToSlide(0); break;
        case "End":  e.preventDefault(); goToSlide(slides.length - 1); break;
        case "s": case "S": toggleNotes(); break;
        case "f": case "F": toggleFullscreen(); break;
      }
    });
  }

  /* --- Speaker notes --- */
  function updateNotes() {
    var panel = document.getElementById("notes-content");
    if (!panel) return;
    var slide = slides[currentIndex];
    var note = slide ? slide.querySelector(".speaker-note") : null;
    panel.textContent = note ? note.textContent : "";
  }

  function toggleNotes() {
    var panel = document.getElementById("notes-panel");
    if (!panel) return;
    notesVisible = !notesVisible;
    panel.classList.toggle("visible", notesVisible);
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(function () {});
    } else {
      document.exitFullscreen().catch(function () {});
    }
  }

  /* --- Photos are of real people and a real school; make casual copying harder --- */
  function protectPhotos() {
    document.addEventListener("contextmenu", function (e) {
      if (e.target.tagName === "IMG" || (e.target.closest && e.target.closest(".photo-shield"))) {
        e.preventDefault();
      }
    });
    var imgs = document.querySelectorAll("img");
    for (var i = 0; i < imgs.length; i++) {
      imgs[i].setAttribute("draggable", "false");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
