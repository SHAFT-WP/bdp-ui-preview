(function (global) {
  "use strict";

  var commonDiagram = global.BDPCommonDiagram;
  if (!commonDiagram || typeof commonDiagram.svgNode !== "function") {
    throw new Error("Common SVG primitives must load before BDP graph renderers");
  }
  var TERMINOLOGY = Object.freeze({
    USAF: Object.freeze({
      rollInRange: "Base Distance",
      rollInSlant: "Base Distance(S)",
      groundRange: "MAP",
      aimOffAngle: "IAA"
    }),
    Shaft: Object.freeze({
      rollInRange: "Roll-in Range",
      rollInSlant: "Roll-in Slant",
      groundRange: "Ground Range",
      aimOffAngle: "Aim-off Angle"
    })
  });

  function node(name, attrs, content) {
    return commonDiagram.svgNode(name, attrs || {}, content === null ? undefined : content);
  }

  function append(parent, name, attrs, content) {
    var element = node(name, attrs, content);
    parent.appendChild(element);
    return element;
  }

  function finite(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function format(value, digits) {
    var number = Number(value);
    if (!Number.isFinite(number)) return "—";
    return number.toLocaleString("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  function line(parent, x1, y1, x2, y2, attrs) {
    return append(parent, "line", Object.assign({
      x1: x1,
      y1: y1,
      x2: x2,
      y2: y2,
      stroke: "#111",
      "stroke-width": 3,
      "stroke-linecap": "round"
    }, attrs || {}));
  }

  function text(parent, x, y, value, attrs) {
    return append(parent, "text", Object.assign({
      x: x,
      y: y,
      fill: "#111",
      "font-size": 14,
      "font-weight": 820
    }, attrs || {}), value);
  }

  function pathFromPoints(points) {
    if (!Array.isArray(points) || points.length === 0) return "";
    return points.map(function (point, index) {
      return (index ? "L" : "M") + finite(point.x, 0).toFixed(1) + "," + finite(point.y, 0).toFixed(1);
    }).join(" ");
  }

  function profileTitle(view) {
    if (view.profileTitle) return view.profileTitle;
    var angle = finite(view.input && view.input.diveAngleDeg, 0);
    var highDrag = Boolean(view.input && view.input.highDragWeapon);
    var suffix = angle === 0 ? "VLD" : angle > 30 ? "HADB" : angle === 30 ? "DB" : highDrag ? "LAHD" : "LALD";
    return Math.round(angle) + "° " + suffix;
  }

  function safetyLabel(view) {
    return view.safety && view.safety.releaseLabel ? view.safety.releaseLabel : "RNLT Release";
  }

  function renderUnavailable(svg, titleValue, detail) {
    svg.setAttribute("viewBox", "0 0 650 220");
    svg.dataset.baseViewBox = "0 0 650 220";
    append(svg, "rect", { width: 650, height: 220, fill: "#fff" });
    text(svg, 325, 88, titleValue, {
      "text-anchor": "middle",
      "font-size": 24,
      "font-weight": 900
    });
    text(svg, 325, 136, detail, {
      "text-anchor": "middle",
      "font-size": 16,
      "font-weight": 750,
      fill: "#687787"
    });
  }

  function movableText(parent, x, y, value, group, attrs) {
    return text(parent, x, y, value, Object.assign({
      class: "movable-label",
      "data-drag-group": group || ""
    }, attrs || {}));
  }

  function renderZ(svg, view) {
    svg.replaceChildren();
    var input = view.input || {};
    var result = view.public || {};
    var local = view.local || {};
    var angle = finite(input.diveAngleDeg, 0);

    if (angle < 10) {
      renderUnavailable(
        svg,
        profileTitle(view),
        angle === 0 ? "LEVEL profile · Z-Diagram not applicable" : "Dive angle below 10° · MINALT concept only"
      );
      return false;
    }

    svg.setAttribute("viewBox", "0 0 650 620");
    svg.dataset.baseViewBox = "0 0 650 620";
    append(svg, "rect", { width: 650, height: 620, fill: "#fff" });

    var left = 50;
    var topX = 478;
    var topY = 98;
    var baseY = 442;
    var plannedY = 224;
    var safetyY = 332;
    var diagX = function (y) {
      return left + ((baseY - y) / (baseY - topY)) * (topX - left);
    };
    var plannedX = diagX(plannedY);
    var safetyX = diagX(safetyY);
    var terms = TERMINOLOGY.USAF;
    var one = function (label, value) { return label + ": " + value; };

    movableText(svg, 325, 30, profileTitle(view), "z-title", {
      "text-anchor": "middle",
      "font-size": 27,
      "font-weight": 900
    });
    movableText(svg, 58, 82, format(result.resolvedInitialAltitudeMslFt, 0) + "ft MSL", "z-initial", {
      "font-size": 15,
      "font-weight": 900
    });
    movableText(svg, 270, 82, format(result.resolvedInitialSpeedKcas, 0) + " KCAS", "z-initial", {
      "font-size": 15,
      "font-weight": 900
    });

    line(svg, left, topY, topX, topY, { "stroke-width": 3.5, "stroke-linecap": "square" });
    line(svg, left, baseY, topX, topY, { "stroke-width": 3.5, "stroke-linecap": "square" });
    line(svg, left, baseY, topX, baseY, { "stroke-width": 3.5, "stroke-linecap": "square" });

    movableText(svg, 638, 82, one("Angle-off", format(input.angleOffDeg, 0) + "°"), "z-right", {
      "text-anchor": "end",
      "font-size": 13,
      "font-weight": 900
    });
    movableText(svg, 638, 110, one(terms.rollInRange, format(result.rollInRangeNm, 1) + "nm"), "z-right", {
      "text-anchor": "end",
      "font-size": 13,
      "font-weight": 900
    });
    movableText(svg, 638, 138, one(terms.rollInSlant, format(local.rollInSlantNm, 1) + "nm"), "z-right", {
      "text-anchor": "end",
      "font-size": 13,
      "font-weight": 900
    });
    movableText(svg, 638, 166, one(terms.groundRange, format(result.groundRangeNm, 1) + "nm"), "z-right", {
      "text-anchor": "end",
      "font-size": 13,
      "font-weight": 900
    });

    movableText(svg, 276, 132, one("Dive Angle", format(angle, 0) + "°"), "z-center", {
      "font-size": 15,
      "font-weight": 900
    });
    movableText(svg, 276, 159, one(terms.aimOffAngle, format(local.aimOffAngleDeg, 0) + "°"), "z-center", {
      "font-size": 15,
      "font-weight": 900
    });

    line(svg, plannedX - 100, plannedY, 356, plannedY, { "stroke-width": 3 });
    movableText(svg, 382, plannedY + 6, one("Planned Release", format(result.effectiveReleaseAltitudeMslFt, 0) + "ft MSL"), "z-release", {
      "font-size": 14,
      "font-weight": 900
    });

    line(svg, safetyX - 76, safetyY, 356, safetyY, { "stroke-width": 3 });
    movableText(svg, 382, safetyY + 6, one(safetyLabel(view), format(result.safetyReleaseMslFt, 0) + "ft MSL"), "z-release", {
      "font-size": 14,
      "font-weight": 900
    });

    movableText(svg, 68, 268, "Release Speed", "z-speed", {
      "font-size": 15,
      "font-weight": 900
    });
    movableText(svg, 68, 292, ": " + format(result.releaseSpeedKcas, 0) + " KCAS", "z-speed", {
      "font-size": 15,
      "font-weight": 900
    });

    movableText(svg, 326, 426, one("MINALT", format(result.minAltMslFt, 0) + "ft MSL"), "z-minalt", {
      "font-size": 15,
      "font-weight": 900
    });

    movableText(svg, 60, 500, one("Roll-in Lead", format(result.leadAngleDeg, 0) + "°"), "z-bottom", {
      "font-size": 15,
      "font-weight": 900
    });
    movableText(svg, 60, 536, one("Tracking Time", format(result.trackingTimeSec, 0) + " s"), "z-bottom", {
      "font-size": 15,
      "font-weight": 900
    });
    movableText(svg, 60, 572, one("Bomb TOF", format(result.bombTofSec, 0) + " s"), "z-bottom", {
      "font-size": 15,
      "font-weight": 900
    });

    enableLabelDrag(svg);
    return true;
  }

  function addGrid(svg, width, height, xStep, yStep) {
    var group = append(svg, "g", { stroke: "#e5e7eb", "stroke-width": 1 });
    var x;
    var y;
    for (x = 40; x < width; x += xStep) line(group, x, 35, x, height - 35, { stroke: "#e5e7eb", "stroke-width": 1 });
    for (y = 45; y < height; y += yStep) line(group, 35, y, width - 35, y, { stroke: "#e5e7eb", "stroke-width": 1 });
  }

  function marker(defs, id, color, size) {
    defs.appendChild(commonDiagram.createOpenArrowMarker(id, color, {
      markerWidth: size,
      markerHeight: size,
      refX: size - 2,
      refY: size / 2,
      path: "M2,2 L" + (size - 2) + "," + (size / 2) + " L2," + (size - 2),
      strokeWidth: 2.2
    }));
  }

  function point(svg, p, color, radius) {
    append(svg, "circle", {
      cx: finite(p.x, 0),
      cy: finite(p.y, 0),
      r: radius || 6,
      fill: "#fff",
      stroke: color,
      "stroke-width": 3
    });
  }

  function angleArc(parent, center, radius, startAngle, endAngle, role, color) {
    var tau = Math.PI * 2;
    var delta = endAngle - startAngle;
    while (delta <= -Math.PI) delta += tau;
    while (delta > Math.PI) delta -= tau;
    var resolvedEnd = startAngle + delta;
    var start = {
      x: center.x + radius * Math.cos(startAngle),
      y: center.y + radius * Math.sin(startAngle)
    };
    var end = {
      x: center.x + radius * Math.cos(resolvedEnd),
      y: center.y + radius * Math.sin(resolvedEnd)
    };
    return append(parent, "path", {
      d: "M" + start.x.toFixed(1) + "," + start.y.toFixed(1) +
        " A" + radius + "," + radius + " 0 0 " + (delta >= 0 ? 1 : 0) +
        " " + end.x.toFixed(1) + "," + end.y.toFixed(1),
      fill: "none",
      stroke: color,
      "stroke-width": 2.2,
      "stroke-linecap": "round",
      "data-profile-angle": role
    });
  }

  function placeholder(svg, label) {
    append(svg, "rect", { width: "100%", height: "100%", fill: "#fff" });
    text(svg, 450, 300, label, {
      "text-anchor": "middle",
      "font-size": 20,
      "font-weight": 850,
      fill: "#687787"
    });
  }

  function renderProfile(svg, view) {
    svg.replaceChildren();
    svg.setAttribute("viewBox", "0 0 900 620");
    svg.dataset.baseViewBox = "0 0 900 620";
    append(svg, "rect", { width: 900, height: 620, fill: "#fff" });

    var visual = view.visualization && view.visualization.profile;
    if (!visual || !visual.points) {
      placeholder(svg, "Profile geometry provider not connected");
      return false;
    }

    var defs = append(svg, "defs", {});
    marker(defs, "profile-blue-arrow", "#176dac", 12);
    marker(defs, "profile-green-arrow", "#087b4c", 12);
    marker(defs, "profile-amber-arrow", "#a35d00", 12);
    marker(defs, "profile-map-arrow", "#d64b4b", 12);
    addGrid(svg, 900, 620, 80, 70);

    var p = visual.points;
    var groundY = p.target.y;
    var dimensionY = 500;
    var mapY = 570;
    var hasAod = Math.abs(p.aimOff.x - p.target.x) > 1;

    line(svg, 48, groundY, 852, groundY, {
      stroke: "#556270",
      "stroke-width": 2,
      "data-profile-line": "ground"
    });

    [
      { point: p.trackPoint, endY: mapY },
      { point: p.release, endY: dimensionY },
      { point: p.target, endY: mapY },
      { point: p.aimOff, endY: dimensionY, optional: true }
    ].forEach(function (station) {
      if (station.optional && !hasAod) return;
      line(svg, station.point.x, station.point.y + 9, station.point.x, station.endY + 8, {
        stroke: "#b45a5a",
        "stroke-width": 1.1,
        "stroke-dasharray": "5 5",
        opacity: 0.58,
        "data-profile-line": "station-projection"
      });
    });

    line(svg, p.trackPoint.x, p.trackPoint.y, p.aimOff.x, p.aimOff.y, {
      stroke: "#374151",
      "stroke-width": 2.1,
      "data-profile-line": "flight-path-reference"
    });
    line(svg, p.trackPoint.x, p.trackPoint.y, p.target.x, p.target.y, {
      stroke: "#111827",
      "stroke-width": 1.8,
      "data-profile-line": "target-los"
    });
    append(svg, "path", {
      d: pathFromPoints(visual.flightPath || [p.trackPoint, p.release]),
      fill: "none",
      stroke: "#176dac",
      "stroke-width": 4,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "data-profile-path": "tracking"
    });
    append(svg, "path", {
      d: pathFromPoints(visual.bombPath || [p.release, p.target]),
      fill: "none",
      stroke: "#087b4c",
      "stroke-width": 4,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "marker-end": "url(#profile-green-arrow)",
      "data-profile-path": "bomb"
    });

    point(svg, p.trackPoint, "#176dac", 6);
    point(svg, p.release, "#a35d00", 6);
    point(svg, p.target, "#087b4c", 7);
    if (hasAod) point(svg, p.aimOff, "#176dac", 5);

    text(svg, p.trackPoint.x, p.trackPoint.y - 21, "Track Point (Rollout)", { "text-anchor": "middle", class: "label-halo" });
    text(svg, p.release.x, p.release.y - 21, "Release", { "text-anchor": "middle", class: "label-halo" });
    text(svg, p.target.x - 12, p.target.y - 16, "Target / Impact", { "text-anchor": "end", class: "label-halo" });
    if (hasAod) text(svg, p.aimOff.x, p.aimOff.y + 28, "Aim-off Point", { "text-anchor": "middle", class: "label-halo" });

    text(svg, 42, 34, "Track Point Altitude: " + format(view.public.trackPointAltitudeMslFt, 0) + "ft MSL", {
      fill: "#203a63",
      "font-size": 13,
      "font-weight": 850,
      class: "label-halo"
    });

    var fpaAngle = Math.atan2(p.aimOff.y - p.trackPoint.y, p.aimOff.x - p.trackPoint.x);
    var losAngle = Math.atan2(p.target.y - p.trackPoint.y, p.target.x - p.trackPoint.x);
    if (Math.abs(fpaAngle - losAngle) > 0.001) {
      angleArc(svg, p.trackPoint, 70, fpaAngle, losAngle, "iaa", "#a35d00");
    }
    text(svg, p.trackPoint.x + 170, p.trackPoint.y + 58,
      "IAA (Initial Aim-off Angle): " + format(view.local.aimOffAngleDeg, 1) + "°", {
        "text-anchor": "middle",
        fill: "#a35d00",
        "font-size": 12,
        "font-weight": 850,
        class: "label-halo"
      });

    if (finite(view.input.diveAngleDeg, 0) > 0) {
      angleArc(svg, p.aimOff, 56, Math.PI,
        Math.atan2(p.trackPoint.y - p.aimOff.y, p.trackPoint.x - p.aimOff.x),
        "dive-angle", "#176dac");
      text(svg, p.aimOff.x - 128, p.aimOff.y - 54,
        "Dive Angle: " + format(view.input.diveAngleDeg, 0) + "°", {
          "text-anchor": "middle",
          fill: "#176dac",
          "font-size": 13,
          "font-weight": 850,
          class: "label-halo"
        });
    }

    line(svg, p.trackPoint.x, dimensionY, p.release.x, dimensionY, {
      stroke: "#176dac",
      "stroke-width": 1.7,
      "marker-start": "url(#profile-blue-arrow)",
      "marker-end": "url(#profile-blue-arrow)",
      "data-profile-dimension": "tracking-distance"
    });
    line(svg, p.release.x, dimensionY, p.target.x, dimensionY, {
      stroke: "#087b4c",
      "stroke-width": 1.7,
      "marker-start": "url(#profile-green-arrow)",
      "marker-end": "url(#profile-green-arrow)",
      "data-profile-dimension": "bomb-range"
    });
    if (hasAod) line(svg, p.target.x, dimensionY, p.aimOff.x, dimensionY, {
        stroke: "#a35d00",
        "stroke-width": 1.7,
        "marker-start": "url(#profile-amber-arrow)",
        "marker-end": "url(#profile-amber-arrow)",
        "data-profile-dimension": "aod"
      });
    text(svg, (p.trackPoint.x + p.release.x) / 2, dimensionY - 10, "Tracking Distance", {
      "text-anchor": "middle",
      fill: "#176dac",
      "font-size": 12,
      class: "label-halo"
    });
    text(svg, (p.release.x + p.target.x) / 2, dimensionY - 10, "Bomb Range", {
      "text-anchor": "middle",
      fill: "#087b4c",
      "font-size": 12,
      class: "label-halo"
    });
    if (hasAod) text(svg, (p.target.x + p.aimOff.x) / 2, dimensionY - 10, "AOD", {
      "text-anchor": "middle",
      fill: "#a35d00",
      "font-size": 11,
      class: "label-halo"
    });
    line(svg, p.trackPoint.x, mapY, p.target.x, mapY, {
      stroke: "#d64b4b",
      "stroke-width": 1.7,
      "marker-start": "url(#profile-map-arrow)",
      "marker-end": "url(#profile-map-arrow)",
      "data-profile-dimension": "map-ground-range"
    });
    text(svg, (p.trackPoint.x + p.target.x) / 2, mapY - 10, "MAP (Ground Range)", {
      "text-anchor": "middle",
      fill: "#d64b4b",
      "font-size": 12,
      "font-weight": 850,
      class: "label-halo"
    });
    return true;
  }

  function renderTop(svg, view) {
    svg.replaceChildren();
    svg.setAttribute("viewBox", "0 0 900 620");
    svg.dataset.baseViewBox = "0 0 900 620";
    append(svg, "rect", { width: 900, height: 620, fill: "#fff" });

    var visual = view.visualization && view.visualization.top;
    if (!visual || !visual.points) {
      placeholder(svg, "Top View geometry provider not connected");
      return false;
    }

    var defs = append(svg, "defs", {});
    marker(defs, "top-blue-arrow", "#2f6fc2", 14);
    marker(defs, "top-amber-arrow", "#d59400", 14);
    marker(defs, "top-dim-arrow", "#2f6fc2", 11);
    addGrid(svg, 900, 620, 80, 70);

    var p = visual.points;
    append(svg, "circle", {
      cx: p.target.x,
      cy: p.target.y,
      r: finite(visual.groundRangeRadiusPx, 175),
      fill: "#f5f8fd",
      "fill-opacity": 0.68,
      stroke: "#203a63",
      "stroke-width": 2
    });
    line(svg, p.initial.x, p.initial.y, p.rollInStart.x, p.rollInStart.y, {
      stroke: "#2f6fc2",
      "stroke-width": 4,
      "marker-end": "url(#top-blue-arrow)"
    });
    append(svg, "path", {
      d: pathFromPoints(visual.rollPath || [p.rollInStart, p.trackPoint]),
      fill: "none",
      stroke: "#c85ac8",
      "stroke-width": 5,
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    });
    line(svg, p.trackPoint.x, p.trackPoint.y, p.target.x, p.target.y, {
      stroke: "#d59400",
      "stroke-width": 4,
      "marker-end": "url(#top-amber-arrow)"
    });
    line(svg, p.rollInStart.x, p.rollInStart.y, p.target.x, p.target.y, {
      stroke: "#d64b4b",
      "stroke-width": 2.8
    });

    point(svg, p.rollInStart, "#c85ac8", 7);
    point(svg, p.trackPoint, "#c85ac8", 6);
    append(svg, "circle", { cx: p.target.x, cy: p.target.y, r: 7, fill: "#d64b4b" });

    text(svg, 48, 46, "Initial", { fill: "#2f6fc2", "font-size": 16, class: "label-halo" });
    text(svg, 48, 69, format(view.public.resolvedInitialAltitudeMslFt, 0) + "ft MSL · " + format(view.public.resolvedInitialSpeedKcas, 0) + " KCAS", {
      fill: "#203a63",
      "font-size": 13,
      class: "label-halo"
    });
    text(svg, p.rollInStart.x - 10, p.rollInStart.y + 29, "Roll-in Start", { "text-anchor": "end", fill: "#a443aa", class: "label-halo" });
    text(svg, p.trackPoint.x - 10, p.trackPoint.y - 17, "Track Point", { "text-anchor": "end", fill: "#a443aa", class: "label-halo" });
    text(svg, p.target.x + 10, p.target.y - 8, "Target", { fill: "#203a63", class: "label-halo" });
    text(svg, p.target.x, p.target.y - 34, "Angle-off: " + format(view.input.angleOffDeg, 0) + "°", {
      "text-anchor": "middle",
      fill: "#203a63",
      "font-size": 17,
      class: "label-halo"
    });
    text(svg, (p.rollInStart.x + p.target.x) / 2 - 20, (p.rollInStart.y + p.target.y) / 2 - 10, "Lead Angle: " + format(view.public.leadAngleDeg, 1) + "°", {
      fill: "#d64b4b",
      "font-size": 13,
      class: "label-halo"
    });
    text(svg, (p.trackPoint.x + p.target.x) / 2, (p.trackPoint.y + p.target.y) / 2 + 58, "Ground Range (MAP): " + format(view.public.groundRangeNm, 2) + "nm", {
      "text-anchor": "middle",
      fill: "#b77d00",
      "font-size": 12,
      class: "label-halo"
    });

    var dimNear = finite(visual.dimensionNearX, 810);
    var dimFar = finite(visual.dimensionFarX, 866);
    [p.rollInStart, p.trackPoint, p.target].forEach(function (value) {
      line(svg, value.x, value.y, dimFar, value.y, {
        stroke: "#6f98d8",
        "stroke-width": 1.2,
        "stroke-dasharray": "5 4"
      });
    });
    line(svg, dimNear, p.rollInStart.y, dimNear, p.trackPoint.y, {
      stroke: "#2f6fc2",
      "stroke-width": 1.5,
      "marker-start": "url(#top-dim-arrow)",
      "marker-end": "url(#top-dim-arrow)"
    });
    line(svg, dimFar, p.rollInStart.y, dimFar, p.target.y, {
      stroke: "#2f6fc2",
      "stroke-width": 1.5,
      "marker-start": "url(#top-dim-arrow)",
      "marker-end": "url(#top-dim-arrow)"
    });
    text(svg, dimNear - 12, (p.rollInStart.y + p.trackPoint.y) / 2, "Roll-in Distance", {
      "text-anchor": "end",
      fill: "#2f6fc2",
      "font-size": 12,
      class: "label-halo"
    });
    text(svg, dimFar - 12, (p.rollInStart.y + p.target.y) / 2, "Roll-in Range", {
      "text-anchor": "end",
      fill: "#2f6fc2",
      "font-size": 12,
      class: "label-halo"
    });
    return true;
  }

  function enableLabelDrag(svg) {
    if (svg.__bdpLabelDragBound) return;
    svg.__bdpLabelDragBound = true;
    var pending = null;
    var active = null;

    function nodesFor(target) {
      var group = target.getAttribute("data-drag-group");
      if (!group) return [target];
      return Array.prototype.slice.call(svg.querySelectorAll('[data-drag-group="' + group + '"]'));
    }

    function pointFromEvent(event) {
      var point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      var matrix = svg.getScreenCTM();
      return matrix ? point.matrixTransform(matrix.inverse()) : point;
    }

    svg.addEventListener("pointerdown", function (event) {
      var target = event.target.closest && event.target.closest(".movable-label");
      if (!target || !svg.contains(target)) return;
      var start = pointFromEvent(event);
      var items = nodesFor(target).map(function (item) {
        return { item: item, transform: item.getAttribute("transform") || "" };
      });
      pending = {
        pointerId: event.pointerId,
        start: start,
        items: items,
        timer: global.setTimeout(function () {
          active = pending;
          pending = null;
          active.items.forEach(function (entry) { entry.item.classList.add("dragging"); });
          svg.setPointerCapture(active.pointerId);
        }, 500)
      };
    });

    svg.addEventListener("pointermove", function (event) {
      if (!active || event.pointerId !== active.pointerId) return;
      var current = pointFromEvent(event);
      var dx = current.x - active.start.x;
      var dy = current.y - active.start.y;
      active.items.forEach(function (entry) {
        entry.item.setAttribute("transform", (entry.transform ? entry.transform + " " : "") + "translate(" + dx.toFixed(2) + " " + dy.toFixed(2) + ")");
      });
    });

    function finish(event) {
      if (pending && event.pointerId === pending.pointerId) {
        global.clearTimeout(pending.timer);
        pending = null;
      }
      if (active && event.pointerId === active.pointerId) {
        active.items.forEach(function (entry) { entry.item.classList.remove("dragging"); });
        active = null;
      }
    }

    svg.addEventListener("pointerup", finish);
    svg.addEventListener("pointercancel", finish);
  }

  function renderAll(elements, view) {
    return {
      zAvailable: renderZ(elements.z, view),
      profileAvailable: renderProfile(elements.profile, view),
      topAvailable: renderTop(elements.top, view)
    };
  }

  global.BDPGraphRenderers = Object.freeze({
    terminology: TERMINOLOGY,
    renderAll: renderAll,
    renderZ: renderZ,
    renderProfile: renderProfile,
    renderTop: renderTop
  });
})(window);
