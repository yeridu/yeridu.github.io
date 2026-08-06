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
    protectPhotos();
    goToSlide(0);
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
