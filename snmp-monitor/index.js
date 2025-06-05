// ADICIONE ESTAS LINHAS NO TOPO ABSOLUTO DO SEU ARQUIVO DE SERVIDOR (se ainda não estiver lá)
console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
console.log("!!!! EXECUTANDO ESTE ARQUIVO AGORA: [NOME DO SEU ARQUIVO AQUI] !!!!"); // <<< SUBSTITUA AQUI
console.log("!!!! TESTE DEFINITIVO - VERSÃO COM LOGS DETALHADOS E AJUSTE NO CATCH !!!!");
console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
// FIM DAS LINHAS DE TESTE NO TOPO

const express = require('express');
const snmp = require('net-snmp');
const cors = require('cors');

const app = express();
const port = 3002;

app.use(cors());
app.use(express.json());

console.log("Iniciando servidor (após logs de verificação de arquivo)...");

// --- Configuração ---
const MIKROTIK_IP = process.env.MIKROTIK_IP || '192.168.56.101';
const SNMP_COMMUNITY = process.env.SNMP_COMMUNITY || 'public';
const INTERFACE_INDEX = process.env.INTERFACE_INDEX || '1';

// --- OIDs ---
const IF_HC_IN_OCTETS_OID = `1.3.6.1.2.1.31.1.1.1.6.${INTERFACE_INDEX}`;
const IF_HC_OUT_OCTETS_OID = `1.3.6.1.2.1.31.1.1.1.10.${INTERFACE_INDEX}`;
const OIDS_TO_FETCH = [IF_HC_IN_OCTETS_OID, IF_HC_OUT_OCTETS_OID];

// --- Estado ---
let previousStats = {
    inOctets: BigInt(0),
    outOctets: BigInt(0),
    timestamp: 0,
    firstPollDone: false
};

const MAX_COUNTER64_VALUE = BigInt("18446744073709551615");

function stringifyBigInts(key, value) {
    return typeof value === 'bigint' ? value.toString() + 'n' : value;
}

async function fetchSnmpDataFromDevice() {
    console.log("==> [LOG INTERNO] Executando fetchSnmpDataFromDevice...");
    return new Promise((resolve, reject) => {
        const options = { /* ... suas opções SNMP ... */
            port: 161, retries: 1, timeout: 5000, transport: "udp4",
            trapPort: 162, version: snmp.Version2c, idBitsSize: 32
        };
        const session = snmp.createSession(MIKROTIK_IP, SNMP_COMMUNITY, options);

        session.get(OIDS_TO_FETCH, (error, varbinds) => {
            if (error) {
                console.error("==> [LOG INTERNO SNMP Error] Erro em session.get:", error.toString());
                session.close();
                reject(error);
            } else {
                let inOctetsResult = BigInt(0);
                let outOctetsResult = BigInt(0);
                let foundIn = false;
                let foundOut = false;

                for (const varbind of varbinds) {
                    if (snmp.isVarbindError(varbind)) {
                        console.error("==> [LOG INTERNO SNMP Varbind Error]:", snmp.varbindError(varbind));
                    } else {
                        let val = BigInt(0); // Inicializa val
                        try {
                            if (typeof varbind.value === 'number') {
                                val = BigInt(Math.round(varbind.value));
                            } else if (typeof varbind.value === 'string' && /^\d+$/.test(varbind.value)) {
                                val = BigInt(varbind.value);
                            } else if (Buffer.isBuffer(varbind.value) && varbind.value.length > 0 && varbind.value.length <= 8) {
                                if (varbind.value.length <= 6) {
                                    val = BigInt(varbind.value.readUIntBE(0, varbind.value.length));
                                } else {
                                   val = varbind.value.readBigUInt64BE(0);
                                }
                            } else {
                                console.warn(`==> [LOG INTERNO WARN] Valor inesperado para OID ${varbind.oid}: ${varbind.value} (tipo: ${typeof varbind.value}), usando 0n.`);
                            }
                        } catch (conversionError) {
                            console.error(`==> [LOG INTERNO ERROR] Erro ao converter valor para BigInt para OID ${varbind.oid}: ${varbind.value}`, conversionError);
                            val = BigInt(0); // Fallback em caso de erro de conversão
                        }


                        if (varbind.oid === IF_HC_IN_OCTETS_OID) {
                            inOctetsResult = val;
                            foundIn = true;
                        } else if (varbind.oid === IF_HC_OUT_OCTETS_OID) {
                            outOctetsResult = val;
                            foundOut = true;
                        }
                    }
                }

                if (!foundIn || !foundOut) {
                    session.close();
                    const errorMessage = `==> [LOG INTERNO ERROR] Falha ao obter todos os OIDs necessários. IP (${MIKROTIK_IP}), comunidade (${SNMP_COMMUNITY}), índice (${INTERFACE_INDEX}). OIDs: ${OIDS_TO_FETCH.join(', ')}.`;
                    console.error(errorMessage);
                    reject(new Error(errorMessage));
                    return;
                }
                
                session.close();
                console.log("==> [LOG INTERNO] Dados SNMP coletados com sucesso:", JSON.stringify({ inOctets: inOctetsResult, outOctets: outOctetsResult }, stringifyBigInts));
                resolve({
                    inOctets: inOctetsResult,
                    outOctets: outOctetsResult,
                    timestamp: Date.now()
                });
            }
        });
    });
}

app.get('/api/traffic', async (req, res) => {
    console.log("%%%%%% ROTA /api/traffic FOI ACIONADA! %%%%%%");
    console.log("-----------------------------------------");
    console.log(`[API /traffic] Nova requisição às: ${new Date().toLocaleTimeString()}`);
    console.log("[API /traffic] PreviousStats ANTES da coleta:", JSON.stringify(previousStats, stringifyBigInts));

    try {
        const currentData = await fetchSnmpDataFromDevice();
        console.log("[API /traffic] CurrentData APÓS a coleta:", JSON.stringify(currentData, stringifyBigInts));

        let rates = {
            inBitsPerSecond: 0,
            outBitsPerSecond: 0,
            inBytesPerSecond: 0,
            outBytesPerSecond: 0,
            error: null,
            message: ""
        };

        if (previousStats.firstPollDone && previousStats.timestamp > 0) {
            const timeDeltaSeconds = (currentData.timestamp - previousStats.timestamp) / 1000.0;
            console.log(`[API /traffic] TimeDeltaSeconds: ${timeDeltaSeconds}`);

            if (timeDeltaSeconds <= 0) {
                rates.message = "Intervalo de tempo inválido ou muito curto. Coleta ignorada para cálculo de taxa.";
                console.warn("[API /traffic WARN] Intervalo de tempo inválido ou muito curto:", timeDeltaSeconds);
                // Não calculamos taxas, mas previousStats será atualizado com currentData
                // para que a próxima medição tenha uma base de tempo válida, assumindo que currentData é válido.
            } else {
                let deltaInOctets = currentData.inOctets - previousStats.inOctets;
                if (deltaInOctets < 0) {
                    console.log(`[API /traffic] Wrap no contador de ENTRADA: current=${currentData.inOctets.toString()}n, previous=${previousStats.inOctets.toString()}n`);
                    deltaInOctets = (MAX_COUNTER64_VALUE - previousStats.inOctets) + currentData.inOctets;
                }

                let deltaOutOctets = currentData.outOctets - previousStats.outOctets;
                if (deltaOutOctets < 0) {
                    console.log(`[API /traffic] Wrap no contador de SAÍDA: current=${currentData.outOctets.toString()}n, previous=${previousStats.outOctets.toString()}n`);
                    deltaOutOctets = (MAX_COUNTER64_VALUE - previousStats.outOctets) + currentData.outOctets;
                }
                
                console.log(`[API /traffic] DeltaInOctets: ${deltaInOctets.toString()}n, DeltaOutOctets: ${deltaOutOctets.toString()}n`);

                rates.inBytesPerSecond = Number(deltaInOctets) / timeDeltaSeconds;
                rates.outBytesPerSecond = Number(deltaOutOctets) / timeDeltaSeconds;
                
                rates.inBitsPerSecond = rates.inBytesPerSecond * 8;
                rates.outBitsPerSecond = rates.outBytesPerSecond * 8;

                rates.inBytesPerSecond = Math.round(rates.inBytesPerSecond);
                rates.outBytesPerSecond = Math.round(rates.outBytesPerSecond);
                rates.inBitsPerSecond = Math.round(rates.inBitsPerSecond);
                rates.outBitsPerSecond = Math.round(rates.outBitsPerSecond);
                console.log("[API /traffic] Taxas calculadas (Bytes/s): In=", rates.inBytesPerSecond, "Out=", rates.outBytesPerSecond);
                console.log("[API /traffic] Taxas calculadas (Bits/s): In=", rates.inBitsPerSecond, "Out=", rates.outBitsPerSecond);
            }
        } else {
            rates.message = "Primeira coleta de dados bem-sucedida. As taxas serão calculadas na próxima requisição.";
            // previousStats.firstPollDone será setado para true abaixo, após currentData ser validado.
            console.log("[API /traffic] É a primeira coleta de dados (ou previousStats foi resetado).");
        }

        // Atualiza previousStats somente se a coleta atual (currentData) foi bem-sucedida.
        previousStats.inOctets = currentData.inOctets;
        previousStats.outOctets = currentData.outOctets;
        previousStats.timestamp = currentData.timestamp;
        previousStats.firstPollDone = true; // Confirma que tivemos pelo menos uma coleta bem-sucedida como base.
        console.log("[API /traffic] PreviousStats ATUALIZADO:", JSON.stringify(previousStats, stringifyBigInts));
        
        res.json(rates);

    } catch (error) {
        console.error("[API /traffic ERRO NO BLOCO TRY PRINCIPAL]:", error.message);
        console.error("[API /traffic ERRO STACK]:", error.stack);

        // *** MUDANÇA IMPORTANTE AQUI ***
        // Se houve um erro ao buscar dados SNMP, resetamos o timestamp e o firstPollDone
        // para que a próxima coleta bem-sucedida não use um previousStats "velho".
        previousStats.timestamp = 0;
        previousStats.firstPollDone = false; 
        console.warn("[API /traffic WARN] Devido ao erro, previousStats foi resetado para forçar nova coleta base.");

        res.status(500).json({
            inBitsPerSecond: 0,
            outBitsPerSecond: 0,
            inBytesPerSecond: 0,
            outBytesPerSecond: 0,
            error: error.message || "Erro desconhecido ao buscar dados SNMP.",
            message: "Falha ao obter dados do dispositivo. Tentando restabelecer na próxima coleta."
        });
    }
});

app.get('/', (req, res) => { /* ... rota raiz ... */
    res.send(`Servidor de monitoramento SNMP MikroTik está rodando! Acesse /api/traffic para os dados.<br>
             Configurado para: IP=${MIKROTIK_IP}, Comunidade=${SNMP_COMMUNITY}, Índice Interface=${INTERFACE_INDEX}`);
});

app.listen(port, () => { /* ... logs de inicialização ... */
    console.log(`Servidor backend rodando em http://localhost:${port}`);
    console.log(`Tentando conectar ao MikroTik em: ${MIKROTIK_IP}`);
    console.log(`Usando comunidade SNMP: ${SNMP_COMMUNITY} e índice de interface: ${INTERFACE_INDEX}`);
    console.warn("IMPORTANTE: A biblioteca 'net-snmp' para Node.js converte contadores SNMP Counter64 para o tipo 'Number' do JavaScript.");
    console.warn("Isso pode causar PERDA DE PRECISÃO se os valores do contador excederem Number.MAX_SAFE_INTEGER (aproximadamente 9x10^15 ou 2^53-1).");
    console.warn("Para interfaces de altíssima velocidade ou contadores que acumulam valores muito grandes, as taxas calculadas podem não ser 100% precisas devido a essa limitação.");
    console.warn("Considere usar uma biblioteca SNMP com suporte nativo a BigInt para Counter64 ou verificar o comportamento com seus dados específicos para produção crítica.");
});