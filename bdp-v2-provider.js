(function (global) {
  "use strict";

  var FTNM = 6076.11549;
  var MPS_PER_KT = 0.5144444444444445;

  if (!global.BDPUI) throw new Error("BDP UI adapter must load before the V2 provider");
  if (!global.BDPV2Core) throw new Error("BDP V2 core must load before the V2 provider");

  function finite(value, name) {
    var number = Number(value);
    if (!Number.isFinite(number)) throw new Error(name + " must be a number");
    return number;
  }

  function toCoreInput(input) {
    return {
      weaponId: input.weaponId,
      targetElevationMslFt: finite(input.targetElevationMslFt, "Target Elevation"),
      releaseSpeedKcas: finite(input.releaseSpeedKcas, "Release Speed"),
      speedOvershootKcas: finite(input.speedOvershootKcas, "Speed Overshoot"),
      maneuverInitiationDelaySec: 0,
      recoveryG: 5,
      gOnsetTimeSec: finite(input.gOnsetTimeSec, "G Onset Time"),
      fragmentHeightMarginPercent: finite(input.fragmentHeightMarginPercent, "Fragment Height Margin"),
      diveAngleDeg: finite(input.diveAngleDeg, "Dive Angle"),
      releaseFpaDeg: -finite(input.diveAngleDeg, "Dive Angle"),
      windDirectionDeg: finite(input.windDirectionDeg, "Wind Direction"),
      windSpeedMps: finite(input.windSpeedKt, "Wind Speed") * MPS_PER_KT,
      initialSpeedValue: finite(input.initialSpeedValue, "Initial Speed"),
      initialSpeedMode: input.initialSpeedMode,
      initialAltitudeMslFt: finite(input.rollInStartAltitudeMslFt, "Roll-in Start Altitude"),
      solveMode: input.solveMode === "trackingTime" ? "time" : "height",
      trackingTimeSec: finite(input.trackingTimeSec, "Tracking Time"),
      releaseAltitudeMslFt: finite(input.releaseAltitudeMslFt, "Release Altitude"),
      angleOffDeg: finite(input.angleOffDeg, "Angle-off"),
      rollInBankAngleDeg: finite(input.rollInBankAngleDeg, "Roll-in Bank Angle"),
      rollInG: finite(input.rollInG, "Roll-in Bank G")
    };
  }

  function buildProfileGeometry(raw) {
    var result = raw.public;
    var local = raw.local;
    var input = raw.canonicalInputs;
    var plot = { left: 105, right: 825, top: 80, bottom: 535 };
    var trackAglFt = result.trackPointAltitudeMslFt - input.targetElevationMslFt;
    var releaseAglFt = result.effectiveReleaseAltitudeMslFt - input.targetElevationMslFt;
    var trackingNm = result.downRangeTravelNm;
    var groundRangeNm = result.groundRangeNm;
    var aimOffDistanceNm = Number.isFinite(local.aimOffDistanceNm) ? local.aimOffDistanceNm : 0;
    var aimOffRangeNm = groundRangeNm + aimOffDistanceNm;
    var maxDistanceNm = Math.max(groundRangeNm, aimOffRangeNm, trackingNm + result.bombRangeNm, 0.001);
    var maxAltitudeFt = Math.max(trackAglFt, releaseAglFt, 1);
    var scale = Math.min(
      (plot.right - plot.left) / maxDistanceNm,
      (plot.bottom - plot.top) / maxAltitudeFt
    );
    var usedWidth = maxDistanceNm * scale;
    var usedHeight = maxAltitudeFt * scale;
    var originX = plot.left + ((plot.right - plot.left) - usedWidth) / 2;
    var groundY = plot.top + usedHeight;
    var x = function (distanceNm) { return originX + distanceNm * scale; };
    var y = function (altitudeAglFt) { return groundY - altitudeAglFt * scale; };
    var trackPoint = { x: x(0), y: y(trackAglFt) };
    var release = { x: x(trackingNm), y: y(releaseAglFt) };
    var target = { x: x(groundRangeNm), y: groundY };
    var aimOff = { x: x(aimOffRangeNm), y: groundY };
    var bombSamples = raw.visualization.bombTrajectorySamples || [];

    return {
      points: {
        trackPoint: trackPoint,
        release: release,
        target: target,
        aimOff: aimOff
      },
      flightPath: [trackPoint, release],
      bombPath: bombSamples.map(function (sample) {
        return {
          x: x(trackingNm + sample.downRangeNm),
          y: y(sample.altitudeAglFt)
        };
      })
    };
  }

  function buildTopGeometry(raw) {
    var semantic = raw.visualization.semanticState;
    var stations = semantic.stations;
    var rollInStart = { x: stations.rollInStart.forwardNm, y: stations.rollInStart.turnSideNm };
    var trackPoint = { x: stations.trackPoint.forwardNm, y: stations.trackPoint.turnSideNm };
    var target = { x: stations.target.forwardNm, y: stations.target.turnSideNm };
    var aimOff = stations.aimOffPoint
      ? { x: stations.aimOffPoint.forwardNm, y: stations.aimOffPoint.turnSideNm }
      : target;
    var groundRangeNm = raw.public.groundRangeNm;
    var ingress = {
      x: rollInStart.x - Math.max(groundRangeNm * 1.5, 1),
      y: rollInStart.y
    };
    var rollPath = (semantic.paths.rollIn || []).map(function (point) {
      return { x: point.forwardNm, y: point.turnSideNm };
    });
    var focus = [ingress, rollInStart, trackPoint, target, aimOff].concat(rollPath);
    var xs = focus.map(function (point) { return point.x; });
    var ys = focus.map(function (point) { return point.y; });
    var rawMinX = Math.min.apply(Math, xs);
    var rawMaxX = Math.max.apply(Math, xs);
    var rawMinY = Math.min.apply(Math, ys);
    var rawMaxY = Math.max.apply(Math, ys);
    var spanSum = (rawMaxX - rawMinX) + (rawMaxY - rawMinY);
    var padding = Math.max(groundRangeNm * 0.14, spanSum * 0.045, 0.15);
    var minX = rawMinX - padding;
    var maxX = rawMaxX + padding;
    var minY = rawMinY - padding;
    var maxY = rawMaxY + padding;
    var plot = { left: 35, right: 745, top: 35, bottom: 585 };
    var scale = Math.min(
      (plot.right - plot.left) / Math.max(0.001, maxX - minX),
      (plot.bottom - plot.top) / Math.max(0.001, maxY - minY)
    );
    var usedWidth = (maxX - minX) * scale;
    var usedHeight = (maxY - minY) * scale;
    var scaledLeft = plot.left + (plot.right - plot.left - usedWidth) / 2;
    var scaledTop = plot.top + (plot.bottom - plot.top - usedHeight) / 2;
    var point = function (source) {
      return {
        x: scaledLeft + (source.x - minX) * scale,
        y: scaledTop + (maxY - source.y) * scale
      };
    };

    return {
      points: {
        initial: point(ingress),
        rollInStart: point(rollInStart),
        trackPoint: point(trackPoint),
        target: point(target),
        aimOff: point(aimOff)
      },
      rollPath: rollPath.map(point),
      groundRangeRadiusPx: groundRangeNm * scale,
      dimensionNearX: 810,
      dimensionFarX: 866
    };
  }

  function toViewModel(raw, uiInput) {
    var targetElevationMslFt = raw.canonicalInputs.targetElevationMslFt;
    var initialAglFt = raw.public.resolvedInitialAltitudeMslFt - targetElevationMslFt;
    var rollInSlantNm = Math.hypot(initialAglFt / FTNM, raw.public.rollInRangeNm);
    var publicResult = Object.assign({}, raw.public, {
      safetyReleaseMslFt: raw.public.nltReleaseMslFt,
      releaseSpeedKcas: raw.canonicalInputs.releaseSpeedKcas
    });
    var localResult = Object.assign({}, raw.local, { rollInSlantNm: rollInSlantNm });

    return {
      profileTitle: global.BDPV2Core.profileTitle(raw),
      input: Object.assign({}, uiInput, {
        highDragWeapon: /^B/.test(raw.canonicalInputs.weaponId || ""),
        recoveryG: raw.canonicalInputs.recoveryG
      }),
      public: publicResult,
      local: localResult,
      safety: {
        releaseLabel: "NLT Release",
        applicability: raw.safety.applicability
      },
      model: raw.model,
      diagnostics: raw.diagnostics,
      provenance: {
        sourceArtifact: global.BDPV2Core.sourceArtifact,
        sourceSha256: global.BDPV2Core.sourceSha256
      },
      visualization: Object.assign({}, raw.visualization, {
        profile: buildProfileGeometry(raw),
        top: buildTopGeometry(raw)
      })
    };
  }

  global.BDPUI.connectProvider({
    id: "bdp-v2-common-ui-provider",
    label: "V2 core connected · UI Preview",
    notice: "Common UI Preview V2 shell에 BDP 계산 Provider를 연결한 Work 버전이다.",
    calculate: function (input) {
      return global.BDPV2Core.calculate(toCoreInput(input));
    },
    toViewModel: toViewModel
  });
})(window);
