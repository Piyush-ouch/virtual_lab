document.addEventListener('DOMContentLoaded', function() {
    // ==================== DOM ELEMENTS ====================
    const elements = {
        bob: document.getElementById('bob'),
        stringContainer: document.querySelector('.pendulum-string-container'),
        stringElement: document.querySelector('.pendulum-string'),
        startBtn: document.getElementById('start-btn'),
        resetBtn: document.getElementById('reset-btn'),
        oscillationsInput: document.getElementById('oscillations'),
        lengthInput: document.getElementById('length'),
        dataBody: document.getElementById('data-body'),
        averageBtn: document.getElementById('average-btn'),
        averageResult: document.getElementById('average-result'),
        phaseDisplay: document.getElementById('phase-difference-value'),
        timeDisplay: document.getElementById('time-difference'),
        saveBtn: document.getElementById('save-btn'),
        loadBtn: document.getElementById('load-btn'),
        downloadBtn: document.getElementById('download-btn'),
        historyBody: document.getElementById('history-body'),
        savedExperiments: document.getElementById('saved-experiments'),
        stopwatchDisplay: document.querySelector('.stopwatch-display'),
        stopwatchStartBtn: document.getElementById('stopwatch-start'),
        stopwatchStopBtn: document.getElementById('stopwatch-stop'),
        periodDisplay: document.getElementById('period-display') || createDisplayElement('period-display'),
        totalTimeDisplay: document.getElementById('total-time-display') || createDisplayElement('total-time-display')
    };

    function createDisplayElement(id) {
        const el = document.createElement('div');
        el.id = id;
        el.style.display = 'none'; // Hidden but available for calculations
        document.body.appendChild(el);
        return el;
    }

    // ==================== CONSTANTS ====================
    const constants = {
        GRAVITY: 9.8,
        BASE_LENGTH: 300, // pixels for 100cm
        MAX_ANGLE: 60, // degrees
        MIN_ANGLE: -60 // degrees
    };

    // ==================== STATE MANAGEMENT ====================
    const state = {
        isDragging: false,
        startAngle: 15,
        animationId: null,
        lastAngle: 0,
        oscillationCount: 0,
        startTime: 0,
        currentLength: constants.BASE_LENGTH,
        trialNumber: 1,
        pauseTime: 0,
        lastResumeTime: 0,
        isFreshStart: true,
        phaseDifference: 0,
        lastZeroCrossingTime: 0,
        currentPeriod: 0,
        periodMeasurements: [],
        phaseMeasurements: [],
        stopwatchInterval: null,
        stopwatchStartTime: 0,
        elapsedTime: 0,
        isStopwatchRunning: false,
        isPendulumRunning: false,
        trialData: [],
        phaseChart: null
    };

    // ==================== INITIALIZATION ====================
    function initialize() {
        initializeStopwatchDisplay();
        updateLength();
        initializePhaseGraph();
        setupEventListeners();
        loadExperiments();
    }

    function initializeStopwatchDisplay() {
        elements.stopwatchDisplay.innerHTML = '';
        const minutesDisplay = document.createElement('span');
        minutesDisplay.id = 'minutes';
        minutesDisplay.textContent = '00';
        const secondsDisplay = document.createElement('span');
        secondsDisplay.id = 'seconds';
        secondsDisplay.textContent = '00';
        const millisecondsDisplay = document.createElement('span');
        millisecondsDisplay.id = 'milliseconds';
        millisecondsDisplay.textContent = '00';
        
        elements.stopwatchDisplay.appendChild(minutesDisplay);
        elements.stopwatchDisplay.appendChild(document.createTextNode(':'));
        elements.stopwatchDisplay.appendChild(secondsDisplay);
        elements.stopwatchDisplay.appendChild(document.createTextNode('.'));
        elements.stopwatchDisplay.appendChild(millisecondsDisplay);
    }

    // ==================== EVENT HANDLERS ====================
    function setupEventListeners() {
        // Pendulum controls
        elements.bob.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);
        elements.startBtn.addEventListener('click', startOscillation);
        elements.resetBtn.addEventListener('click', resetPendulum);
        elements.lengthInput.addEventListener('input', updateLength);
        elements.averageBtn.addEventListener('click', calculateAverage);

        // Stopwatch controls
        elements.stopwatchStartBtn.addEventListener('click', startStopwatchAndPendulum);
        elements.stopwatchStopBtn.addEventListener('click', stopStopwatchAndPendulum);

        // Database operations
        elements.saveBtn?.addEventListener('click', saveExperiment);
        elements.loadBtn?.addEventListener('click', loadExperiments);
        elements.downloadBtn?.addEventListener('click', downloadCSV);
    }

    // ==================== PENDULUM PHYSICS ====================
    function startDrag(e) {
        e.preventDefault();
        state.isDragging = true;
        elements.bob.style.cursor = 'grabbing';

        if (state.animationId) {
            cancelAnimationFrame(state.animationId);
            state.animationId = null;
            state.isPendulumRunning = false;
        }
        updateButtonStates();
    }

    function drag(e) {
        if (!state.isDragging) return;

        const container = document.querySelector('.pendulum-container');
        const rect = container.getBoundingClientRect();
        const stringContainerRect = elements.stringContainer.getBoundingClientRect();

        const pivotX = rect.left + rect.width / 2;
        const pivotY = stringContainerRect.top;

        const mouseX = e.clientX;
        const mouseY = e.clientY;

        const deltaX = mouseX - pivotX;
        const deltaY = mouseY - pivotY;

        let angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
        angle = Math.max(constants.MIN_ANGLE, Math.min(constants.MAX_ANGLE, angle));

        elements.stringContainer.style.transform = `translateX(-50%) rotate(${angle}deg)`;
        state.startAngle = angle;
        state.lastAngle = angle;
    }

    function stopDrag() {
        state.isDragging = false;
        elements.bob.style.cursor = 'grab';
    }

    function startOscillation() {
        const oscillations = parseInt(elements.oscillationsInput.value) || 5;
        const lengthCm = parseInt(elements.lengthInput.value) || 50;

        // Reset state
        resetPendulumState();
        state.isPendulumRunning = true;
        updateButtonStates();
        resetStopwatch();
        startStopwatch();

        if (state.animationId) cancelAnimationFrame(state.animationId);
        state.animationId = requestAnimationFrame((t) => animatePendulum(t, oscillations, lengthCm));
    }

    function resetPendulumState() {
        state.oscillationCount = 0;
        state.startTime = 0;
        state.lastZeroCrossingTime = 0;
        state.pauseTime = 0;
        state.lastResumeTime = 0;
        state.periodMeasurements = [];
        state.phaseMeasurements = [];
        state.isFreshStart = true;
    }

    function animatePendulum(timestamp, oscillations, lengthCm) {
        if (!state.startTime) {
            state.startTime = timestamp;
            state.lastZeroCrossingTime = 0;
        }
        
        const adjustedTimestamp = timestamp - state.pauseTime;
        const elapsed = (adjustedTimestamp - state.startTime) / 1000;

        const lengthM = lengthCm / 100;
        state.currentPeriod = 2 * Math.PI * Math.sqrt(lengthM / constants.GRAVITY);
        const angle = state.startAngle * Math.cos(2 * Math.PI * elapsed / state.currentPeriod);

        state.phaseDifference = (2 * Math.PI * (elapsed % state.currentPeriod)) / state.currentPeriod;
        elements.phaseDisplay.textContent = state.phaseDifference.toFixed(3);

        elements.stringContainer.style.transform = `translateX(-50%) rotate(${angle}deg)`;

        // Detect zero crossings (when pendulum passes center)
        if (Math.abs(angle) < 5 && Math.sign(angle) !== Math.sign(state.lastAngle)) {
            state.oscillationCount += 0.5;
            
            // Only record full oscillations (every 2 zero crossings)
            if (state.oscillationCount % 1 === 0) {
                const actualPeriod = elapsed - state.lastZeroCrossingTime;
                state.lastZeroCrossingTime = elapsed;
                
                state.periodMeasurements.push(actualPeriod);
                state.phaseMeasurements.push(state.phaseDifference);
                
                // Update displays
                elements.periodDisplay.textContent = actualPeriod.toFixed(4);
                elements.totalTimeDisplay.textContent = elapsed.toFixed(2);
            }
        }

        // Check completion condition
        if (state.oscillationCount >= oscillations && Math.abs(angle) < 2) {
            stopStopwatch();
            addDataToTable(oscillations, elapsed);
            state.isPendulumRunning = false;
            state.isFreshStart = true;
            updateButtonStates();
            return;
        }

        state.lastAngle = angle;
        state.animationId = requestAnimationFrame((t) => animatePendulum(t, oscillations, lengthCm));
    }

    function resetPendulum() {
        stopStopwatchAndPendulum();
        elements.stringContainer.style.transform = 'translateX(-50%) rotate(0deg)';
        state.startAngle = 15;
        state.lastAngle = 0;
        resetPendulumState();
        elements.phaseDisplay.textContent = "0";
        elements.timeDisplay.textContent = "0";
        updateButtonStates();

        if (state.phaseChart) {
            state.phaseChart.data.labels = [];
            state.phaseChart.data.datasets[0].data = [];
            state.phaseChart.update();
        }
    }

    // ==================== STOPWATCH FUNCTIONS ====================
    function startStopwatch() {
        if (!state.isStopwatchRunning) {
            state.stopwatchStartTime = Date.now() - state.elapsedTime;
            state.stopwatchInterval = setInterval(updateStopwatch, 10);
            state.isStopwatchRunning = true;
            updateButtonStates();
        }
    }

    function updateStopwatch() {
        const currentTime = Date.now();
        state.elapsedTime = currentTime - state.stopwatchStartTime;
        
        const minutes = Math.floor(state.elapsedTime / 60000);
        const seconds = Math.floor((state.elapsedTime % 60000) / 1000);
        const milliseconds = Math.floor((state.elapsedTime % 1000) / 10);
        
        document.getElementById('minutes').textContent = minutes.toString().padStart(2, '0');
        document.getElementById('seconds').textContent = seconds.toString().padStart(2, '0');
        document.getElementById('milliseconds').textContent = milliseconds.toString().padStart(2, '0');
    }

    function stopStopwatch() {
        clearInterval(state.stopwatchInterval);
        state.isStopwatchRunning = false;
        updateButtonStates();
    }

    function resetStopwatch() {
        stopStopwatch();
        state.elapsedTime = 0;
        document.getElementById('minutes').textContent = '00';
        document.getElementById('seconds').textContent = '00';
        document.getElementById('milliseconds').textContent = '00';
        updateButtonStates();
    }

    function startStopwatchAndPendulum() {
        if (!state.isPendulumRunning) {
            if (state.isFreshStart) {
                resetPendulumState();
                resetStopwatch();
                state.startAngle = 60;
                elements.stringContainer.style.transform = `translateX(-50%) rotate(${state.startAngle}deg)`;
                state.lastAngle = state.startAngle;
            } else if (state.lastResumeTime > 0) {
                state.pauseTime += Date.now() - state.lastResumeTime;
            }
            
            startStopwatch();
            state.isPendulumRunning = true;
            state.isFreshStart = false;
            updateButtonStates();
            
            const oscillations = parseInt(elements.oscillationsInput.value) || 5;
            const lengthCm = parseInt(elements.lengthInput.value) || 50;
            
            if (state.animationId) cancelAnimationFrame(state.animationId);
            state.animationId = requestAnimationFrame((t) => animatePendulum(t, oscillations, lengthCm));
            
            state.lastResumeTime = Date.now();
        }
    }

    function stopStopwatchAndPendulum() {
        if (state.isPendulumRunning) {
            stopStopwatch();
            if (state.animationId) {
                cancelAnimationFrame(state.animationId);
                state.animationId = null;
            }
            state.isPendulumRunning = false;
            updateButtonStates();
            state.lastResumeTime = Date.now();
        }
    }

    function updateButtonStates() {
        elements.stopwatchStartBtn.disabled = state.isStopwatchRunning;
        elements.stopwatchStopBtn.disabled = !state.isStopwatchRunning;
        elements.startBtn.disabled = state.isPendulumRunning;
        elements.resetBtn.disabled = !state.isPendulumRunning && !state.isStopwatchRunning;
    }

    // ==================== DATA MANAGEMENT ====================
    function addDataToTable(oscillations, totalTime) {
        const period = (totalTime / oscillations).toFixed(2);
        const trial = {
            number: state.trialNumber,
            oscillations: oscillations,
            totalTime: totalTime.toFixed(2),
            period: period
        };

        state.trialData.push(trial);
        const lengthCm = parseInt(elements.lengthInput.value) || 50;
        updateLengthVsT2Graph(lengthCm, period);

        const row = `
            <tr>
                <td>${trial.number}</td>
                <td>${trial.oscillations}</td>
                <td>${trial.totalTime}</td>
                <td>${trial.period}</td>
            </tr>
        `;
        elements.dataBody.insertAdjacentHTML('beforeend', row);
        state.trialNumber++;
    }

    function calculateAverage() {
        fetch('/get_average')
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                if (data.status === 'success' && data.count === state.trialData.length) {
                    displayAverageResult(data.average, data.count, true);
                } else {
                    calculateClientSideAverage();
                }
            })
            .catch(() => {
                calculateClientSideAverage();
            });
    }

    function calculateClientSideAverage() {
        if (state.trialData.length === 0) {
            displayAverageResult(0, 0, false);
            return;
        }

        const totalPeriod = state.trialData.reduce((sum, trial) => {
            return sum + parseFloat(trial.period);
        }, 0);

        const average = totalPeriod / state.trialData.length;
        displayAverageResult(average, state.trialData.length, false);
    }

    function displayAverageResult(average, count, fromServer) {
        if (count === 0) {
            elements.averageResult.textContent = 'No data available to calculate average';
            elements.averageResult.style.color = '#ff9800';
        } else {
            const source = fromServer ? '(server calculation)' : '(client calculation)';
            elements.averageResult.textContent = `Average Time Period: ${average.toFixed(2)}s (from ${count} trial${count !== 1 ? 's' : ''} ${source}`;
            elements.averageResult.style.color = '#11999E';
        }
    }

    // ==================== DATABASE OPERATIONS ====================
    async function saveExperiment() {
        try {
            // Verify we have valid measurements
            const totalTime = parseFloat(elements.totalTimeDisplay.textContent);
            const period = parseFloat(elements.periodDisplay.textContent);
            
            if (isNaN(totalTime) || totalTime <= 0 || isNaN(period) || period <= 0) {
                throw new Error('Invalid time measurements. Please run the experiment first.');
            }

            const experimentData = {
                n: parseInt(elements.oscillationsInput.value) || 0,
                t: totalTime,
                T: period,
                length: parseFloat(elements.lengthInput.value) || 0,
                phase_difference: parseFloat(elements.phaseDisplay.textContent) || 0
            };

            const response = await fetch('/add_data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(experimentData)
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const result = await response.json();
            if (result.status !== 'success') throw new Error(result.message || 'Save failed');
            
            alert('Experiment saved successfully!');
            loadExperiments();
        } catch (error) {
            console.error('Save error:', error);
            alert('Failed to save experiment: ' + error.message);
        }
    }

    async function loadExperiments() {
        try {
            const response = await fetch('/get_experiments');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const result = await response.json();
            if (result.status !== 'success') throw new Error(result.message || 'Load failed');

            renderExperiments(result.data);
        } catch (error) {
            console.error('Load error:', error);
            alert('Failed to load experiments: ' + error.message);
        }
    }

    function renderExperiments(experiments) {
        if (!elements.historyBody) {
            console.error('History table body not found');
            return;
        }

        elements.historyBody.innerHTML = experiments.map(exp => `
            <tr>
                <td>${exp.id}</td>
                <td>${exp.length?.toFixed(2) || 'N/A'}</td>
                <td>${exp.oscillations}</td>
                <td>${exp.total_time?.toFixed(2) || 'N/A'}</td>
                <td>${exp.period?.toFixed(4) || 'N/A'}</td>
                <td>${exp.phase_difference?.toFixed(4) || 'N/A'}</td>
                <td>${new Date(exp.created_at).toLocaleString()}</td>
                <td>
                    <button class="load-exp-btn" data-id="${exp.id}">Load</button>
                    <button class="delete-exp-btn" data-id="${exp.id}">Delete</button>
                </td>
            </tr>
        `).join('');

        if (elements.savedExperiments) {
            elements.savedExperiments.style.display = 'block';
        }

        setupExperimentButtons(experiments);
    }

    function setupExperimentButtons(experiments) {
        document.querySelectorAll('.load-exp-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const expId = this.dataset.id;
                const experiment = experiments.find(exp => exp.id == expId);
                
                if (experiment) {
                    elements.lengthInput.value = experiment.length;
                    elements.oscillationsInput.value = experiment.oscillations;
                    alert(`Loaded experiment ${expId}\nLength: ${experiment.length}cm\nOscillations: ${experiment.oscillations}`);
                }
            });
        });

        document.querySelectorAll('.delete-exp-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                if (!confirm('Are you sure you want to delete this experiment?')) return;
                
                const expId = this.dataset.id;
                try {
                    const response = await fetch(`/delete_experiment/${expId}`, {
                        method: 'DELETE'
                    });
                    
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    
                    const result = await response.json();
                    if (result.status !== 'success') throw new Error(result.message || 'Delete failed');
                    
                    this.closest('tr').remove();
                    alert('Experiment deleted successfully');
                } catch (error) {
                    console.error('Delete error:', error);
                    alert('Failed to delete experiment: ' + error.message);
                }
            });
        });
    }

    function downloadCSV() {
        const table = document.getElementById('data-table');
        let csv = [];
        const rows = table.querySelectorAll('tr');
        
        for (let row of rows) {
            let rowData = [];
            const cols = row.querySelectorAll('td, th');
            for (let col of cols) {
                rowData.push(col.innerText);
            }
            csv.push(rowData.join(','));
        }
        
        const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'pendulum_data.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    // ==================== DATA VISUALIZATION ====================
    function initializePhaseGraph() {
        const ctx = document.getElementById('phaseGraph').getContext('2d');
        state.phaseChart = new Chart(ctx, {
            type: 'scatter',
            data: {
                labels: [],
                datasets: [{
                    label: 'T² vs Length',
                    data: [],
                    borderColor: '#30e3ca',
                    backgroundColor: 'rgba(48, 227, 202, 0.8)',
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    showLine: true,
                    borderWidth: 2,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                animation: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Length (m)',
                            color: '#ffffff'
                        },
                        ticks: { color: '#ffffff' }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'T² (s²)',
                            color: '#ffffff'
                        },
                        ticks: { color: '#ffffff' },
                        min: 0
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: '#ffffff' }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return [
                                    `Length: ${context.parsed.x.toFixed(3)} m`,
                                    `T²: ${context.parsed.y.toFixed(3)} s²`
                                ];
                            }
                        }
                    }
                }
            }
        });
    }

    function updateLengthVsT2Graph(lengthCm, period) {
        const T2 = Math.pow(period, 2);
        const lengthM = lengthCm / 100;

        state.phaseChart.data.labels.push(`Trial ${state.trialNumber}`);
        state.phaseChart.data.datasets[0].data.push({
            x: lengthM,
            y: T2
        });
        state.phaseChart.update();
    }

    // ==================== UTILITY FUNCTIONS ====================
    function updateLength() {
        const lengthCm = parseInt(elements.lengthInput.value) || 50;
        const scale = lengthCm / 100;
        state.currentLength = constants.BASE_LENGTH * scale;
        elements.stringElement.style.height = `${state.currentLength}px`;
    }

    // Start the application
    initialize();
});