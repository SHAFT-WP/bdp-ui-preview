(function (global) {
  "use strict";

  var STORAGE_KEY = "bdp-common-ui-preview-v2-provider-v1";
  var FONT_BASE_MULTIPLIER = 1.5;
  var DEFAULT_FONT_SCALE = Object.freeze({
    "z-diagram": 1,
    "profile-diagram": 1.2,
    "top-diagram": 1.2
  });
  var DEFAULTS = Object.freeze({
    weaponId: "M82",
    targetElevationMslFt: "31",
    attackHeadingDeg: "0",
    windDirectionDeg: "0",
    windSpeedKt: "0",
    fragmentHeightMarginPercent: "20",
    speedOvershootKcas: "50",
    gOnsetTimeSec: "2",
    initialSpeedValue: "350",
    initialSpeedMode: "CAS",
    rollInStartAltitudeMslFt: "16000",
    diveAngleDeg: "45",
    angleOffDeg: "90",
    trackingTimeSec: "18",
    levelMapNm: "5.0",
    levelTurnEnabled: true,
    releaseAltitudeMslFt: "6800",
    releaseSpeedKcas: "450",
    rollInBankAngleDeg: "112.5",
    rollInG: "4"
  });

  var STRING_KEYS = Object.freeze({
    weaponId: true,
    initialSpeedMode: true
  });
  var BOOLEAN_KEYS = Object.freeze({
    levelTurnEnabled: true
  });

  var state = {
    provider: null,
    lastView: null,
    requestId: 0,
    hasRendered: false,
    changeTimers: {},
    bankLinked: true,
    levelMode: false,
    nonLevelRollInG: "4",
    fontScale: {
      "z-diagram": DEFAULT_FONT_SCALE["z-diagram"],
      "profile-diagram": DEFAULT_FONT_SCALE["profile-diagram"],
      "top-diagram": DEFAULT_FONT_SCALE["top-diagram"]
    },
    resultFontScale: {
      "result-summary": 1
    },
    zoom: {
      "z-diagram": 1,
      "profile-diagram": 1,
      "top-diagram": 1
    },
    pan: {
      "z-diagram": { x: 0, y: 0 },
      "profile-diagram": { x: 0, y: 0 },
      "top-diagram": { x: 0, y: 0 }
    }
  };

  var app = document.getElementById("app") || document.getElementById("bdp-app");
  var providerStatus = document.getElementById("provider-status");
  var calculateButton = document.getElementById("calculate-button");
  var advancedToggle = document.getElementById("advancedToggle") || document.getElementById("advanced-toggle");
  var defaultButton = document.getElementById("defaultBtn") || document.getElementById("default-button");
  var solveModeNode = document.getElementById("solveMode") || document.getElementById("solve-mode");
  var providerError = document.getElementById("provider-error");

  function controls(key) {
    return Array.prototype.slice.call(document.querySelectorAll('[data-bdp-input="' + key + '"]'));
  }

  function firstControl(key) {
    return controls(key)[0] || null;
  }

  function dependentFlash(element) {
    global.clearTimeout(element.__bdpDependentTimer);
    element.classList.remove("value-dependent-change");
    if (element.disabled || element.classList.contains("value-result")) {
      element.classList.remove("value-dependent-input");
      return;
    }
    element.classList.add("value-dependent-input");
  }

  function confirmDependentInput(key) {
    controls(key).forEach(function (element) {
      global.clearTimeout(element.__bdpDependentTimer);
      element.classList.remove("value-dependent-input");
    });
  }

  function setControls(key, value, except, flash) {
    controls(key).forEach(function (element) {
      var checkbox = element.getAttribute && element.getAttribute("type") === "checkbox";
      var changed = checkbox ? element.checked !== Boolean(value) : element.value !== String(value);
      if (element !== except && changed) {
        if (checkbox) element.checked = Boolean(value);
        else element.value = String(value);
        if (flash) dependentFlash(element);
      }
    });
  }

  function collectInput() {
    var input = {};
    Object.keys(DEFAULTS).forEach(function (key) {
      var element = firstControl(key);
      if (!element) return;
      if (BOOLEAN_KEYS[key]) {
        input[key] = Boolean(element.checked);
        return;
      }
      if (STRING_KEYS[key]) {
        input[key] = element.value;
        return;
      }
      var number = Number(element.value);
      input[key] = Number.isFinite(number) ? number : NaN;
    });
    input.solveMode = solveModeNode.dataset.mode || "initialAltitude";
    return input;
  }

  function loadInput() {
    var saved = {};
    try {
      saved = JSON.parse(global.localStorage.getItem(STORAGE_KEY) || "{}");
    } catch (error) {
      saved = {};
    }
    Object.keys(DEFAULTS).forEach(function (key) {
      setControls(key, saved[key] !== undefined ? saved[key] : DEFAULTS[key]);
    });
  }

  function saveInput() {
    var saved = {};
    Object.keys(DEFAULTS).forEach(function (key) {
      var element = firstControl(key);
      if (element) saved[key] = BOOLEAN_KEYS[key] ? Boolean(element.checked) : element.value;
    });
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }

  function resetInput() {
    Object.keys(DEFAULTS).forEach(function (key) {
      setControls(key, DEFAULTS[key]);
    });
    solveModeNode.dataset.mode = "initialAltitude";
    solveModeNode.textContent = "Initial Altitude 기준";
    state.bankLinked = true;
    state.levelMode = false;
    state.nonLevelRollInG = DEFAULTS.rollInG;
    state.fontScale["z-diagram"] = DEFAULT_FONT_SCALE["z-diagram"];
    state.fontScale["profile-diagram"] = DEFAULT_FONT_SCALE["profile-diagram"];
    state.fontScale["top-diagram"] = DEFAULT_FONT_SCALE["top-diagram"];
    state.resultFontScale["result-summary"] = 1;
    state.zoom["z-diagram"] = 1;
    state.zoom["profile-diagram"] = 1;
    state.zoom["top-diagram"] = 1;
    state.pan["z-diagram"] = { x: 0, y: 0 };
    state.pan["profile-diagram"] = { x: 0, y: 0 };
    state.pan["top-diagram"] = { x: 0, y: 0 };
    Array.prototype.slice.call(document.querySelectorAll(".value-dependent-input")).forEach(function (element) {
      element.classList.remove("value-dependent-input");
    });
    applyLevelMode(false);
    saveInput();
    calculate();
  }

  function outputNodes(key) {
    return Array.prototype.slice.call(document.querySelectorAll('[data-bdp-output="' + key + '"]'));
  }

  function setOutput(key, value) {
    var nodes = outputNodes(key);
    var changed = state.hasRendered && nodes.some(function (element) {
      return element.textContent !== value;
    });
    nodes.forEach(function (element) {
      element.textContent = value;
    });
    if (!changed) return;
    global.clearTimeout(state.changeTimers[key]);
    nodes.forEach(function (element) { element.classList.add("value-dependent-change"); });
    state.changeTimers[key] = global.setTimeout(function () {
      nodes.forEach(function (element) { element.classList.remove("value-dependent-change"); });
    }, 1200);
  }

  function numberText(value, digits, unit) {
    if (value === null || value === undefined || value === "") return "—";
    var number = Number(value);
    if (!Number.isFinite(number)) return "—";
    return number.toLocaleString("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }) + (unit ? " " + unit : "");
  }

  function clockText(value) {
    var totalSeconds = Math.max(0, Math.round(Number(value) || 0));
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    return String(minutes).padStart(2, "0") + " min " + String(seconds).padStart(2, "0") + " sec";
  }

  function compactNumber(value) {
    return String(Math.round(Number(value) * 10) / 10);
  }

  function levelTurnActive() {
    var control = firstControl("levelTurnEnabled");
    return state.levelMode && Boolean(control && control.checked);
  }

  function setControlDisabled(key, disabled) {
    controls(key).forEach(function (element) { element.disabled = Boolean(disabled); });
  }

  function setControlDerived(key, derived) {
    controls(key).forEach(function (element) {
      element.disabled = Boolean(derived);
      if (derived) {
        element.classList.remove("value-dependent-input");
        element.classList.add("value-result");
      } else {
        element.classList.remove("value-result");
      }
    });
  }

  function syncAutomaticBank(flash) {
    if (!state.bankLinked) return;
    var bankAngle;
    if (levelTurnActive()) {
      var turnG = Number(firstControl("rollInG") && firstControl("rollInG").value);
      if (!(turnG >= 1)) return;
      bankAngle = Math.acos(1 / turnG) * 180 / Math.PI;
    } else {
      var angleOff = Number(firstControl("angleOffDeg") && firstControl("angleOffDeg").value);
      var diveAngle = Number(firstControl("diveAngleDeg") && firstControl("diveAngleDeg").value);
      if (!Number.isFinite(angleOff) || !Number.isFinite(diveAngle)) return;
      bankAngle = angleOff + diveAngle / 2;
    }
    setControls("rollInBankAngleDeg", compactNumber(bankAngle), null, flash);
  }

  function applyLevelMode(flash) {
    var diveAngle = Number(firstControl("diveAngleDeg") && firstControl("diveAngleDeg").value);
    var nextLevelMode = Number.isFinite(diveAngle) && Math.abs(diveAngle) < 0.001;
    var levelTurnControl = firstControl("levelTurnEnabled");
    if (nextLevelMode && !state.levelMode) {
      var currentG = firstControl("rollInG");
      if (currentG && Number.isFinite(Number(currentG.value))) state.nonLevelRollInG = currentG.value;
      if (levelTurnControl && levelTurnControl.checked) setControls("rollInG", "2", null, flash);
    } else if (!nextLevelMode && state.levelMode) {
      setControls("rollInG", state.nonLevelRollInG || DEFAULTS.rollInG, null, flash);
    }
    state.levelMode = nextLevelMode;
    if (nextLevelMode) app.classList.add("level-mode");
    else app.classList.remove("level-mode");
    if (levelTurnControl) levelTurnControl.disabled = !nextLevelMode;
    setControlDisabled("trackingTimeSec", nextLevelMode);
    setControlDisabled("levelMapNm", !nextLevelMode);
    setControlDerived("rollInBankAngleDeg", levelTurnActive());
    if (nextLevelMode) {
      solveModeNode.dataset.mode = "levelMap";
      solveModeNode.textContent = "MAP 기준";
    } else if (solveModeNode.dataset.mode === "levelMap") {
      solveModeNode.dataset.mode = "initialAltitude";
      solveModeNode.textContent = "Initial Altitude 기준";
    }
    syncAutomaticBank(flash);
  }

  function titleFor(view) {
    if (view.profileTitle) return view.profileTitle;
    var angle = Number(view.input && view.input.diveAngleDeg);
    if (!Number.isFinite(angle)) return "—";
    var highDrag = Boolean(view.input && view.input.highDragWeapon);
    var suffix = angle === 0 ? "VLD" : angle > 30 ? "HADB" : angle === 30 ? "DB" : highDrag ? "LAHD" : "LALD";
    return Math.round(angle) + "° " + suffix;
  }

  function setSafetyLabel(label) {
    var value = label || "RNLT Release";
    Array.prototype.slice.call(document.querySelectorAll("[data-safety-release-label]")).forEach(function (element) {
      element.textContent = value + " (ft msl)";
    });
    Array.prototype.slice.call(document.querySelectorAll("[data-safety-release-result-label]")).forEach(function (element) {
      element.textContent = value;
    });
  }

  function renderOutputs(view) {
    var result = view.public || {};
    var local = view.local || {};
    var displacement = result.rollInDisplacement || {};
    var level = Math.abs(Number(view.input && view.input.diveAngleDeg)) < 0.001;
    setOutput("recoveryG", numberText(view.input && view.input.recoveryG, 1, ""));
    setOutput("attackHeadingDeg", numberText(view.input && view.input.attackHeadingDeg, 0, "deg"));
    setOutput("profileTitle", titleFor(view));
    setOutput("effectiveReleaseAltitudeMslFt", numberText(result.effectiveReleaseAltitudeMslFt, 0, "ft msl"));
    setOutput("minAltMslFt", numberText(result.minAltMslFt, 0, "ft msl"));
    setOutput("safetyReleaseMslFt", numberText(result.safetyReleaseMslFt, 0, "ft msl"));
    setOutput("leadAngleDeg", numberText(result.leadAngleDeg, 1, "deg"));
    setOutput("rollInAltitudeLossFt", numberText(result.rollInAltitudeLossFt, 0, "ft"));
    setOutput("resolvedInitialAltitudeMslFt", numberText(result.resolvedInitialAltitudeMslFt, 0, "ft msl"));
    setOutput("resolvedInitialSpeedKcas", numberText(result.resolvedInitialSpeedKcas, 1, "kcas"));
    setOutput("trackPointAltitudeMslFt", numberText(result.trackPointAltitudeMslFt, 0, "ft msl"));
    setOutput("rollInRangeNm", numberText(result.rollInRangeNm, 1, "nm"));
    setOutput("rollInSlantNm", numberText(local.rollInSlantNm, 1, "nm"));
    setOutput("baseDistanceNm", numberText(result.rollInLateralSeparationNm, 1, "nm"));
    setOutput("rollInLongitudinalDistanceNm", numberText(displacement.forwardNm, 1, "nm"));
    setOutput("rollInLateralDistanceNm", numberText(Math.abs(displacement.turnSideNm), 1, "nm"));
    setOutput("groundRangeNm", numberText(result.groundRangeNm, 1, "nm"));
    setOutput("downRangeTravelNm", numberText(result.downRangeTravelNm, 3, "nm"));
    setOutput("bombRangeNm", numberText(result.bombRangeNm, 3, "nm"));
    setOutput("trackingTimeSec", level ? clockText(result.trackingTimeSec) : numberText(result.trackingTimeSec, 0, "sec"));
    setOutput("levelTrackingTime", clockText(result.trackingTimeSec));
    setOutput("bombTofSec", numberText(result.bombTofSec, 0, "sec"));
    setOutput("rollInRadiusTime", numberText(result.rollInRadiusNm, 3, "nm") + " / " + numberText(result.rollInTimeSec, 0, "sec"));
    setOutput("rollInGroundArcNm", numberText(result.rollInGroundArcNm, 3, "nm"));
    setOutput("rollInDisplacement", numberText(result.rollInDisplacement && result.rollInDisplacement.forwardNm, 3, "") + " / " + numberText(result.rollInDisplacement && result.rollInDisplacement.turnSideNm, 3, "nm"));
    setOutput("rollInLateralSeparationNm", numberText(result.rollInLateralSeparationNm, 3, "nm"));
    setOutput("minAltResultMslFt", numberText(result.minAltMslFt, 0, "ft msl"));
    setOutput("safetyReleaseResultMslFt", numberText(result.safetyReleaseMslFt, 0, "ft msl"));
    setOutput("rollInStartAltitudeMslFt", numberText(result.resolvedInitialAltitudeMslFt, 0, "ft msl"));
    setOutput("aimOffPointRangeNm", numberText(local.aimOffPointRangeNm, 3, "nm"));
    setOutput("aimOffAngleDeg", numberText(local.aimOffAngleDeg, 1, "deg"));
    setOutput("aimOffDistanceNm", numberText(local.aimOffDistanceNm, 3, "nm"));
    setOutput("rollInRangeProfileFitNm", numberText(local.rollInRangeProfileFitNm, 3, "nm"));
    setOutput("bdpModel", view.model ? view.model.id + " / " + view.model.version : "—");
    setOutput("ballisticModel", view.diagnostics ? view.diagnostics.ballisticModelId + " / " + view.diagnostics.ballisticModelVersion : "—");
    setSafetyLabel(view.safety && view.safety.releaseLabel);
    state.hasRendered = true;
  }

  function syncSolvedInputs(view) {
    var result = view.public || {};
    var mode = solveModeNode.dataset.mode || "initialAltitude";
    if (Math.abs(Number(view.input && view.input.diveAngleDeg)) < 0.001) {
      var levelTrackingTime = Number(result.trackingTimeSec);
      if (Number.isFinite(levelTrackingTime)) {
        setControls("trackingTimeSec", Math.round(levelTrackingTime), null, state.hasRendered);
      }
      return;
    }
    if (mode === "trackingTime") {
      var initialAltitude = Number(result.resolvedInitialAltitudeMslFt);
      if (Number.isFinite(initialAltitude)) {
        setControls("rollInStartAltitudeMslFt", Math.round(initialAltitude), null, state.hasRendered);
      }
      return;
    }
    var trackingTime = Number(result.trackingTimeSec);
    if (Number.isFinite(trackingTime)) {
      setControls("trackingTimeSec", Math.round(trackingTime), null, state.hasRendered);
    }
  }

  function normalizeView(raw, input) {
    var view = state.provider && typeof state.provider.toViewModel === "function"
      ? state.provider.toViewModel(raw, input)
      : raw;
    if (!view || typeof view !== "object") throw new Error("Provider returned no view model");
    view.input = Object.assign({}, input, view.input || {});
    view.public = Object.assign({
      releaseSpeedKcas: input.releaseSpeedKcas
    }, view.public || {});
    view.local = Object.assign({}, view.local || {});
    view.safety = Object.assign({ releaseLabel: "NLT Release" }, view.safety || {});
    return view;
  }

  function setProviderStatus(kind, label) {
    if (!providerStatus) return;
    providerStatus.classList.remove("connected", "error");
    if (kind) providerStatus.classList.add(kind);
    providerStatus.textContent = label;
  }

  function clearOutputs() {
    state.hasRendered = false;
    Array.prototype.slice.call(document.querySelectorAll("[data-bdp-output]")).forEach(function (element) {
      element.textContent = "—";
    });
  }

  function applyZoom(targetId) {
    var svg = document.getElementById(targetId);
    var toolbar = document.querySelector('[data-zoom-target="' + targetId + '"]');
    if (!svg || !toolbar) return;
    var base = (svg.dataset.baseViewBox || svg.getAttribute("viewBox") || "0 0 900 620").split(/\s+/).map(Number);
    if (base.length !== 4 || base.some(function (value) { return !Number.isFinite(value); })) return;
    var zoom = Math.max(0.5, Math.min(2, state.zoom[targetId] || 1));
    state.zoom[targetId] = zoom;
    var width = base[2] / zoom;
    var height = base[3] / zoom;
    var pan = state.pan[targetId] || { x: 0, y: 0 };
    var maxPanX = Math.max(0, (base[2] - width) / 2);
    var maxPanY = Math.max(0, (base[3] - height) / 2);
    if (zoom <= 1) {
      pan.x = 0;
      pan.y = 0;
    }
    pan.x = Math.max(-maxPanX, Math.min(maxPanX, Number(pan.x) || 0));
    pan.y = Math.max(-maxPanY, Math.min(maxPanY, Number(pan.y) || 0));
    state.pan[targetId] = pan;
    var x = base[0] + (base[2] - width) / 2 + pan.x;
    var y = base[1] + (base[3] - height) / 2 + pan.y;
    svg.setAttribute("viewBox", [x, y, width, height].join(" "));
    if (zoom > 1) svg.classList.add("plot-pan-enabled");
    else {
      svg.classList.remove("plot-pan-enabled");
      svg.classList.remove("plot-panning");
    }
    var valueButton = toolbar.querySelector('[data-zoom="reset"]');
    var outButton = toolbar.querySelector('[data-zoom="out"]');
    var inButton = toolbar.querySelector('[data-zoom="in"]');
    if (valueButton) valueButton.textContent = Math.round(zoom * 100) + "%";
    if (outButton) outButton.disabled = zoom <= 0.5;
    if (inButton) inButton.disabled = zoom >= 2;
  }

  function applyAllZoom() {
    applyZoom("z-diagram");
    applyZoom("profile-diagram");
    applyZoom("top-diagram");
  }

  function bindPlotPan(targetId) {
    var svg = document.getElementById(targetId);
    if (!svg || svg.__bdpPlotPanBound) return;
    svg.__bdpPlotPanBound = true;
    var active = null;

    svg.addEventListener("pointerdown", function (event) {
      if ((state.zoom[targetId] || 1) <= 1) return;
      if (event.button !== undefined && event.button !== 0) return;
      var eventTarget = event.target;
      if (eventTarget && typeof eventTarget.closest === "function" && eventTarget.closest(".movable-label")) return;
      var viewport = (svg.getAttribute("viewBox") || "").split(/\s+/).map(Number);
      var bounds = typeof svg.getBoundingClientRect === "function"
        ? svg.getBoundingClientRect()
        : { width: viewport[2], height: viewport[3] };
      if (viewport.length !== 4 || !bounds.width || !bounds.height) return;
      var pan = state.pan[targetId] || { x: 0, y: 0 };
      active = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        panX: pan.x,
        panY: pan.y,
        unitsPerPixelX: viewport[2] / bounds.width,
        unitsPerPixelY: viewport[3] / bounds.height
      };
      if (event.preventDefault) event.preventDefault();
      svg.classList.add("plot-panning");
      if (typeof svg.setPointerCapture === "function") {
        try { svg.setPointerCapture(event.pointerId); } catch (error) { /* pointer stream may already be ending */ }
      }
    });

    svg.addEventListener("pointermove", function (event) {
      if (!active || event.pointerId !== active.pointerId) return;
      if (event.preventDefault) event.preventDefault();
      state.pan[targetId] = {
        x: active.panX - (event.clientX - active.clientX) * active.unitsPerPixelX,
        y: active.panY - (event.clientY - active.clientY) * active.unitsPerPixelY
      };
      applyZoom(targetId);
    });

    function finish(event) {
      if (!active || event.pointerId !== active.pointerId) return;
      active = null;
      svg.classList.remove("plot-panning");
      if (typeof svg.releasePointerCapture === "function") {
        try { svg.releasePointerCapture(event.pointerId); } catch (error) { /* capture may already be released */ }
      }
    }

    svg.addEventListener("pointerup", finish);
    svg.addEventListener("pointercancel", finish);
  }

  function applyFontScale(targetId) {
    var svg = document.getElementById(targetId);
    var toolbar = document.querySelector('[data-font-target="' + targetId + '"]');
    if (!svg || !toolbar) return;
    var scale = Math.max(0.5, Math.min(2, state.fontScale[targetId] || 1));
    state.fontScale[targetId] = scale;
    if (typeof svg.querySelectorAll === "function") {
      Array.prototype.slice.call(svg.querySelectorAll("text")).forEach(function (element) {
        var baseSize = Number(element.dataset && element.dataset.baseFontSize);
        if (!Number.isFinite(baseSize)) {
          baseSize = Number(element.getAttribute("font-size"));
          if (!Number.isFinite(baseSize)) baseSize = 14;
          if (element.dataset) element.dataset.baseFontSize = String(baseSize);
        }
        element.setAttribute("font-size", (baseSize * FONT_BASE_MULTIPLIER * scale).toFixed(2));
      });
    }
    var valueButton = toolbar.querySelector('[data-font-scale="reset"]');
    var outButton = toolbar.querySelector('[data-font-scale="out"]');
    var inButton = toolbar.querySelector('[data-font-scale="in"]');
    if (valueButton) valueButton.textContent = Math.round(scale * 100) + "%";
    if (outButton) outButton.disabled = scale <= 0.5;
    if (inButton) inButton.disabled = scale >= 2;
  }

  function applyAllFontScale() {
    applyFontScale("z-diagram");
    applyFontScale("profile-diagram");
    applyFontScale("top-diagram");
  }

  function applyResultFontScale(targetId) {
    var target = document.getElementById(targetId);
    var toolbar = document.querySelector('[data-result-font-target="' + targetId + '"]');
    if (!target || !toolbar) return;
    var scale = Math.max(0.5, Math.min(2, state.resultFontScale[targetId] || 1));
    state.resultFontScale[targetId] = scale;
    target.style.fontSize = (13 * scale).toFixed(2) + "px";
    var valueButton = toolbar.querySelector('[data-result-font-scale="reset"]');
    var outButton = toolbar.querySelector('[data-result-font-scale="out"]');
    var inButton = toolbar.querySelector('[data-result-font-scale="in"]');
    if (valueButton) valueButton.textContent = Math.round(scale * 100) + "%";
    if (outButton) outButton.disabled = scale <= 0.5;
    if (inButton) inButton.disabled = scale >= 2;
  }

  function applyAllResultFontScale() {
    applyResultFontScale("result-summary");
  }

  function renderView(view) {
    state.lastView = view;
    syncSolvedInputs(view);
    renderOutputs(view);
    var availability = global.BDPGraphRenderers.renderAll({
      z: document.getElementById("z-diagram"),
      profile: document.getElementById("profile-diagram"),
      top: document.getElementById("top-diagram")
    }, view);
    var zExport = document.querySelector('[data-export-svg="z-diagram"]');
    if (zExport) zExport.disabled = !availability.zAvailable;
    applyAllZoom();
    applyAllFontScale();
    applyAllResultFontScale();
  }

  function resetPlot(targetId) {
    if (!state.lastView) return;
    var svg = document.getElementById(targetId);
    if (!svg) return;
    state.fontScale[targetId] = DEFAULT_FONT_SCALE[targetId] || 1;
    state.zoom[targetId] = 1;
    state.pan[targetId] = { x: 0, y: 0 };
    if (targetId === "z-diagram") {
      var zAvailable = global.BDPGraphRenderers.renderZ(svg, state.lastView);
      var zExport = document.querySelector('[data-export-svg="z-diagram"]');
      if (zExport) zExport.disabled = !zAvailable;
    }
    if (targetId === "profile-diagram") global.BDPGraphRenderers.renderProfile(svg, state.lastView);
    if (targetId === "top-diagram") global.BDPGraphRenderers.renderTop(svg, state.lastView);
    applyZoom(targetId);
    applyFontScale(targetId);
  }

  async function calculate() {
    if (!state.provider) {
      setProviderStatus("error", "Provider 미연결");
      return;
    }
    var requestId = ++state.requestId;
    var input = collectInput();
    app.setAttribute("aria-busy", "true");
    if (calculateButton) calculateButton.disabled = true;
    setProviderStatus("", "Calculating…");
    try {
      var raw = await state.provider.calculate(input);
      if (requestId !== state.requestId) return;
      var view = normalizeView(raw, input);
      renderView(view);
      setProviderStatus("connected", state.provider.label || state.provider.id || "Provider connected");
    } catch (error) {
      if (requestId !== state.requestId) return;
      clearOutputs();
      setProviderStatus("error", error && error.message ? error.message : String(error));
      if (providerError) providerError.textContent = error && error.message ? error.message : String(error);
    } finally {
      if (requestId === state.requestId) {
        app.removeAttribute("aria-busy");
        if (calculateButton) calculateButton.disabled = false;
      }
    }
  }

  function connectProvider(provider) {
    if (!provider || typeof provider.calculate !== "function") {
      throw new TypeError("BDP provider must expose calculate(input)");
    }
    state.provider = provider;
    setProviderStatus("connected", provider.label || provider.id || "Provider connected");
    calculate();
  }

  function savePng(svg, filename) {
    if (!global.BDPCommonDiagram || typeof global.BDPCommonDiagram.saveSvgAsPng !== "function") {
      throw new Error("Common SVG PNG exporter is not connected");
    }
    global.BDPCommonDiagram.saveSvgAsPng(svg, filename, { background: "#fff" }).catch(function (error) {
      setProviderStatus("error", error && error.message ? error.message : String(error));
    });
  }

  if (advancedToggle) advancedToggle.addEventListener("click", function () {
    var active = document.body.classList.toggle("show-advanced");
    advancedToggle.classList.toggle("active", active);
    advancedToggle.setAttribute("aria-pressed", String(active));
    advancedToggle.textContent = "Advanced: " + (active ? "On" : "Off");
  });

  if (defaultButton) defaultButton.addEventListener("click", resetInput);
  if (calculateButton) calculateButton.addEventListener("click", calculate);

  app.addEventListener("keydown", function (event) {
    if (!event || event.key !== "Enter") return;
    var key = event.target && event.target.getAttribute("data-bdp-input");
    if (!key) return;
    confirmDependentInput(key);
    global.clearTimeout(app.__bdpInputTimer);
    saveInput();
    calculate();
  });

  app.addEventListener("input", function (event) {
    var key = event.target && event.target.getAttribute("data-bdp-input");
    if (!key) return;
    if (key === "angleOffDeg") {
      setControls(key, event.target.value, event.target, true);
      state.bankLinked = true;
      syncAutomaticBank(true);
    }
    if (key === "diveAngleDeg") {
      state.bankLinked = true;
      applyLevelMode(true);
    }
    if (key === "rollInBankAngleDeg") state.bankLinked = false;
    if (key === "rollInG") {
      if (levelTurnActive()) {
        state.bankLinked = true;
        syncAutomaticBank(true);
      } else if (!state.levelMode) {
        state.nonLevelRollInG = event.target.value;
      }
    }
    if (key === "rollInStartAltitudeMslFt") {
      solveModeNode.dataset.mode = "initialAltitude";
      solveModeNode.textContent = "Initial Altitude 기준";
    }
    if (key === "trackingTimeSec") {
      solveModeNode.dataset.mode = "trackingTime";
      solveModeNode.textContent = "Tracking Time 기준";
    }
    if (key === "levelMapNm") {
      solveModeNode.dataset.mode = "levelMap";
      solveModeNode.textContent = "MAP 기준";
    }
    saveInput();
    global.clearTimeout(app.__bdpInputTimer);
    app.__bdpInputTimer = global.setTimeout(calculate, 120);
  });

  app.addEventListener("change", function (event) {
    var key = event.target && event.target.getAttribute("data-bdp-input");
    if (key === "levelTurnEnabled") {
      state.bankLinked = true;
      applyLevelMode(true);
    }
    if (event.target && event.target.hasAttribute("data-bdp-input")) {
      saveInput();
      calculate();
    }
  });

  Array.prototype.slice.call(document.querySelectorAll("[data-zoom-target]")).forEach(function (toolbar) {
    toolbar.addEventListener("click", function (event) {
      var action = event.target && event.target.getAttribute("data-zoom");
      if (!action) return;
      var targetId = toolbar.getAttribute("data-zoom-target");
      if (action === "out") state.zoom[targetId] -= 0.25;
      if (action === "in") state.zoom[targetId] += 0.25;
      if (action === "reset") {
        state.zoom[targetId] = 1;
        state.pan[targetId] = { x: 0, y: 0 };
      }
      applyZoom(targetId);
    });
  });

  Array.prototype.slice.call(document.querySelectorAll("[data-font-target]")).forEach(function (toolbar) {
    toolbar.addEventListener("click", function (event) {
      var action = event.target && event.target.getAttribute("data-font-scale");
      if (!action) return;
      var targetId = toolbar.getAttribute("data-font-target");
      if (action === "out") state.fontScale[targetId] -= 0.1;
      if (action === "in") state.fontScale[targetId] += 0.1;
      if (action === "reset") state.fontScale[targetId] = 1;
      applyFontScale(targetId);
    });
  });

  Array.prototype.slice.call(document.querySelectorAll("[data-result-font-target]")).forEach(function (toolbar) {
    toolbar.addEventListener("click", function (event) {
      var action = event.target && event.target.getAttribute("data-result-font-scale");
      if (!action) return;
      var targetId = toolbar.getAttribute("data-result-font-target");
      if (action === "out") state.resultFontScale[targetId] -= 0.1;
      if (action === "in") state.resultFontScale[targetId] += 0.1;
      if (action === "reset") state.resultFontScale[targetId] = 1;
      applyResultFontScale(targetId);
    });
  });

  Array.prototype.slice.call(document.querySelectorAll("[data-export-svg]")).forEach(function (button) {
    button.addEventListener("click", function () {
      var svg = document.getElementById(button.getAttribute("data-export-svg"));
      savePng(svg, button.getAttribute("data-export-name") || "BDP_Diagram.png");
    });
  });

  Array.prototype.slice.call(document.querySelectorAll("[data-reset-plot]")).forEach(function (button) {
    button.addEventListener("click", function () {
      resetPlot(button.getAttribute("data-reset-plot"));
    });
  });

  ["z-diagram", "profile-diagram", "top-diagram"].forEach(bindPlotPan);

  var levelTurnControl = firstControl("levelTurnEnabled");
  var levelTurnOption = document.getElementById("level-turn-option");
  if (levelTurnOption) levelTurnOption.addEventListener("click", function (event) {
    if (event && typeof event.stopPropagation === "function") event.stopPropagation();
  });

  loadInput();
  var loadedRollInG = firstControl("rollInG");
  var loadedDiveAngle = Number(firstControl("diveAngleDeg") && firstControl("diveAngleDeg").value);
  if (loadedRollInG && Math.abs(loadedDiveAngle) >= 0.001) {
    state.nonLevelRollInG = loadedRollInG.value || DEFAULTS.rollInG;
  }
  solveModeNode.dataset.mode = "initialAltitude";
  solveModeNode.textContent = "Initial Altitude 기준";
  applyLevelMode(false);

  global.BDPUI = Object.freeze({
    connectProvider: connectProvider,
    calculate: calculate,
    getInput: collectInput,
    defaults: DEFAULTS
  });
})(window);
