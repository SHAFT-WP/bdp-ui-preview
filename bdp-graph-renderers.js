(function (global) {
  "use strict";

  var commonDiagram = global.BDPCommonDiagram;
  if (!commonDiagram || typeof commonDiagram.svgNode !== "function") {
    throw new Error("Common SVG primitives must load before BDP graph renderers");
  }
  var TERMINOLOGY = Object.freeze({
    USAF: Object.freeze({
      rollInSlant: "Base Distance(S)",
      groundRange: "MAP",
      aimOffAngle: "IAA",
      baseDistance: "Base Distance",
      rollInLongitudinalDistance: "Roll-in Longitudinal Distance",
      rollInLateralDistance: "Roll-in Lateral Distance",
      rollInStart: "Roll-in Point",
      trackPoint: "Track Point",
      leadAngle: "Roll-in Lead",
      angleOff: "Angle-off (Heading)"
    }),
    Shaft: Object.freeze({
      rollInRange: "Roll-in Range",
      rollInSlant: "Roll-in Slant",
      groundRange: "Ground Range",
      aimOffAngle: "Aim-off Angle"
    })
  });
  var TOP_FONT_SIZE = 13;

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

  function clock(value) {
    var totalSeconds = Math.max(0, Math.round(finite(value, 0)));
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    return String(minutes).padStart(2, "0") + " min " + String(seconds).padStart(2, "0") + " sec";
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
    var options = Object.assign({}, attrs || {});
    var classes = (options.class || "").split(/\s+/).filter(Boolean);
    if (classes.indexOf("movable-label") < 0) classes.push("movable-label");
    options.class = classes.join(" ");
    return append(parent, "text", Object.assign({
      x: x,
      y: y,
      fill: "#111",
      "font-size": 14,
      "font-weight": 820
    }, options), value);
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
    append(svg, "rect", { width: 650, height: 220, fill: "#fff", "data-plot-background": "true" });
    text(svg, 325, 88, titleValue, {
      "text-anchor": "middle",
      "font-size": 24,
      "font-weight": 900
    });
    text(svg, 325, 136, detail, {
      "text-anchor": "middle",
      "font-size": 13,
      "font-weight": 750,
      fill: "#687787"
    });
    enableLabelDrag(svg);
  }

  function movableText(parent, x, y, value, group, attrs) {
    return text(parent, x, y, value, Object.assign({
      class: "movable-label",
      "data-drag-group": group || ""
    }, attrs || {}));
  }

  function dimensionValue(parent, x, y, label, value, group, attrs) {
    var labelAttrs = Object.assign({
      "text-anchor": "middle",
      "font-size": 12,
      class: "label-halo"
    }, attrs || {});
    var valueAttrs = Object.assign({}, labelAttrs, {
      "font-size": 11,
      "font-weight": 850
    });
    movableText(parent, x, y, label, group, labelAttrs);
    movableText(parent, x, y + 20, value, group, valueAttrs);
  }

  function topDimensionValue(parent, x, y, label, value, group, attrs) {
    var options = Object.assign({
      "text-anchor": "middle",
      "font-size": TOP_FONT_SIZE,
      "font-weight": 850,
      class: "label-halo"
    }, attrs || {});
    movableText(parent, x, y - 10, label, group, options);
    movableText(parent, x, y + 10, value, group, options);
  }

  function topDimensionLabelPoint(segment) {
    var dx = segment.end.x - segment.start.x;
    var dy = segment.end.y - segment.start.y;
    var length = Math.max(1, Math.hypot(dx, dy));
    var normal = { x: -dy / length, y: dx / length };
    var midpoint = {
      x: (segment.start.x + segment.end.x) / 2,
      y: (segment.start.y + segment.end.y) / 2
    };
    var centerVector = { x: midpoint.x - 450, y: midpoint.y - 327.5 };
    if (normal.x * centerVector.x + normal.y * centerVector.y < 0) {
      normal.x *= -1;
      normal.y *= -1;
    }
    var x = midpoint.x + normal.x * 28;
    var y = midpoint.y + normal.y * 28;
    var anchor = normal.x > 0.35 ? "start" : normal.x < -0.35 ? "end" : "middle";
    if (anchor === "start") x = Math.min(x, 690);
    else if (anchor === "end") x = Math.max(x, 210);
    else x = Math.max(150, Math.min(750, x));
    y = Math.max(125, Math.min(585, y));
    return { x: x, y: y, anchor: anchor };
  }

  function drawTopDimension(svg, segment, role, label, value, group, fixedLabelPoint) {
    (segment.guides || []).forEach(function (guide) {
      line(svg, guide.start.x, guide.start.y, guide.end.x, guide.end.y, {
        stroke: "#6f98d8",
        "stroke-width": 1.2,
        "stroke-dasharray": "5 4",
        "data-top-guide": role
      });
    });
    line(svg, segment.start.x, segment.start.y, segment.end.x, segment.end.y, {
      stroke: "#2f6fc2",
      "stroke-width": 1.5,
      "marker-start": "url(#top-dim-arrow)",
      "marker-end": "url(#top-dim-arrow)",
      "data-top-dimension": role
    });
    var labelPoint = fixedLabelPoint || topDimensionLabelPoint(segment);
    topDimensionValue(svg, labelPoint.x, labelPoint.y, label, value, group, {
      "text-anchor": labelPoint.anchor,
      fill: "#2f6fc2"
    });
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

    svg.setAttribute("viewBox", "0 -62 650 682");
    svg.dataset.baseViewBox = "0 -62 650 682";
    append(svg, "rect", { x: 0, y: -62, width: 650, height: 682, fill: "#fff", "data-plot-background": "true" });

    var left = 50;
    var topX = 360;
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

    movableText(svg, 325, -12, profileTitle(view), "z-title", {
      "text-anchor": "middle",
      "font-size": 27,
      "font-weight": 900
    });
    movableText(svg, 58, 82, format(result.resolvedInitialAltitudeMslFt, 0) + " ft msl", "z-initial", {
      "font-size": 13,
      "font-weight": 900
    });
    movableText(svg, 270, 82, format(result.resolvedInitialSpeedKcas, 0) + " kcas", "z-initial", {
      "font-size": 13,
      "font-weight": 900
    });

    line(svg, left, topY, topX, topY, { "stroke-width": 3.5, "stroke-linecap": "square" });
    line(svg, left, baseY, topX, topY, { "stroke-width": 3.5, "stroke-linecap": "square" });
    line(svg, left, baseY, topX, baseY, { "stroke-width": 3.5, "stroke-linecap": "square" });

    movableText(svg, 390, 82, one(terms.angleOff, format(input.angleOffDeg, 0) + " deg"), "z-right", {
      "text-anchor": "start",
      "font-size": 13,
      "font-weight": 900
    });
    movableText(svg, 390, 110, one(terms.baseDistance, format(result.rollInLateralSeparationNm, 1) + " nm"), "z-right", {
      "text-anchor": "start",
      "font-size": 13,
      "font-weight": 900
    });
    movableText(svg, 390, 138, one(terms.rollInSlant, format(local.baseDistanceSlantNm, 1) + " nm"), "z-right", {
      "text-anchor": "start",
      "font-size": 13,
      "font-weight": 900
    });
    movableText(svg, 390, 166, one(terms.groundRange, format(result.groundRangeNm, 1) + " nm"), "z-right", {
      "text-anchor": "start",
      "font-size": 13,
      "font-weight": 900
    });

    movableText(svg, 320, 132, format(angle, 0) + " deg", "z-dive-angle", {
      "text-anchor": "end",
      "font-size": 13,
      "font-weight": 900
    });

    line(svg, plannedX - 100, plannedY, 356, plannedY, { "stroke-width": 3 });
    movableText(svg, 382, plannedY + 6, one("Planned Release", format(result.effectiveReleaseAltitudeMslFt, 0) + " ft msl"), "z-release", {
      "font-size": 13,
      "font-weight": 900
    });

    line(svg, safetyX - 76, safetyY, 356, safetyY, { "stroke-width": 3 });
    movableText(svg, 382, safetyY + 6, one(safetyLabel(view), format(result.safetyReleaseMslFt, 0) + " ft msl"), "z-release", {
      "font-size": 13,
      "font-weight": 900
    });

    movableText(svg, 68, 268, "Release Speed", "z-speed", {
      "font-size": 13,
      "font-weight": 900
    });
    movableText(svg, 68, 292, ": " + format(result.releaseSpeedKcas, 0) + " kcas", "z-speed", {
      "font-size": 13,
      "font-weight": 900
    });

    movableText(svg, 326, 426, one("MINALT", format(result.minAltMslFt, 0) + " ft msl"), "z-minalt", {
      "font-size": 13,
      "font-weight": 900
    });

    movableText(svg, 60, 480, one("Roll-in Lead", format(result.leadAngleDeg, 0) + " deg"), "z-bottom", {
      "font-size": 13,
      "font-weight": 900
    });
    movableText(svg, 60, 516, one(terms.aimOffAngle, format(local.aimOffAngleDeg, 0) + " deg"), "z-bottom", {
      "font-size": 13,
      "font-weight": 900
    });
    movableText(svg, 60, 552, one("Tracking Time", format(result.trackingTimeSec, 0) + " sec"), "z-bottom", {
      "font-size": 13,
      "font-weight": 900
    });
    movableText(svg, 60, 588, one("Bomb TOF", format(result.bombTofSec, 0) + " sec"), "z-bottom", {
      "font-size": 13,
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
    append(svg, "rect", { width: "100%", height: "100%", fill: "#fff", "data-plot-background": "true" });
    text(svg, 450, 300, label, {
      "text-anchor": "middle",
      "font-size": 20,
      "font-weight": 850,
      fill: "#687787"
    });
  }

  function renderProfile(svg, view) {
    svg.replaceChildren();
    svg.setAttribute("viewBox", "0 0 980 700");
    svg.dataset.baseViewBox = "0 0 980 700";
    append(svg, "rect", { width: 980, height: 700, fill: "#fff", "data-plot-background": "true" });

    var visual = view.visualization && view.visualization.profile;
    if (!visual || !visual.points) {
      placeholder(svg, "Profile geometry provider not connected");
      enableLabelDrag(svg);
      return false;
    }

    var defs = append(svg, "defs", {});
    marker(defs, "profile-blue-arrow", "#176dac", 12);
    marker(defs, "profile-green-arrow", "#087b4c", 12);
    marker(defs, "profile-amber-arrow", "#a35d00", 12);
    marker(defs, "profile-map-arrow", "#d64b4b", 12);
    addGrid(svg, 980, 700, 80, 70);

    var p = visual.points;
    var groundY = p.target.y;
    var dimensionY = 560;
    var mapY = 640;
    var hasAod = Math.abs(p.aimOff.x - p.target.x) > 1;
    var isLevel = Math.abs(finite(view.input && view.input.diveAngleDeg, 0)) < 0.001;
    var trackPointLabel = isLevel
      ? "Track: " + clock(view.public.trackingTimeSec)
      : "Track: " + format(view.public.trackPointAltitudeMslFt, 0) + " ft, " +
        format(view.public.trackingTimeSec, 0) + " sec";
    var releaseLabel = (isLevel ? "Initial" : "Release") + ": " +
      format(view.public.effectiveReleaseAltitudeMslFt, 0) + " ft msl";

    line(svg, 48, groundY, 932, groundY, {
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

    text(svg, p.trackPoint.x, p.trackPoint.y - 21, trackPointLabel, { "text-anchor": "start", class: "label-halo" });
    text(svg, isLevel ? p.release.x + 18 : p.release.x, p.release.y - 21, releaseLabel, {
      "text-anchor": isLevel ? "start" : "middle",
      class: "label-halo"
    });
    var targetAimOffY = p.target.y + 34;
    if (hasAod) {
      var stationLabelBoundary = (p.target.x + p.aimOff.x) / 2;
      movableText(svg, stationLabelBoundary - 12, targetAimOffY, "Target", "profile-target", {
        "text-anchor": "end",
        class: "label-halo"
      });
      movableText(svg, stationLabelBoundary + 12, targetAimOffY,
        "Aim Off Point",
        "profile-aim-off", {
          "text-anchor": "start",
          class: "label-halo"
        });
    } else {
      movableText(svg, p.target.x, targetAimOffY, "Target", "profile-target", {
        "text-anchor": "middle",
        class: "label-halo"
      });
    }

    var fpaAngle = Math.atan2(p.aimOff.y - p.trackPoint.y, p.aimOff.x - p.trackPoint.x);
    var losAngle = Math.atan2(p.target.y - p.trackPoint.y, p.target.x - p.trackPoint.x);
    if (!isLevel) {
      if (Math.abs(fpaAngle - losAngle) > 0.001) {
        angleArc(svg, p.trackPoint, 70, fpaAngle, losAngle, "iaa", "#a35d00");
      }
      text(svg, p.trackPoint.x + 170, p.trackPoint.y + 58,
        "IAA: " + format(view.local.aimOffAngleDeg, 0) + " deg", {
          "text-anchor": "middle",
          fill: "#a35d00",
          "font-size": 12,
          "font-weight": 850,
          class: "label-halo"
        });
    }

    if (finite(view.input.diveAngleDeg, 0) > 0) {
      angleArc(svg, p.aimOff, 56, Math.PI,
        Math.atan2(p.trackPoint.y - p.aimOff.y, p.trackPoint.x - p.aimOff.x),
        "dive-angle", "#176dac");
      text(svg, p.aimOff.x - 128, p.aimOff.y - 54,
        "Dive Angle: " + format(view.input.diveAngleDeg, 0) + " deg", {
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
    dimensionValue(svg, (p.trackPoint.x + p.release.x) / 2, dimensionY - 36,
      "Tracking Distance", format(view.public.downRangeTravelNm, 1) + " nm",
      "profile-tracking-distance", { fill: "#176dac" });
    dimensionValue(svg, (p.release.x + p.target.x) / 2, dimensionY - 36,
      "Bomb Range", format(view.public.bombRangeNm, 1) + " nm",
      "profile-bomb-range", { fill: "#087b4c" });
    if (hasAod) dimensionValue(svg, (p.target.x + p.aimOff.x) / 2, dimensionY - 36,
      "AOD", format(view.local.aimOffDistanceNm, 1) + " nm",
      "profile-aod", { fill: "#a35d00" });
    line(svg, p.trackPoint.x, mapY, p.target.x, mapY, {
      stroke: "#d64b4b",
      "stroke-width": 1.7,
      "marker-start": "url(#profile-map-arrow)",
      "marker-end": "url(#profile-map-arrow)",
      "data-profile-dimension": "map-ground-range"
    });
    dimensionValue(svg, (p.trackPoint.x + p.target.x) / 2, mapY - 36,
      "MAP", format(view.public.groundRangeNm, 1) + " nm",
      "profile-map", { fill: "#d64b4b" });
    enableLabelDrag(svg);
    return true;
  }

  function renderTop(svg, view) {
    svg.replaceChildren();
    svg.setAttribute("viewBox", "0 0 900 620");
    svg.dataset.baseViewBox = "0 0 900 620";
    append(svg, "rect", { width: 900, height: 620, fill: "#fff", "data-plot-background": "true" });

    var visual = view.visualization && view.visualization.top;
    if (!visual || !visual.points) {
      placeholder(svg, "Top View geometry provider not connected");
      enableLabelDrag(svg);
      return false;
    }

    var defs = append(svg, "defs", {});
    marker(defs, "top-blue-arrow", "#2f6fc2", 14);
    marker(defs, "top-amber-arrow", "#d59400", 14);
    marker(defs, "top-dim-arrow", "#2f6fc2", 11);
    addGrid(svg, 900, 620, 80, 70);

    var p = visual.points;
    var terms = TERMINOLOGY.USAF;
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

    var baseDx = p.initial.x - p.rollInStart.x;
    var baseDy = p.initial.y - p.rollInStart.y;
    var baseLength = Math.max(1, Math.hypot(baseDx, baseDy));
    var baseUnit = { x: baseDx / baseLength, y: baseDy / baseLength };
    var baseNormal = { x: -baseUnit.y, y: baseUnit.x };
    if (baseNormal.y > 0) {
      baseNormal.x *= -1;
      baseNormal.y *= -1;
    }
    var baseLabelX = Math.min(p.initial.x, p.rollInStart.x) + TOP_FONT_SIZE * 2;
    var baseLabelY = p.rollInStart.y + baseUnit.y * (TOP_FONT_SIZE * 2) + baseNormal.y * 16;
    baseLabelX = Math.max(48, Math.min(650, baseLabelX));
    baseLabelY = Math.max(125, Math.min(570, baseLabelY));
    movableText(svg, baseLabelX, baseLabelY - TOP_FONT_SIZE * 2,
      terms.leadAngle + ": " + format(view.public.leadAngleDeg, 0) + " deg",
      "top-base-condition", {
      "text-anchor": "start",
      fill: "#d64b4b",
      "font-size": TOP_FONT_SIZE,
      class: "label-halo"
    });
    movableText(svg, baseLabelX, baseLabelY,
      format(view.public.resolvedInitialAltitudeMslFt, 0) + " ft msl · " +
        format(view.public.resolvedInitialSpeedKcas, 0) + " kcas",
      "top-base-condition", {
      "text-anchor": "start",
      fill: "#203a63",
      "font-size": TOP_FONT_SIZE,
      class: "label-halo"
    });
    movableText(svg, 852, 46, "Attack Heading: " + format(view.input.attackHeadingDeg, 0) + " deg", "top-context", {
      "text-anchor": "end",
      fill: "#203a63",
      "font-size": TOP_FONT_SIZE,
      class: "label-halo"
    });
    movableText(svg, 852, 70, terms.angleOff + ": " + format(view.input.angleOffDeg, 0) + " deg", "top-context", {
      "text-anchor": "end",
      fill: "#203a63",
      "font-size": TOP_FONT_SIZE,
      class: "label-halo"
    });
    var windSpeedKt = finite(view.input.windSpeedKt, 0);
    if (Math.abs(windSpeedKt) > 0.0001) {
      movableText(svg, 852, 94,
        "Wind: " + format(view.input.windDirectionDeg, 0) + " deg from · " + format(Math.abs(windSpeedKt), 0) + " kt",
        "top-context", {
          "text-anchor": "end",
          fill: "#203a63",
          "font-size": TOP_FONT_SIZE,
          class: "label-halo"
        });
    }
    text(svg, p.rollInStart.x - 10, p.rollInStart.y + 29, terms.rollInStart, { "text-anchor": "end", fill: "#a443aa", "font-size": TOP_FONT_SIZE, class: "label-halo" });
    text(svg, p.trackPoint.x - 10, p.trackPoint.y - 17, terms.trackPoint, { "text-anchor": "end", fill: "#a443aa", "font-size": TOP_FONT_SIZE, class: "label-halo" });
    text(svg, p.target.x + 10, p.target.y - 8, "Target", { fill: "#203a63", "font-size": TOP_FONT_SIZE, class: "label-halo" });
    text(svg, 95, 72, terms.groundRange + ": " + format(view.public.groundRangeNm, 1) + " nm", {
      "text-anchor": "start",
      fill: "#b77d00",
      "font-size": TOP_FONT_SIZE,
      class: "label-halo"
    });

    var dimensions = visual.dimensions || {};
    if (dimensions.baseDistance) {
      drawTopDimension(svg, dimensions.baseDistance, "base-distance",
        terms.baseDistance,
        format(view.public.rollInLateralSeparationNm, 1) + " nm",
        "top-base-distance", { x: 875, y: 350, anchor: "end" });
    }
    if (dimensions.rollInLateralDistance) {
      drawTopDimension(svg, dimensions.rollInLateralDistance, "roll-in-lateral-distance",
        terms.rollInLateralDistance.replace(/ Distance$/, ""),
        "Distance: " + format(Math.abs(view.public.rollInDisplacement && view.public.rollInDisplacement.turnSideNm), 1) + " nm",
        "top-roll-in-lateral", { x: 875, y: 420, anchor: "end" });
    }
    if (dimensions.rollInLongitudinalDistance) {
      drawTopDimension(svg, dimensions.rollInLongitudinalDistance, "roll-in-longitudinal-distance",
        terms.rollInLongitudinalDistance.replace(/ Distance$/, ""),
        "Distance: " + format(Math.abs(view.public.rollInDisplacement && view.public.rollInDisplacement.forwardNm), 1) + " nm",
        "top-roll-in-longitudinal", { x: 875, y: 490, anchor: "end" });
    }
    enableLabelDrag(svg);
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
      if (typeof svg.createSVGPoint !== "function") return { x: event.clientX, y: event.clientY };
      var point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      var matrix = svg.getScreenCTM();
      return matrix ? point.matrixTransform(matrix.inverse()) : point;
    }

    svg.addEventListener("pointerdown", function (event) {
      var target = event.target.closest && event.target.closest(".movable-label");
      if (!target || !svg.contains(target)) return;
      if (event.preventDefault) event.preventDefault();
      var start = pointFromEvent(event);
      var items = nodesFor(target).map(function (item) {
        return { item: item, transform: item.getAttribute("transform") || "" };
      });
      var hold = {
        pointerId: event.pointerId,
        start: start,
        items: items,
        timer: null
      };
      hold.timer = global.setTimeout(function () {
          if (pending !== hold) return;
          active = hold;
          pending = null;
          active.items.forEach(function (entry) { entry.item.classList.add("dragging"); });
        }, 500);
      pending = hold;
      if (typeof svg.setPointerCapture === "function") {
        try { svg.setPointerCapture(event.pointerId); } catch (error) { /* pointer stream may already be ending */ }
      }
    });

    svg.addEventListener("pointermove", function (event) {
      if ((pending && event.pointerId === pending.pointerId) || (active && event.pointerId === active.pointerId)) {
        if (event.preventDefault) event.preventDefault();
      }
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
      if (typeof svg.releasePointerCapture === "function") {
        try { svg.releasePointerCapture(event.pointerId); } catch (error) { /* capture may already be released */ }
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
