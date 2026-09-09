(function (global) {
  "use strict";

  /*
   * Calculation-only extraction from:
   * BDP_V2_REV1.9_ORACLE_FIDELITY_MOBILE_WORK_FIX7-1.html
   * SHA-256: 82ed448c1cf63ed92c016597a726a37e162b023444921782fa4ed7810b545a20
   *
   * The Common UI Preview adapter adds a configurable Fragment Height Margin;
   * its 20% default remains numerically identical to the FIX7 source.
   *
   * No DOM, storage, event, or graph code belongs in this file.
   */

  var FTNM = 6076.11549;
  var G = 32.174;
  var KTFPS = 1.687809857;

  var WEAPONS = Object.freeze([
    Object.freeze({ id: "M82", name: "Mk-82 (LD)", drag: 0.165, fragAlt0: 2140, fragAlt5: 2500, fragRange0: 2550, fragRange5: 2900, fragTime0: 24.4, fragTime5: 25.9 }),
    Object.freeze({ id: "B49", name: "Mk-82 AIR (HD)", drag: 1, fragAlt0: 2140, fragAlt5: 2500, fragRange0: 2550, fragRange5: 2900, fragTime0: 24.4, fragTime5: 25.9 }),
    Object.freeze({ id: "M83", name: "Mk-83 (LD)", drag: 0.165, fragAlt0: 2455, fragAlt5: 2825, fragRange0: 2905, fragRange5: 3307.5, fragTime0: 26.2, fragTime5: 27.8 }),
    Object.freeze({ id: "B85", name: "Mk-83 AIR (HD)", drag: 1, fragAlt0: 2455, fragAlt5: 2825, fragRange0: 2905, fragRange5: 3307.5, fragTime0: 26.2, fragTime5: 27.8 }),
    Object.freeze({ id: "M84", name: "Mk-84 (LD)", drag: 0.165, fragAlt0: 2770, fragAlt5: 3150, fragRange0: 3260, fragRange5: 3715, fragTime0: 28, fragTime5: 29.7 }),
    Object.freeze({ id: "B50", name: "Mk-84 AIR (HD)", drag: 1, fragAlt0: 2770, fragAlt5: 3150, fragRange0: 3260, fragRange5: 3715, fragTime0: 28, fragTime5: 29.7 })
  ]);

  function weapon(id) {
    var found = WEAPONS.find(function (item) { return item.id === id; });
    if (!found) throw new Error("Unknown weapon");
    return found;
  }

  function atmosphere(altitudeFt) {
    var altitudeM = Math.max(-1000, altitudeFt) * 0.3048;
    var temperature;
    var pressure;
    if (altitudeM <= 11000) {
      temperature = 288.15 - 0.0065 * altitudeM;
      pressure = 101325 * Math.pow(temperature / 288.15, 5.2558798127);
    } else {
      temperature = 216.65;
      pressure = 22632.06 * Math.exp((-9.80665 * (altitudeM - 11000)) / (287.05287 * temperature));
    }
    return {
      pressure: pressure,
      speedOfSoundKt: Math.sqrt(1.4 * 287.05287 * temperature) * 1.943844492
    };
  }

  function casToTas(casKt, altitudeFt) {
    var atm = atmosphere(altitudeFt);
    var seaLevelMach = casKt / 661.4788;
    var dynamicPressure = 101325 * (Math.pow(1 + 0.2 * seaLevelMach * seaLevelMach, 3.5) - 1);
    var mach = Math.sqrt(5 * (Math.pow(dynamicPressure / atm.pressure + 1, 2 / 7) - 1));
    return mach * atm.speedOfSoundKt;
  }

  function tasToCas(tasKt, altitudeFt) {
    var atm = atmosphere(altitudeFt);
    var mach = tasKt / atm.speedOfSoundKt;
    var dynamicPressure = atm.pressure * (Math.pow(1 + 0.2 * mach * mach, 3.5) - 1);
    var seaLevelMach = Math.sqrt(5 * (Math.pow(dynamicPressure / 101325 + 1, 2 / 7) - 1));
    return seaLevelMach * 661.4788;
  }

  function machToTas(mach, altitudeFt) {
    return mach * atmosphere(altitudeFt).speedOfSoundKt;
  }

  function onsetLoad(baseLoad, targetLoad, totalSec, elapsedSec) {
    var fraction = Math.max(0, Math.min(1, elapsedSec / totalSec));
    return baseLoad + (targetLoad - baseLoad) * fraction;
  }

  function recovery(input) {
    var state = {
      timeSec: 0,
      horizontalFt: 0,
      altitudeMslFt: input.startAltitudeMslFt,
      minimumAltitudeMslFt: input.startAltitudeMslFt,
      speedFps: casToTas(input.startSpeedKcas, input.startAltitudeMslFt) * KTFPS,
      fpaRad: input.startFpaDeg * Math.PI / 180
    };
    var targetFpaRad = input.targetFpaDeg * Math.PI / 180;
    var fixedStepSec = 0.01;
    var baseLoad = Math.cos(state.fpaRad);

    function step(load, dt) {
      var speedRate = -G * Math.sin(state.fpaRad);
      var fpaRate = G / state.speedFps * (load - Math.cos(state.fpaRad));
      var midpointSpeed = Math.max(80, state.speedFps + speedRate * dt / 2);
      var midpointFpa = state.fpaRad + fpaRate * dt / 2;
      var midpointSpeedRate = -G * Math.sin(midpointFpa);
      var midpointFpaRate = G / midpointSpeed * (load - Math.cos(midpointFpa));

      state.speedFps = Math.max(80, state.speedFps + midpointSpeedRate * dt);
      state.fpaRad += midpointFpaRate * dt;
      state.horizontalFt += midpointSpeed * Math.cos(midpointFpa) * dt;
      state.altitudeMslFt += midpointSpeed * Math.sin(midpointFpa) * dt;
      state.timeSec += dt;
      state.minimumAltitudeMslFt = Math.min(state.minimumAltitudeMslFt, state.altitudeMslFt);
    }

    var delayElapsed = 0;
    while (delayElapsed < input.maneuverInitiationDelaySec - 1e-12) {
      var delayStep = Math.min(fixedStepSec, input.maneuverInitiationDelaySec - delayElapsed);
      step(baseLoad, delayStep);
      delayElapsed += delayStep;
    }

    var onsetElapsed = 0;
    while (state.fpaRad < targetFpaRad && onsetElapsed < input.gOnsetTimeSec - 1e-12) {
      var onsetStep = Math.min(fixedStepSec, input.gOnsetTimeSec - onsetElapsed);
      step(onsetLoad(baseLoad, input.recoveryG, input.gOnsetTimeSec, onsetElapsed + onsetStep / 2), onsetStep);
      onsetElapsed += onsetStep;
    }

    var guard = 0;
    while (state.fpaRad < targetFpaRad && guard++ < 60000) step(input.recoveryG, fixedStepSec);

    return {
      minAltitudeMslFt: state.minimumAltitudeMslFt,
      elapsedTimeSec: state.timeSec,
      horizontalDistanceNm: state.horizontalFt / FTNM
    };
  }

  function fragmentData(selectedWeapon, targetElevationMslFt) {
    var ratio = targetElevationMslFt / 5000;
    var lerp = function (low, high) { return low + (high - low) * ratio; };
    return {
      altitudeFt: lerp(selectedWeapon.fragAlt0, selectedWeapon.fragAlt5),
      rangeFt: lerp(selectedWeapon.fragRange0, selectedWeapon.fragRange5),
      timeSec: lerp(selectedWeapon.fragTime0, selectedWeapon.fragTime5)
    };
  }

  function semSafety(input) {
    var fragment = fragmentData(input.weapon, input.targetElevationMslFt);
    var fragmentMarginFactor = 1 + input.fragmentHeightMarginPercent / 100;
    var minAltMslFt = input.targetElevationMslFt + fragment.altitudeFt * fragmentMarginFactor;
    var recoverySpeedKcas = input.releaseSpeedKcas + input.speedOvershootKcas;

    if (Math.abs(input.releaseFpaDeg) < 1e-12) {
      return { minAltMslFt: minAltMslFt, nltReleaseMslFt: minAltMslFt };
    }

    function evaluate(startAltitudeMslFt) {
      var result = recovery({
        startAltitudeMslFt: startAltitudeMslFt,
        startSpeedKcas: recoverySpeedKcas,
        startFpaDeg: input.releaseFpaDeg,
        targetFpaDeg: 0,
        recoveryG: input.recoveryG,
        gOnsetTimeSec: input.gOnsetTimeSec,
        maneuverInitiationDelaySec: input.maneuverInitiationDelaySec
      });
      return { result: result, residual: result.minAltitudeMslFt - minAltMslFt };
    }

    var low = minAltMslFt;
    var high = minAltMslFt + 2000;
    var evaluation = evaluate(high);
    var expansion;
    for (expansion = 0; evaluation.residual < 0 && expansion < 20; expansion += 1) {
      high += Math.max(2000, (high - minAltMslFt) * 0.75);
      evaluation = evaluate(high);
    }
    var iteration;
    for (iteration = 0; iteration < 48; iteration += 1) {
      var middle = (low + high) / 2;
      var middleEvaluation = evaluate(middle);
      if (middleEvaluation.residual >= 0) {
        high = middle;
        evaluation = middleEvaluation;
      } else {
        low = middle;
      }
    }
    return { minAltMslFt: minAltMslFt, nltReleaseMslFt: Math.max(minAltMslFt, high) };
  }

  function bombTrajectory(profile, selectedWeapon, releaseTasKt) {
    var config = {
      stepSec: 0.01,
      maxSteps: 18002,
      sampleSec: 0.1,
      dragFps2: 160,
      lowDragScale: 0.2,
      highDragScale: 0.88,
      highDragVerticalG: 0.65,
      dragDelaySec: 1
    };
    var angleRad = profile.diveAngleDeg * Math.PI / 180;
    var speedFps = releaseTasKt * KTFPS;
    var drag = selectedWeapon.drag < 1 ? selectedWeapon.drag * config.lowDragScale : config.highDragScale;
    var highDrag = selectedWeapon.drag >= 1;
    var windAngleRad = profile.windDirectionDeg * Math.PI / 180;
    var windFps = profile.windSpeedMps * 3.280839895;
    var alongWindFps = -windFps * Math.cos(windAngleRad);
    var state = {
      timeSec: 0,
      xFt: 0,
      downFt: 0,
      horizontalSpeedFps: speedFps * Math.cos(angleRad),
      downSpeedFps: speedFps * Math.sin(angleRad)
    };
    var samples = [{ xFt: 0, altitudeAglFt: profile.releaseAglFt }];
    var nextSampleSec = config.sampleSec;
    var stepIndex;

    for (stepIndex = 0; stepIndex < config.maxSteps; stepIndex += 1) {
      var old = Object.assign({}, state);
      var nextTimeSec = state.timeSec + config.stepSec;
      var nextHorizontalSpeedFps = state.horizontalSpeedFps;
      var nextDownSpeedFps = state.downSpeedFps;
      if (nextTimeSec <= config.dragDelaySec + 1e-12) {
        nextDownSpeedFps += G * config.stepSec;
      } else {
        nextHorizontalSpeedFps = Math.max(0, state.horizontalSpeedFps - drag * config.dragFps2 * config.stepSec);
        nextDownSpeedFps += G * (highDrag ? config.highDragVerticalG : 1) * config.stepSec;
      }
      state = {
        timeSec: nextTimeSec,
        xFt: state.xFt + (state.horizontalSpeedFps + alongWindFps) * config.stepSec,
        downFt: state.downFt + state.downSpeedFps * config.stepSec,
        horizontalSpeedFps: nextHorizontalSpeedFps,
        downSpeedFps: nextDownSpeedFps
      };

      if (state.downFt >= profile.releaseAglFt) {
        var fraction = (profile.releaseAglFt - old.downFt) / (state.downFt - old.downFt || 1);
        fraction = Math.max(0, Math.min(1, fraction));
        var impactXFt = old.xFt + (state.xFt - old.xFt) * fraction;
        var impactTimeSec = old.timeSec + (state.timeSec - old.timeSec) * fraction;
        samples.push({ xFt: impactXFt, altitudeAglFt: 0 });
        var level = Math.abs(profile.diveAngleDeg) < 1e-9;
        var lineOfSightRangeFt = level ? null : profile.releaseAglFt / Math.tan(angleRad);
        return {
          modelId: "bms-4.38-acmi-v1",
          modelVersion: "1.0.0",
          bombRangeFt: impactXFt,
          bombTofSec: impactTimeSec,
          aimOffDistanceFt: level ? null : lineOfSightRangeFt - impactXFt,
          samples: samples
        };
      }

      if (state.timeSec >= nextSampleSec) {
        samples.push({ xFt: state.xFt, altitudeAglFt: Math.max(0, profile.releaseAglFt - state.downFt) });
        nextSampleSec += config.sampleSec;
      }
    }
    throw new Error("Bomb impact integration limit");
  }

  function rollIn(profile, initialAltitudeMslFt) {
    var bankRad = profile.rollInBankAngleDeg * Math.PI / 180;
    var headingChangeRad = profile.angleOffDeg * Math.PI / 180;
    var diveRad = profile.diveAngleDeg * Math.PI / 180;
    var level = Math.abs(profile.diveAngleDeg) < 1e-9;
    var initialSpeedFps = (profile.initialSpeedMode === "MACH"
      ? machToTas(profile.initialSpeedValue, initialAltitudeMslFt)
      : casToTas(profile.initialSpeedValue, initialAltitudeMslFt)) * KTFPS;
    var speedFps = initialSpeedFps;
    var fpaRad = 0;
    var headingRad = 0;
    var timeSec = 0;
    var rawSamples = [{ timeSec: 0, diveRad: 0, headingRad: 0 }];

    function rates(speed, fpa) {
      var cosine = Math.max(0.08, Math.cos(fpa));
      return {
        speedRate: -G * Math.sin(fpa),
        fpaRate: G / speed * (profile.rollInG * Math.cos(bankRad) - Math.cos(fpa)),
        headingRate: G * profile.rollInG * Math.abs(Math.sin(bankRad)) / (speed * cosine)
      };
    }

    var stepIndex;
    for (stepIndex = 0; stepIndex < 24000 && headingRad < headingChangeRad - 1e-10; stepIndex += 1) {
      var startRates = rates(speedFps, fpaRad);
      var dt = Math.min(0.01, (headingChangeRad - headingRad) / startRates.headingRate);
      var midpointSpeed = speedFps + startRates.speedRate * dt / 2;
      var midpointFpa = fpaRad + startRates.fpaRate * dt / 2;
      var midpointRates = rates(midpointSpeed, midpointFpa);
      dt = Math.min(dt, (headingChangeRad - headingRad) / midpointRates.headingRate);
      speedFps += midpointRates.speedRate * dt;
      fpaRad += midpointRates.fpaRate * dt;
      headingRad = Math.min(headingChangeRad, headingRad + midpointRates.headingRate * dt);
      timeSec += dt;
      rawSamples.push({ timeSec: timeSec, diveRad: Math.max(0, -fpaRad), headingRad: headingRad });
    }

    var rawFinalDive = rawSamples[rawSamples.length - 1].diveRad;
    var diveScale = level ? 0 : diveRad / rawFinalDive;
    var integratedSpeedFps = initialSpeedFps;
    var altitudeLossFt = 0;
    var groundArcFt = 0;
    var forwardFt = 0;
    var turnSideFt = 0;
    var samples = [{ groundArcFt: 0, altitudeLossFt: 0, forwardFt: 0, turnSideFt: 0, headingChangeRad: 0 }];
    var nextSampleSec = 0.1;
    var sampleIndex;

    for (sampleIndex = 1; sampleIndex < rawSamples.length; sampleIndex += 1) {
      var prior = rawSamples[sampleIndex - 1];
      var current = rawSamples[sampleIndex];
      var priorDive = prior.diveRad * diveScale;
      var currentDive = current.diveRad * diveScale;
      var midpointDive = (priorDive + currentDive) / 2;
      var midpointHeading = (prior.headingRad + current.headingRad) / 2;
      var sampleDt = current.timeSec - prior.timeSec;
      var accelerationFps2 = G * Math.sin(midpointDive);
      var sampleMidpointSpeed = integratedSpeedFps + accelerationFps2 * sampleDt / 2;
      integratedSpeedFps += accelerationFps2 * sampleDt;
      var segmentFt = sampleMidpointSpeed * Math.cos(midpointDive) * sampleDt;
      groundArcFt += segmentFt;
      forwardFt += segmentFt * Math.cos(midpointHeading);
      turnSideFt += segmentFt * Math.sin(midpointHeading);
      altitudeLossFt += sampleMidpointSpeed * Math.sin(midpointDive) * sampleDt;
      if (sampleIndex === rawSamples.length - 1 || current.timeSec >= nextSampleSec - 1e-9) {
        samples.push({
          groundArcFt: groundArcFt,
          altitudeLossFt: altitudeLossFt,
          forwardFt: forwardFt,
          turnSideFt: turnSideFt,
          headingChangeRad: current.headingRad
        });
        nextSampleSec += 0.1;
      }
    }

    return {
      initialTasKt: initialSpeedFps / KTFPS,
      finalTasKt: integratedSpeedFps / KTFPS,
      rollInTimeSec: timeSec,
      displacementForwardFt: forwardFt,
      displacementTurnSideFt: turnSideFt,
      altitudeLossFt: altitudeLossFt,
      groundArcFt: groundArcFt,
      equivalentRadiusFt: groundArcFt / headingChangeRad,
      samples: samples
    };
  }

  function geometry(input, bomb, effectiveReleaseAltitudeMslFt) {
    var diveRad = input.diveAngleDeg * Math.PI / 180;
    var level = Math.abs(input.diveAngleDeg) < 1e-9;
    var releaseAglFt = effectiveReleaseAltitudeMslFt - input.targetElevationMslFt;
    var releaseTasKt = casToTas(input.releaseSpeedKcas, effectiveReleaseAltitudeMslFt);
    var initialAglFt;
    var initialMslFt;
    var trackAglFt;
    var trackingPathFt;
    var trackingTimeSec;
    var requestedLevelMapNm = Number(input.levelMapNm);
    var roll;
    var rollProfile = {
      initialSpeedValue: input.initialSpeedValue,
      initialSpeedMode: input.initialSpeedMode,
      diveAngleDeg: input.diveAngleDeg,
      angleOffDeg: input.angleOffDeg,
      rollInBankAngleDeg: input.rollInBankAngleDeg,
      rollInG: input.rollInG
    };
    var iteration;

    if (level) {
      initialAglFt = releaseAglFt;
      for (iteration = 0; iteration < 12; iteration += 1) {
        initialMslFt = input.targetElevationMslFt + initialAglFt;
        roll = rollIn(rollProfile, initialMslFt);
        initialAglFt = releaseAglFt + roll.altitudeLossFt;
      }
      initialMslFt = input.targetElevationMslFt + initialAglFt;
      roll = rollIn(rollProfile, initialMslFt);
      trackAglFt = initialAglFt - roll.altitudeLossFt;
      var levelTrackingSpeedFps = ((roll.finalTasKt + releaseTasKt) / 2) * KTFPS;
      if (Number.isFinite(requestedLevelMapNm)) {
        trackingPathFt = requestedLevelMapNm * FTNM - bomb.bombRangeFt;
        if (trackingPathFt < 0) {
          throw new Error("Level MAP must be at least the computed Bomb Range");
        }
        trackingTimeSec = trackingPathFt / levelTrackingSpeedFps;
      } else {
        trackingTimeSec = input.trackingTimeSec;
        trackingPathFt = levelTrackingSpeedFps * trackingTimeSec;
      }
    } else if (input.solveMode === "height") {
      initialMslFt = input.initialAltitudeMslFt;
      initialAglFt = initialMslFt - input.targetElevationMslFt;
      roll = rollIn(rollProfile, initialMslFt);
      trackAglFt = initialAglFt - roll.altitudeLossFt;
      if (!(trackAglFt > releaseAglFt)) {
        throw new Error("Initial altitude minus roll-in loss is below effective Release altitude");
      }
      trackingPathFt = (trackAglFt - releaseAglFt) / Math.sin(diveRad);
      trackingTimeSec = trackingPathFt / (((roll.finalTasKt + releaseTasKt) / 2) * KTFPS);
    } else {
      trackingTimeSec = input.trackingTimeSec;
      initialAglFt = releaseAglFt + trackingTimeSec * releaseTasKt * KTFPS * Math.sin(diveRad) + 2500;
      for (iteration = 0; iteration < 30; iteration += 1) {
        initialMslFt = input.targetElevationMslFt + initialAglFt;
        roll = rollIn(rollProfile, initialMslFt);
        trackingPathFt = ((roll.finalTasKt + releaseTasKt) / 2) * KTFPS * trackingTimeSec;
        var nextInitialAglFt = releaseAglFt + trackingPathFt * Math.sin(diveRad) + roll.altitudeLossFt;
        initialAglFt = 0.45 * initialAglFt + 0.55 * nextInitialAglFt;
      }
      initialMslFt = input.targetElevationMslFt + initialAglFt;
      roll = rollIn(rollProfile, initialMslFt);
      trackingPathFt = ((roll.finalTasKt + releaseTasKt) / 2) * KTFPS * trackingTimeSec;
      trackAglFt = initialAglFt - roll.altitudeLossFt;
    }

    var downRangeTravelFt = trackingPathFt * Math.cos(diveRad);
    var groundRangeFt = downRangeTravelFt + bomb.bombRangeFt;
    var lineOfSightAngleDeg = Math.atan2(trackAglFt, groundRangeFt) * 180 / Math.PI;
    var aimOffRangeFt = bomb.aimOffDistanceFt === null ? null : groundRangeFt + bomb.aimOffDistanceFt;
    var offsetRangeFt = aimOffRangeFt === null ? groundRangeFt : aimOffRangeFt;
    var headingRad = input.angleOffDeg * Math.PI / 180;
    var targetForwardFt = roll.displacementForwardFt + groundRangeFt * Math.cos(headingRad);
    var targetTurnSideFt = roll.displacementTurnSideFt + groundRangeFt * Math.sin(headingRad);
    var offsetForwardFt = roll.displacementForwardFt + offsetRangeFt * Math.cos(headingRad);
    var offsetTurnSideFt = roll.displacementTurnSideFt + offsetRangeFt * Math.sin(headingRad);
    var targetBearingDeg = Math.atan2(targetTurnSideFt, targetForwardFt) * 180 / Math.PI;
    var offsetBearingDeg = Math.atan2(offsetTurnSideFt, offsetForwardFt) * 180 / Math.PI;

    return {
      initialMslFt: initialMslFt,
      initialTasKt: roll.initialTasKt,
      trackMslFt: input.targetElevationMslFt + trackAglFt,
      effectiveReleaseAltitudeMslFt: effectiveReleaseAltitudeMslFt,
      releaseTasKt: releaseTasKt,
      trackingTimeSec: trackingTimeSec,
      downRangeTravelFt: downRangeTravelFt,
      groundRangeFt: groundRangeFt,
      aimOffRangeFt: aimOffRangeFt,
      rollInRangeFt: Math.hypot(targetForwardFt, targetTurnSideFt),
      targetForwardFt: targetForwardFt,
      targetTurnSideFt: targetTurnSideFt,
      leadAngleDeg: input.angleOffDeg - targetBearingDeg,
      legacyOffsetLeadDeg: input.angleOffDeg - offsetBearingDeg,
      aimOffAngleDeg: lineOfSightAngleDeg - input.diveAngleDeg,
      roll: roll
    };
  }

  function calculate(rawInput) {
    var input = Object.assign({}, rawInput, {
      gOnsetTimeSec: rawInput.gOnsetTimeSec === undefined ? 2 : rawInput.gOnsetTimeSec,
      fragmentHeightMarginPercent: rawInput.fragmentHeightMarginPercent === undefined ? 20 : rawInput.fragmentHeightMarginPercent,
      releaseFpaDeg: rawInput.releaseFpaDeg === undefined ? -rawInput.diveAngleDeg : rawInput.releaseFpaDeg,
      windSpeedMps: rawInput.windSpeedMps === undefined ? 0 : rawInput.windSpeedMps
    });
    var selectedWeapon = weapon(input.weaponId);
    var nltSupported = input.diveAngleDeg >= 10;
    var safety;
    if (nltSupported) {
      safety = semSafety(Object.assign({}, input, { weapon: selectedWeapon }));
      safety.applicability = "NLT_SUPPORTED";
    } else {
      var fragment = fragmentData(selectedWeapon, input.targetElevationMslFt);
      safety = {
        minAltMslFt: input.targetElevationMslFt + fragment.altitudeFt * (1 + input.fragmentHeightMarginPercent / 100),
        nltReleaseMslFt: null,
        applicability: "MINALT_ONLY"
      };
    }

    var effectiveReleaseAltitudeMslFt = nltSupported
      ? Math.max(input.releaseAltitudeMslFt, safety.nltReleaseMslFt)
      : input.releaseAltitudeMslFt;
    var bomb = bombTrajectory({
      diveAngleDeg: input.diveAngleDeg,
      releaseAglFt: effectiveReleaseAltitudeMslFt - input.targetElevationMslFt,
      windDirectionDeg: input.windDirectionDeg,
      windSpeedMps: input.windSpeedMps
    }, selectedWeapon, casToTas(input.releaseSpeedKcas, effectiveReleaseAltitudeMslFt));
    var profile = geometry(input, bomb, effectiveReleaseAltitudeMslFt);
    var publicResult = {
      effectiveReleaseAltitudeMslFt: profile.effectiveReleaseAltitudeMslFt,
      resolvedInitialAltitudeMslFt: profile.initialMslFt,
      resolvedInitialSpeedKcas: input.initialSpeedMode === "CAS"
        ? input.initialSpeedValue
        : tasToCas(profile.initialTasKt, profile.initialMslFt),
      trackPointAltitudeMslFt: profile.trackMslFt,
      trackingTimeSec: profile.trackingTimeSec,
      rollInRangeNm: profile.rollInRangeFt / FTNM,
      groundRangeNm: profile.groundRangeFt / FTNM,
      downRangeTravelNm: profile.downRangeTravelFt / FTNM,
      bombRangeNm: bomb.bombRangeFt / FTNM,
      bombTofSec: bomb.bombTofSec,
      rollInRadiusNm: profile.roll.equivalentRadiusFt / FTNM,
      rollInTimeSec: profile.roll.rollInTimeSec,
      rollInGroundArcNm: profile.roll.groundArcFt / FTNM,
      rollInDisplacement: {
        forwardNm: profile.roll.displacementForwardFt / FTNM,
        turnSideNm: profile.roll.displacementTurnSideFt / FTNM
      },
      rollInLateralSeparationNm: Math.abs(profile.targetTurnSideFt) / FTNM,
      rollInAltitudeLossFt: profile.roll.altitudeLossFt,
      leadAngleDeg: profile.leadAngleDeg,
      minAltMslFt: safety.minAltMslFt,
      nltReleaseMslFt: safety.nltReleaseMslFt
    };
    var localResult = {
      aimOffPointRangeNm: profile.aimOffRangeFt === null ? null : profile.aimOffRangeFt / FTNM,
      aimOffAngleDeg: profile.aimOffAngleDeg,
      aimOffDistanceNm: bomb.aimOffDistanceFt === null ? null : bomb.aimOffDistanceFt / FTNM,
      rollInRangeProfileFitNm: (profile.rollInRangeFt - profile.groundRangeFt) / FTNM,
      legacyOffsetLeadDeg: profile.legacyOffsetLeadDeg
    };
    var headingRad = input.angleOffDeg * Math.PI / 180;
    var axis = { forward: Math.cos(headingRad), side: Math.sin(headingRad) };
    var rollInStart = { forwardNm: 0, turnSideNm: 0, altitudeMslFt: publicResult.resolvedInitialAltitudeMslFt };
    var trackPoint = {
      forwardNm: publicResult.rollInDisplacement.forwardNm,
      turnSideNm: publicResult.rollInDisplacement.turnSideNm,
      altitudeMslFt: publicResult.trackPointAltitudeMslFt
    };
    var along = function (origin, distanceNm, altitudeMslFt) {
      return {
        forwardNm: origin.forwardNm + distanceNm * axis.forward,
        turnSideNm: origin.turnSideNm + distanceNm * axis.side,
        altitudeMslFt: altitudeMslFt
      };
    };
    var release = along(trackPoint, publicResult.downRangeTravelNm, publicResult.effectiveReleaseAltitudeMslFt);
    var target = along(trackPoint, publicResult.groundRangeNm, input.targetElevationMslFt);
    var aimOffPoint = localResult.aimOffPointRangeNm === null
      ? null
      : along(trackPoint, localResult.aimOffPointRangeNm, input.targetElevationMslFt);

    return {
      model: { id: "bomb-delivery-planner-v0.3-js-facade", version: "0.3.3-ui-preview" },
      canonicalInputs: input,
      public: publicResult,
      local: localResult,
      safety: { applicability: safety.applicability },
      diagnostics: {
        ballisticModelId: bomb.modelId,
        ballisticModelVersion: bomb.modelVersion,
        nltSupported: nltSupported
      },
      visualization: {
        rollInTrajectorySamples: profile.roll.samples.map(function (sample) {
          return {
            forwardNm: sample.forwardFt / FTNM,
            turnSideNm: sample.turnSideFt / FTNM,
            groundArcNm: sample.groundArcFt / FTNM,
            altitudeLossFt: sample.altitudeLossFt
          };
        }),
        bombTrajectorySamples: bomb.samples.map(function (sample) {
          return { downRangeNm: sample.xFt / FTNM, altitudeAglFt: sample.altitudeAglFt };
        }),
        semanticState: {
          stations: {
            rollInStart: rollInStart,
            trackPoint: trackPoint,
            release: release,
            target: target,
            aimOffPoint: aimOffPoint
          },
          paths: {
            rollIn: profile.roll.samples.map(function (sample) {
              return { forwardNm: sample.forwardFt / FTNM, turnSideNm: sample.turnSideFt / FTNM };
            }),
            tracking: [trackPoint, release]
          }
        }
      }
    };
  }

  function profileTitle(result) {
    var angle = result.canonicalInputs.diveAngleDeg;
    var selectedWeapon = weapon(result.canonicalInputs.weaponId);
    var suffix = angle === 0 ? "VLD" : angle > 30 ? "HADB" : angle === 30 ? "DB" : selectedWeapon.drag >= 1 ? "LAHD" : "LALD";
    return Math.round(angle) + "° " + suffix;
  }

  global.BDPV2Core = Object.freeze({
    id: "bomb-delivery-planner-v0.3-js-facade",
    version: "0.3.2",
    sourceArtifact: "BDP_V2_REV1.9_ORACLE_FIDELITY_MOBILE_WORK_FIX7-1.html",
    sourceSha256: "82ed448c1cf63ed92c016597a726a37e162b023444921782fa4ed7810b545a20",
    calculate: calculate,
    profileTitle: profileTitle
  });
})(window);
