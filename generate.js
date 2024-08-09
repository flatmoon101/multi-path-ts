"use strict";
function perp(vec) {
    return { x: -vec.y, y: vec.x };
}
function negate(vec) {
    return { x: -vec.x, y: -vec.y };
}
function dot(v0, v1) {
    return v0.x * v1.x + v0.y * v1.y;
}
function add(a, b) {
    return { x: a.x + b.x, y: a.y + b.y };
}
function sub(a, b) {
    return { x: a.x - b.x, y: a.y - b.y };
}
function scale(vec, s) {
    return { x: vec.x * s, y: vec.y * s };
}
function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}
function midpoint(a, b) {
    return { x: 0.5 * (a.x + b.x), y: 0.5 * (a.y + b.y) };
}
function normal(vec) {
    const len = Math.sqrt(vec.x * vec.x + vec.y * vec.y);
    if (len === 0) {
        return { x: 0, y: 0 };
    }
    return scale(vec, 1 / len);
}
function isEqual(v0, v1) {
    return v0.x == v1.x && v0.y == v1.y;
}
// Placeholder for the linesCross function
function linesCross(v0, v1, t0, t1) {
    if (isEqual(v1, t0) ||
        isEqual(v0, t0) ||
        isEqual(v1, t1) ||
        isEqual(v0, t1)) {
        return null;
    }
    let vnormal = sub(v1, v0);
    vnormal = perp(vnormal);
    const v0d = dot(vnormal, v0);
    const t0d = dot(vnormal, t0);
    const t1d = dot(vnormal, t1);
    if (t0d > v0d && t1d > v0d) {
        return null;
    }
    if (t0d < v0d && t1d < v0d) {
        return null;
    }
    let tnormal = sub(t1, t0);
    tnormal = perp(tnormal);
    const t0dNormal = dot(tnormal, t0);
    const v0dNormal = dot(tnormal, v0);
    const v1dNormal = dot(tnormal, v1);
    if (v0dNormal > t0dNormal && v1dNormal > t0dNormal) {
        return null;
    }
    if (v0dNormal < t0dNormal && v1dNormal < t0dNormal) {
        return null;
    }
    const fullvec = sub(v1, v0);
    const frac = (t0dNormal - v0dNormal) / (v1dNormal - v0dNormal);
    return { frac: frac, point: add(v0, scale(fullvec, frac)) };
}
function generateFlightPath(points, metersPerLat, metersPerLng, angle, turn, separation) {
    // get vector parallel to rows
    const rad = angle * Math.PI / 180;
    let parallelVec = { x: Math.sin(rad), y: Math.cos(rad) };
    // get vector perpendicular to strips
    let perpVec = perp(parallelVec);
    if (turn === 1) {
        perpVec = negate(perpVec);
    }
    // find extents in parallel and perp directions
    let minParallel = 0, maxParallel = 0, minPerp = 0, maxPerp = 0;
    let minParallelInd = 0, maxParallelInd = 0, minPerpInd = 0, maxPerpInd = 0;
    for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        const parallelDot = dot(pt, parallelVec);
        const perpDot = dot(pt, perpVec);
        if (i === 0) {
            minParallel = maxParallel = parallelDot;
            minPerp = maxPerp = perpDot;
            minParallelInd = maxParallelInd = 0;
            minPerpInd = maxPerpInd = 0;
        }
        else {
            if (parallelDot < minParallel) {
                minParallel = parallelDot;
                minParallelInd = i;
            }
            if (parallelDot > maxParallel) {
                maxParallel = parallelDot;
                maxParallelInd = i;
            }
            if (perpDot < minPerp) {
                minPerp = perpDot;
                minPerpInd = i;
            }
            if (perpDot > maxPerp) {
                maxPerp = perpDot;
                maxPerpInd = i;
            }
        }
    }
    // get row separation in lat/lng dimension (along perpVec)
    let quadrantAngle = angle;
    if (quadrantAngle > 180) {
        quadrantAngle = 360 - quadrantAngle;
    }
    if (quadrantAngle > 90) {
        quadrantAngle = 180 - quadrantAngle;
    }
    const lngToLatRatio = quadrantAngle / 90;
    const latLngSeparationPerDegree = metersPerLng + lngToLatRatio * (metersPerLat - metersPerLng);
    const latLngSeparation = separation / latLngSeparationPerDegree;
    // find corners of oriented bounding box
    const parallelMinPoint = points[minParallelInd];
    const parallelMaxPoint = points[maxParallelInd];
    const perpMinPoint = points[minPerpInd];
    const perpMaxPoint = points[maxPerpInd];
    let parallelMinExtended1 = add(parallelMinPoint, scale(perpVec, -10000));
    let parallelMinExtended2 = add(parallelMinPoint, scale(perpVec, 10000));
    let parallelMaxExtended1 = add(parallelMaxPoint, scale(perpVec, -10000));
    let parallelMaxExtended2 = add(parallelMaxPoint, scale(perpVec, 10000));
    let perpMinExtended1 = add(perpMinPoint, scale(parallelVec, -10000));
    let perpMinExtended2 = add(perpMinPoint, scale(parallelVec, 10000));
    let perpMaxExtended1 = add(perpMaxPoint, scale(parallelVec, -10000));
    let perpMaxExtended2 = add(perpMaxPoint, scale(parallelVec, 10000));
    parallelMinExtended1 = add(parallelMinExtended1, scale(parallelVec, -0.0001));
    parallelMinExtended2 = add(parallelMinExtended2, scale(parallelVec, -0.0001));
    parallelMaxExtended1 = add(parallelMaxExtended1, scale(parallelVec, 0.0001));
    parallelMaxExtended2 = add(parallelMaxExtended2, scale(parallelVec, 0.0001));
    perpMinExtended1 = add(perpMinExtended1, scale(perpVec, latLngSeparation * 0.5));
    perpMinExtended2 = add(perpMinExtended2, scale(perpVec, latLngSeparation * 0.5));
    const lxlyInt = linesCross(parallelMinExtended1, parallelMinExtended2, perpMinExtended1, perpMinExtended2);
    const uxlyInt = linesCross(parallelMinExtended1, parallelMinExtended2, perpMaxExtended1, perpMaxExtended2);
    const uxuyInt = linesCross(parallelMaxExtended1, parallelMaxExtended2, perpMaxExtended1, perpMaxExtended2);
    const lxuyInt = linesCross(parallelMaxExtended1, parallelMaxExtended2, perpMinExtended1, perpMinExtended2);
    if (!lxlyInt || !uxlyInt || !uxuyInt || !lxuyInt) {
        throw new Error("Lines do not cross.");
    }
    const lxly = lxlyInt.point;
    const uxly = uxlyInt.point;
    const uxuy = uxuyInt.point;
    const lxuy = lxuyInt.point;
    const perpDist = dist(lxly, uxly);
    const rowsNeeded = Math.ceil(perpDist / latLngSeparation);
    const fullspan = sub(uxly, lxly);
    const rowEnds = [];
    for (let i = 0; i < rowsNeeded; i++) {
        const start = add(lxly, scale(perpVec, i * latLngSeparation));
        const end = add(lxuy, scale(perpVec, i * latLngSeparation));
        rowEnds.push({ start, end });
    }
    for (let i = 0; i < rowEnds.length; i++) {
        const row = rowEnds[i];
        let closestHit;
        let furthestHit;
        let closestDist = 99999999;
        let furthestDist = -99999999;
        for (let k = 0; k < points.length; k++) {
            const pt0 = points[k];
            const pt1 = points[(k + 1) % points.length];
            const intersection = linesCross(row.start, row.end, pt0, pt1);
            if (!intersection)
                continue;
            if (intersection.frac < closestDist) {
                closestDist = intersection.frac;
                closestHit = intersection.point;
            }
            if (intersection.frac > furthestDist) {
                furthestDist = intersection.frac;
                furthestHit = intersection.point;
            }
        }
        if (closestHit)
            row.start = closestHit;
        if (furthestHit)
            row.end = furthestHit;
        if (i % 2 === 1) {
            // swap start and end for every second row
            const tmpX = row.start.x;
            row.start.x = row.end.x;
            row.end.x = tmpX;
            const tmpY = row.start.y;
            row.start.y = row.end.y;
            row.end.y = tmpY;
        }
    }
    return rowEnds;
}
