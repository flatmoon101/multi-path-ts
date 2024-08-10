// Import Google Maps types
/// <reference types="@types/google.maps" />

interface LatLngLiteral {
    lat: number;
    lng: number;
}

interface Point {
    y: number;
    x: number;
}

let map: google.maps.Map;
let infoWindow: google.maps.InfoWindow | undefined;
let flightArea: google.maps.Polygon[] = [];
const colors = ["#FF0000", "#00FF00", "#0000FF", "#00FFFF", "#FF00FF", "#FFFF00", "#FFFFFF", "#000000"];
let pointUpdateTimeout: (number | null)[] = [];
let areaResetTimeout: (number | null)[] = [];
let rowEnds: any[] = [];
let displayLines: google.maps.Polyline[][] = [];
let rowLineColor: string[] = [];
let entryAngle: number[] = [];
let firstTurn: number[] = [];
let rowSeparation: number[] = [];
let altitude: number[] = [];
let agentIndex = 0;
let numAgents = 0;
let deleteMenu: DeleteMenu | undefined;

function pad(n: number, width: number, z?: string): string {
    z = z || '0';
    const nString = n.toString();
    return nString.length >= width ? nString : new Array(width - nString.length + 1).join(z) + nString;
}

function addAgentSelectEvent(): void {
    const agentSelect = document.getElementById('agentSelect') as HTMLSelectElement;
    agentSelect.addEventListener('change', () => {
        agentIndex = agentSelect.selectedIndex;
        recenterView(agentIndex);
        setTimeout(() => {
            recenterArea(agentIndex);
        }, 500);

        function setInputValue(): void {
            (document.getElementById('angle') as HTMLInputElement).value = entryAngle[agentIndex].toString();
            (document.getElementById('turn') as HTMLInputElement).value = firstTurn[agentIndex].toString();
            (document.getElementById('separation') as HTMLInputElement).value = rowSeparation[agentIndex].toString();
            (document.getElementById('altitude') as HTMLInputElement).value = altitude[agentIndex].toString();
        }

        window.onload = setInputValue;
    });
}

function initAgents(numAgents: number): void {
    for (let i = 0; i < numAgents; i++) {
        pointUpdateTimeout.push(null);
        areaResetTimeout.push(null);
        rowEnds.push(0);
        displayLines.push([]);
        rowLineColor.push(colors[i % colors.length]);
        entryAngle.push(0);
        firstTurn.push(1);
        rowSeparation.push(20);
        altitude.push(130);
    }
}

function generateAgents(numAgents: number): void {
    const selectElement = document.getElementById("agentSelect") as HTMLSelectElement;

    for (let i = 1; i <= numAgents; i++) {
        const option = document.createElement("option");
        option.id = "agent" + i;
        option.className = "selectAgent";
        option.value = (i - 1).toString(); // 0-based index for value
        option.text = "Agent " + i;
        selectElement.appendChild(option);
    }
}

function initMap(): void {
    let startLat: number;
    let startLng: number;

    const modal = document.getElementById("myModal") as HTMLElement;
    modal.style.display = "block";

    const form = document.getElementById("myForm") as HTMLFormElement;

    form.onsubmit = function (event: Event) {
        event.preventDefault();
        modal.style.display = "none";

        numAgents = parseInt((document.getElementById("agents") as HTMLInputElement).value, 10);
        startLat = parseFloat((document.getElementById("lat") as HTMLInputElement).value);
        startLng = parseFloat((document.getElementById("lon") as HTMLInputElement).value);

        initAgents(numAgents);

        map = new google.maps.Map(document.getElementById('map') as HTMLElement, {
            center: new google.maps.LatLng(startLat, startLng),
            mapTypeId: 'hybrid',
        });

        for (let i = 0; i < numAgents; i++) {
            flightArea.push(new google.maps.Polygon({
                paths: [
                    { lat: startLat + 0.001 * i, lng: startLng + 0.001 * i },
                    { lat: startLat + 0.001 * (i + 1), lng: startLng + 0.001 * i },
                    { lat: startLat + 0.001 * (i + 1), lng: startLng + 0.001 * (i + 1) },
                    { lat: startLat + 0.001 * i, lng: startLng + 0.001 * (i + 1) }
                ],
                strokeColor: '#BB0000',
                strokeOpacity: 1,
                strokeWeight: 1,
                fillColor: '#4444BB',
                fillOpacity: 0.2,
                editable: true,
                draggable: true
            }));
            flightArea[i].setMap(map);
            setPathListeners(i);
            queuePointsAreaUpdate(i);
        }

        generateAgents(numAgents);
        addAgentSelectEvent();

        deleteMenu = new DeleteMenu();

        infoWindow = new google.maps.InfoWindow();

        queuePointsAreaUpdate(0);
        google.maps.event.trigger(map, 'resize');
        recenterView(0);
    };
}

function setPathListeners(agent: number): void {
    google.maps.event.addListener(flightArea[agent].getPath(), 'set_at', function () {
        queuePointsAreaUpdate(agent);
    });

    google.maps.event.addListener(flightArea[agent].getPath(), 'insert_at', function () {
        queuePointsAreaUpdate(agent);
    });

    google.maps.event.addListener(flightArea[agent], 'rightclick', function (e: any) {
        if (e.vertex == undefined) {
            return;
        }
        deleteMenu!.open(map!, flightArea[agent].getPath(), e.vertex);
    });
}

function queuePointsAreaUpdate(agent: number): void {
    if (pointUpdateTimeout[agent] !== null) {
        clearTimeout(pointUpdateTimeout[agent]!);
    }
    if (areaResetTimeout[agent] !== null) {
        clearTimeout(areaResetTimeout[agent]!);
    }
    clearDisplayLines(agent);
    pointUpdateTimeout[agent] = setTimeout(() => { updatePointsTextarea(agent); updateFlightPath(agent); }, 500);
}

function updatePointsTextarea(agent: number): void {
    let str = "";
    const path = flightArea[agent].getPath();
    for (let i = 0; i < path.getLength(); i++) {
        if (i > 0) {
            str += ",\n";
        }
        const loc = path.getAt(i);
        str += loc.lat() + ", " + loc.lng();
    }
    (document.getElementById("points") as HTMLTextAreaElement).value = str;
}

function queueAreaReset(agent: number): void {
    if (pointUpdateTimeout[agent] !== null) {
        clearTimeout(pointUpdateTimeout[agent]!);
    }
    if (areaResetTimeout[agent] !== null) {
        clearTimeout(areaResetTimeout[agent]!);
    }
    areaResetTimeout[agent] = setTimeout(() => { resetAreaFromInput(agent); }, 500);
}

function resetAreaFromInput(agent: number): void {
    const feedback = document.getElementById("feedback") as HTMLElement;
    feedback.innerHTML = "";
    const input = (document.getElementById("points") as HTMLTextAreaElement).value;
    const parts = input.split(",");
    if (parts.length % 2 !== 0) {
        feedback.innerHTML = "Need even number of values to interpret as lat/lng points";
        return;
    }
    const pts: google.maps.LatLngLiteral[] = [];
    for (let i = 0; i < parts.length; i += 2) {
        const lat = parseFloat(parts[i]);
        const lng = parseFloat(parts[i + 1]);
        if (isNaN(lat) || isNaN(lng)) {
            feedback.innerHTML = "Need numerical values to interpret as lat/lng points";
            return;
        }
        pts.push({ lat: lat, lng: lng });
    }
    flightArea[agent].setMap(null);
    flightArea[agent].setPaths(pts);
    flightArea[agent].setMap(map!);
    setPathListeners(agent);
    updateFlightPath(agent);
}

function recenterView(agent: number): void {
    const markers = flightArea[agent].getPath();
    const bounds = new google.maps.LatLngBounds();
    for (let i = 0; i < markers.getLength(); i++) {
        bounds.extend(markers.getAt(i));
    }
    map!.fitBounds(bounds);
}

// function recenterArea(agent: number): void {
//     const path = flightArea[agent].getPath();
//     const bounds = new google.maps.LatLngBounds();
//     for (let i = 0; i < path.getLength(); i++) {
//         bounds.extend(path.getAt(i));
//     }
//     map!.fitBounds(bounds);
// }

function recenterArea(agent: number): void {
    const path: google.maps.MVCArray<google.maps.LatLng> = flightArea[agent].getPath();
    const bounds: google.maps.LatLngBounds = new google.maps.LatLngBounds();

    for (let i = 0; i < path.getLength(); i++) {
        bounds.extend(path.getAt(i));
    }

    const areaCenter: google.maps.LatLng = bounds.getCenter();
    const viewCenter: google.maps.LatLng = map.getCenter() as google.maps.LatLng;

    const latDelta: number = viewCenter.lat() - areaCenter.lat();
    const lngDelta: number = viewCenter.lng() - areaCenter.lng();

    const pts: LatLngLiteral[] = [];
    for (let i = 0; i < path.getLength(); i++) {
        const pt: google.maps.LatLng = path.getAt(i);
        pts.push({ lat: pt.lat() + latDelta, lng: pt.lng() + lngDelta });
    }

    flightArea[agent].setMap(null);
    flightArea[agent].setPaths(pts);
    flightArea[agent].setMap(map);

    setPathListeners(agent);
    updatePointsTextarea(agent);
    updateFlightPath(agent);
}

function updateFlightPath(agent: number): void {
    clearDisplayLines(agent);
    $(`#pathlength`).html("-");
    $(`#efficiency`).html("-");
    $(`#esttime`).html("-");

    const path: google.maps.MVCArray<google.maps.LatLng> = flightArea[agent].getPath();
    if (path.getLength() < 3) {
        $(`#feedback`).html("Need at least three points");
        return;
    } else {
        $(`#feedback`).html("");
    }

    // find meters per degree for lat/lng at this location
    const firstPoint = path.getAt(0);
    const p0 = new google.maps.LatLng(firstPoint.lat(), firstPoint.lng());
    const p1 = new google.maps.LatLng(firstPoint.lat() + 0.001, firstPoint.lng());
    const p2 = new google.maps.LatLng(firstPoint.lat(), firstPoint.lng() + 0.001);
    const metersPerLat = 1000 * google.maps.geometry.spherical.computeDistanceBetween(p0, p1);
    const metersPerLng = 1000 * google.maps.geometry.spherical.computeDistanceBetween(p0, p2);

    const pts: Point[] = [];
    for (let i = 0; i < path.getLength(); i++) {
        const pt = path.getAt(i);
        pts.push({ y: pt.lat(), x: pt.lng() });
    }

    let angle: number = parseFloat($(`#angle`).val() as string);
    const turn: number = firstTurn[agent] = parseInt($(`#turn`).val() as string);
    const separation: number = rowSeparation[agent] = parseFloat($(`#separation`).val() as string);

    while (angle > 360) {
        angle -= 360;
    }
    entryAngle[agent] = angle;

    rowEnds[agent] = generateFlightPath(pts, metersPerLat, metersPerLng, angle, turn, separation);

    let usefulLengthMeters: number = 0;
    let turningLengthMeters: number = 0;

    for (let i = 0; i < rowEnds[agent].length; i++) {
        const row = rowEnds[agent][i];

        const start: google.maps.LatLng = new google.maps.LatLng(row.start.y, row.start.x);
        const end: google.maps.LatLng = new google.maps.LatLng(row.end.y, row.end.x);
        usefulLengthMeters += google.maps.geometry.spherical.computeDistanceBetween(start, end);

        if (i > 0) {
            const lastRow = rowEnds[agent][i - 1];
            const lastEnd = new google.maps.LatLng(lastRow.end.y, lastRow.end.x);
            const turnLength = google.maps.geometry.spherical.computeDistanceBetween(lastEnd, start);
            turningLengthMeters += turnLength;
        }
    }

    const pathLengthMeters = usefulLengthMeters + turningLengthMeters;

    $(`#pathlength`).html(`${Math.round(pathLengthMeters)} meters`);

    const speed: number = parseFloat($(`#speed`).val() as string);
    const turntime: number = parseFloat($(`#turntime`).val() as string);
    let seconds: number = Math.round(pathLengthMeters / speed);
    seconds += (rowEnds[agent].length - 1) * turntime * 2;

    const usefulSeconds: number = Math.round(usefulLengthMeters / speed);
    $(`#efficiency`).html(`${Math.round(100 * usefulSeconds / seconds)} %`);

    const hours: number = Math.floor(seconds / 3600);
    seconds -= hours * 3600;
    const minutes: number = Math.floor(seconds / 60);
    seconds -= minutes * 60;
    $(`#esttime`).html(`${hours}:${pad(minutes, 2)}:${pad(seconds, 2)}`);

    $(`#totalwaypoints`).html((rowEnds[agent].length * 2).toString());

    drawFlightPath(agent);
}

function drawFlightPath(agent: number): void {
    clearDisplayLines(agent);

    const path: LatLngLiteral[] = [];
    for (let i = 0; i < rowEnds[agent].length; i++) {
        const row = rowEnds[agent][i];
        const pstart: LatLngLiteral = { lat: row.start.y, lng: row.start.x };
        const pend: LatLngLiteral = { lat: row.end.y, lng: row.end.x };
        path.push(pstart);
        path.push(pend);
    }

    const line = new google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: rowLineColor[agent],
        strokeOpacity: 1.0,
        strokeWeight: 3,
        zIndex: 100
    });
    line.setMap(map);
    displayLines[agent].push(line);

    // draw arrows
    for (let i = 0; i < rowEnds[agent].length; i++) {
        const row = rowEnds[agent][i];
        let mid: Point = midpoint(row.start, row.end);
        let n: Point = normal(sub(row.end, row.start));
        n = scale(n, -0.00005);
        mid = add(mid, scale(n, -0.5));
        const pn: Point = scale(perp(n), 0.5);
        const p0: Point = add(mid, add(n, pn));
        const p1: Point = add(mid, sub(n, pn));
        const arrowPath: LatLngLiteral[] = [
            { lat: p0.y, lng: p0.x },
            { lat: mid.y, lng: mid.x },
            { lat: p1.y, lng: p1.x },
        ];
        const arrowLine = new google.maps.Polyline({
            path: arrowPath,
            geodesic: true,
            strokeColor: rowLineColor[agent],
            strokeOpacity: 1.0,
            strokeWeight: 3,
            zIndex: 100
        });
        arrowLine.setMap(map);
        displayLines[agent].push(arrowLine);
    }
}

function clearDisplayLines(agent: number): void {
    if (displayLines[agent].length > 0) {
        displayLines[agent].forEach((line) => {
            line.setMap(null);
        });
        displayLines[agent] = [];
    }
}

function initColor(): void {
    for (let i = 0; i < colors.length; i++) {
        $("#color" + i).css("background-color", colors[i]);
    }
}

function changeColor(agent: number, i: number): void {
    rowLineColor[agent] = colors[i];
    drawFlightPath(agent);
}

initColor();
initMap();