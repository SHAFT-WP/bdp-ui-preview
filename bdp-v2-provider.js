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

  function absoluteHeading(value) {
    var number = finite(value, "Attack Heading");
    if (number < 0 || number > 360) throw new Error("Attack Heading must be between 0 and 360 deg");
    return number;
  }

  function toCoreInput(input) {
    return {
      weaponId: input.weaponId,
      targetElevationMslFt: finite(input.targetElevationMslFt, "Target Elevation"),
      attackHeadingDeg: absoluteHeading(input.attackHeadingDeg),
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
      levelMapNm: finite(input.levelMapNm === undefined ? 5 : input.levelMapNm, "Level MAP"),
      levelTurnEnabled: Boolean(input.levelTurnEnabled),
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
    var plot = { left: 80, right: 830, top: 95, bottom: 390 };
    var trackAglFt = result.trackPointAltitudeMslFt - input.targetElevationMslFt;
    var releaseAglFt = result.effectiveReleaseAltitudeMslFt - input.targetElevationMslFt;
    var trackingFt = result.downRangeTravelNm * FTNM;
    var groundRangeFt = result.groundRangeNm * FTNM;
    var bombRangeFt = result.bombRangeNm * FTNM;
    var aimOffDistanceFt = Number.isFinite(local.aimOffDistanceNm) ? local.aimOffDistanceNm * FTNM : 0;
    var aimOffRangeFt = groundRangeFt + aimOffDistanceFt;
    var maxDistanceFt = Math.max(groundRangeFt, aimOffRangeFt, trackingFt + bombRangeFt, 1);
    var maxAltitudeFt = Math.max(trackAglFt, releaseAglFt, 1);
    var horizontalScale = (plot.right - plot.left) / maxDistanceFt;
    var verticalScale = (plot.bottom - plot.top) / maxAltitudeFt;
    var groundY = plot.bottom;
    var x = function (distanceFt) { return plot.left + distanceFt * horizontalScale; };
    var y = function (altitudeAglFt) { return groundY - altitudeAglFt * verticalScale; };
    var trackPoint = { x: x(0), y: y(trackAglFt) };
    var release = { x: x(trackingFt), y: y(releaseAglFt) };
    var target = { x: x(groundRangeFt), y: groundY };
    var aimOff = { x: x(aimOffRangeFt), y: groundY };
    var bombSamples = raw.visualization.bombTrajectorySamples || [];

    return {
      points: {
        trackPoint: trackPoint,
        release: release,
        target: target,
        aimOff: aimOff
      },
      flightPath: [trackPoint, release],
      flightPathReference: [trackPoint, aimOff],
      targetLineOfSight: [trackPoint, target],
      bombPath: bombSamples.map(function (sample) {
        return {
          x: x(trackingFt + sample.downRangeNm * FTNM),
          y: y(sample.altitudeAglFt)
        };
      })
    };
  }

  function buildTopGeometry(raw) {
    var semantic = raw.visualization.semanticState;
    var stations = semantic.stations;
    var localRollInStart = { x: stations.rollInStart.forwardNm, y: stations.rollInStart.turnSideNm };
    var localTrackPoint = { x: stations.trackPoint.forwardNm, y: stations.trackPoint.turnSideNm };
    var localTarget = { x: stations.target.forwardNm, y: stations.target.turnSideNm };
    var localAimOff = stations.aimOffPoint
      ? { x: stations.aimOffPoint.forwardNm, y: stations.aimOffPoint.turnSideNm }
      : localTarget;
    var groundRangeNm = raw.public.groundRangeNm;
    var localIngress = {
      x: localRollInStart.x - Math.max(groundRangeNm * 1.5, 1),
      y: localRollInStart.y
    };
    var localRollPath = (semantic.paths.rollIn || []).map(function (point) {
      return { x: point.forwardNm, y: point.turnSideNm };
    });

    var attackVector = {
      x: localTarget.x - localTrackPoint.x,
      y: localTarget.y - localTrackPoint.y
    };
    var localAttackAngle = Math.atan2(attackVector.y, attackVector.x);
    var attackHeadingDeg = absoluteHeading(raw.canonicalInputs.attackHeadingDeg);
    var northUpAttackAngle = (90 - attackHeadingDeg) * Math.PI / 180;
    var rotation = northUpAttackAngle - localAttackAngle;
    var cosRotation = Math.cos(rotation);
    var sinRotation = Math.sin(rotation);
    var rotate = function (source) {
      var dx = source.x - localRollInStart.x;
      var dy = source.y - localRollInStart.y;
      return {
        x: localRollInStart.x + dx * cosRotation - dy * sinRotation,
        y: localRollInStart.y + dx * sinRotation + dy * cosRotation
      };
    };

    var forwardSign = localTarget.x >= localRollInStart.x ? 1 : -1;
    var sideSign = localTarget.y >= localRollInStart.y ? 1 : -1;
    var dimensionGap = Math.max(groundRangeNm * 0.12, 0.18);
    var farForward = forwardSign > 0
      ? Math.max(localTarget.x, localTrackPoint.x) + dimensionGap * 2
      : Math.min(localTarget.x, localTrackPoint.x) - dimensionGap * 2;
    var nearForward = forwardSign > 0
      ? Math.max(localTrackPoint.x, localRollInStart.x) + dimensionGap
      : Math.min(localTrackPoint.x, localRollInStart.x) - dimensionGap;
    var outsideSide = sideSign > 0
      ? Math.min(localRollInStart.y, localTrackPoint.y) - dimensionGap
      : Math.max(localRollInStart.y, localTrackPoint.y) + dimensionGap;
    var localTargetFoot = { x: localTarget.x, y: localRollInStart.y };
    var localTrackFoot = { x: localTrackPoint.x, y: localRollInStart.y };
    var localDimensions = {
      baseDistance: {
        start: { x: farForward, y: localRollInStart.y },
        end: { x: farForward, y: localTarget.y },
        guides: [
          { start: localTargetFoot, end: { x: farForward, y: localRollInStart.y } },
          { start: localTarget, end: { x: farForward, y: localTarget.y } }
        ]
      },
      rollInLateralDistance: {
        start: { x: nearForward, y: localRollInStart.y },
        end: { x: nearForward, y: localTrackPoint.y },
        guides: [
          { start: localRollInStart, end: { x: nearForward, y: localRollInStart.y } },
          { start: localTrackPoint, end: { x: nearForward, y: localTrackPoint.y } }
        ]
      },
      rollInLongitudinalDistance: {
        start: { x: localRollInStart.x, y: outsideSide },
        end: { x: localTrackPoint.x, y: outsideSide },
        guides: [
          { start: localRollInStart, end: { x: localRollInStart.x, y: outsideSide } },
          { start: localTrackFoot, end: { x: localTrackPoint.x, y: outsideSide } }
        ]
      }
    };

    var rollInStart = rotate(localRollInStart);
    var trackPoint = rotate(localTrackPoint);
    var target = rotate(localTarget);
    var aimOff = rotate(localAimOff);
    var ingress = rotate(localIngress);
    var rollPath = localRollPath.map(rotate);
    var rotatedDimensions = {};
    Object.keys(localDimensions).forEach(function (key) {
      var dimension = localDimensions[key];
      rotatedDimensions[key] = {
        start: rotate(dimension.start),
        end: rotate(dimension.end),
        guides: dimension.guides.map(function (guide) {
          return { start: rotate(guide.start), end: rotate(guide.end) };
        })
      };
    });
    var dimensionFocus = [];
    Object.keys(rotatedDimensions).forEach(function (key) {
      var dimension = rotatedDimensions[key];
      dimensionFocus.push(dimension.start, dimension.end);
      dimension.guides.forEach(function (guide) { dimensionFocus.push(guide.start, guide.end); });
    });
    var focus = [ingress, rollInStart, trackPoint, target, aimOff].concat(rollPath, dimensionFocus);
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
    var plot = { left: 85, right: 620, top: 125, bottom: 550 };
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

    var mapSegment = function (segment) {
      return {
        start: point(segment.start),
        end: point(segment.end),
        guides: segment.guides.map(function (guide) {
          return { start: point(guide.start), end: point(guide.end) };
        })
      };
    };

    return {
      northUp: true,
      attackHeadingDeg: attackHeadingDeg,
      points: {
        initial: point(ingress),
        rollInStart: point(rollInStart),
        trackPoint: point(trackPoint),
        target: point(target),
        aimOff: point(aimOff)
      },
      rollPath: rollPath.map(point),
      groundRangeRadiusPx: groundRangeNm * scale,
      dimensions: {
        baseDistance: mapSegment(rotatedDimensions.baseDistance),
        rollInLateralDistance: mapSegment(rotatedDimensions.rollInLateralDistance),
        rollInLongitudinalDistance: mapSegment(rotatedDimensions.rollInLongitudinalDistance)
      }
    };
  }

  function toViewModel(raw, uiInput) {
    var targetElevationMslFt = raw.canonicalInputs.targetElevationMslFt;
    var initialAglFt = raw.public.resolvedInitialAltitudeMslFt - targetElevationMslFt;
    var rollInSlantNm = Math.hypot(initialAglFt / FTNM, raw.public.rollInRangeNm);
    var baseDistanceSlantNm = Math.hypot(initialAglFt / FTNM, raw.public.rollInLateralSeparationNm);
    var publicResult = Object.assign({}, raw.public, {
      safetyReleaseMslFt: raw.public.nltReleaseMslFt,
      releaseSpeedKcas: raw.canonicalInputs.releaseSpeedKcas
    });
    var localResult = Object.assign({}, raw.local, {
      rollInSlantNm: rollInSlantNm,
      baseDistanceSlantNm: baseDistanceSlantNm
    });

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
