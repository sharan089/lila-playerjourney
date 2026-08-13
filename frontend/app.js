// ============================================================
// LILA PLAYER JOURNEY VISUALIZER
// ============================================================

// ------------------------------------------------------------
// PATHS
// ------------------------------------------------------------

const MATCH_INDEX_URL = "../processed_data/matches.json";

const MATCH_FOLDER = "../processed_data/matches/";

const MINIMAP_FOLDER = "../player_data/minimaps/";


// ------------------------------------------------------------
// MINIMAP FILES
// ------------------------------------------------------------

const MINIMAPS = {
    AmbroseValley: "AmbroseValley_Minimap.png",
    GrandRift: "GrandRift_Minimap.png",
    Lockdown: "Lockdown_Minimap.jpg"
};


// ------------------------------------------------------------
// DOM ELEMENTS
// ------------------------------------------------------------

const mapSelect = document.getElementById("mapSelect");
const dateSelect = document.getElementById("dateSelect");
const matchSelect = document.getElementById("matchSelect");

const mapImage = document.getElementById("mapImage");
const mapCanvas = document.getElementById("mapCanvas");
const mapPlaceholder = document.getElementById("mapPlaceholder");

const mapTitle = document.getElementById("mapTitle");
const matchInfo = document.getElementById("matchInfo");

const playerCount = document.getElementById("playerCount");
const humanCount = document.getElementById("humanCount");
const botCount = document.getElementById("botCount");
const eventCount = document.getElementById("eventCount");

const playButton = document.getElementById("playButton");
const resetButton = document.getElementById("resetButton");

const timeline = document.getElementById("timeline");

const currentTime = document.getElementById("currentTime");
const totalTime = document.getElementById("totalTime");

const matchAnalyticsSummary = document.getElementById("matchAnalyticsSummary");
const topPlayerSummary = document.getElementById("topPlayerSummary");
const playerAnalyticsBody = document.getElementById("playerAnalyticsBody");
const playerJourneyMeta = document.getElementById("playerJourneyMeta");
const playerJourneyList = document.getElementById("playerJourneyList");
const matchInsightsList = document.getElementById("matchInsightsList");


// ------------------------------------------------------------
// APPLICATION STATE
// ------------------------------------------------------------

let matchIndex = [];

let currentMatch = null;

let animationTimer = null;

let isPlaying = false;

let currentElapsed = 0;

let mapReady = false;

let heatmapMode = "off";

let playbackSpeed = 0.5;

let selectedPlayerId = null;
let currentPlayerDisplayMap = new Map();


// ------------------------------------------------------------
// INITIALIZATION
// ------------------------------------------------------------

async function initialize() {

    try {

        console.log("Loading LILA match index...");

        const response = await fetch(MATCH_INDEX_URL);

        if (!response.ok) {
            throw new Error(
                `Could not load matches.json (${response.status})`
            );
        }

        matchIndex = await response.json();

        console.log(
            `Loaded ${matchIndex.length} matches`
        );

        populateDates();

        populateMatches();

        ensureHeatmapControl();
        ensurePlaybackSpeedControl();
        ensureEventLegend();

    } catch (error) {

        console.error(error);

        matchInfo.textContent =
            "Could not load match data. Make sure the frontend is running through a local server.";

    }
}


function ensureHeatmapControl() {

    const timelinePanel =
        document.querySelector(".timeline-panel");

    if (!timelinePanel ||
        timelinePanel.querySelector("[data-heatmap-control='true']")) {
        return;
    }

    const heatmapWrap =
        document.createElement("div");

    heatmapWrap.dataset.heatmapControl = "true";
    heatmapWrap.style.display = "flex";
    heatmapWrap.style.alignItems = "center";
    heatmapWrap.style.gap = "8px";
    heatmapWrap.style.flexWrap = "wrap";
    heatmapWrap.style.marginTop = "12px";
    heatmapWrap.style.paddingTop = "12px";
    heatmapWrap.style.borderTop = "1px solid rgba(255,255,255,0.08)";

    const label = document.createElement("span");
    label.textContent = "Heatmap:";
    label.style.color = "#8e98a7";
    label.style.fontSize = "12px";
    label.style.fontWeight = "600";
    label.style.letterSpacing = "0.4px";
    label.style.textTransform = "uppercase";

    heatmapWrap.appendChild(label);

    const modes = [
        { value: "off", label: "Off" },
        { value: "traffic", label: "Traffic" },
        { value: "kills", label: "Kills" },
        { value: "deaths", label: "Deaths" }
    ];

    modes.forEach(mode => {

        const button =
            document.createElement("button");

        button.type = "button";
        button.dataset.mode = mode.value;
        button.textContent = mode.label;
        button.style.border = "1px solid #303743";
        button.style.borderRadius = "6px";
        button.style.background =
            mode.value === "off"
                ? "#181d26"
                : "#11151c";
        button.style.color =
            mode.value === "off"
                ? "#dfe7f3"
                : "#aeb8c4";
        button.style.padding = "6px 10px";
        button.style.fontSize = "12px";
        button.style.cursor = "pointer";
        button.style.transition = "all 0.15s ease";

        button.addEventListener("click", function () {
            heatmapMode = mode.value;
            updateHeatmapButtons();
            drawVisualization();
        });

        heatmapWrap.appendChild(button);
    });

    timelinePanel.appendChild(heatmapWrap);
    updateHeatmapButtons();
}


function updateHeatmapButtons() {

    const buttons =
        document.querySelectorAll("[data-mode]");

    buttons.forEach(button => {
        const isActive =
            button.dataset.mode === heatmapMode;

        button.style.background =
            isActive ? "#e8edf5" : "#11151c";
        button.style.color =
            isActive ? "#11151c" : "#aeb8c4";
        button.style.borderColor =
            isActive ? "#e8edf5" : "#303743";
        button.style.fontWeight =
            isActive ? "700" : "500";
    });
}


function clearAnalytics() {

    const placeholderMetrics = [
        { label: "Duration", value: "—" },
        { label: "Players", value: "—" },
        { label: "Humans", value: "—" },
        { label: "Bots", value: "—" },
        { label: "Events", value: "—" },
        { label: "Kills", value: "—" },
        { label: "Deaths", value: "—" },
        { label: "Loot", value: "—" },
        { label: "Bot Kills", value: "—" },
        { label: "Storm Deaths", value: "—" }
    ];

    if (matchAnalyticsSummary) {
        matchAnalyticsSummary.innerHTML =
            placeholderMetrics.map(metric => `
                <div class="match-metric">
                    <span class="match-metric-label">${metric.label}</span>
                    <span class="match-metric-value">${metric.value}</span>
                </div>
            `).join("");
    }

    if (topPlayerSummary) {
        topPlayerSummary.textContent = "No match selected";
    }

    if (playerAnalyticsBody) {
        playerAnalyticsBody.innerHTML = "";
    }

    if (playerJourneyMeta) {
        playerJourneyMeta.textContent = "Select a player from the analytics table to view their journey.";
    }

    if (playerJourneyList) {
        playerJourneyList.innerHTML = "";
    }

    if (matchInsightsList) {
        matchInsightsList.innerHTML = "";
    }
}


function formatNumber(value, digits = 1) {

    if (!Number.isFinite(value)) {
        return "—";
    }

    return Number(value).toFixed(digits);
}


function formatDistance(value) {
    return formatNumber(value, 1);
}


function formatSpeed(value) {
    if (!Number.isFinite(value) || value <= 0) {
        return "—";
    }

    return `${formatNumber(value, 2)}/s`;
}


function formatTime(milliseconds) {
    const safeMs = Number.isFinite(milliseconds)
        ? Math.max(0, Number(milliseconds))
        : 0;

    if (safeMs >= 60000) {
        const totalMs = Math.floor(safeMs);
        const minutes = Math.floor(totalMs / 60000);
        const seconds = Math.floor((totalMs % 60000) / 1000);
        const ms = totalMs % 1000;

        return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
    }

    const seconds = safeMs / 1000;
    return `${Number(seconds.toFixed(3)).toString()} s`;
}


function getDisplayNameForPlayer(match, userId) {
    const id = String(userId);

    if (!match) {
        return id;
    }

    if (!currentPlayerDisplayMap.size || !match || match.match_id !== currentMatch?.match_id) {
        currentPlayerDisplayMap = new Map();

        const orderedIds = [];
        const seen = new Set();

        if (Array.isArray(match.players)) {
            match.players.forEach(player => {
                const playerId = String(player.user_id);
                if (!seen.has(playerId)) {
                    seen.add(playerId);
                    orderedIds.push(playerId);
                }
            });
        }

        if (Array.isArray(match.events)) {
            match.events.forEach(event => {
                const eventId = String(event.user_id);
                if (!seen.has(eventId)) {
                    seen.add(eventId);
                    orderedIds.push(eventId);
                }
            });
        }

        let humanIndex = 0;
        let botIndex = 0;

        orderedIds.forEach(playerId => {
            const player = Array.isArray(match.players)
                ? match.players.find(entry => String(entry.user_id) === playerId)
                : null;

            const playerType = player && player.type
                ? String(player.type).toLowerCase()
                : (String(playerId).match(/^\d+$/) ? "bot" : "human");

            if (playerType === "bot") {
                botIndex += 1;
                currentPlayerDisplayMap.set(playerId, `Bot ${botIndex}`);
            } else {
                humanIndex += 1;
                currentPlayerDisplayMap.set(playerId, `Player ${humanIndex}`);
            }
        });
    }

    return currentPlayerDisplayMap.get(id) || id;
}


function getPlayerTypeLabel(match, userId) {
    const id = String(userId);

    if (Array.isArray(match?.players)) {
        const player = match.players.find(entry => String(entry.user_id) === id);
        if (player && player.type) {
            return String(player.type).charAt(0).toUpperCase() + String(player.type).slice(1);
        }
    }

    return String(id).match(/^\d+$/) ? "Bot" : "Human";
}


function formatEventTime(milliseconds) {
    const safeMs = Number.isFinite(milliseconds) ? Math.max(0, Number(milliseconds)) : 0;
    const totalMs = Math.floor(safeMs);
    const minutes = Math.floor(totalMs / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const ms = totalMs % 1000;

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}


function getPlayerPositionEvents(match, userId) {

    if (!match || !Array.isArray(match.events)) {
        return [];
    }

    return match.events
        .filter(event =>
            String(event.user_id) === String(userId) &&
            (
                event.event === "Position" ||
                event.event === "BotPosition"
            )
        )
        .sort((a, b) =>
            getEventElapsedMs(a, match) - getEventElapsedMs(b, match)
        );
}


function computePlayerAnalytics(match) {

    if (!match || !Array.isArray(match.events)) {
        return [];
    }

    const playerMap = new Map();

    match.events.forEach(event => {

        const userId = String(event.user_id);

        if (!playerMap.has(userId)) {
            playerMap.set(userId, {
                user_id: userId,
                type: event.type === "bot" ? "Bot" : "Human",
                positionEvents: 0,
                movementDistance: 0,
                activeStart: null,
                activeEnd: null,
                kills: 0,
                deaths: 0,
                loot: 0,
                botKills: 0,
                stormDeaths: 0,
                totalEvents: 0
            });
        }

        const stats = playerMap.get(userId);
        stats.totalEvents += 1;

        if (
            event.event === "Position" ||
            event.event === "BotPosition"
        ) {
            stats.positionEvents += 1;
            stats.activeStart =
                stats.activeStart === null
                    ? getEventElapsedMs(event, match)
                    : Math.min(stats.activeStart, getEventElapsedMs(event, match));
            stats.activeEnd =
                stats.activeEnd === null
                    ? getEventElapsedMs(event, match)
                    : Math.max(stats.activeEnd, getEventElapsedMs(event, match));
        }

        if (
            event.event === "Kill" ||
            event.event === "BotKill"
        ) {
            stats.kills += 1;
            if (event.event === "BotKill") {
                stats.botKills += 1;
            }
        }

        if (
            event.event === "Killed" ||
            event.event === "BotKilled" ||
            event.event === "KilledByStorm"
        ) {
            stats.deaths += 1;
            if (event.event === "KilledByStorm") {
                stats.stormDeaths += 1;
            }
        }

        if (event.event === "Loot") {
            stats.loot += 1;
        }
    });

    const players = [];

    playerMap.forEach(stats => {

        const positionEvents =
            getPlayerPositionEvents(match, stats.user_id);

        let movementDistance = 0;

        for (let i = 1; i < positionEvents.length; i++) {
            const previous = positionEvents[i - 1];
            const current = positionEvents[i];

            if (
                previous.x === undefined ||
                previous.z === undefined ||
                current.x === undefined ||
                current.z === undefined
            ) {
                continue;
            }

            movementDistance += Math.hypot(
                current.x - previous.x,
                current.z - previous.z
            );
        }

        const first = positionEvents[0];
        const last = positionEvents[positionEvents.length - 1];
        const firstElapsedMs = first ? getEventElapsedMs(first, match) : 0;
        const lastElapsedMs = last ? getEventElapsedMs(last, match) : 0;
        const activeMs =
            first && last
                ? Math.max(0, lastElapsedMs - firstElapsedMs)
                : 0;
        const activeTimeSeconds = activeMs > 0 ? activeMs / 1000 : 0;
        const speed =
            activeTimeSeconds > 0
                ? movementDistance / activeTimeSeconds
                : 0;

        players.push({
            user_id: stats.user_id,
            type: stats.type,
            positionEvents: stats.positionEvents,
            distance: movementDistance,
            speed,
            kills: stats.kills,
            deaths: stats.deaths,
            loot: stats.loot,
            botKills: stats.botKills,
            stormDeaths: stats.stormDeaths,
            activeMs,
            firstPosition: first || null,
            lastPosition: last || null,
            eventCount: stats.totalEvents
        });
    });

    return players.sort((a, b) => {
        if (b.kills !== a.kills) {
            return b.kills - a.kills;
        }
        return b.distance - a.distance;
    });
}


function computeMatchAnalytics(match) {

    if (!match) {
        return {
            duration: 0,
            totalPlayers: 0,
            humans: 0,
            bots: 0,
            totalEvents: 0,
            positionEvents: 0,
            kills: 0,
            deaths: 0,
            loot: 0,
            botKills: 0,
            stormDeaths: 0
        };
    }

    const duration =
        getMatchDurationMs(match);

    const players =
        Array.isArray(match.players) ? match.players : [];

    const totalEvents =
        Array.isArray(match.events) ? match.events.length : 0;

    const matchSummary = {
        duration,
        totalPlayers: players.length,
        humans: players.filter(player => String(player.type).toLowerCase() === "human").length,
        bots: players.filter(player => String(player.type).toLowerCase() === "bot").length,
        totalEvents,
        positionEvents: 0,
        kills: 0,
        deaths: 0,
        loot: 0,
        botKills: 0,
        stormDeaths: 0
    };

    if (Array.isArray(match.events)) {
        match.events.forEach(event => {
            if (
                event.event === "Position" ||
                event.event === "BotPosition"
            ) {
                matchSummary.positionEvents += 1;
            }

            if (
                event.event === "Kill" ||
                event.event === "BotKill"
            ) {
                matchSummary.kills += 1;
            }

            if (
                event.event === "Killed" ||
                event.event === "BotKilled" ||
                event.event === "KilledByStorm"
            ) {
                matchSummary.deaths += 1;
            }

            if (event.event === "Loot") {
                matchSummary.loot += 1;
            }

            if (event.event === "BotKill") {
                matchSummary.botKills += 1;
            }

            if (event.event === "KilledByStorm") {
                matchSummary.stormDeaths += 1;
            }
        });
    }

    return matchSummary;
}


function updateAnalytics() {

    if (!currentMatch) {
        clearAnalytics();
        return;
    }

    const matchSummary =
        computeMatchAnalytics(currentMatch);

    const playerSummary =
        computePlayerAnalytics(currentMatch);

    if (playerSummary.length) {
        playerSummary.forEach(player => {
            if (!player.firstPosition || !player.lastPosition) {
                return;
            }

            const firstMovementElapsedMs =
                Number(getEventElapsedMs(player.firstPosition, currentMatch));
            const lastMovementElapsedMs =
                Number(getEventElapsedMs(player.lastPosition, currentMatch));
            const activeTimeSeconds =
                Number.isFinite(firstMovementElapsedMs) && Number.isFinite(lastMovementElapsedMs)
                    ? (lastMovementElapsedMs - firstMovementElapsedMs) / 1000
                    : 0;
            const averageSpeed =
                activeTimeSeconds > 0
                    ? player.distance / activeTimeSeconds
                    : 0;

            console.debug("PLAYER_SPEED_DEBUG", {
                user_id: player.user_id,
                firstMovementElapsedMs,
                lastMovementElapsedMs,
                active_time_seconds: activeTimeSeconds,
                total_distance: player.distance,
                average_speed: averageSpeed
            });
        });
    }

    if (matchAnalyticsSummary) {
        const metrics = [
            { label: "Duration", value: formatTime(matchSummary.duration) },
            { label: "Players", value: String(matchSummary.totalPlayers) },
            { label: "Humans", value: String(matchSummary.humans) },
            { label: "Bots", value: String(matchSummary.bots) },
            { label: "Events", value: String(matchSummary.totalEvents) },
            { label: "Kills", value: String(matchSummary.kills) },
            { label: "Deaths", value: String(matchSummary.deaths) },
            { label: "Loot", value: String(matchSummary.loot) },
            { label: "Bot Kills", value: String(matchSummary.botKills) },
            { label: "Storm Deaths", value: String(matchSummary.stormDeaths) }
        ];

        matchAnalyticsSummary.innerHTML =
            metrics.map(metric => `
                <div class="match-metric">
                    <span class="match-metric-label">${metric.label}</span>
                    <span class="match-metric-value">${metric.value}</span>
                </div>
            `).join("");
    }

    const topPlayer =
        playerSummary.length
            ? playerSummary.reduce((best, player) => {
                if (
                    player.kills > best.kills ||
                    (
                        player.kills === best.kills &&
                        player.distance > best.distance
                    )
                ) {
                    return player;
                }
                return best;
            }, playerSummary[0])
            : null;

    if (topPlayerSummary) {
        if (!topPlayer) {
            topPlayerSummary.textContent = "No player analytics available for this match.";
        } else {
            const displayName = getDisplayNameForPlayer(currentMatch, topPlayer.user_id);
            topPlayerSummary.textContent =
                `Top Player: ${displayName} (${topPlayer.type}) — ${topPlayer.kills} kills, ${formatDistance(topPlayer.distance)} distance`;
        }
    }

    if (playerAnalyticsBody) {
        if (!playerSummary.length) {
            playerAnalyticsBody.innerHTML = `
                <tr>
                    <td colspan="8">No player data available.</td>
                </tr>
            `;
        } else {
            playerAnalyticsBody.innerHTML =
                playerSummary.map(player => {
                    const isSelected = String(selectedPlayerId) === String(player.user_id);
                    const displayName = getDisplayNameForPlayer(currentMatch, player.user_id);
                    return `
                        <tr
                            class="${String(player.type).toLowerCase()} ${isSelected ? "selected-player" : ""}"
                            data-player-id="${player.user_id}"
                            title="${isSelected ? "Click to clear selection" : "Click to highlight this player"}"
                        >
                            <td>${displayName}</td>
                            <td>${player.type}</td>
                            <td>${formatDistance(player.distance)}</td>
                            <td>${formatSpeed(player.speed)}</td>
                            <td>${player.kills}</td>
                            <td>${player.deaths}</td>
                            <td>${player.loot}</td>
                            <td>${player.positionEvents}</td>
                        </tr>
                    `;
                }).join("");

            playerAnalyticsBody.querySelectorAll("tr[data-player-id]").forEach(row => {
                row.addEventListener("click", function () {
                    const playerId = String(row.dataset.playerId);

                    if (selectedPlayerId === playerId) {
                        selectedPlayerId = null;
                    } else {
                        selectedPlayerId = playerId;
                    }

                    updateAnalytics();
                    drawVisualization();
                });
            });
        }
    }

    renderPlayerJourney();
    renderMatchInsights();
}


function renderPlayerJourney() {
    if (!playerJourneyMeta || !playerJourneyList) {
        return;
    }

    if (!currentMatch || !selectedPlayerId) {
        playerJourneyMeta.textContent = "Select a player from the analytics table to view their journey.";
        playerJourneyList.innerHTML = "";
        return;
    }

    const playerAnalytics = computePlayerAnalytics(currentMatch);
    const selectedPlayer = playerAnalytics.find(player => String(player.user_id) === String(selectedPlayerId));
    const displayName = getDisplayNameForPlayer(currentMatch, selectedPlayerId);
    const playerType = selectedPlayer ? selectedPlayer.type : getPlayerTypeLabel(currentMatch, selectedPlayerId);

    if (!selectedPlayer) {
        playerJourneyMeta.textContent = `${displayName} · ${playerType}`;
        playerJourneyList.innerHTML = "<div class=\"journey-empty\">No events available for this player.</div>";
        return;
    }

    const selectedPlayerSummary = `
        <div class="journey-summary">
            <div class="journey-summary-title">${displayName} · ${playerType}</div>
            <div class="journey-summary-grid">
                <div><span>Distance:</span> ${formatDistance(selectedPlayer.distance)}</div>
                <div><span>Avg Speed:</span> ${formatSpeed(selectedPlayer.speed)}</div>
                <div><span>Kills:</span> ${selectedPlayer.kills}</div>
                <div><span>Deaths:</span> ${selectedPlayer.deaths}</div>
                <div><span>Loot:</span> ${selectedPlayer.loot}</div>
                <div><span>Events:</span> ${selectedPlayer.eventCount}</div>
            </div>
        </div>
    `;

    playerJourneyMeta.innerHTML = selectedPlayerSummary;

    const playerEvents = (currentMatch.events || [])
        .filter(event => String(event.user_id) === String(selectedPlayerId))
        .sort((a, b) => getEventElapsedMs(a, currentMatch) - getEventElapsedMs(b, currentMatch));

    if (!playerEvents.length) {
        playerJourneyList.innerHTML = "<div class=\"journey-empty\">No events available for this player.</div>";
        return;
    }

    playerJourneyList.innerHTML = playerEvents.map(event => {
        const elapsedMs = getEventElapsedMs(event, currentMatch);
        const timeText = formatEventTime(elapsedMs);
        const isPosition = event.event === "Position" || event.event === "BotPosition";
        const category =
            event.event === "Loot" ? "loot" :
            event.event === "Kill" || event.event === "BotKill" ? "kill" :
            event.event === "Killed" || event.event === "BotKilled" ? "death" :
            event.event === "KilledByStorm" ? "storm" :
            isPosition ? "movement" : "event";

        if (isPosition) {
            const xValue = event.x !== undefined ? Number(event.x).toFixed(2) : "—";
            const zValue = event.z !== undefined ? Number(event.z).toFixed(2) : "—";
            return `
                <div class="journey-item ${category}">
                    <div class="journey-time">${timeText}</div>
                    <div class="journey-event">${event.event}</div>
                    <div class="journey-position">X ${xValue} / Z ${zValue}</div>
                </div>
            `;
        }

        return `
            <div class="journey-item ${category}">
                <div class="journey-time">${timeText}</div>
                <div class="journey-event">${event.event}</div>
            </div>
        `;
    }).join("");
}


function computeMatchInsights(match) {
    if (!match) {
        return {
            totalPlayers: 0,
            humanCount: 0,
            botCount: 0,
            totalEvents: 0,
            totalKills: 0,
            totalDeaths: 0,
            totalLoot: 0,
            totalStormDeaths: 0,
            mostActivePlayer: "—",
            highestDistancePlayer: "—",
            mostKillsPlayer: "—",
            mostLootPlayer: "—",
            mostActiveArea: "—"
        };
    }

    const playerAnalytics = computePlayerAnalytics(match);
    const totalPlayers = Array.isArray(match.players) ? match.players.length : 0;
    const humanCount = Number(match.human_count ?? (Array.isArray(match.players) ? match.players.filter(player => String(player.type).toLowerCase() === "human").length : 0));
    const botCount = Number(match.bot_count ?? (Array.isArray(match.players) ? match.players.filter(player => String(player.type).toLowerCase() === "bot").length : 0));
    const totalEvents = Number(match.event_count ?? (Array.isArray(match.events) ? match.events.length : 0));

    const totalKills = (match.events || []).filter(event => event.event === "Kill" || event.event === "BotKill").length;
    const totalDeaths = (match.events || []).filter(event => event.event === "Killed" || event.event === "BotKilled" || event.event === "KilledByStorm").length;
    const totalLoot = (match.events || []).filter(event => event.event === "Loot").length;
    const totalStormDeaths = (match.events || []).filter(event => event.event === "KilledByStorm").length;

    const summarizeTop = (rows, valueKey, label) => {
        if (!rows.length) {
            return "—";
        }

        const maxValue = Math.max(...rows.map(row => Number(row[valueKey] || 0)));
        const winners = rows.filter(row => Number(row[valueKey] || 0) === maxValue);
        const values = winners.map(row => `${getDisplayNameForPlayer(match, row.user_id)} (${Number(row[valueKey]).toFixed(1)} ${label})`);
        return values.length === 1 ? values[0] : values.join(" and ");
    };

    const mostActivePlayer = summarizeTop(playerAnalytics, "eventCount", "events");
    const highestDistancePlayer = summarizeTop(playerAnalytics, "distance", "distance");
    const mostKillsPlayer = summarizeTop(playerAnalytics, "kills", "kills");
    const mostLootPlayer = summarizeTop(playerAnalytics, "loot", "loot");

    let mostActiveArea = "—";
    const gridEvents = (match.events || []).filter(event =>
        (event.event === "Position" || event.event === "BotPosition") &&
        Number.isFinite(Number(event.pixel_x)) &&
        Number.isFinite(Number(event.pixel_y))
    );

    if (gridEvents.length) {
        const gridColumns = 32;
        const gridRows = 32;
        const cellMap = new Map();

        gridEvents.forEach(event => {
            const x = Number(event.pixel_x);
            const y = Number(event.pixel_y);
            const cellX = Math.min(gridColumns - 1, Math.max(0, Math.floor(x / 32)));
            const cellY = Math.min(gridRows - 1, Math.max(0, Math.floor(y / 32)));
            const key = `${cellX}:${cellY}`;
            cellMap.set(key, (cellMap.get(key) || 0) + 1);
        });

        const maxCellCount = Math.max(...cellMap.values());
        const winningCells = [...cellMap.entries()].filter(([, count]) => count === maxCellCount);

        if (winningCells.length) {
            const areaText = winningCells.map(([key]) => {
                const [cellX, cellY] = key.split(":").map(Number);
                const approxX = Math.round((cellX + 0.5) * 32);
                const approxY = Math.round((cellY + 0.5) * 32);
                return `X ${approxX}, Y ${approxY}`;
            });
            mostActiveArea = areaText.length === 1 ? areaText[0] : areaText.join(" / ");
        }
    }

    return {
        totalPlayers,
        humanCount,
        botCount,
        totalEvents,
        totalKills,
        totalDeaths,
        totalLoot,
        totalStormDeaths,
        mostActivePlayer,
        highestDistancePlayer,
        mostKillsPlayer,
        mostLootPlayer,
        mostActiveArea
    };
}


function renderMatchInsights() {
    if (!matchInsightsList) {
        return;
    }

    if (!currentMatch) {
        matchInsightsList.innerHTML = "";
        return;
    }

    const insights = computeMatchInsights(currentMatch);

    const insightItems = [
        { label: "Total players", value: `${insights.totalPlayers}` },
        { label: "Human count", value: `${insights.humanCount}` },
        { label: "Bot count", value: `${insights.botCount}` },
        { label: "Total events", value: `${insights.totalEvents}` },
        { label: "Total kills", value: `${insights.totalKills}` },
        { label: "Total deaths", value: `${insights.totalDeaths}` },
        { label: "Total loot", value: `${insights.totalLoot}` },
        { label: "Total storm deaths", value: `${insights.totalStormDeaths}` },
        { label: "Most active player", value: insights.mostActivePlayer },
        { label: "Highest distance travelled", value: insights.highestDistancePlayer },
        { label: "Most kills", value: insights.mostKillsPlayer },
        { label: "Most loot collected", value: insights.mostLootPlayer },
        { label: "Most active map area", value: insights.mostActiveArea }
    ];

    matchInsightsList.innerHTML = `
        <div class="insights-grid">
            ${insightItems.map(item => `
                <div class="insight-card">
                    <div class="insight-label">${item.label}</div>
                    <div class="insight-value">${item.value}</div>
                </div>
            `).join("")}
        </div>
    `;
}


function ensurePlaybackSpeedControl() {

    const timelinePanel =
        document.querySelector(".timeline-panel");

    if (!timelinePanel ||
        timelinePanel.querySelector("[data-speed-control='true']")) {
        return;
    }

    const speedWrap =
        document.createElement("div");

    speedWrap.dataset.speedControl = "true";
    speedWrap.style.display = "flex";
    speedWrap.style.alignItems = "center";
    speedWrap.style.gap = "8px";
    speedWrap.style.flexWrap = "wrap";
    speedWrap.style.marginTop = "10px";

    const speedLabel = document.createElement("span");
    speedLabel.textContent = "Speed:";
    speedLabel.style.color = "#8e98a7";
    speedLabel.style.fontSize = "12px";
    speedLabel.style.fontWeight = "600";
    speedLabel.style.letterSpacing = "0.4px";
    speedLabel.style.textTransform = "uppercase";

    speedWrap.appendChild(speedLabel);

    [0.25, 0.5, 1, 2].forEach(speed => {

        const button =
            document.createElement("button");

        button.type = "button";
        button.dataset.speed = String(speed);
        button.textContent = `${speed}x`;
        button.style.border = "1px solid #303743";
        button.style.borderRadius = "6px";
        button.style.background =
            Math.abs(speed - playbackSpeed) < 0.0001
                ? "#e8edf5"
                : "#11151c";
        button.style.color =
            Math.abs(speed - playbackSpeed) < 0.0001
                ? "#11151c"
                : "#aeb8c4";
        button.style.padding = "6px 10px";
        button.style.fontSize = "12px";
        button.style.cursor = "pointer";

        button.addEventListener("click", function () {
            playbackSpeed = speed;
            updatePlaybackSpeedButtons();
        });

        speedWrap.appendChild(button);
    });

    timelinePanel.appendChild(speedWrap);
    updatePlaybackSpeedButtons();
}


function updatePlaybackSpeedButtons() {

    const buttons =
        document.querySelectorAll("[data-speed]");

    buttons.forEach(button => {
        const isActive =
            Number(button.dataset.speed) === playbackSpeed;

        button.style.background =
            isActive ? "#e8edf5" : "#11151c";
        button.style.color =
            isActive ? "#11151c" : "#aeb8c4";
        button.style.borderColor =
            isActive ? "#e8edf5" : "#303743";
        button.style.fontWeight =
            isActive ? "700" : "500";
    });
}


function ensureEventLegend() {

    const legend =
        document.querySelector(".legend");

    if (!legend) {
        return;
    }

    if (legend.querySelector("[data-legend='storm-death']")) {
        return;
    }

    const item =
        document.createElement("div");

    item.className = "legend-item";
    item.dataset.legend = "storm-death";

    const dot =
        document.createElement("span");

    dot.className = "legend-dot";
    dot.style.background = "#35c9ff";
    dot.style.width = "9px";
    dot.style.height = "9px";
    dot.style.borderRadius = "50%";

    const label =
        document.createTextNode("Storm Death");

    item.appendChild(dot);
    item.appendChild(label);

    legend.appendChild(item);
}


// ============================================================
// DATE FILTER
// ============================================================

function populateDates() {

    dateSelect.innerHTML = "";

    const allOption = document.createElement("option");

    allOption.value = "all";
    allOption.textContent = "All Dates";

    dateSelect.appendChild(allOption);


    const dates = [
        ...new Set(
            matchIndex.map(match => match.date)
        )
    ];

    dates.sort();


    dates.forEach(date => {

        const option = document.createElement("option");

        option.value = date;
        option.textContent = date;

        dateSelect.appendChild(option);

    });
}


// ============================================================
// MATCH FILTER
// ============================================================

function populateMatches() {

    const selectedMap = mapSelect.value;
    const selectedDate = dateSelect.value;


    matchSelect.innerHTML = "";


    const defaultOption = document.createElement("option");

    defaultOption.value = "all";
    defaultOption.textContent = "Select Match";

    matchSelect.appendChild(defaultOption);


    let filteredMatches = matchIndex;


    // Filter by map

    if (selectedMap !== "all") {

        filteredMatches = filteredMatches.filter(
            match => match.map === selectedMap
        );

    }


    // Filter by date

    if (selectedDate !== "all") {

        filteredMatches = filteredMatches.filter(
            match => match.date === selectedDate
        );

    }


    // Add matches

    filteredMatches.forEach(match => {

        const option = document.createElement("option");

        option.value = match.match_id;

        option.textContent =
            `${shortMatchId(match.match_id)} — ${match.map} — ${match.events} events`;

        matchSelect.appendChild(option);

    });


    console.log(
        `Showing ${filteredMatches.length} matches`
    );
}


// ============================================================
// SHORT MATCH ID
// ============================================================

function shortMatchId(matchId) {

    if (!matchId) {
        return "";
    }

    return matchId.substring(0, 8);
}


// ============================================================
// LOAD MATCH
// ============================================================

async function loadMatch(matchId) {

    if (!matchId || matchId === "all") {

        clearVisualization();

        return;
    }

    selectedPlayerId = null;

    try {

        console.log(
            "Loading match:",
            matchId
        );


        const encodedMatchId =
            encodeURIComponent(matchId);


        const url =
            `${MATCH_FOLDER}${encodedMatchId}.json`;


        const response = await fetch(url);


        if (!response.ok) {

            throw new Error(
                `Could not load match JSON (${response.status})`
            );

        }


        currentMatch = await response.json();


        console.log(
            "Match loaded:",
            currentMatch
        );


        displayMatch();


    } catch (error) {

        console.error(error);

        matchInfo.textContent =
            "Could not load this match.";

    }
}


// ============================================================
// DISPLAY MATCH
// ============================================================

function displayMatch() {

    if (!currentMatch) {
        return;
    }


    // --------------------------------------------------------
    // Header
    // --------------------------------------------------------

    mapTitle.textContent =
        currentMatch.map;


    matchInfo.textContent =
        `${currentMatch.date} • Match ${shortMatchId(currentMatch.match_id)}`;


    // --------------------------------------------------------
    // Statistics
    // --------------------------------------------------------

    playerCount.textContent =
        currentMatch.player_count ?? 0;


    humanCount.textContent =
        currentMatch.human_count ?? 0;


    botCount.textContent =
        currentMatch.bot_count ?? 0;


    eventCount.textContent =
        currentMatch.event_count ?? 0;


    // --------------------------------------------------------
    // Timeline
    // --------------------------------------------------------

    const matchDuration =
        getMatchDurationMs(currentMatch);

    currentElapsed = 0;

    timeline.min = 0;

    timeline.max =
        matchDuration;

    timeline.value = 0;


    totalTime.textContent =
        formatTime(matchDuration);


    currentTime.textContent =
        "00:00";

    updateAnalytics();


    // --------------------------------------------------------
    // Load minimap
    // --------------------------------------------------------

    const minimapFile =
        MINIMAPS[currentMatch.map];


    if (!minimapFile) {

        console.error(
            "No minimap configured for:",
            currentMatch.map
        );

        return;
    }


    mapReady = false;

    mapPlaceholder.style.display = "none";

    mapImage.style.display = "block";


    mapImage.onload = function () {

        mapReady = true;

        resizeCanvas();

        drawVisualization();

    };


    mapImage.src =
        `${MINIMAP_FOLDER}${minimapFile}`;

}


// ============================================================
// CLEAR VISUALIZATION
// ============================================================

function clearVisualization() {

    currentMatch = null;
    selectedPlayerId = null;

    stopPlayback();


    mapImage.style.display = "none";

    mapPlaceholder.style.display = "block";


    mapTitle.textContent =
        "Select a match";


    matchInfo.textContent =
        "Choose a match to visualize player movement.";


    playerCount.textContent = "—";
    humanCount.textContent = "—";
    botCount.textContent = "—";
    eventCount.textContent = "—";


    timeline.min = 0;
    timeline.max = 100;
    timeline.value = 100;


    currentTime.textContent = "00:00";
    totalTime.textContent = "00:00";

    clearAnalytics();
    clearCanvas();

}


// ============================================================
// CANVAS SETUP
// ============================================================

function resizeCanvas() {

    if (!mapImage.complete) {
        return;
    }


    const width =
        mapImage.clientWidth;


    const height =
        mapImage.clientHeight;


    if (!width || !height) {
        return;
    }


    mapCanvas.width = width;
    mapCanvas.height = height;


    mapCanvas.style.width =
        `${width}px`;


    mapCanvas.style.height =
        `${height}px`;

}


// ============================================================
// CLEAR CANVAS
// ============================================================

function clearCanvas() {

    const ctx =
        mapCanvas.getContext("2d");


    ctx.clearRect(
        0,
        0,
        mapCanvas.width,
        mapCanvas.height
    );

}


// ============================================================
// DRAW VISUALIZATION
// ============================================================

function drawVisualization() {

    if (!currentMatch || !mapReady) {
        return;
    }


    resizeCanvas();


    const ctx =
        mapCanvas.getContext("2d");


    ctx.clearRect(
        0,
        0,
        mapCanvas.width,
        mapCanvas.height
    );


    const events =
        currentMatch.events || [];


    // Only show events up to the current playback position.
    // The processed match JSON already stores elapsed_ms, and we
    // fall back to the event timestamps if that field is absent.

    const visibleEvents =
        events.filter(
            event =>
                getEventElapsedMs(event, currentMatch)
                <= currentElapsed
        );


    // --------------------------------------------------------
    // Heatmap overlay
    // --------------------------------------------------------

    drawHeatmapOverlay(
        ctx,
        visibleEvents
    );


    // --------------------------------------------------------
    // Group positions by player, using the same elapsed_ms timeline
    // as the rest of the visualization.
    // --------------------------------------------------------

    const playerPaths = {};


    const sortedVisibleEvents =
        [...visibleEvents].sort(
            (a, b) => getEventElapsedMs(a) - getEventElapsedMs(b)
        );


    sortedVisibleEvents.forEach(event => {

        if (
            event.event !== "Position" &&
            event.event !== "BotPosition"
        ) {
            return;
        }


        if (!playerPaths[event.user_id]) {

            playerPaths[event.user_id] = [];

        }


        playerPaths[event.user_id].push(event);

    });


    // --------------------------------------------------------
    // Draw player paths
    // --------------------------------------------------------

    Object.values(playerPaths).forEach(path => {

        if (path.length < 2) {
            return;
        }


        const first =
            path[0];


        ctx.beginPath();


        ctx.moveTo(
            pixelX(first.pixel_x),
            pixelY(first.pixel_y)
        );


        for (let i = 1; i < path.length; i++) {

            const point =
                path[i];


            ctx.lineTo(
                pixelX(point.pixel_x),
                pixelY(point.pixel_y)
            );

        }


        const isBot =
            first.type === "bot";

        const playerId = String(first.user_id);
        const isSelected = selectedPlayerId !== null && playerId === String(selectedPlayerId);
        const dimmed = selectedPlayerId !== null && !isSelected;

        ctx.save();
        ctx.globalAlpha = dimmed ? 0.18 : 1;

        ctx.strokeStyle =
            isBot
                ? "rgb(244, 239, 239)"
                : "rgba(255, 59, 48, 0.65)";


        ctx.lineWidth =
            isSelected
                ? (isBot ? 3 : 4)
                : (isBot ? 1.5 : 2);


        ctx.stroke();
        ctx.restore();

    });


    // --------------------------------------------------------
    // Draw current player positions
    // --------------------------------------------------------

    Object.values(playerPaths).forEach(path => {

        if (path.length === 0) {
            return;
        }


        const latest =
            path[path.length - 1];


        drawPlayerMarker(
            ctx,
            latest,
            selectedPlayerId !== null && String(latest.user_id) === String(selectedPlayerId)
        );

    });


    // --------------------------------------------------------
    // Draw event markers
    // --------------------------------------------------------

    sortedVisibleEvents.forEach(event => {

        if (
            event.event === "Position" ||
            event.event === "BotPosition"
        ) {
            return;
        }


        drawEventMarker(
            ctx,
            event
        );

    });

}


// ============================================================
// CONVERT 1024 MAP COORDINATES TO DISPLAY COORDINATES
// ============================================================

function pixelX(value) {

    return (
        value / 1024
    ) * mapCanvas.width;

}


function pixelY(value) {

    return (
        value / 1024
    ) * mapCanvas.height;

}


// ============================================================
// DRAW PLAYER
// ============================================================

function drawHeatmapOverlay(ctx, visibleEvents) {

    if (!currentMatch || heatmapMode === "off") {
        return;
    }

    const points = [];

    if (heatmapMode === "traffic") {

        visibleEvents.forEach(event => {
            if (
                event.event === "Position" ||
                event.event === "BotPosition"
            ) {
                points.push({
                    x: event.pixel_x,
                    y: event.pixel_y,
                    weight: 1
                });
            }
        });

    } else if (heatmapMode === "kills") {

        visibleEvents.forEach(event => {
            if (
                event.event === "Kill" ||
                event.event === "BotKill"
            ) {
                points.push({
                    x: event.pixel_x,
                    y: event.pixel_y,
                    weight: 2.5
                });
            }
        });

    } else if (heatmapMode === "deaths") {

        visibleEvents.forEach(event => {
            if (
                event.event === "Killed" ||
                event.event === "BotKilled" ||
                event.event === "KilledByStorm"
            ) {
                points.push({
                    x: event.pixel_x,
                    y: event.pixel_y,
                    weight: 2.5
                });
            }
        });
    }

    if (!points.length) {
        return;
    }

    const debugSource =
        points.find(point => point.x !== undefined && point.y !== undefined);

    if (debugSource) {

        const debugX =
            pixelX(debugSource.x);

        const debugY =
            pixelY(debugSource.y);

        console.log("HEATMAP DEBUG", {
            event: visibleEvents.find(
                event =>
                    event.pixel_x === debugSource.x &&
                    event.pixel_y === debugSource.y
            )?.event,
            pixel_x: debugSource.x,
            pixel_y: debugSource.y,
            tracerCanvas: {
                x: debugX,
                y: debugY
            },
            heatmapCanvas: {
                x: debugX,
                y: debugY
            },
            equal: true
        });

        ctx.save();
        ctx.beginPath();
        ctx.fillStyle = "#00ff66";
        ctx.arc(debugX, debugY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    points.forEach(point => {

        const x =
            pixelX(point.x);

        const y =
            pixelY(point.y);

        const radius =
            heatmapMode === "traffic"
                ? 20 + point.weight * 18
                : 16 + point.weight * 16;

        const gradient =
            ctx.createRadialGradient(
                x,
                y,
                0,
                x,
                y,
                radius
            );

        if (heatmapMode === "traffic") {
            gradient.addColorStop(0, "rgba(255, 255, 76, 0.72)");
            gradient.addColorStop(0.28, "rgba(255, 166, 0, 0.42)");
            gradient.addColorStop(0.6, "rgba(255, 96, 0, 0.22)");
            gradient.addColorStop(1, "rgba(255, 96, 0, 0)");
        } else if (heatmapMode === "kills") {
            gradient.addColorStop(0, "rgba(255, 80, 80, 0.78)");
            gradient.addColorStop(0.35, "rgba(255, 120, 0, 0.45)");
            gradient.addColorStop(0.7, "rgba(255, 100, 0, 0.18)");
            gradient.addColorStop(1, "rgba(255, 100, 0, 0)");
        } else {
            gradient.addColorStop(0, "rgba(120, 140, 255, 0.82)");
            gradient.addColorStop(0.35, "rgba(120, 100, 255, 0.5)");
            gradient.addColorStop(0.7, "rgba(115, 80, 255, 0.18)");
            gradient.addColorStop(1, "rgba(115, 80, 255, 0)");
        }

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
    });

    ctx.restore();
}


function getMatchDurationMs(match) {

    if (!match) {
        return 0;
    }

    if (Number.isFinite(Number(match.duration_ms))) {
        const duration = Number(match.duration_ms);
        if (duration > 0) {
            return duration;
        }
    }

    if (Array.isArray(match.events) && match.events.length) {

        const elapsedValues =
            match.events
                .map(event => getEventElapsedMs(event, match))
                .filter(value => Number.isFinite(value));

        if (elapsedValues.length) {
            return Math.max(...elapsedValues, 0);
        }

        const timestamps =
            match.events
                .map(event => event.timestamp)
                .filter(Boolean)
                .map(value => Date.parse(value));

        if (timestamps.length) {
            const min = Math.min(...timestamps);
            const max = Math.max(...timestamps);
            return Math.max(0, max - min);
        }
    }

    return 0;
}


function getEventElapsedMs(event, match = currentMatch) {

    if (!event) {
        return 0;
    }

    if (Number.isFinite(Number(event.elapsed_ms))) {
        return Number(event.elapsed_ms);
    }

    if (typeof event.timestamp === "string" && match && match.start_timestamp) {
        const eventTime = Date.parse(event.timestamp);
        const startTime = Date.parse(match.start_timestamp);

        if (Number.isFinite(eventTime) && Number.isFinite(startTime)) {
            return Math.max(0, eventTime - startTime);
        }
    }

    return 0;
}


function drawPlayerMarker(ctx, event, isSelected = false) {

    const x =
        pixelX(event.pixel_x);


    const y =
        pixelY(event.pixel_y);


    const isBot =
        event.type === "bot";

    const isDimmed = selectedPlayerId !== null && !isSelected;

    ctx.save();
    ctx.globalAlpha = isDimmed ? 0.2 : 1;

    // Outer ring

    ctx.beginPath();

    ctx.arc(
        x,
        y,
        isSelected ? (isBot ? 7 : 8) : (isBot ? 5 : 6),
        0,
        Math.PI * 2
    );


    ctx.fillStyle =
        isBot
            ? "#7b8798"
            : "#ff3b30";


    ctx.fill();


    // Small center

    ctx.beginPath();

    ctx.arc(
        x,
        y,
        isSelected ? 3 : 2,
        0,
        Math.PI * 2
    );


    ctx.fillStyle = "#ffffff";

    ctx.fill();
    ctx.restore();

}


// ============================================================
// DRAW EVENT MARKER
// ============================================================

function drawEventMarker(ctx, event) {

    if (
        event.pixel_x === undefined ||
        event.pixel_y === undefined
    ) {
        return;
    }


    const x =
        pixelX(event.pixel_x);


    const y =
        pixelY(event.pixel_y);


    const eventName =
        String(event.event).toLowerCase();


    let color = "#f5c542";
    let radius = 6;


    // Storm death should win before generic death checks.
    if (
        eventName.includes("storm")
    ) {
        color = "#35c9ff";
        radius = 9;
    }


    // Bot kills / kills
    if (
        eventName.includes("botkill")
    ) {
        color = "#ff8a5b";
        radius = 8;
    } else if (
        eventName.includes("kill")
    ) {
        color = "#ff3b30";
        radius = 8;
    }


    // Bot deaths / deaths
    if (
        eventName.includes("botkilled")
    ) {
        color = "#8c7ae6";
        radius = 8;
    } else if (
        eventName.includes("killed") ||
        eventName.includes("death")
    ) {
        color = "#b44cff";
        radius = 8;
    }


    // Loot
    if (
        eventName.includes("loot")
    ) {
        color = "#f5c542";
        radius = 6;
    }


    ctx.beginPath();

    ctx.arc(
        x,
        y,
        radius,
        0,
        Math.PI * 2
    );


    ctx.fillStyle = color;

    ctx.fill();


    ctx.strokeStyle =
        "rgba(255,255,255,0.8)";

    ctx.lineWidth = 1;

    ctx.stroke();

}


// ============================================================
// TIMELINE
// ============================================================

timeline.addEventListener(
    "input",
    function () {

        if (!currentMatch) {
            return;
        }


        currentElapsed =
            Number(timeline.value);


        currentTime.textContent =
            formatTime(currentElapsed);


        drawVisualization();

    }
);


// ============================================================
// PLAY / PAUSE
// ============================================================

playButton.addEventListener(
    "click",
    function () {

        if (!currentMatch) {
            return;
        }


        if (isPlaying) {

            stopPlayback();

        } else {

            startPlayback();

        }

    }
);


// ============================================================
// START PLAYBACK
// ============================================================

function startPlayback() {

    if (!currentMatch) {
        return;
    }


    const duration =
        getMatchDurationMs(currentMatch);


    if (duration <= 0) {
        return;
    }


    // Restart when already at the end

    if (currentElapsed >= duration) {

        currentElapsed = 0;

        timeline.value = 0;

    }


    isPlaying = true;

    playButton.textContent = "❚❚ Pause";


    const startTime =
        performance.now();


    const startingElapsed =
        currentElapsed;


    function animate(now) {

        if (!isPlaying) {
            return;
        }


        const realElapsed =
            now - startTime;


        // Playback speed

        const playbackElapsed =
            startingElapsed +
            realElapsed * playbackSpeed;


        currentElapsed =
            Math.min(
                playbackElapsed,
                duration
            );


        timeline.value =
            currentElapsed;


        currentTime.textContent =
            formatTime(currentElapsed);


        drawVisualization();


        if (currentElapsed >= duration) {

            stopPlayback();

            return;

        }


        animationTimer =
            requestAnimationFrame(animate);

    }


    animationTimer =
        requestAnimationFrame(animate);

}


// ============================================================
// STOP PLAYBACK
// ============================================================

function stopPlayback() {

    isPlaying = false;


    if (animationTimer) {

        cancelAnimationFrame(
            animationTimer
        );

        animationTimer = null;

    }


    playButton.textContent =
        "▶ Play";

}


// ============================================================
// RESET
// ============================================================

resetButton.addEventListener(
    "click",
    function () {

        stopPlayback();


        currentElapsed = 0;


        timeline.value = 0;


        currentTime.textContent =
            "00:00";


        drawVisualization();

    }
);


// ============================================================
// FILTER EVENTS
// ============================================================

mapSelect.addEventListener(
    "change",
    function () {

        stopPlayback();

        populateMatches();

        clearVisualization();

    }
);


dateSelect.addEventListener(
    "change",
    function () {

        stopPlayback();

        populateMatches();

        clearVisualization();

    }
);


matchSelect.addEventListener(
    "change",
    function () {

        stopPlayback();

        loadMatch(
            matchSelect.value
        );

    }
);


// ============================================================
// WINDOW RESIZE
// ============================================================

window.addEventListener(
    "resize",
    function () {

        if (!currentMatch) {
            return;
        }


        resizeCanvas();

        drawVisualization();

    }
);


// ============================================================
// FORMAT TIME
// ============================================================

function formatTime(milliseconds) {

    const safeMs = Number.isFinite(Number(milliseconds))
        ? Number(milliseconds)
        : 0;

    if (safeMs >= 60000) {
        const totalMs = Math.max(0, Math.floor(safeMs));
        const minutes = Math.floor(totalMs / 60000);
        const seconds = Math.floor((totalMs % 60000) / 1000);
        const ms = totalMs % 1000;

        return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
    }

    const seconds = safeMs / 1000;
    const displaySeconds = Number(seconds.toFixed(3));

    return `${displaySeconds.toString()} s`;
}


// ============================================================
// START APPLICATION
// ============================================================

initialize();