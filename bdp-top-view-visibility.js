(function (global) {
  "use strict";

  var original = global.BDPGraphRenderers;
  if (!original || typeof original.renderTop !== "function") {
    throw new Error("BDP graph renderers must load before Top View visibility rules");
  }

  var ZERO_EPSILON = 1e-9;
  var STATION_EPSILON = 1e-6;

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

  function sameCoordinate(value, expected) {
    var number = Number(value);
    var target = Number(expected);
    return Number.isFinite(number) && Number.isFinite(target) && Math.abs(number - target) <= STATION_EPSILON;
  }

  function removeRollInPoint(svg, view) {
    var terms = original.terminology && original.terminology.USAF;
    var label = (terms && terms.rollInStart) || "Roll-in Point";
    removeNodes(svg, "text", function (element) {
      return String(element.textContent || "") === label;
    });

    var point = view && view.visualization && view.visualization.top && view.visualization.top.points
      ? view.visualization.top.points.rollInStart
      : null;
    if (!point) return;
    removeNodes(svg, "circle", function (element) {
      return sameCoordinate(element.getAttribute("cx"), point.x) &&
        sameCoordinate(element.getAttribute("cy"), point.y) &&
        Number(element.getAttribute("r")) === 7;
    });
  }

  function formatNm(value) {
    var number = Number(value);
    if (!Number.isFinite(number)) return null;
    return number.toLocaleString("en-US", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    });
  }

  function appendLevelBombRange(svg, view) {
    var input = view && view.input;
    var result = view && view.public;
    var points = view && view.visualization && view.visualization.top && view.visualization.top.points;
    if (!svg || !input || !result || !points || !isZeroResult(input.diveAngleDeg)) return;
    if (isZeroResult(result.bombRangeNm)) return;

    var bombRangeText = formatNm(result.bombRangeNm);
    if (bombRangeText === null || !points.trackPoint || !points.target) return;

    var track = points.trackPoint;
    var target = points.target;
    var groundRangeNm = Number(result.groundRangeNm);
    var bombRangeNm = Number(result.bombRangeNm);
    var releaseFraction = 0.5;
    if (Number.isFinite(groundRangeNm) && Math.abs(groundRangeNm) > ZERO_EPSILON && Number.isFinite(bombRangeNm)) {
      releaseFraction = Math.max(0, Math.min(1, (groundRangeNm - bombRangeNm) / groundRangeNm));
    }
    var release = {
      x: Number(track.x) + (Number(target.x) - Number(track.x)) * releaseFraction,
      y: Number(track.y) + (Number(target.y) - Number(track.y)) * releaseFraction
    };
    var labelPoint = {
      x: (release.x + Number(target.x)) / 2,
      y: (release.y + Number(target.y)) / 2 + 34
    };

    var commonDiagram = global.BDPCommonDiagram;
    if (!commonDiagram || typeof commonDiagram.svgNode !== "function") return;
    svg.appendChild(commonDiagram.svgNode("text", {
      x: labelPoint.x,
      y: labelPoint.y,
      fill: "#087b4c",
      "font-size": 13,
      "font-weight": 820,
      "text-anchor": "middle",
      class: "movable-label label-halo",
      "data-drag-group": "top-bomb-range",
      "data-top-result": "bomb-range"
    }, "Bomb Range: " + bombRangeText + " nm"));
  }

  function applyTopViewRules(svg, view) {
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

    if (view.input && isZeroResult(view.input.angleOffDeg)) {
      removeRollInPoint(svg, view);
    }

    appendLevelBombRange(svg, view);
  }

  function renderTop(svg, view) {
    var available = original.renderTop(svg, view);
    if (available !== false) applyTopViewRules(svg, view);
    return available;
  }

  function renderAll(elements, view) {
    var availability = original.renderAll(elements, view);
    if (!availability || availability.topAvailable !== false) {
      applyTopViewRules(elements && elements.top, view);
    }
    return availability;
  }

  global.BDPTopViewVisibility = Object.freeze({
    zeroEpsilon: ZERO_EPSILON,
    isZeroResult: isZeroResult,
    apply: applyTopViewRules
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
