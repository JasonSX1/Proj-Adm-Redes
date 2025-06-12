document.addEventListener('DOMContentLoaded', () => {
    // --- Configurações ---
    const API_BASE_URL = 'http://localhost:3002'; // URL do back
    const POLLING_INTERVAL = 2000; // Intervalo de busca em milissegundos (ex: 2000ms = 2 segundos)
    const MAX_DATA_POINTS = 30; // Máximo de pontos de dados a serem exibidos no gráfico

    // --- Elementos da DOM ---
    const rxValueElem = document.getElementById('rx-value');
    const rxUnitElem = document.getElementById('rx-unit');
    const txValueElem = document.getElementById('tx-value');
    const txUnitElem = document.getElementById('tx-unit');
    const statusTextElem = document.getElementById('status-text');
    const lastUpdateTimeElem = document.getElementById('last-update-time');
    const toggleButton = document.getElementById('toggle-button');
    const hostnameElem = document.getElementById('hostname');
    const interfaceNameElem = document.getElementById('interface-name');

    // --- Estado da Aplicação ---
    let trafficInterval;
    let isPaused = false;
    let chart;

    // --- Funções ---

    /**
     * Formata a taxa de bits (bps) para a unidade mais apropriada (Kbps, Mbps, Gbps).
     * @param {number} bits - A taxa em bits por segundo.
     * @returns {{value: string, unit: string}} O valor formatado e a unidade.
     */
    function formatBitrate(bits) {
        if (bits < 1000) {
            return { value: bits.toFixed(0), unit: 'bps' };
        } else if (bits < 1000000) {
            return { value: (bits / 1000).toFixed(2), unit: 'Kbps' };
        } else if (bits < 1000000000) {
            return { value: (bits / 1000000).toFixed(2), unit: 'Mbps' };
        } else {
            return { value: (bits / 1000000000).toFixed(2), unit: 'Gbps' };
        }
    }

    /**
     * Busca os dados de tráfego do backend e atualiza a UI.
     */
    async function fetchTrafficData() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/traffic`);
            if (!response.ok) {
                throw new Error(`Erro de rede: ${response.statusText}`);
            }
            const data = await response.json();

            if (data.error) {
                throw new Error(data.message || 'Erro retornado pela API');
            }
            
            if (data.message.includes("Primeira coleta")) {
                statusTextElem.textContent = "Aguardando 2ª leitura...";
                return;
            }

            updateUI(data);

        } catch (error) {
            console.error("Falha ao buscar dados de tráfego:", error);
            setStatus('Erro', 'red');
            stopMonitoring();
        }
    }
    
    /**
     * Busca as informações da interface e do host
     */
     async function fetchInterfaceInfo() {
        try {
            const nameRes = await fetch(`${API_BASE_URL}/api/interface-name`);
            const nameData = await nameRes.json();
            interfaceNameElem.textContent = `Interface: ${nameData.name || 'Desconhecida'}`;
            
            const configRes = await fetch(`${API_BASE_URL}/`);
            const configText = await configRes.text();
            const ipMatch = configText.match(/IP=([\d.]+)/);
            if (ipMatch && ipMatch[1]) {
                 hostnameElem.textContent = `IP/Hostname: ${ipMatch[1]}`;
            }

        } catch (error) {
            console.error("Falha ao buscar informações da interface:", error);
            interfaceNameElem.textContent = "Interface: Erro";
            hostnameElem.textContent = "IP/Hostname: Erro";
        }
     }


    /**
     * Atualiza todos os elementos da interface com os novos dados.
     * @param {{inBitsPerSecond: number, outBitsPerSecond: number}} data - Os dados de tráfego.
     */
    function updateUI(data) {
        const rxFormatted = formatBitrate(data.inBitsPerSecond);
        const txFormatted = formatBitrate(data.outBitsPerSecond);

        rxValueElem.textContent = rxFormatted.value;
        rxUnitElem.textContent = rxFormatted.unit;
        txValueElem.textContent = txFormatted.value;
        txUnitElem.textContent = txFormatted.unit;
        
        setStatus('Conectado', '#4caf50');
        lastUpdateTimeElem.textContent = new Date().toLocaleTimeString();

        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        // Converte os dados para Kbps para o gráfico
        addDataToChart(timestamp, data.inBitsPerSecond / 1000, data.outBitsPerSecond / 1000);
    }

    /**
     * Adiciona um novo ponto de dado ao gráfico e remove o mais antigo se exceder o limite.
     * @param {string} label - O rótulo para o eixo X (ex: timestamp).
     * @param {number} rxData - O dado de download (Rx).
     * @param {number} txData - O dado de upload (Tx).
     */
    function addDataToChart(label, rxData, txData) {
        chart.data.labels.push(label);
        chart.data.datasets[0].data.push(rxData); // Rx
        chart.data.datasets[1].data.push(txData); // Tx

        if (chart.data.labels.length > MAX_DATA_POINTS) {
            chart.data.labels.shift();
            chart.data.datasets.forEach((dataset) => {
                dataset.data.shift();
            });
        }
        chart.update();
    }
    
    function setStatus(text, color) {
        statusTextElem.textContent = text;
        statusTextElem.style.color = color;
    }

    /**
     * Inicializa o gráfico usando Chart.js.
     */
    function initializeChart() {
        const ctx = document.getElementById('trafficChart').getContext('2d');
        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    // Label para Kbps
                    label: 'Upload (Tx) - Kbps',
                    data: [],
                    borderColor: 'rgba(33, 150, 243, 1)',
                    backgroundColor: 'rgba(33, 150, 243, 0.2)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2
                }, {
                    // Label para Kbps
                    label: 'Download (Rx) - Kbps',
                    data: [],
                    borderColor: 'rgba(76, 175, 80, 1)',
                    backgroundColor: 'rgba(76, 175, 80, 0.2)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2

                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                // Melhora da interação do tooltip (caixa de informações)
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            // Título do eixo para Kbps
                            text: 'Kbps'
                        },
                         ticks: { color: 'white' },
                         grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    x: {
                        ticks: { color: 'white' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: 'white' }
                    }
                }
            }
        });
    }

    function startMonitoring() {
        if (trafficInterval) clearInterval(trafficInterval);
        fetchTrafficData(); 
        trafficInterval = setInterval(fetchTrafficData, POLLING_INTERVAL);
    }

    function stopMonitoring() {
        clearInterval(trafficInterval);
    }

    function togglePause() {
        isPaused = !isPaused;
        if (isPaused) {
            stopMonitoring();
            toggleButton.textContent = 'Retomar';
            setStatus('Pausado', 'orange');
        } else {
            startMonitoring();
            toggleButton.textContent = 'Pausar';
            setStatus('Conectado', '#4caf50');
        }
    }

    // --- Inicialização ---
    initializeChart();
    fetchInterfaceInfo();
    startMonitoring();
    toggleButton.addEventListener('click', togglePause);
});