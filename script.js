// API Base URL
const API_BASE = 'https://api.chess.com/pub';

// DOM Elements
const usernameInput = document.getElementById('usernameInput');
const searchButton = document.getElementById('searchButton');
const errorMessage = document.getElementById('errorMessage');
const loadingIndicator = document.getElementById('loadingIndicator');
const progressFill = document.getElementById('progressFill');
const resultsContainer = document.getElementById('resultsContainer');

// Section elements
const profileContent = document.getElementById('profileContent');
const statsContent = document.getElementById('statsContent');
const gamesContent = document.getElementById('gamesContent');
const tournamentsContent = document.getElementById('tournamentsContent');
const clubsContent = document.getElementById('clubsContent');
const matchesContent = document.getElementById('matchesContent');
const rawDataDisplay = document.getElementById('rawDataDisplay');

// Store fetched data
let fetchedData = {};
let currentUsername = '';
let comparisonMode = false;
let comparisonData = { player1: null, player2: null };
let allGames = [];
let filteredGames = [];
let currentPage = 1;
const gamesPerPage = 20;

// DOM Elements for new features
const recentSearches = document.getElementById('recentSearches');
const recentSearchesList = document.getElementById('recentSearchesList');
const clearHistoryBtn = document.getElementById('clearHistory');
const themeToggle = document.getElementById('themeToggle');
const compareButton = document.getElementById('compareButton');
const comparisonContainer = document.getElementById('comparisonContainer');
const comparisonContent = document.getElementById('comparisonContent');
const closeComparisonBtn = document.getElementById('closeComparison');
const exportProfileBtn = document.getElementById('exportProfileBtn');
const copyRawDataBtn = document.getElementById('copyRawDataBtn');
const toast = document.getElementById('toast');
const gameFilters = document.getElementById('gameFilters');
const filterTimeControl = document.getElementById('filterTimeControl');
const filterResult = document.getElementById('filterResult');
const sortGames = document.getElementById('sortGames');
const resetFiltersBtn = document.getElementById('resetFilters');
const gamesListContainer = document.getElementById('gamesListContainer');
const gamesPagination = document.getElementById('gamesPagination');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Load theme preference
    loadTheme();
    
    // Load and display recent searches
    loadRecentSearches();
    
    // Search button click handler
    searchButton.addEventListener('click', handleSearch);
    
    // Enter key handler
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
    
    // Keyboard navigation for sections
    document.addEventListener('keydown', (e) => {
        // Escape key closes comparison
        if (e.key === 'Escape' && comparisonMode) {
            exitComparisonMode();
        }
        
        // Ctrl/Cmd + K focuses search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            usernameInput.focus();
        }
    });

    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);
    
    // Compare button
    compareButton.addEventListener('click', () => {
        if (comparisonMode) {
            exitComparisonMode();
        } else {
            enterComparisonMode();
        }
    });
    
    // Close comparison
    closeComparisonBtn.addEventListener('click', exitComparisonMode);
    
    // Clear history
    clearHistoryBtn.addEventListener('click', clearSearchHistory);
    
    // Export profile
    exportProfileBtn.addEventListener('click', exportProfileData);
    
    // Copy raw data
    copyRawDataBtn.addEventListener('click', copyRawData);
    
    // Game filters
    filterTimeControl.addEventListener('change', applyGameFilters);
    filterResult.addEventListener('change', applyGameFilters);
    sortGames.addEventListener('change', applyGameFilters);
    resetFiltersBtn.addEventListener('click', resetGameFilters);

    // Toggle section buttons
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const section = e.target.getAttribute('data-section');
            toggleSection(section);
        });
    });
});

// Input validation
function validateUsername(username) {
    if (!username || username.trim() === '') {
        return { valid: false, error: 'Please enter a username' };
    }
    
    const trimmed = username.trim();
    if (trimmed.length < 2 || trimmed.length > 20) {
        return { valid: false, error: 'Username must be between 2 and 20 characters' };
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
        return { valid: false, error: 'Username can only contain letters, numbers, underscores, and hyphens' };
    }
    
    return { valid: true, username: trimmed };
}

// Error handling
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    errorMessage.setAttribute('aria-live', 'assertive');
    // Announce to screen readers
    const announcement = document.createElement('div');
    announcement.className = 'sr-only';
    announcement.setAttribute('aria-live', 'assertive');
    announcement.textContent = `Error: ${message}`;
    document.body.appendChild(announcement);
    setTimeout(() => {
        errorMessage.style.display = 'none';
        document.body.removeChild(announcement);
    }, 5000);
}

function hideError() {
    errorMessage.style.display = 'none';
}

// Loading states
function showLoading() {
    loadingIndicator.style.display = 'block';
    resultsContainer.style.display = 'none';
    searchButton.disabled = true;
    progressFill.style.width = '0%';
}

function hideLoading() {
    loadingIndicator.style.display = 'none';
    searchButton.disabled = false;
}

function updateProgress(percentage) {
    progressFill.style.width = `${percentage}%`;
}

// API Fetching Functions
async function fetchWithErrorHandling(url, errorContext, retryCount = 0) {
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(`Player not found: ${errorContext}`);
            } else if (response.status === 429) {
                throw new Error('Rate limit exceeded. Please try again later.');
            } else {
                throw new Error(`API error (${response.status}): ${errorContext}`);
            }
        }
        
        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            if (retryCount < 2) {
                // Retry on network error
                await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
                return fetchWithErrorHandling(url, errorContext, retryCount + 1);
            }
            throw new Error('Network error. Please check your internet connection.');
        }
        throw error;
    }
}

async function fetchPlayerProfile(username) {
    const url = `${API_BASE}/player/${username}`;
    return await fetchWithErrorHandling(url, 'profile');
}

async function fetchPlayerStats(username) {
    const url = `${API_BASE}/player/${username}/stats`;
    return await fetchWithErrorHandling(url, 'stats');
}

async function fetchGameArchives(username) {
    const url = `${API_BASE}/player/${username}/games/archives`;
    return await fetchWithErrorHandling(url, 'game archives');
}

async function fetchGamesByMonth(username, year, month) {
    const monthStr = String(month).padStart(2, '0');
    const url = `${API_BASE}/player/${username}/games/${year}/${monthStr}`;
    return await fetchWithErrorHandling(url, `games ${year}/${monthStr}`);
}

async function fetchTournaments(username) {
    const url = `${API_BASE}/player/${username}/tournaments`;
    return await fetchWithErrorHandling(url, 'tournaments');
}

async function fetchClubs(username) {
    const url = `${API_BASE}/player/${username}/clubs`;
    return await fetchWithErrorHandling(url, 'clubs');
}

async function fetchMatches(username) {
    const url = `${API_BASE}/player/${username}/matches`;
    return await fetchWithErrorHandling(url, 'matches');
}

// Main search handler
async function handleSearch() {
    hideError();
    
    const validation = validateUsername(usernameInput.value);
    if (!validation.valid) {
        showError(validation.error);
        return;
    }
    
    const username = validation.username;
    
    // Handle comparison mode
    if (comparisonMode) {
        if (!comparisonData.player1) {
            // First player - fetch and store
            showLoading();
            try {
                const firstPlayerData = await fetchAllPlayerData(username);
                comparisonData.player1 = { ...firstPlayerData, username };
                hideLoading();
                showToast('Now search for the second player to compare');
                return;
            } catch (error) {
                hideLoading();
                showError(error.message || 'Failed to fetch first player data');
                return;
            }
        } else if (comparisonData.player1 && !comparisonData.player2) {
            // Second player - fetch and compare
            showLoading();
            try {
                const secondPlayerData = await fetchAllPlayerData(username);
                comparisonData.player2 = { ...secondPlayerData, username };
                displayComparison();
                hideLoading();
                showToast('Comparison ready');
                return;
            } catch (error) {
                hideLoading();
                showError(error.message || 'Failed to fetch second player data');
                return;
            }
        }
    }
    
    // Normal search
    currentUsername = username;
    showLoading();
    
    try {
        fetchedData = await fetchAllPlayerData(username);
        
        // Save to search history
        saveToSearchHistory(username);
        
        // Display all data
        displayAllData();
        
        // Show results
        hideLoading();
        resultsContainer.style.display = 'block';
        
    } catch (error) {
        hideLoading();
        showError(error.message || 'An unexpected error occurred');
        resultsContainer.style.display = 'none';
    }
}

async function fetchAllPlayerData(username) {
    const data = {};
    const totalRequests = 7;
    let completedRequests = 0;
    const errors = [];
    
    // Fetch profile with caching
    updateProgress((completedRequests / totalRequests) * 100);
    data.profile = await fetchWithCaching(
        `${API_BASE}/player/${username}`,
        'profile',
        `profile_${username}`
    );
    if (!data.profile.success) errors.push('Profile');
    completedRequests++;
    
    // Fetch stats with caching
    updateProgress((completedRequests / totalRequests) * 100);
    data.stats = await fetchWithCaching(
        `${API_BASE}/player/${username}/stats`,
        'stats',
        `stats_${username}`
    );
    if (!data.stats.success) errors.push('Stats');
    completedRequests++;
    
    // Fetch game archives
    updateProgress((completedRequests / totalRequests) * 100);
    data.archives = await fetchWithCaching(
        `${API_BASE}/player/${username}/games/archives`,
        'game archives',
        `archives_${username}`
    );
    if (!data.archives.success) errors.push('Game Archives');
    completedRequests++;
    
    // Fetch recent games (from most recent archive)
    if (data.archives.success && data.archives.data.archives && data.archives.data.archives.length > 0) {
        const mostRecentArchive = data.archives.data.archives[data.archives.data.archives.length - 1];
        const archiveUrl = mostRecentArchive;
        const parts = archiveUrl.split('/');
        const year = parseInt(parts[parts.length - 2]);
        const month = parseInt(parts[parts.length - 1]);
        
        updateProgress((completedRequests / totalRequests) * 100);
        try {
            data.recentGames = await fetchGamesByMonth(username, year, month);
        } catch (error) {
            data.recentGames = { success: false, error: error.message };
            errors.push('Recent Games');
        }
        completedRequests++;
    } else {
        data.recentGames = { success: true, data: { games: [] } };
        completedRequests++;
    }
    
    // Fetch tournaments
    updateProgress((completedRequests / totalRequests) * 100);
    data.tournaments = await fetchWithCaching(
        `${API_BASE}/player/${username}/tournaments`,
        'tournaments',
        `tournaments_${username}`
    );
    if (!data.tournaments.success) errors.push('Tournaments');
    completedRequests++;
    
    // Fetch clubs
    updateProgress((completedRequests / totalRequests) * 100);
    data.clubs = await fetchWithCaching(
        `${API_BASE}/player/${username}/clubs`,
        'clubs',
        `clubs_${username}`
    );
    if (!data.clubs.success) errors.push('Clubs');
    completedRequests++;
    
    // Fetch matches
    updateProgress((completedRequests / totalRequests) * 100);
    data.matches = await fetchWithCaching(
        `${API_BASE}/player/${username}/matches`,
        'matches',
        `matches_${username}`
    );
    if (!data.matches.success) errors.push('Matches');
    completedRequests++;
    
    updateProgress(100);
    
    // Show warning if some requests failed but allow partial display
    if (errors.length > 0 && errors.length < totalRequests) {
        showToast(`Some data unavailable: ${errors.join(', ')}. Showing available data.`);
    }
    
    // Throw error only if critical data (profile) is missing
    if (!data.profile.success) {
        throw new Error(data.profile.error || 'Failed to fetch player profile');
    }
    
    return data;
}

// Data Display Functions
function displayAllData() {
    displayProfile();
    displayStats();
    displayGames();
    displayTournaments();
    displayClubs();
    displayMatches();
    displayRawData();
    
    // Generate charts and metrics asynchronously
    setTimeout(() => {
        generateRatingCharts();
        calculatePerformanceMetrics();
    }, 500);
}

function displayProfile() {
    if (!fetchedData.profile || !fetchedData.profile.success) {
        profileContent.innerHTML = '<div class="empty-state">Profile data not available</div>';
        return;
    }
    
    const profile = fetchedData.profile.data;
    
    let html = '<div class="profile-card">';
    
    if (profile.avatar) {
        html += `<img src="${profile.avatar}" alt="Avatar" class="profile-avatar" onerror="this.style.display='none'">`;
    }
    
    html += '<div class="profile-info">';
    html += `<div class="profile-name">${escapeHtml(profile.name || profile.username || 'N/A')}</div>`;
    
    if (profile.username) {
        html += `<div class="profile-detail"><strong>Username:</strong> ${escapeHtml(profile.username)}`;
        html += ` <button class="copy-btn-small" onclick="copyToClipboard('${escapeHtml(profile.username)}', 'Username')" aria-label="Copy username">📋</button></div>`;
    }
    
    if (profile.location) {
        html += `<div class="profile-detail"><strong>Location:</strong> ${escapeHtml(profile.location)}</div>`;
    }
    
    if (profile.joined) {
        const joinedDate = new Date(profile.joined * 1000);
        html += `<div class="profile-detail"><strong>Joined:</strong> ${formatDate(joinedDate)}</div>`;
    }
    
    if (profile.followers !== undefined) {
        html += `<div class="profile-detail"><strong>Followers:</strong> ${profile.followers}</div>`;
    }
    
    if (profile.status) {
        html += `<div class="profile-detail"><strong>Status:</strong> ${escapeHtml(profile.status)}</div>`;
    }
    
    if (profile.url) {
        html += `<div class="profile-detail"><strong>Profile URL:</strong> <a href="${profile.url}" target="_blank">${profile.url}</a>`;
        html += ` <button class="copy-btn-small" onclick="copyToClipboard('${profile.url}', 'URL')" aria-label="Copy URL">📋</button></div>`;
    }
    
    html += '</div></div>';
    profileContent.innerHTML = html;
}

function displayStats() {
    if (!fetchedData.stats || !fetchedData.stats.success) {
        statsContent.innerHTML = '<div class="empty-state">Statistics not available</div>';
        return;
    }
    
    const stats = fetchedData.stats.data;
    let html = '<div class="stats-grid">';
    
    // Chess ratings
    const timeControls = [
        { key: 'chess_blitz', label: 'Blitz' },
        { key: 'chess_bullet', label: 'Bullet' },
        { key: 'chess_rapid', label: 'Rapid' },
        { key: 'chess_daily', label: 'Daily' }
    ];
    
    timeControls.forEach(control => {
        if (stats[control.key] && stats[control.key].last && stats[control.key].last.rating) {
            const rating = stats[control.key].last.rating;
            const record = stats[control.key].record;
            html += '<div class="stat-card">';
            html += `<div class="stat-label">${control.label}</div>`;
            html += `<div class="stat-value">${rating}</div>`;
            if (record) {
                html += `<div class="stat-record">${record.win || 0}W - ${record.loss || 0}L - ${record.draw || 0}D</div>`;
            }
            html += '</div>';
        }
    });
    
    // Tactics rating
    if (stats.tactics && stats.tactics.highest && stats.tactics.highest.rating) {
        html += '<div class="stat-card">';
        html += '<div class="stat-label">Tactics</div>';
        html += `<div class="stat-value">${stats.tactics.highest.rating}</div>`;
        html += '</div>';
    }
    
    // Puzzle rush
    if (stats.puzzle_rush && stats.puzzle_rush.best) {
        html += '<div class="stat-card">';
        html += '<div class="stat-label">Puzzle Rush</div>';
        html += `<div class="stat-value">${stats.puzzle_rush.best.score || 'N/A'}</div>`;
        html += '</div>';
    }
    
    html += '</div>';
    
    if (html === '<div class="stats-grid"></div>') {
        statsContent.innerHTML = '<div class="empty-state">No statistics available</div>';
    } else {
        statsContent.innerHTML = html;
    }
}

function displayGames() {
    if (!fetchedData.recentGames || !fetchedData.recentGames.success || !fetchedData.recentGames.data.games) {
        gamesListContainer.innerHTML = '<div class="empty-state">No recent games available</div>';
        gameFilters.style.display = 'none';
        return;
    }
    
    const games = fetchedData.recentGames.data.games;
    
    if (games.length === 0) {
        gamesListContainer.innerHTML = '<div class="empty-state">No games found</div>';
        gameFilters.style.display = 'none';
        return;
    }
    
    // Store all games and reverse to show newest first
    allGames = games.slice().reverse();
    filteredGames = [...allGames];
    
    // Show filters
    gameFilters.style.display = 'flex';
    
    // Display filtered games
    displayFilteredGames();
}

function displayTournaments() {
    if (!fetchedData.tournaments || !fetchedData.tournaments.success || !fetchedData.tournaments.data) {
        tournamentsContent.innerHTML = '<div class="empty-state">Tournament data not available</div>';
        return;
    }
    
    const tournaments = fetchedData.tournaments.data;
    
    if (!tournaments.finished || tournaments.finished.length === 0) {
        tournamentsContent.innerHTML = '<div class="empty-state">No tournaments found</div>';
        return;
    }
    
    let html = '';
    
    tournaments.finished.slice(0, 20).forEach(tournament => {
        html += '<div class="list-item">';
        html += `<div class="list-item-title">${escapeHtml(tournament.name || 'Unnamed Tournament')}</div>`;
        if (tournament.url) {
            html += `<div class="list-item-detail"><strong>URL:</strong> <a href="${tournament.url}" target="_blank">${tournament.url}</a></div>`;
        }
        if (tournament.status) {
            html += `<div class="list-item-detail"><strong>Status:</strong> ${escapeHtml(tournament.status)}</div>`;
        }
        html += '</div>';
    });
    
    tournamentsContent.innerHTML = html;
}

function displayClubs() {
    if (!fetchedData.clubs || !fetchedData.clubs.success || !fetchedData.clubs.data) {
        clubsContent.innerHTML = '<div class="empty-state">Club data not available</div>';
        return;
    }
    
    const clubs = fetchedData.clubs.data;
    
    // Handle both array and object responses
    let clubsArray = [];
    if (Array.isArray(clubs)) {
        clubsArray = clubs;
    } else if (clubs && typeof clubs === 'object') {
        // If it's an object, try to extract array from common properties
        if (clubs.clubs && Array.isArray(clubs.clubs)) {
            clubsArray = clubs.clubs;
        } else if (clubs.active && Array.isArray(clubs.active)) {
            clubsArray = clubs.active;
        } else {
            // Convert object values to array if it has numeric keys
            clubsArray = Object.values(clubs).filter(item => item && typeof item === 'object');
        }
    }
    
    if (!clubsArray || clubsArray.length === 0) {
        clubsContent.innerHTML = '<div class="empty-state">No clubs found</div>';
        return;
    }
    
    let html = '';
    
    clubsArray.forEach(club => {
        html += '<div class="list-item">';
        html += `<div class="list-item-title">${escapeHtml(club.name || 'Unnamed Club')}</div>`;
        if (club.url) {
            html += `<div class="list-item-detail"><strong>URL:</strong> <a href="${club.url}" target="_blank">${club.url}</a></div>`;
        }
        if (club.joined) {
            const joinedDate = new Date(club.joined * 1000);
            html += `<div class="list-item-detail"><strong>Joined:</strong> ${formatDate(joinedDate)}</div>`;
        }
        html += '</div>';
    });
    
    clubsContent.innerHTML = html;
}

function displayMatches() {
    if (!fetchedData.matches || !fetchedData.matches.success || !fetchedData.matches.data) {
        matchesContent.innerHTML = '<div class="empty-state">Match data not available</div>';
        return;
    }
    
    const matches = fetchedData.matches.data;
    
    if (!matches.finished || matches.finished.length === 0) {
        matchesContent.innerHTML = '<div class="empty-state">No matches found</div>';
        return;
    }
    
    let html = '';
    
    matches.finished.slice(0, 20).forEach(match => {
        html += '<div class="list-item">';
        html += `<div class="list-item-title">${escapeHtml(match.name || 'Unnamed Match')}</div>`;
        if (match.url) {
            html += `<div class="list-item-detail"><strong>URL:</strong> <a href="${match.url}" target="_blank">${match.url}</a></div>`;
        }
        if (match.status) {
            html += `<div class="list-item-detail"><strong>Status:</strong> ${escapeHtml(match.status)}</div>`;
        }
        html += '</div>';
    });
    
    matchesContent.innerHTML = html;
}

function displayRawData() {
    if (!fetchedData) {
        rawDataDisplay.textContent = 'No data available';
        return;
    }
    
    rawDataDisplay.textContent = JSON.stringify(fetchedData, null, 2);
}

// Search History Functions
function saveToSearchHistory(username) {
    let history = JSON.parse(localStorage.getItem('chessSearchHistory') || '[]');
    // Remove if already exists
    history = history.filter(u => u.toLowerCase() !== username.toLowerCase());
    // Add to beginning
    history.unshift(username);
    // Keep only last 10
    history = history.slice(0, 10);
    localStorage.setItem('chessSearchHistory', JSON.stringify(history));
    displayRecentSearches();
}

function loadRecentSearches() {
    displayRecentSearches();
}

function displayRecentSearches() {
    const history = JSON.parse(localStorage.getItem('chessSearchHistory') || '[]');
    if (history.length === 0) {
        recentSearches.style.display = 'none';
        return;
    }
    
    recentSearches.style.display = 'block';
    recentSearchesList.innerHTML = '';
    
    history.forEach(username => {
        const chip = document.createElement('button');
        chip.className = 'recent-search-chip';
        chip.textContent = username;
        chip.setAttribute('aria-label', `Search for ${username}`);
        chip.addEventListener('click', () => {
            usernameInput.value = username;
            usernameInput.focus();
            handleSearch();
        });
        recentSearchesList.appendChild(chip);
    });
}

function clearSearchHistory() {
    localStorage.removeItem('chessSearchHistory');
    recentSearches.style.display = 'none';
    showToast('Search history cleared');
}

// Dark Mode Functions
function loadTheme() {
    const savedTheme = localStorage.getItem('chessTheme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggle.querySelector('.theme-icon').textContent = '☀️';
    } else {
        document.body.classList.remove('dark-mode');
        themeToggle.querySelector('.theme-icon').textContent = '🌙';
    }
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('chessTheme', isDark ? 'dark' : 'light');
    themeToggle.querySelector('.theme-icon').textContent = isDark ? '☀️' : '🌙';
}

// Toast Notification
function showToast(message) {
    toast.textContent = message;
    toast.style.display = 'block';
    toast.setAttribute('aria-live', 'polite');
    // Announce to screen readers
    const announcement = document.createElement('div');
    announcement.className = 'sr-only';
    announcement.setAttribute('aria-live', 'polite');
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => {
        toast.style.display = 'none';
        document.body.removeChild(announcement);
    }, 3000);
}

// Export Functions
function exportProfileData() {
    if (!fetchedData.profile || !fetchedData.profile.success) {
        showToast('No profile data to export');
        return;
    }
    
    const dataToExport = {
        username: currentUsername,
        exportDate: new Date().toISOString(),
        profile: fetchedData.profile.data,
        stats: fetchedData.stats?.data || null,
        games: allGames.slice(0, 50), // Export first 50 games
        tournaments: fetchedData.tournaments?.data || null,
        clubs: fetchedData.clubs?.data || null,
        matches: fetchedData.matches?.data || null
    };
    
    const jsonStr = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chess-profile-${currentUsername}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Profile data exported');
}

function copyRawData() {
    if (!fetchedData) {
        showToast('No data to copy');
        return;
    }
    
    const jsonStr = JSON.stringify(fetchedData, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
        showToast('Raw data copied to clipboard');
    }).catch(() => {
        showToast('Failed to copy data');
    });
}

// Comparison Functions
function enterComparisonMode() {
    comparisonMode = true;
    comparisonData.player1 = { ...fetchedData, username: currentUsername };
    compareButton.textContent = 'Exit Compare';
    showToast('Search for a second player to compare');
}

function exitComparisonMode() {
    comparisonMode = false;
    comparisonData = { player1: null, player2: null };
    comparisonContainer.style.display = 'none';
    compareButton.textContent = 'Compare';
}

function displayComparison() {
    if (!comparisonData.player1 || !comparisonData.player2) return;
    
    comparisonContainer.style.display = 'block';
    let html = '<div class="comparison-content">';
    
    // Player 1
    html += '<div class="comparison-player">';
    html += `<h3>${comparisonData.player1.username}</h3>`;
    html += generateComparisonStats(comparisonData.player1);
    html += '</div>';
    
    // Player 2
    html += '<div class="comparison-player">';
    html += `<h3>${comparisonData.player2.username}</h3>`;
    html += generateComparisonStats(comparisonData.player2);
    html += '</div>';
    
    html += '</div>';
    comparisonContent.innerHTML = html;
}

function generateComparisonStats(playerData) {
    let html = '';
    const stats = playerData.stats?.data;
    
    if (stats) {
        const timeControls = [
            { key: 'chess_blitz', label: 'Blitz' },
            { key: 'chess_bullet', label: 'Bullet' },
            { key: 'chess_rapid', label: 'Rapid' },
            { key: 'chess_daily', label: 'Daily' }
        ];
        
        timeControls.forEach(control => {
            if (stats[control.key]?.last?.rating) {
                const rating = stats[control.key].last.rating;
                html += `<div class="comparison-stat">`;
                html += `<span>${control.label}:</span>`;
                html += `<strong>${rating}</strong>`;
                html += `</div>`;
            }
        });
    }
    
    return html;
}

// Rating Charts
function generateRatingCharts() {
    if (!fetchedData.archives || !fetchedData.archives.success) return;
    
    const archives = fetchedData.archives.data.archives || [];
    if (archives.length === 0) return;
    
    // Fetch rating history from recent archives (last 6 months)
    const recentArchives = archives.slice(-6);
    fetchRatingHistory(recentArchives);
}

async function fetchRatingHistory(archives) {
    const ratingData = { blitz: [], bullet: [], rapid: [], daily: [] };
    
    for (const archiveUrl of archives) {
        const parts = archiveUrl.split('/');
        const year = parseInt(parts[parts.length - 2]);
        const month = parseInt(parts[parts.length - 1]);
        
        try {
            const gamesData = await fetchGamesByMonth(currentUsername, year, month);
            if (gamesData.success && gamesData.data.games) {
                gamesData.data.games.forEach(game => {
                    const timeControl = game.time_control || '';
                    const date = new Date(game.end_time * 1000);
                    
                    if (game.white.username === currentUsername) {
                        const rating = game.white.rating;
                        if (timeControl.includes('blitz') && rating) ratingData.blitz.push({ date, rating });
                        if (timeControl.includes('bullet') && rating) ratingData.bullet.push({ date, rating });
                        if (timeControl.includes('rapid') && rating) ratingData.rapid.push({ date, rating });
                        if (timeControl.includes('daily') && rating) ratingData.daily.push({ date, rating });
                    } else if (game.black.username === currentUsername) {
                        const rating = game.black.rating;
                        if (timeControl.includes('blitz') && rating) ratingData.blitz.push({ date, rating });
                        if (timeControl.includes('bullet') && rating) ratingData.bullet.push({ date, rating });
                        if (timeControl.includes('rapid') && rating) ratingData.rapid.push({ date, rating });
                        if (timeControl.includes('daily') && rating) ratingData.daily.push({ date, rating });
                    }
                });
            }
        } catch (error) {
            console.error('Error fetching rating history:', error);
        }
    }
    
    displayRatingCharts(ratingData);
}

function displayRatingCharts(ratingData) {
    const chartsContainer = document.getElementById('ratingCharts');
    if (!chartsContainer) return;
    
    let html = '';
    const chartTypes = [
        { key: 'blitz', label: 'Blitz Rating' },
        { key: 'bullet', label: 'Bullet Rating' },
        { key: 'rapid', label: 'Rapid Rating' },
        { key: 'daily', label: 'Daily Rating' }
    ];
    
    chartTypes.forEach(type => {
        const data = ratingData[type.key];
        if (data.length === 0) return;
        
        html += '<div class="rating-chart-container">';
        html += `<div class="rating-chart-title">${type.label}</div>`;
        html += `<svg class="rating-chart" viewBox="0 0 400 200">`;
        html += generateChartSVG(data);
        html += `</svg>`;
        html += '</div>';
    });
    
    chartsContainer.innerHTML = html;
}

function generateChartSVG(data) {
    if (data.length === 0) return '';
    
    const width = 400;
    const height = 200;
    const padding = 20;
    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding;
    
    const ratings = data.map(d => d.rating);
    const minRating = Math.min(...ratings);
    const maxRating = Math.max(...ratings);
    const range = maxRating - minRating || 1;
    
    let path = `M ${padding} ${height - padding}`;
    data.forEach((point, index) => {
        const x = padding + (index / (data.length - 1)) * chartWidth;
        const y = height - padding - ((point.rating - minRating) / range) * chartHeight;
        path += index === 0 ? ` M ${x} ${y}` : ` L ${x} ${y}`;
    });
    
    return `<path d="${path}" stroke="var(--secondary-color)" stroke-width="2" fill="none"/>`;
}

// Performance Metrics
function calculatePerformanceMetrics() {
    if (!allGames || allGames.length === 0) return;
    
    const metrics = {
        totalGames: allGames.length,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: 0,
        currentStreak: { type: 'none', count: 0 },
        bestStreak: { type: 'win', count: 0 },
        worstStreak: { type: 'loss', count: 0 }
    };
    
    const username = currentUsername;
    let currentStreakType = 'none';
    let currentStreakCount = 0;
    let bestWinStreak = 0;
    let worstLossStreak = 0;
    let tempWinStreak = 0;
    let tempLossStreak = 0;
    
    allGames.forEach(game => {
        const isWhite = game.white.username === username;
        const result = isWhite ? game.white.result : game.black.result;
        
        if (result === 'win') {
            metrics.wins++;
            tempWinStreak++;
            tempLossStreak = 0;
            if (tempWinStreak > bestWinStreak) bestWinStreak = tempWinStreak;
        } else if (result === 'checkmated' || result === 'resigned' || result === 'timeout') {
            metrics.losses++;
            tempLossStreak++;
            tempWinStreak = 0;
            if (tempLossStreak > worstLossStreak) worstLossStreak = tempLossStreak;
        } else {
            metrics.draws++;
            tempWinStreak = 0;
            tempLossStreak = 0;
        }
        
        // Current streak
        if (result === 'win') {
            if (currentStreakType === 'win') currentStreakCount++;
            else { currentStreakType = 'win'; currentStreakCount = 1; }
        } else if (result === 'checkmated' || result === 'resigned' || result === 'timeout') {
            if (currentStreakType === 'loss') currentStreakCount++;
            else { currentStreakType = 'loss'; currentStreakCount = 1; }
        } else {
            currentStreakType = 'none';
            currentStreakCount = 0;
        }
    });
    
    metrics.winRate = metrics.totalGames > 0 ? ((metrics.wins / metrics.totalGames) * 100).toFixed(1) : 0;
    metrics.currentStreak = { type: currentStreakType, count: currentStreakCount };
    metrics.bestStreak = { type: 'win', count: bestWinStreak };
    metrics.worstStreak = { type: 'loss', count: worstLossStreak };
    
    displayPerformanceMetrics(metrics);
}

function displayPerformanceMetrics(metrics) {
    const metricsContainer = document.getElementById('performanceMetrics');
    if (!metricsContainer) return;
    
    let html = '';
    html += '<div class="metric-card">';
    html += '<div class="metric-label">Total Games</div>';
    html += `<div class="metric-value">${metrics.totalGames}</div>`;
    html += '</div>';
    
    html += '<div class="metric-card">';
    html += '<div class="metric-label">Win Rate</div>';
    html += `<div class="metric-value">${metrics.winRate}%</div>`;
    html += '</div>';
    
    html += '<div class="metric-card">';
    html += '<div class="metric-label">Record</div>';
    html += `<div class="metric-value">${metrics.wins}W-${metrics.losses}L-${metrics.draws}D</div>`;
    html += '</div>';
    
    if (metrics.currentStreak.count > 0) {
        html += '<div class="metric-card">';
        html += '<div class="metric-label">Current Streak</div>';
        html += `<div class="metric-value">${metrics.currentStreak.count} ${metrics.currentStreak.type === 'win' ? 'Wins' : 'Losses'}</div>`;
        html += '</div>';
    }
    
    if (metrics.bestStreak.count > 0) {
        html += '<div class="metric-card">';
        html += '<div class="metric-label">Best Win Streak</div>';
        html += `<div class="metric-value">${metrics.bestStreak.count}</div>`;
        html += '</div>';
    }
    
    metricsContainer.innerHTML = html;
}

// Game Filtering
function applyGameFilters() {
    if (!allGames || allGames.length === 0) return;
    
    filteredGames = [...allGames];
    
    // Filter by time control
    const timeControlFilter = filterTimeControl.value;
    if (timeControlFilter) {
        filteredGames = filteredGames.filter(game => {
            const tc = (game.time_control || '').toLowerCase();
            return tc.includes(timeControlFilter);
        });
    }
    
    // Filter by result
    const resultFilter = filterResult.value;
    if (resultFilter) {
        filteredGames = filteredGames.filter(game => {
            const username = currentUsername;
            const isWhite = game.white.username === username;
            const result = isWhite ? game.white.result : game.black.result;
            
            if (resultFilter === 'win') return result === 'win';
            if (resultFilter === 'loss') return result === 'checkmated' || result === 'resigned' || result === 'timeout';
            if (resultFilter === 'draw') return result === 'agreed' || result === 'repetition' || result === 'stalemate' || result === 'insufficient';
            return true;
        });
    }
    
    // Sort
    const sortValue = sortGames.value;
    filteredGames.sort((a, b) => {
        if (sortValue === 'date-desc') return (b.end_time || 0) - (a.end_time || 0);
        if (sortValue === 'date-asc') return (a.end_time || 0) - (b.end_time || 0);
        if (sortValue === 'rating-desc') {
            const aRating = getOpponentRating(a);
            const bRating = getOpponentRating(b);
            return (bRating || 0) - (aRating || 0);
        }
        if (sortValue === 'rating-asc') {
            const aRating = getOpponentRating(a);
            const bRating = getOpponentRating(b);
            return (aRating || 0) - (bRating || 0);
        }
        return 0;
    });
    
    currentPage = 1;
    displayFilteredGames();
}

function getOpponentRating(game) {
    const username = currentUsername;
    if (game.white.username === username) return game.black.rating || 0;
    return game.white.rating || 0;
}

function resetGameFilters() {
    filterTimeControl.value = '';
    filterResult.value = '';
    sortGames.value = 'date-desc';
    filteredGames = [...allGames];
    currentPage = 1;
    displayFilteredGames();
}

function displayFilteredGames() {
    if (!filteredGames || filteredGames.length === 0) {
        gamesListContainer.innerHTML = '<div class="empty-state">No games match the filters</div>';
        gamesPagination.style.display = 'none';
        return;
    }
    
    const start = (currentPage - 1) * gamesPerPage;
    const end = start + gamesPerPage;
    const pageGames = filteredGames.slice(start, end);
    
    let html = '<div class="games-list">';
    
    pageGames.forEach(game => {
        const white = game.white;
        const black = game.black;
        const username = currentUsername;
        
        let result = 'draw';
        let resultText = 'Draw';
        if (game.white.username === username) {
            if (game.white.result === 'win') {
                result = 'win';
                resultText = 'Win';
            } else if (game.white.result === 'checkmated' || game.white.result === 'resigned' || game.white.result === 'timeout') {
                result = 'loss';
                resultText = 'Loss';
            }
        } else if (game.black.username === username) {
            if (game.black.result === 'win') {
                result = 'win';
                resultText = 'Win';
            } else if (game.black.result === 'checkmated' || game.black.result === 'resigned' || game.black.result === 'timeout') {
                result = 'loss';
                resultText = 'Loss';
            }
        }
        
        const timeControl = formatTimeControl(game.time_control) || 'N/A';
        const endTime = game.end_time ? formatDate(new Date(game.end_time * 1000)) : 'N/A';
        const opening = game.pgn ? extractOpening(game.pgn) : null;
        
        html += '<div class="game-item">';
        html += '<div class="game-info">';
        html += `<div class="game-result ${result}">${resultText}</div>`;
        html += `<div class="game-details">vs ${escapeHtml(game.white.username === username ? black.username : white.username)} | ${timeControl} | ${endTime}`;
        if (opening) html += ` | ${opening}`;
        html += `</div>`;
        html += '</div>';
        if (game.url) {
            html += `<a href="${game.url}" target="_blank" class="game-link">View Game</a>`;
        }
        html += '</div>';
    });
    
    html += '</div>';
    gamesListContainer.innerHTML = html;
    
    // Pagination
    const totalPages = Math.ceil(filteredGames.length / gamesPerPage);
    if (totalPages > 1) {
        displayPagination(totalPages);
    } else {
        gamesPagination.style.display = 'none';
    }
}

function extractOpening(pgn) {
    const lines = pgn.split('\n');
    for (const line of lines) {
        if (line.startsWith('[ECO')) {
            const ecoMatch = line.match(/"(.*?)"/);
            if (ecoMatch) return ecoMatch[1];
        }
        if (line.startsWith('[Opening')) {
            const openingMatch = line.match(/"(.*?)"/);
            if (openingMatch) return openingMatch[1];
        }
    }
    return null;
}

function displayPagination(totalPages) {
    gamesPagination.style.display = 'flex';
    let html = '';
    
    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    
    gamesPagination.innerHTML = html;
    
    gamesPagination.querySelectorAll('.pagination-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentPage = parseInt(btn.getAttribute('data-page'));
            displayFilteredGames();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}

// Local Storage Caching
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

function getCachedData(key) {
    try {
        const cached = localStorage.getItem(`chess_cache_${key}`);
        if (!cached) return null;
        
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp > CACHE_DURATION) {
            localStorage.removeItem(`chess_cache_${key}`);
            return null;
        }
        return data;
    } catch {
        return null;
    }
}

function setCachedData(key, data) {
    try {
        localStorage.setItem(`chess_cache_${key}`, JSON.stringify({
            data,
            timestamp: Date.now()
        }));
    } catch {
        // Ignore storage errors
    }
}

async function fetchWithCaching(url, errorContext, cacheKey) {
    // Check cache first
    const cached = getCachedData(cacheKey);
    if (cached) {
        return { success: true, data: cached, cached: true };
    }
    
    // Fetch from API
    try {
        const result = await fetchWithErrorHandling(url, errorContext);
        if (result.success) {
            setCachedData(cacheKey, result.data);
        }
        return { ...result, cached: false };
    } catch (error) {
        // Return error but allow partial data display
        return { success: false, error: error.message, cached: false };
    }
}

// Utility Functions
function toggleSection(sectionName) {
    const sectionMap = {
        profile: { content: profileContent, btn: document.querySelector('[data-section="profile"]') },
        stats: { content: statsContent, btn: document.querySelector('[data-section="stats"]') },
        games: { content: gamesContent, btn: document.querySelector('[data-section="games"]') },
        tournaments: { content: tournamentsContent, btn: document.querySelector('[data-section="tournaments"]') },
        clubs: { content: clubsContent, btn: document.querySelector('[data-section="clubs"]') },
        matches: { content: matchesContent, btn: document.querySelector('[data-section="matches"]') },
        rawData: { content: document.getElementById('rawDataContent'), btn: document.querySelector('[data-section="rawData"]') }
    };
    
    const section = sectionMap[sectionName];
    if (!section) return;
    
    const isCollapsed = section.content.classList.contains('collapsed');
    
    if (isCollapsed) {
        section.content.classList.remove('collapsed');
        section.btn.textContent = '▼';
    } else {
        section.content.classList.add('collapsed');
        section.btn.textContent = '▶';
    }
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Format time control from seconds to human-readable format
function formatTimeControl(timeControl) {
    if (!timeControl || timeControl === 'N/A') {
        return 'N/A';
    }
    
    // If already contains letters (already formatted), return as-is
    if (typeof timeControl === 'string' && /[a-zA-Z]/.test(timeControl)) {
        return timeControl;
    }
    
    // Helper function to format a single time value in seconds
    function formatTime(seconds) {
        if (!seconds && seconds !== 0) return '';
        
        const secs = parseInt(seconds, 10);
        if (isNaN(secs)) return '';
        
        // Under 60 seconds: display as seconds
        if (secs < 60) {
            return `${secs}s`;
        }
        
        // 60+ seconds but less than 3600: convert to minutes
        if (secs < 3600) {
            const minutes = Math.floor(secs / 60);
            const remainingSeconds = secs % 60;
            if (remainingSeconds === 0) {
                return `${minutes}m`;
            }
            return `${minutes}m ${remainingSeconds}s`;
        }
        
        // 3600+ seconds: convert to hours and minutes
        const hours = Math.floor(secs / 3600);
        const remainingMinutes = Math.floor((secs % 3600) / 60);
        const remainingSecs = secs % 60;
        
        if (remainingMinutes === 0 && remainingSecs === 0) {
            return `${hours}h`;
        } else if (remainingSecs === 0) {
            return `${hours}h ${remainingMinutes}m`;
        } else {
            return `${hours}h ${remainingMinutes}m ${remainingSecs}s`;
        }
    }
    
    // Convert to string if it's a number
    const timeStr = String(timeControl);
    
    // Check if it has increment format (X+Y)
    if (timeStr.includes('+')) {
        const parts = timeStr.split('+');
        const baseTime = formatTime(parts[0]);
        const increment = formatTime(parts[1]);
        
        if (!baseTime) return 'N/A';
        if (!increment) return baseTime;
        
        return `${baseTime}+${increment}`;
    }
    
    // Single time value
    const formatted = formatTime(timeStr);
    return formatted || 'N/A';
}

// Copy to clipboard helper (global for onclick handlers)
function copyToClipboard(text, label) {
    navigator.clipboard.writeText(text).then(() => {
        showToast(`${label} copied to clipboard`);
    }).catch(() => {
        showToast('Failed to copy');
    });
}

// Make it globally accessible
window.copyToClipboard = copyToClipboard;
