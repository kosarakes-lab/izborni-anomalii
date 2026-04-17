const svg = d3.select("#chart");
const width = window.innerWidth;
const height = window.innerHeight;

svg.attr("width", width).attr("height", height);

// ONE permanent zoom layer (DO NOT recreate)
const zoomLayer = svg.append("g");

// zoom behavior
const zoom = d3.zoom()
    .scaleExtent([0.5, 5])
    .on("zoom", (event) => {
        zoomLayer.attr("transform", event.transform);
    });

// attach once
svg.call(zoom);

const anomalySelect = d3.select("#anomaly");
const regionSelect = d3.select("#region");
const yearSelect = d3.select("#year");

const introOverlay = document.getElementById("introOverlay");
const enterBtn = document.getElementById("enterBtn");

enterBtn.onclick = () => {
    introOverlay.style.opacity = "0";
    introOverlay.style.pointerEvents = "none";

    setTimeout(() => {
        introOverlay.style.display = "none";
    }, 300);
};

const popup = document.getElementById("popup");
const info = d3.select("#info");
const barSvg = d3.select("#barChart");
const closeBtn = document.getElementById("closePopup");

// ALWAYS start hidden (CSS should already do this, but we force it once)
popup.style.display = "none";

// CLOSE popup
closeBtn.onclick = () => {
    popup.style.display = "none";
};

// -------------------- PARTIES --------------------
const parties = {
    2: "ГЛАС НАРОДЕН",
    4: "ВЕЛИЧИЕ",
    5: "Булгари",
    6: "МОЯ СТРАНА",
    7: "ИТН",
    8: "ДПС",
    9: "БРИГАДА",
    10: "ЗЕЛЕНИТЕ",
    11: "ПРАВОТО",
    12: "ВЪЗРАЖДАНЕ",
    13: "АПС",
    14: "БНС",
    15: "БСДД",
    16: "СИНЯ БЪЛГАРИЯ",
    17: "МЕЧ",
    18: "ГЕРБ-СДС",
    19: "АТАКА",
    20: "ИСТИНАТА",
    21: "ПРЯКА ДЕМОКРАЦИЯ",
    22: "СВОБОДНИ",
    23: "БТР",
    24: "КОЙ",
    25: "РУСОФИЛИ",
    26: "ПП-ДБ",
    27: "БЪЛГАРСКИ ВЪЗХОД",
    28: "БСП"
};

const partyColors = {
    4: "#f2c94c",   // yellow
    7: "#ad7144ff",   // brown
    8: "#ff45c4ff",   // dark grey
    12: "#609c64ff",  // dark green
    13: "#56ccf2",  // light blue
    17: "#ff8ea5ff",  // pale red
    18: "#6494d2ff",  // blue
    26: "#bb7df5ff",  // purple
    28: "#ff4d4dff"   // red
};

const OTHER_COLOR = "#e6d3b3"; // beige

const colorScale = d3.scaleOrdinal(d3.schemeTableau10);


// -------------------- LOAD DATA --------------------

let allData = [];


d3.csv("csv/20241027-results-viz.csv").then(data => {

    data.forEach(d => {
        d.actual_voters = +d.actual_voters;

        d.dominant_party = d.dominant_party === "TRUE";
        d.high_turnout = d.high_turnout === "TRUE";
        d.many_invalid = d.many_invalid === "TRUE";
    });

    allData = data;

    // anomaly dropdown
    anomalySelect.selectAll("option")
        .data([
            { key: "dominant_party", label: "Над 60% от гласовете към една единствена партия" },
            { key: "high_turnout", label: "Над 90% избирателна активност" },
            { key: "many_invalid", label: "Повече от 10% невалидни бюлетини" }
        ])
        .enter()
        .append("option")
        .attr("value", d => d.key)
        .text(d => d.label);

    // regions
    const regions = ["all", ...new Set(data.map(d => d.oblast))];

    regionSelect.selectAll("option")
        .data(regions)
        .enter()
        .append("option")
        .attr("value", d => d)
        .text(d => d === "all" ? "Цяла България" : d);

    // years
    const years = [...new Set(data.map(d => d.elections))];

    yearSelect.selectAll("option")
        .data(years)
        .enter()
        .append("option")
        .attr("value", d => d)
        .text(d => `Избори на ${(d)}`);

    anomalySelect.on("change", update);
    regionSelect.on("change", update);
    yearSelect.on("change", update);

    update();

    const isAllBulgaria = regionSelect.property("value") === "all";
    if (isAllBulgaria) {
        svg.call(zoom);   // enable drag
    } else {
        svg.on(".zoom", null); // disable drag
    }


    // clear
    legendItems.innerHTML = "";

    // collect items
    const items = [];

    // colored parties first
    Object.keys(partyColors)
        .sort((a, b) => parties[a].localeCompare(parties[b]))
        .forEach(key => {
            items.push({
                label: parties[key],
                color: partyColors[key]
            });
        });

    // others
    Object.keys(parties)
        .filter(k => !partyColors[k])
        .forEach(key => {
            items.push({
                label: parties[key],
                color: OTHER_COLOR
            });
        });

    // add explicit "Others" category (optional but nice)
    items.push({
        label: "Others",
        color: OTHER_COLOR
    });

    // distribute into 5 columns
    const columns = [[], [], [], [], []];

    items.forEach((item, i) => {
        columns[i % 5].push(item);
    });

    // render columns
    columns.forEach(col => {
        const colDiv = document.createElement("div");

        col.forEach(item => {
            const div = document.createElement("div");
            div.className = "legend-item";

            const color = document.createElement("div");
            color.className = "legend-color";
            color.style.background = item.color;

            const text = document.createElement("div");
            text.textContent = item.label;

            div.appendChild(color);
            div.appendChild(text);

            colDiv.appendChild(div);
        });

        legendItems.appendChild(colDiv);
    });

});

const legend = document.getElementById("legend");
const legendHeader = document.getElementById("legendHeader");
const legendItems = document.getElementById("legendItems");

legendHeader.onclick = () => {
    legend.classList.toggle("open");
};

// -------------------- UPDATE --------------------
function update() {

    const anomaly = anomalySelect.property("value");
    const region = regionSelect.property("value");
    const year = yearSelect.property("value");

    let filtered = allData.filter(d => d[anomaly]);

    if (region !== "all") {
        filtered = filtered.filter(d => d.oblast === region);
    }

    filtered = filtered.filter(d => d.elections === year);

    filtered.forEach(d => {
        let max = -1;
        let winner = null;

        Object.keys(parties).forEach(p => {
            const v = +d[p] || 0;
            if (v > max) {
                max = v;
                winner = p;
            }
        });

        d.winner = winner;
    });

    const radiusScale = d3.scaleSqrt()
        .domain([0, d3.max(filtered, d => d.actual_voters) || 1])
        .range([3, 25]);

    // 🔥 ONLY clear zoomLayer (NOT svg!)
    zoomLayer.selectAll("*").remove();

    const nodes = zoomLayer.selectAll("g")
        .data(filtered)
        .enter()
        .append("g");

    nodes.append("circle")
        .attr("r", d => radiusScale(d.actual_voters))
        .attr("fill", d => partyColors[d.winner] || OTHER_COLOR)
        .attr("opacity", 0.85)
        .style("cursor", "pointer")
        .on("click", (event, d) => showPopup(d));

    nodes.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", d => radiusScale(d.actual_voters) + 12)
        .text(d => d.naseleno_myasto);

    const simulation = d3.forceSimulation(filtered)
        .force("x", d3.forceX(width / 2).strength(0.03))
        .force("y", d3.forceY(height / 2).strength(0.03))

        // keep general spacing
        .force("collide", d3.forceCollide(d => radiusScale(d.actual_voters) + 20))

        // 🔥 NEW: cluster by dominant party
        .force("clusterX", d3.forceX(d => {
            // assign each party a horizontal band
            const keys = Object.keys(partyColors);
            const index = keys.indexOf(d.winner);
            const step = width / (keys.length + 1);
            return step * (index + 1);
        }).strength(0.08))

        .force("charge", d3.forceManyBody().strength(-5))

        .on("tick", ticked);

    function ticked() {
        nodes.attr("transform", d => `translate(${d.x},${d.y})`);
    }
}

// -------------------- POPUP --------------------
function showPopup(d) {

    console.log("SHOW POPUP", d);

    // -----------------------------
    // RESET POPUP
    // -----------------------------
    popup.style.cssText = "";
    popup.style.display = "flex";

    // -----------------------------
    // ANOMALY TITLE
    // -----------------------------
    const anomalyLabels = [];

    if (d.dominant_party) anomalyLabels.push("доминираща партия");
    if (d.high_turnout) anomalyLabels.push("висока избирателна активност");
    if (d.many_invalid) anomalyLabels.push("много невалидни бюлетини");

    const anomalyTitle = anomalyLabels.length
        ? `Изборни аномалии представляващи: ${anomalyLabels.join(", ")}`
        : "Изборни аномалии";

    // -----------------------------
    // INFO HTML
    // -----------------------------

    // -----------------------------
    // INFO PANEL
    // -----------------------------
    document.getElementById("info").innerHTML = `
    <div class="popup-title" style="font-size:16px; font-weight:600; text-align:center; margin-bottom:10px;">
        ${anomalyTitle}
    </div>

    <div class="popup-text">
        в област <span class="emph">${d.oblast}</span>,
        община <span class="emph">${d.obshtina}</span>,
        <span class="emph">${d.naseleno_myasto}</span>,
        с номер в СИК <span class="emph">${d.sik_num}</span>
        от <span class="emph">${d.potential_voters}</span> регистрирани са гласували
        <span class="emph">${d.actual_voters}</span>,
        общо <span class="emph">${d.valid_votes}</span> валидни и
        <span class="emph">${d.invalid_votes}</span> невалидни бюлетини
    </div>
`;

    // -----------------------------
    // CLEAN SVG
    // -----------------------------
    barSvg.selectAll("*").remove();

    // -----------------------------
    // DATA
    // -----------------------------
    const dataBars = Object.keys(parties).map(p => ({
        key: p,
        name: parties[p],
        votes: +d[p] || 0
    }));

    const filteredBars = dataBars
        .filter(d => d.votes > 0)
        .sort((a, b) => b.votes - a.votes);

    // -----------------------------
    // LAYOUT
    // -----------------------------
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };

    const totalWidth = 600;
    const innerWidth = totalWidth - margin.left - margin.right;

    const centerX = innerWidth / 2;

    const rowHeight = 34;
    const height = filteredBars.length * rowHeight;

    // -----------------------------
    // SCALE (HALF WIDTH for symmetric bars)
    // -----------------------------
    const maxVotes = d3.max(filteredBars, d => d.votes) || 1;

    const x = d3.scaleLinear()
        .domain([0, maxVotes])
        .range([0, innerWidth / 2]);

    const y = d3.scaleBand()
        .domain(filteredBars.map(d => d.name))
        .range([0, height])
        .padding(0.25);

    // -----------------------------
    // SVG
    // -----------------------------
    barSvg
        .attr("width", totalWidth)
        .attr("height", height + margin.top + margin.bottom);

    // -----------------------------
    // GROUP
    // -----------------------------
    const g = barSvg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // -----------------------------
    // BARS (CENTERED AROUND MIDLINE)
    // -----------------------------
    g.selectAll("rect")
        .data(filteredBars)
        .enter()
        .append("rect")
        .attr("y", d => y(d.name))
        .attr("x", d => centerX - x(d.votes)) // LEFT SIDE OF CENTER
        .attr("width", d => x(d.votes) * 2)   // SPANS BOTH SIDES
        .attr("height", y.bandwidth())
        .attr("rx", 10) // rounded corners
        .attr("ry", 10)
        .attr("fill", d => partyColors[d.key] || OTHER_COLOR);

    // -----------------------------
    // LABELS (CENTERED ON BAR)
    // -----------------------------
    g.selectAll("text.label")
        .data(filteredBars)
        .enter()
        .append("text")
        .attr("x", centerX)
        .attr("y", d => y(d.name) + y.bandwidth() / 2)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-size", "14px")
        .style("fill", "black")
        .text(d => `${d.name} ${d.votes}`);

    document.getElementById("downloadBtn").onclick = async () => {
        const anomaly = anomalySelect.property("value");
        const region = regionSelect.property("value");
        const year = yearSelect.property("value");

        const anomalyLabel = anomalySelect.select(`option[value = "${anomaly}"]`).text();
        const regionLabel = regionSelect.select(`option[value = "${region}"]`).text();

        const titleText = `${anomalyLabel} — ${regionLabel} (${year})`;

        downloadSVGAsPNG(titleText);
    };

    function downloadSVGAsPNG(titleText) {

        const svgNode = document.querySelector("#chart");

        const serializer = new XMLSerializer();
        let source = serializer.serializeToString(svgNode);

        // add XML namespace if missing
        if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
            source = source.replace(
                /^<svg/,
                '<svg xmlns="http://www.w3.org/2000/svg"'
            );
        }

        // add title inside SVG
        const titleSVG = `
        < text x = "20" y = "30"
    font - size="20"
    font - weight="bold"
    fill = "black" >
        ${titleText}
        </text >
        `;

        source = source.replace("<g", titleSVG + "<g");

        const svgBlob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);

        const img = new Image();

        img.onload = function () {
            const canvas = document.createElement("canvas");
            canvas.width = svgNode.clientWidth;
            canvas.height = svgNode.clientHeight;

            const ctx = canvas.getContext("2d");

            // white background
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.drawImage(img, 0, 0);

            URL.revokeObjectURL(url);

            const png = canvas.toDataURL("image/png");

            const a = document.createElement("a");
            a.href = png;
            a.download = `${titleText}.png`;
            a.click();
        };

        img.src = url;
    }
}