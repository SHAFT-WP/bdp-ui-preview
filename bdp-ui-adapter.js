(function (global) {
  "use strict";

  var STORAGE_KEY = "bdp-common-ui-preview-v2-provider-v1";
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
    releaseAltitudeMslFt: "6800",
    releaseSpeedKcas: "450",
    rollInBankAngleDeg: "113",
    rollInG: "4"
  });

  var STRING_KEYS = Object.freeze({
    weaponId: true,
    initialSpeedMode: true
  });

  var state = {
    provider: null,
    lastView: null,
    requestId: 0,
    hasRendered: false,
    changeTimers: {},
    bankLinked: true,
    fontScale: {
      "z-diagram": 1,
      "profile-diagram": 1,
      "top-diagram": 1
    },
    zoom: {
      "profile-diagram": 1,
      "top-diagram": 1
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
    void element.offsetWidth;
    element.classList.add("value-dependent-change");
    element.__bdpDependentTimer = global.setTimeout(function () {
      element.classList.remove("value-dependent-change");
    }, 1250);
  }

  function setControls(key, value, except, flash) {
    controls(key).forEach(function (element) {
      if (element !== except && element.value !== String(value)) {
        element.value = String(value);
        if (flash) dependentFlash(element);
      }
    });
  }

  function collectInput() {
    var input = {};
    Object.keys(DEFAULTS).forEach(function (key) {
      var element = firstControl(key);
      if (!element) return;
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
      if (element) saved[key] = element.value;
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
    state.fontScale["z-diagram"] = 1;
    state.fontScale["profile-diagram"] = 1;
    state.fontScale["top-diagram"] = 1;
    state.zoom["profile-diagram"] = 1;
    state.zoom["top-diagram"] = 1;
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
    var number = Number(value);
    if (!Number.isFinite(number)) return "—";
    return number.toLocaleString("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }) + (unit ? " " + unit : "");
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
    setOutput("trackingTimeSec", numberText(result.trackingTimeSec, 2, "sec"));
    setOutput("bombTofSec", numberText(result.bombTofSec, 2, "sec"));
    setOutput("rollInRadiusTime", numberText(result.rollInRadiusNm, 3, "nm") + " / " + numberText(result.rollInTimeSec, 2, "sec"));
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
    if (mode === "trackingTime") {
      var initialAltitude = Number(result.resolvedInitialAltitudeMslFt);
      if (Number.isFinite(initialAltitude)) {
        setControls("rollInStartAltitudeMslFt", Math.round(initialAltitude), null, state.hasRendered);
      }
      return;
    }
    var trackingTime = Number(result.trackingTimeSec);
    if (Number.isFinite(trackingTime)) {
      setControls("trackingTimeSec", trackingTime.toFixed(2), null, state.hasRendered);
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
    var x = base[0] + (base[2] - width) / 2;
    var y = base[1] + (base[3] - height) / 2;
    svg.setAttribute("viewBox", [x, y, width, height].join(" "));
    var valueButton = toolbar.querySelector('[data-zoom="reset"]');
    var outButton = toolbar.querySelector('[data-zoom="out"]');
    var inButton = toolbar.querySelector('[data-zoom="in"]');
    if (valueButton) valueButton.textContent = Math.round(zoom * 100) + "%";
    if (outButton) outButton.disabled = zoom <= 0.5;
    if (inButton) inButton.disabled = zoom >= 2;
  }

  function applyAllZoom() {
    applyZoom("profile-diagram");
    applyZoom("top-diagram");
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
        element.setAttribute("font-size", (baseSize * scale).toFixed(2));
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

  app.addEventListener("input", function (event) {
    var key = event.target && event.target.getAttribute("data-bdp-input");
    if (!key) return;
    if (key === "angleOffDeg") setControls(key, event.target.value, event.target, true);
    if (key === "diveAngleDeg") {
      state.bankLinked = true;
      var diveAngle = Number(event.target.value);
      if (Number.isFinite(diveAngle)) setControls("rollInBankAngleDeg", Math.round(90 + diveAngle / 2), null, true);
    }
    if (key === "rollInBankAngleDeg") state.bankLinked = false;
    if (key === "rollInStartAltitudeMslFt") {
      solveModeNode.dataset.mode = "initialAltitude";
      solveModeNode.textContent = "Initial Altitude 기준";
    }
    if (key === "trackingTimeSec") {
      solveModeNode.dataset.mode = "trackingTime";
      solveModeNode.textContent = "Tracking Time 기준";
    }
    saveInput();
    global.clearTimeout(app.__bdpInputTimer);
    app.__bdpInputTimer = global.setTimeout(calculate, 120);
  });

  app.addEventListener("change", function (event) {
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
      if (action === "reset") state.zoom[targetId] = 1;
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

  Array.prototype.slice.call(document.querySelectorAll("[data-export-svg]")).forEach(function (button) {
    button.addEventListener("click", function () {
      var svg = document.getElementById(button.getAttribute("data-export-svg"));
      savePng(svg, button.getAttribute("data-export-name") || "BDP_Diagram.png");
    });
  });

  Array.prototype.slice.call(document.querySelectorAll("[data-reset-labels]")).forEach(function (button) {
    button.addEventListener("click", function () {
      if (state.lastView) renderView(state.lastView);
    });
  });

  loadInput();
  solveModeNode.dataset.mode = "initialAltitude";

  global.BDPUI = Object.freeze({
    connectProvider: connectProvider,
    calculate: calculate,
    getInput: collectInput,
    defaults: DEFAULTS
  });
})(window);
