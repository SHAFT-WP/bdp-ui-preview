(function (global) {
  "use strict";

  var original = global.BDPGraphRenderers;
  if (!original || typeof original.renderTop !== "function") {
    throw new Error("BDP graph renderers must load before Top View visibility rules");
  }

  var ZERO_EPSILON = 1e-9;

  function isZeroResult(value) {
    var number = Number(value);
    return Number.isFinite(number) && Math.abs(number) <= ZERO_EPSILON;
  }

  function removeNodes(svg, selector, predicate) {
    if (!svg || typeof svg.querySelectorAll !== "function") return;
    Array.prototype.slice.call(svg.querySelectorAll(selector)).forEach(function (element) {
      if (!predicate || predicate(element)) element.remove();
    });
  }

  function removeDimension(svg, role, group) {
    removeNodes(svg, '[data-drag-group="' + group + '"]');
    removeNodes(svg, '[data-top-dimension="' + role + '"]');
    removeNodes(svg, '[data-top-guide="' + role + '"]');
  }

  function applyZeroResultVisibility(svg, view) {
    var result = view && view.public;
    if (!svg || !result) return;

    if (isZeroResult(result.leadAngleDeg)) {
      var terms = original.terminology && original.terminology.USAF;
      var leadPrefix = ((terms && terms.leadAngle) || "Roll-in Lead") + ":";
      removeNodes(svg, '[data-drag-group="top-base-condition"]', function (element) {
        return String(element.textContent || "").indexOf(leadPrefix) === 0;
      });
    }

    if (isZeroResult(result.groundRangeNm)) {
      removeNodes(svg, '[data-drag-group="top-map"]');
    }

    if (isZeroResult(result.rollInLateralSeparationNm)) {
      removeDimension(svg, "base-distance", "top-base-distance");
    }

    var displacement = result.rollInDisplacement || {};
    if (isZeroResult(displacement.turnSideNm)) {
      removeDimension(svg, "roll-in-lateral-distance", "top-roll-in-lateral");
    }
    if (isZeroResult(displacement.forwardNm)) {
      removeDimension(svg, "roll-in-longitudinal-distance", "top-roll-in-longitudinal");
    }
  }

  function renderTop(svg, view) {
    var available = original.renderTop(svg, view);
    if (available !== false) applyZeroResultVisibility(svg, view);
    return available;
  }

  function renderAll(elements, view) {
    var availability = original.renderAll(elements, view);
    if (!availability || availability.topAvailable !== false) {
      applyZeroResultVisibility(elements && elements.top, view);
    }
    return availability;
  }

  global.BDPTopViewVisibility = Object.freeze({
    zeroEpsilon: ZERO_EPSILON,
    isZeroResult: isZeroResult,
    apply: applyZeroResultVisibility
  });

  global.BDPGraphRenderers = Object.freeze({
    terminology: original.terminology,
    renderAll: renderAll,
    renderError: original.renderError,
    renderErrors: original.renderErrors,
    renderZ: original.renderZ,
    renderProfile: original.renderProfile,
    renderTop: renderTop
  });
})(window);
