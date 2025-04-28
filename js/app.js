(async function () {
  ("use strict");

  // ------------------------------
  // Utility Functions and Globals
  // ------------------------------

  // Spinner functions
  const spinner = document.querySelector(".spinner-container");
  function showSpinner() {
    spinner.style.display = "flex";
  }
  function hideSpinner() {
    spinner.style.display = "none";
  }

  // Filter Variables
  let mannerFilter = null;
  let modeFilter = null;
  let currentTimeRange = [0, 2359]; // Default to "All Crashes" range

  // Global variable to store the currently filtered crash data.
  let currentFilteredData = [];

  // Layer properties for crash severities
  const layerProps = [
    {
      id: "K",
      text: "Fatal Crash (K)",
      color: "#00365B",
      size: 12,
      checked: true,
    },
    {
      id: "A",
      text: "Serious Injury Crash (A)",
      color: "#346484",
      size: 10,
      checked: true,
    },
    {
      id: "B",
      text: "Minor Injury Crash (B)",
      color: "#3db7e8",
      size: 7.5,
      checked: true,
    },
    {
      id: "C",
      text: "Possible Injury Crash (C)",
      color: "#A4DAF7",
      size: 6,
      checked: true,
    },
    {
      id: "O",
      text: "Property Damage Only (O)",
      color: "#D3F0FF",
      size: 4,
      checked: true,
    },
  ];

  // Manner of Collision mapping
  const mannerOfCollisionMapping = {
    1: "Angle",
    2: "Backing",
    3: "Head On",
    4: "Opposing Left Turn",
    5: "Rear End",
    6: "Rear to Rear",
    7: "Sideswipe-Opposite Direction",
    8: "Sideswipe-Same Direction",
    9: "Single Vehicle",
  };

  // Mode mapping
  const modeMapping = {
    Bicyclists: ["Bicyclist"],
    Pedestrians: ["Pedestrian"],
    Motorcyclists: ["Motorcyclist"],
    // "Intersection Crashes": ["Intersection Crash"],
    "Motor Vehicles": [
      "Young Driver",
      "Commercial Vehicle",
      "Mature Driver",
      "Distracted",
      "Aggressive",
      "Impaired",
      "Unrestrained",
      "Roadway Departure",
      "Median Cross-over",
    ],
  };

  // Time groups for slider
  const timeGroups = [
    { label: "All Crashes", range: [0, 2359] },
    { label: "12:00 AM - 2:59 AM", range: [0, 259] },
    { label: "3:00 AM - 5:59 AM", range: [300, 559] },
    { label: "6:00 AM - 8:59 AM", range: [600, 859] },
    { label: "9:00 AM - 11:59 AM", range: [900, 1159] },
    { label: "12:00 PM - 2:59 PM", range: [1200, 1459] },
    { label: "3:00 PM - 5:59 PM", range: [1500, 1759] },
    { label: "6:00 PM - 8:59 PM", range: [1800, 2059] },
    { label: "9:00 PM - 11:59 PM", range: [2100, 2359] },
  ];

  // ------------------------------
  // DOM Elements & Dropdown Population
  // ------------------------------
  const dropdown = document.getElementById("collision-filter");
  const modeDropdown = document.getElementById("mode-filter");
  const slider = document.getElementById("slider-controls");
  const sliderLabel = document.getElementById("slider-label");

  // Populate the collision dropdown
  Object.entries(mannerOfCollisionMapping).forEach(([key, value]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = value;
    dropdown.appendChild(option);
  });

  // ------------------------------
  // Map Initialization
  // ------------------------------
  const mapOptions = {
    zoomSnap: 0.1,
    center: [37.4769, -82.5242],
    zoom: 12,
  };
  const map = L.map("map", mapOptions);
  // Create panes for ordering layers
  const setPanes = ["bottom", "middle", "top"];
  setPanes.forEach((pane, i) => {
    map.createPane(pane);
    map.getPane(pane).style.zIndex = 401 + i;
  });

  const imagery = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { attribution: "Imagery &copy; Esri", opacity: 0.8 }
  );

  const darkTopo = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }
  );

  const OSM = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  });

  const labels = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | PEC',
      pane: "top",
    }
  ).addTo(map);

  const basemaps = {
    Imagery: imagery,
    "Dark Gray": darkTopo,
    OpenStreetMap: OSM,
    // Labels: labels,
  };

  const basemapThumbnails = {
    Imagery: "images/imagery-thumb.jpg",
    "Dark Gray": "images/darkTopo-thumb.JPG",
    OpenStreetMap: "images/OSM-thumb.JPG",
  };

  imagery.addTo(map);
  labels.addTo(map);

  const basemapControl = L.control({ position: "topright" });

  basemapControl.onAdd = function (map) {
    const container = L.DomUtil.create(
      "div",
      "leaflet-control-layers leaflet-control"
    );
    container.innerHTML = `
    <button id="basemap-button" class="leaflet-bar">Switch Basemap</button>
    <div id="basemap-options" style="display:none; padding:5px; text-align:center;">
      ${Object.keys(basemaps)
        .map(
          (name) => `
        <img src="${basemapThumbnails[name]}" title="${name}" data-layer="${name}" style="width:50px;height:50px;margin:5px;cursor:pointer;border:2px solid #ccc;border-radius:5px;">
      `
        )
        .join("")}
    </div>
  `;
    return container;
  };

  basemapControl.addTo(map);

  // Add click listeners after a delay to ensure it's loaded
  setTimeout(() => {
    const basemapButton = document.getElementById("basemap-button");
    const basemapOptions = document.getElementById("basemap-options");

    basemapButton.addEventListener("click", () => {
      // Toggle showing thumbnails
      basemapOptions.style.display =
        basemapOptions.style.display === "none" ? "block" : "none";
    });

    document.querySelectorAll("#basemap-options img").forEach((img) => {
      img.addEventListener("click", function () {
        const layerName = this.getAttribute("data-layer");

        // Remove all basemaps and labels first
        Object.values(basemaps).forEach((layer) => map.removeLayer(layer));
        map.removeLayer(labels);

        // Add selected basemap
        basemaps[layerName].addTo(map);

        // If imagery selected, also add labels
        if (layerName === "Imagery") {
          labels.addTo(map);
        }

        // Update button text
        basemapButton.textContent = `${layerName}`;

        // Hide the thumbnail selector after choosing
        basemapOptions.style.display = "none";
      });
    });
  }, 1000);
  // ------------------------------
  // Data Filtering and Rendering Functions
  // ------------------------------
  function timeFilter(filteredData, timeRange) {
    return filteredData.filter((row) => {
      const crashTime = parseInt(row.CollisionTime, 10);
      return crashTime >= timeRange[0] && crashTime <= timeRange[1];
    });
  }

  function renderCrashes(data, crashLayers, mannerFilter, modeFilter) {
    Object.values(crashLayers).forEach((layerGroup) =>
      layerGroup.clearLayers()
    );
    data.forEach((row) => {
      const lat = parseFloat(row.Latitude);
      const lng = parseFloat(row.Longitude);
      const kabco = row.KABCO;
      if (isNaN(lat) || isNaN(lng)) return;
      const layerProp = layerProps.find((p) => p.id === kabco);
      if (!layerProp) return;
      if (mannerFilter && row.MannerofCollisionCode !== mannerFilter) return;
      if (
        modeFilter &&
        !modeMapping[modeFilter].some((factor) => row[factor] === "1")
      )
        return;

      const popupContent = `
          <u>KABCO</u>: ${layerProp.text}<br>
          <u>Manner of Collision</u>: ${
            mannerOfCollisionMapping[row.MannerofCollisionCode]
          }<br>
        `;
      const marker = L.circleMarker([lat, lng], {
        radius: layerProp.size,
        fillColor: layerProp.color,
        color: "#444",
        weight: 0.5,
        opacity: 1,
        fillOpacity: 1,
        pane: "top",
      });
      marker.bindPopup(popupContent);
      marker.on("mouseover", function () {
        this.setStyle({ color: "#00ffff", weight: 2 });
      });
      marker.on("mouseout", function () {
        this.setStyle({ color: "#444", weight: 0.5 });
      });
      crashLayers[kabco].addLayer(marker);
    });
  }

  // Helper function to animate number counting.
  function animateCount(element, start, end, duration) {
    let startTime = null;
    function animate(timestamp) {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const current = Math.floor(start + (end - start) * (progress / duration));
      element.textContent = current.toLocaleString();
      if (progress < duration) {
        requestAnimationFrame(animate);
      } else {
        element.textContent = end.toLocaleString();
      }
    }
    requestAnimationFrame(animate);
  }

  // ------------------------------
  // Main Data Loading & Rendering
  // ------------------------------
  async function fetchData() {
    showSpinner();

    // Load crash CSV and various GeoJSON files using await
    const [crashData, cityLimits, HIN, highwayPlan] = await Promise.all([
      d3.csv("data/etown-crashes.csv"),
      d3.json("data/city-limits.geojson"),
      d3.json("data/etowh-hin.geojson"),
      d3.json("data/current-highway-plan-etown.geojson"),
    ]);

    // Filter crash data
    const filteredData = crashData.filter(
      (row) => row.ParkingLotIndicator !== "Y"
    );

    // Initialize crashLayers and layersLabels for crash severities
    const crashLayers = {};
    const layersLabels = {};

    const cityLayer = L.geoJSON(cityLimits, {
      style: function (feature) {
        return {
          color: "#190781",
          weight: 4,
          fillOpacity: 0,
          opacity: 0.8,
        };
      },
    }).addTo(map);
    const bounds = cityLayer.getBounds().pad(1);
    map.fitBounds(cityLayer.getBounds(), { padding: [50, 75] });
    map.setMaxBounds(bounds);
    const hinStyle = {
      color: "#FF0000",
      weight: 6,
      zIndex: 400,
      pane: "bottom",
    };
    const highwayPlanStyle = {
      color: "#18b445",
      weight: 5,
      fillOpacity: 0,
      dashArray: "5, 8",
      // zIndex: 600,
      pane: "middle",
    };

    const HINLayer = L.geoJSON(HIN, {
      style: hinStyle,
      onEachFeature: function (feature, layer) {
        const props = feature.properties;
        const popupContent = `
          <h2>High Injury Network <br> Rank: ${
            props["Rank EPDO/ Mile"]
          }</h2><br><br>
          <u>Route Name</u>: ${props["Description"]}<br>
          <u>KA/Mile</u>: ${props["KA/MILE"].toFixed(2)}<br>
        `;
        layer.bindPopup(popupContent);
        layer.on("mouseover", function () {
          layer.setStyle({ color: "cyan", weight: 6 });
        });
        layer.on("mouseout", function () {
          layer.setStyle(hinStyle);
        });
      },
    });

    const highwayPlanLayer = L.geoJSON(highwayPlan, {
      style: highwayPlanStyle,
      onEachFeature: function (feature, layer) {
        const props = feature.properties;
        // const popupContent = `
        //   <h2>Current Highway Plan <br>
        //   KYTC No: ${props["Item No"]}</h2><br><br>
        //   <u>Route ID</u>: ${props["Description"]}<br>
        // `;
        const popupContent = `
          <h2>Current Highway Plan </h2><br><br>
          <u>Route ID</u>: ${props["Description"]}<br>
          <u>Status</u>: ${props["Project Type"]}<br>
        `;
        layer.bindPopup(popupContent);
        layer.on("mouseover", function () {
          layer.setStyle({ color: "cyan", weight: 6 });
        });
        layer.on("mouseout", function () {
          layer.setStyle(highwayPlanStyle);
        });
      },
    });

    // Process the data
    filteredData.forEach((row) => {
      if (!["K", "A", "B", "C", "O"].includes(row.KABCO)) {
        row.KABCO = "O";
      }
      if (
        !Object.keys(mannerOfCollisionMapping).includes(
          row.MannerofCollisionCode
        )
      ) {
        row.MannerofCollisionCode = "UNKNOWN";
      }
    });

    // Build crashLayers and legend labels for crash severities (with counts)
    layerProps.forEach((prop) => {
      crashLayers[prop.id] = L.layerGroup().addTo(map);
      const count = filteredData.filter((row) => row.KABCO === prop.id).length;
      const maxSize = Math.max(...layerProps.map((p) => p.size));
      const margin = maxSize - prop.size;
      const circleSymbol = `<span style="display:inline-block; width:${
        prop.size * 2
      }px; height:${prop.size * 2}px; background-color:${
        prop.color
      }; border: 0.1px solid #444; border-radius:50%; margin-left:${margin}px; margin-right:${
        margin + 5
      }px; vertical-align: middle; line-height: 0;"></span>`;
      // Notice the span with id is used for dynamic updates.
      const labelHTML = `<span class="legend-text" style="color:${
        prop.color
      }; display:inline-block;">
        ${circleSymbol}${prop.text} (<span id="count-${
        prop.id
      }">${count.toLocaleString()}</span>)
      </span>`;
      layersLabels[labelHTML] = crashLayers[prop.id];
    });

    const HINSymbol = `<span style="display:inline-block; width:20px; height:4px; background-color:#FF0000; margin-right:9px; vertical-align:middle;"></span>`;
    const hinLabel = `<span class="legend-text" style="color:#FF0000; display:inline-block;">
        ${HINSymbol}High Injury Network
      </span>`;
    layersLabels[hinLabel] = HINLayer;

    const highwayPlanSymbol = `<span style="display:inline-block; width:20px; height:4px; background-color:#18b445; margin-right:9px; vertical-align:middle;"></span>`;
    const highwayLabel = `<span class="legend-text" style="color:#18b445; display:inline-block;">
        ${highwayPlanSymbol}Current Highway Plan Projects
      </span>`;
    layersLabels[highwayLabel] = highwayPlanLayer;

    // Render crashes initially and set currentFilteredData to full filteredData.
    currentFilteredData = filteredData;
    renderCrashes(currentFilteredData, crashLayers, mannerFilter, modeFilter);

    // ------------------------------
    // Dynamic Legend Update Functions
    // ------------------------------

    // Function to update the KABCO counts for crashes dynamically.
    // Uses currentFilteredData instead of the full dataset.
    function updateCrashLegend() {
      layerProps.forEach((prop) => {
        const countElem = document.getElementById(`count-${prop.id}`);
        if (!countElem) return;
        const newCount = map.hasLayer(crashLayers[prop.id])
          ? currentFilteredData.filter((row) => row.KABCO === prop.id).length
          : 0;

        // Start the animation after a 300ms delay.
        setTimeout(() => {
          // Animate from 0 to newCount over 600ms.
          animateCount(countElem, 0, newCount, 300);
        }, 50);
      });
    }

    // ------------------------------
    // Intersection Layers and EPDO Legend Graphic
    // ------------------------------

    const [signalizedData, unsignalizedData] = await Promise.all([
      d3.json("data/signalized-intersections.geojson"),
      d3.json("data/unsignalized-intersections.geojson"),
    ]);

    const combinedIntersectionFeatures = signalizedData.features.concat(
      unsignalizedData.features
    );
    const intersectionEPDOValues = combinedIntersectionFeatures
      .map((f) => +f.properties.EPDO)
      .filter((v) => !isNaN(v));
    const minIntersectionEPDO = Math.min(...intersectionEPDOValues);
    const maxIntersectionEPDO = Math.max(...intersectionEPDOValues);

    // Helper to calculate radius for intersections (adjust scaleFactor to increase sizes)
    function calcRadius(val) {
      const radius = Math.sqrt(val / Math.PI);
      const scaleFactor = 2.5; // Increase overall sizes
      return radius * 0.5 * scaleFactor;
    }

    function createIntersectionLayer(data, fillColor, strokeColor) {
      return L.geoJSON(data, {
        pointToLayer: function (feature, latlng) {
          const EPDO = +feature.properties.EPDO;
          const radius = calcRadius(EPDO);
          const marker = L.circleMarker(latlng, {
            radius: radius,
            fillColor: fillColor,
            color: strokeColor,
            weight: 1,
            fillOpacity: 0.8,
            pane: "top",
          });

          const rankText =
            feature.properties.SignalRank != null
              ? `<u>Signalized Rank:</u> ${feature.properties.SignalRank}<br>`
              : feature.properties.UnsignalRank != null
              ? `<u>Unsignalized Rank:</u> ${feature.properties.UnsignalRank}<br>`
              : "";

          const crashTotal = feature.properties.CrashTotal;
          const ka = feature.properties.KA;
          // const mainRt = feature.properties.MAINRT_NAME || "N/A";
          // const secondRt = feature.properties.SECONDRT_NAME || "N/A";
          const intDesc = feature.properties.Intersection || "N/A";
          const intersectionText = `<u>Intersection of ${intDesc}</u><br>`;

          const popupContent = `
            <h2>${rankText}</h2>
            ${intersectionText}
            <u>EPDO Score</u>: ${EPDO.toLocaleString()}<br>
            <u>KA Crashes</u>: ${ka}<br>
          `;
          marker.bindPopup(popupContent);
          marker.on("mouseover", function () {
            this.setStyle({ color: "#00ffff", weight: 2 });
          });
          marker.on("mouseout", function () {
            this.setStyle({ color: strokeColor, weight: 1 });
          });
          return marker;
        },
      });
    }

    const signalizedLayer = createIntersectionLayer(
      signalizedData,
      "#FFAA00",
      "#AA5500"
    );
    const unsignalizedLayer = createIntersectionLayer(
      unsignalizedData,
      "#00AAFF",
      "#0055AA"
    );

    const signalizedIntLabel = `<span class="legend-text" style="color:#AA5500; display:inline-block;">
         <span style="display:inline-block; width:12px; height:12px; background-color:#FFAA00; border:1px solid #AA5500; border-radius:50%; margin-right:5px;"></span>
         Prioritized Signalized Intersections
      </span>`;
    layersLabels[signalizedIntLabel] = signalizedLayer;
    const unsignalizedIntLabel = `<span class="legend-text" style="color:#0055AA; display:inline-block;">
         <span style="display:inline-block; width:12px; height:12px; background-color:#00AAFF; border:1px solid #0055AA; border-radius:50%; margin-right:5px;"></span>
         Prioritized Unsignalized Intersections
      </span>`;
    layersLabels[unsignalizedIntLabel] = unsignalizedLayer;

    const maxValueRounded = Math.round(maxIntersectionEPDO / 1000) * 1000;
    const largeDiameter = calcRadius(maxValueRounded) * 2;
    const smallDiameter = largeDiameter / 2;
    const largeDiameterStr = largeDiameter.toFixed() + "px";
    const smallDiameterStr = smallDiameter.toFixed() + "px";

    const EPDOGraphic = `
    <div style="position: relative; width:${largeDiameterStr}; height:${largeDiameterStr};">
        <div style="position: absolute; top: 0; left: 0; width:${largeDiameterStr}; height:${largeDiameterStr};
                    border-radius: 50%; background-color:#ddd; border: 1px solid #888;"></div>
        <div style="position: absolute; top: 0; left: 50%; width: 40px; height: 1px; background: #888;"></div>
        <div style="position: absolute; top: -10px; left: calc(50% + 45px); font-size: 12px; margin: 5px;">
          ${maxIntersectionEPDO.toLocaleString()}
        </div>
        
        <div style="position: absolute; top: calc(100% - ${smallDiameterStr}); 
                    left: calc(50% - ${(smallDiameter / 2).toFixed()}px); 
                    width:${smallDiameterStr}; height:${smallDiameterStr};
                    border-radius: 50%; background-color:#ddd; border: 1px solid #888;"></div>
        <div style="position: absolute; top: calc(100% - ${smallDiameterStr}); left: 50%; 
                    width: 40px; height: 1px; background: #888;"></div>
        <div style="position: absolute; top: calc(100% - ${smallDiameterStr} - 10px); left: calc(50% + 45px); font-size: 12px; margin: 5px;">
          ${minIntersectionEPDO.toLocaleString()}
        </div>
      </div>
    `;
    const EPDOLegendLabel = `
      <div class="legend-text" style="margin: 5px; pointer-events: none;">
        <div>EPDO Score Range:</div>
        <div style="margin-top: 10px;">
          ${EPDOGraphic}
        </div>
      </div>
    `;
    layersLabels[EPDOLegendLabel] = null; // Non-toggleable

    // ------------------------------
    // Legend Injection & Toggle Setup
    // ------------------------------
    const legendDiv = document.getElementById("legend");
    const legendKeys = Object.keys(layersLabels);
    let legendHTML = `<div class="legend-items" style="text-align: left;">`;
    legendKeys.forEach((key, i) => {
      if (layersLabels[key]) {
        legendHTML += `<div class="legend-item" data-index="${i}" style="margin: 5px 0; cursor: pointer;">
                          ${key}
                        </div>`;
      } else {
        legendHTML += `<div class="legend-item" style="margin: 5px 0;">
                          ${key}
                        </div>`;
      }
    });
    legendHTML += `</div>`;
    legendDiv.innerHTML = legendHTML;

    // Add toggle functionality for legend items that represent layers
    const legendItems = legendDiv.querySelectorAll(".legend-item[data-index]");
    legendItems.forEach((item) => {
      const index = item.getAttribute("data-index");
      const key = legendKeys[index];
      const layer = layersLabels[key];
      // Check if this legend item is for a crash layer (KABCO) by looking for "count-" in its HTML.
      const isCrashLayer = key.indexOf("count-") !== -1;

      if (!map.hasLayer(layer)) {
        item.style.opacity = "0.4";
      } else {
        item.style.opacity = "1";
      }
      item.addEventListener("click", function () {
        if (map.hasLayer(layer)) {
          map.removeLayer(layer);
          item.style.opacity = "0.4";
          // If this is a crash layer, update its count immediately to 0.
          if (isCrashLayer) {
            // Extract the KABCO id using a regex.
            const match = key.match(/id="count-([^"]+)"/);
            if (match) {
              const crashId = match[1];
              const countElem = document.getElementById(`count-${crashId}`);
              if (countElem) countElem.textContent = "0";
            }
          }
        } else {
          map.addLayer(layer);
          item.style.opacity = "1";
          // Only animate the count for this crash layer.
          if (isCrashLayer) {
            const match = key.match(/id="count-([^"]+)"/);
            if (match) {
              const crashId = match[1];
              const countElem = document.getElementById(`count-${crashId}`);
              if (countElem) {
                const newCount = currentFilteredData.filter(
                  (row) => row.KABCO === crashId
                ).length;
                // Animate after a 300ms delay.
                setTimeout(() => {
                  animateCount(countElem, 0, newCount, 300);
                }, 50);
              }
            }
          }
        }
      });
    });

    // ------------------------------
    // Filter Event Listeners
    // ------------------------------

    // Slider event listener
    slider.addEventListener("input", function (e) {
      const index = e.target.value;
      currentTimeRange = timeGroups[index].range;
      sliderLabel.textContent = timeGroups[index].label;
      const filteredByTime = timeFilter(filteredData, currentTimeRange);
      const filtered = filteredByTime.filter((row) => {
        if (mannerFilter && row.MannerofCollisionCode !== mannerFilter)
          return false;
        if (
          modeFilter &&
          !modeMapping[modeFilter].some((factor) => row[factor] === "1")
        )
          return false;
        return true;
      });
      currentFilteredData = filtered;
      renderCrashes(currentFilteredData, crashLayers);
      updateCrashLegend();
    });

    // Dropdown event listener (for collision filter)
    dropdown.addEventListener("change", (e) => {
      mannerFilter = e.target.value;
      const filteredByTime = timeFilter(filteredData, currentTimeRange);
      const filtered = filteredByTime.filter((row) => {
        return (
          (!mannerFilter || row.MannerofCollisionCode === mannerFilter) &&
          (!modeFilter ||
            modeMapping[modeFilter].some((factor) => row[factor] === "1"))
        );
      });
      currentFilteredData = filtered;
      renderCrashes(currentFilteredData, crashLayers);
      updateCrashLegend();
    });

    // Mode dropdown event listener
    modeDropdown.addEventListener("change", (e) => {
      modeFilter = e.target.value;
      const filteredByTime = timeFilter(filteredData, currentTimeRange);
      const filtered = filteredByTime.filter((row) => {
        return (
          (!mannerFilter || row.MannerofCollisionCode === mannerFilter) &&
          (!modeFilter ||
            modeMapping[modeFilter].some((factor) => row[factor] === "1"))
        );
      });
      currentFilteredData = filtered;
      renderCrashes(currentFilteredData, crashLayers);
      updateCrashLegend();
    });

    // Call updateCrashLegend once after initial load.
    updateCrashLegend();

    hideSpinner();
  }

  fetchData();
})();
