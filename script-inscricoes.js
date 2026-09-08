// ==========================================
// CONFIGURAÇÕES E GIDS DAS ABAS DO GOOGLE SHEETS
// ==========================================
const SHEET_ID = '10Lts1kA9GD1bjSlR1HoLi3mIJBBCXc58tf-jCgOq-lc';
const GID_CAPTACAO_POLO = '680288164';
const GID_CAPTACAO_CONSOLIDADO = '298804678';
const GID_CONSOLIDADO_PAGAMENTOS = '778246193'; // aba CONSOLIDADO (Pagamentos) — só usada p/ ler a data/hora de atualização, comum à planilha inteira

// ==========================================
// FUNÇÕES UTILITÁRIAS
// ==========================================
function parseBRNumber(value) {
    if (!value) return 0;
    const cleanVal = value.toString().trim()
        .replace(/\./g, '')
        .replace('%', '')
        .replace(',', '.');
    const parsed = parseFloat(cleanVal);
    return isNaN(parsed) ? 0 : parsed;
}

function formatBRInteger(num) {
    return Math.round(num).toLocaleString('pt-BR');
}

function formatBRPct(num) {
    return (num * 100).toFixed(2).replace('.', ',') + '%';
}

function getPctColorClass(pctValue) {
    if (pctValue >= 100) return 'pct-ok';
    if (pctValue >= 80) return 'pct-warn';
    return 'pct-danger';
}

// Parser CSV simples com suporte a aspas
function parseCSV(text) {
    const lines = text.split(/\r\n|\n/);
    return lines.map(line => {
        const regex = /(?:\"([^\"]*(?:\"\"[^\"]*)*)\")|([^,]+)/g;
        const row = [];
        let match;
        while ((match = regex.exec(line)) !== null) {
            const val = match[1] ? match[1].replace(/\"\"/g, '"') : match[2];
            row.push(val ? val.trim() : '');
        }
        return row;
    }).filter(row => row.length > 1);
}

// ==========================================
// CARREGAMENTO DOS DADOS (GOOGLE SHEETS)
// ==========================================
async function fetchSheetData(gid) {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
    try {
        const response = await fetch(url);
        return parseCSV(await response.text());
    } catch (error) {
        console.error('Erro ao carregar aba com GID ' + gid, error);
        return [];
    }
}

// ==========================================
// PROCESSAMENTO E RENDERIZAÇÃO DOS KPIs
// ==========================================
// Mapeamento de colunas — aba CAPTAÇÃO POLO:
// 0: COD_POLO | 1: POLO | 2: ESTADO | 3: REGIÃO | 4: PARCEIRO | 5: CARTEIRA | 6: ANALISTA
// 7: INSCRITO | 8: MATRICULADO | 9: META MOVEL INSCRIÇÃO | 10: % META MOVEL INSC
// 11: META MOVEL MATRICULADO | 12: % META MOVEL MATR | 13: META EDITAL INSC
// 14: % META EDITAL INSC | 15: META EDITAL MATR | 16: % META EDITAL MATR

function processAndRenderTopKPIs(consolidadoData) {
    // Busca a linha do total geral
    const totalRow = consolidadoData.find(row =>
        row[0] && row[0].toString().toUpperCase().includes('GERAL')
    );
    if (!totalRow) return console.warn('Linha GERAL não encontrada.');

    const inscritos = parseBRNumber(totalRow[1]);
    const metaMovelInsc = parseBRNumber(totalRow[2]);
    const pctMovelInsc = parseBRNumber(totalRow[3]) / 100;
    const metaEditalInsc = parseBRNumber(totalRow[4]);
    const pctEditalInsc = parseBRNumber(totalRow[5]) / 100;

    const matriculados = parseBRNumber(totalRow[6]);
    const metaMovelMatr = parseBRNumber(totalRow[7]);
    const pctMovelMatr = parseBRNumber(totalRow[8]) / 100;
    const metaEditalMatr = parseBRNumber(totalRow[9]);
    const pctEditalMatr = parseBRNumber(totalRow[10]) / 100;

    // Inscrições
    document.getElementById('val-inscritos-total').innerText = formatBRInteger(inscritos);
    document.getElementById('val-insc-movel-esperado').innerText = formatBRInteger(metaMovelInsc);
    document.getElementById('val-insc-edital-alvo').innerText = formatBRInteger(metaEditalInsc);

    const elPctMovelInsc = document.getElementById('val-insc-movel-pct');
    elPctMovelInsc.innerText = formatBRPct(pctMovelInsc);
    elPctMovelInsc.className = 'val ' + getPctColorClass(pctMovelInsc * 100);

    const elPctEditalInsc = document.getElementById('val-insc-edital-pct');
    elPctEditalInsc.innerText = formatBRPct(pctEditalInsc);
    elPctEditalInsc.className = 'val ' + getPctColorClass(pctEditalInsc * 100);

    // Matrículas
    document.getElementById('val-matriculas-total').innerText = formatBRInteger(matriculados);
    document.getElementById('val-matr-movel-esperado').innerText = formatBRInteger(metaMovelMatr);
    document.getElementById('val-matr-edital-alvo').innerText = formatBRInteger(metaEditalMatr);

    const elPctMovelMatr = document.getElementById('val-matr-movel-pct');
    elPctMovelMatr.innerText = formatBRPct(pctMovelMatr);
    elPctMovelMatr.className = 'val ' + getPctColorClass(pctMovelMatr * 100);

    const elPctEditalMatr = document.getElementById('val-matr-edital-pct');
    elPctEditalMatr.innerText = formatBRPct(pctEditalMatr);
    elPctEditalMatr.className = 'val ' + getPctColorClass(pctEditalMatr * 100);
}

// ==========================================
// CARTEIRAS & GERÊNCIAS
// ==========================================
const CARTEIRAS = [
    { key: 'florenca', match: 'Florença' },
    { key: 'genova', match: 'Gênova' },
    { key: 'milao', match: 'Milão' },
    { key: 'roma', match: 'Roma' },
];

const GERENCIAS = [
    { key: 'diretoria', match: 'Diretoria OP' },
    { key: 'op1', match: 'Operações I -' },
    { key: 'op2', match: 'Operações II -' },
];

const NOMES_CURTOS_GRUPO = {
    florenca: 'Florença',
    genova: 'Gênova',
    milao: 'Milão',
    roma: 'Roma',
    diretoria: 'Diretoria OP',
    op1: 'Operações I',
    op2: 'Operações II',
};

function buildCGCard(row, nomeExibido, carteiraExport = null) {
    const inscritos = formatBRInteger(parseBRNumber(row[1]));
    const metaMovelInsc = formatBRInteger(parseBRNumber(row[2]));
    const pctMovelInsc = parseBRNumber(row[3]);
    const metaEditalInsc = formatBRInteger(parseBRNumber(row[4]));
    const pctEditalInsc = parseBRNumber(row[5]);

    const matriculados = formatBRInteger(parseBRNumber(row[6]));
    const metaMovelMatr = formatBRInteger(parseBRNumber(row[7]));
    const pctMovelMatr = parseBRNumber(row[8]);
    const metaEditalMatr = formatBRInteger(parseBRNumber(row[9]));
    const pctEditalMatr = parseBRNumber(row[10]);

    const colorInscMovel = getPctColorClass(pctMovelInsc);
    const colorInscEdital = getPctColorClass(pctEditalInsc);
    const colorMatrMovel = getPctColorClass(pctMovelMatr);
    const colorMatrEdital = getPctColorClass(pctEditalMatr);

    const fmtPct = v => v.toFixed(2).replace('.', ',') + '%';

    return `
    <div class="cg-card">
      <div class="cg-card-title">
        ${nomeExibido}
        ${carteiraExport ? `<button class="cg-export-btn" onclick="exportCarteiraPolo('${carteiraExport}')" title="Exportar polos desta carteira">⬇</button>` : ''}
      </div>

      <div class="cg-linha">
        <span class="cg-linha-label">Inscrição</span>
        <div class="cg-vsep"></div>
        <div class="cg-volume">
          <span class="val">${inscritos}</span>
          <span class="lbl">Inscritos</span>
        </div>
        <div class="cg-vsep"></div>
        <div class="cg-metas">
          <div class="cg-meta-grupo">
            <div class="cg-meta-titulo">Meta Móvel</div>
            <div class="cg-meta-inner">
              <div class="cg-stat"><span class="val">${metaMovelInsc}</span><span class="lbl">Esperado</span></div>
              <div class="cg-stat"><span class="val ${colorInscMovel}">${fmtPct(pctMovelInsc)}</span><span class="lbl">Atingido</span></div>
            </div>
          </div>
          <div class="cg-meta-grupo">
            <div class="cg-meta-titulo">Meta Edital</div>
            <div class="cg-meta-inner">
              <div class="cg-stat"><span class="val">${metaEditalInsc}</span><span class="lbl">Alvo</span></div>
              <div class="cg-stat"><span class="val ${colorInscEdital}">${fmtPct(pctEditalInsc)}</span><span class="lbl">Progresso</span></div>
            </div>
          </div>
        </div>
      </div>

      <div class="cg-linha">
        <span class="cg-linha-label">Matrícula</span>
        <div class="cg-vsep"></div>
        <div class="cg-volume">
          <span class="val">${matriculados}</span>
          <span class="lbl">Matriculados</span>
        </div>
        <div class="cg-vsep"></div>
        <div class="cg-metas">
          <div class="cg-meta-grupo">
            <div class="cg-meta-titulo">Meta Móvel</div>
            <div class="cg-meta-inner">
              <div class="cg-stat"><span class="val">${metaMovelMatr}</span><span class="lbl">Esperado</span></div>
              <div class="cg-stat"><span class="val ${colorMatrMovel}">${fmtPct(pctMovelMatr)}</span><span class="lbl">Atingido</span></div>
            </div>
          </div>
          <div class="cg-meta-grupo">
            <div class="cg-meta-titulo">Meta Edital</div>
            <div class="cg-meta-inner">
              <div class="cg-stat"><span class="val">${metaEditalMatr}</span><span class="lbl">Alvo</span></div>
              <div class="cg-stat"><span class="val ${colorMatrEdital}">${fmtPct(pctEditalMatr)}</span><span class="lbl">Progresso</span></div>
            </div>
          </div>
        </div>
      </div>

    </div>`;
}

function exportCarteiraPolo(nomeCarteira) {
    if (!polosDetalheData || polosDetalheData.length === 0) return;

    const alvo = normalizeStr(nomeCarteira);
    const itens = polosDetalheData.filter(item => normalizeStr(item.carteira) === alvo)
    if (itens.length === 0) return;

    const header = [
        'Cód. Polo', 'Polo', 'Estado', 'Região', 'Parceiro', 'Carteira', 'Analista',
        'Inscritos', 'Matriculados',
        'Meta Móvel Inscrição', '% Meta Móvel Insc',
        'Meta Móvel Matriculado', '% Meta Móvel Matr',
        'Meta Edital Inscrição', '% Meta Edital Insc',
        'Meta Edital Matriculado', '% Meta Edital Matr'
    ];

    const linhas = itens.map(item => [
        item.codPolo, item.polo, item.estado, item.regiao, item.parceiro, item.carteira, item.analista,
        item.inscritos, item.matriculados,
        item.metaMovelInsc, formatBRPctDirect(item.pctMovelInsc),
        item.metaMovelMatr, formatBRPctDirect(item.pctMovelMatr),
        item.metaEditalInsc, formatBRPctDirect(item.pctEditalInsc),
        item.metaEditalMatr, formatBRPctDirect(item.pctEditalMatr)
    ]);

    const csv = [header, ...linhas]
        .map(cols => cols.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'))
        .join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `polos_${nomeCarteira.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function processAndRenderCarteiras(consolidadoData) {

    let htmlCarteiras = '';
    let htmlGerencias = '';

    for (const row of consolidadoData) {
        const col0 = row[0] ? row[0].toString() : '';

        for (const c of CARTEIRAS) {
            if (col0.includes(c.match)) {
                htmlCarteiras += buildCGCard(row, NOMES_CURTOS_GRUPO[c.key], NOMES_CURTOS_GRUPO[c.key]);
            }
        }
        for (const g of GERENCIAS) {
            if (col0.includes(g.match)) {
                htmlGerencias += buildCGCard(row, NOMES_CURTOS_GRUPO[g.key], NOMES_CURTOS_GRUPO[g.key]);
            }
        }
    }

    document.getElementById('grid-carteiras').innerHTML = htmlCarteiras;
    document.getElementById('grid-gerencias').innerHTML = htmlGerencias;
}

// ==========================================
// TOTALIZADORES POR REGIÃO (aba CAPTAÇÃO POLO)
// ==========================================
const ORDEM_REGIOES = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'];

let regiaoPolosData = [];
let regiaoCarteirasSelecionadas = new Set();
let insightsCarteirasSelecionadas = new Set();
let insightsPolosData = [];
let estadosPolosData = [];
let estadosCarteirasSelecionadas = new Set();
let estadosTableData = [];


function renderRegioesFiltradas() {
    const filtroAtivo = regiaoCarteirasSelecionadas.size > 0;
    const REGIOES_INVALIDAS = ['REGIÃO', '#N/D', '#N/A', ''];
    const pctOrZero = (num, den) => (den > 0 ? (num / den) * 100 : 0);
    const toBR = (num) => num.toFixed(2).replace('.', ',');

    const regioesMap = {};
    for (const row of regiaoPolosData) {
        const regiao = (row[3] || '').toString().trim();
        if (REGIOES_INVALIDAS.includes(regiao.toUpperCase())) continue;
        if (!isLinhaPoloValida(row)) continue;
        if (filtroAtivo && !regiaoCarteirasSelecionadas.has(extractCarteiraLimpa(row))) continue;

        if (!regioesMap[regiao]) {
            regioesMap[regiao] = { inscritos: 0, matriculados: 0, metaMovelInsc: 0, metaMovelMatr: 0, metaEditalInsc: 0, metaEditalMatr: 0 };
        }
        const r = regioesMap[regiao];
        r.inscritos += parseBRNumber(row[7]);
        r.matriculados += parseBRNumber(row[8]);
        r.metaMovelInsc += parseBRNumber(row[9]);
        r.metaMovelMatr += parseBRNumber(row[11]);
        r.metaEditalInsc += parseBRNumber(row[13]);
        r.metaEditalMatr += parseBRNumber(row[15]);
    }

    const regioesOrdenadas = Object.keys(regioesMap).sort((a, b) => {
        const ia = ORDEM_REGIOES.indexOf(a), ib = ORDEM_REGIOES.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1; if (ib === -1) return -1;
        return ia - ib;
    });

    let html = '';
    for (const regiao of regioesOrdenadas) {
        const r = regioesMap[regiao];
        if (r.inscritos === 0 && r.matriculados === 0) continue;

        const syntheticRow = [
            null,
            r.inscritos,
            r.metaMovelInsc, toBR(pctOrZero(r.inscritos, r.metaMovelInsc)),
            r.metaEditalInsc, toBR(pctOrZero(r.inscritos, r.metaEditalInsc)),
            r.matriculados,
            r.metaMovelMatr, toBR(pctOrZero(r.matriculados, r.metaMovelMatr)),
            r.metaEditalMatr, toBR(pctOrZero(r.matriculados, r.metaEditalMatr)),
        ];
        html += buildCGCard(syntheticRow, regiao);
    }

    document.getElementById('grid-regioes').innerHTML = html || '<p style="color:var(--muted)">Nenhuma região com dados para a seleção.</p>';
}

function processAndRenderRegioes(polosData) {
    regiaoPolosData = polosData;

    const carteiras = [...new Set(
        polosData
            .filter(row => isLinhaPoloValida(row))
            .map(row => extractCarteiraLimpa(row))
    )].sort((a, b) => a.localeCompare(b));

    const optionsWrapper = document.getElementById('regiao-carteira-options');
    const carteiraLabel = document.getElementById('regiaoCarteiraLabel');
    const dropdown = document.getElementById('regiaoCarteiraDropdown');
    const btn = document.getElementById('regiaoCarteiraBtn');

    function updateLabel() {
        carteiraLabel.textContent =
            regiaoCarteirasSelecionadas.size === 0 || regiaoCarteirasSelecionadas.size === carteiras.length
                ? 'Todas as carteiras'
                : `${regiaoCarteirasSelecionadas.size} carteira(s) selecionada(s)`;
    }

    function buildOptions() {
        optionsWrapper.innerHTML = carteiras.map(c => `
            <label class="uf-chip">
                <input type="checkbox" value="${c}" ${regiaoCarteirasSelecionadas.has(c) ? 'checked' : ''}>
                <span>${c}</span>
            </label>`).join('');

        optionsWrapper.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                if (cb.checked) regiaoCarteirasSelecionadas.add(cb.value);
                else regiaoCarteirasSelecionadas.delete(cb.value);
                updateLabel();
                renderRegioesFiltradas();
            });
        });
    }

    buildOptions();

    document.getElementById('regiaoCarteiraSelectAll').addEventListener('click', () => {
        carteiras.forEach(c => regiaoCarteirasSelecionadas.add(c));
        buildOptions(); updateLabel(); renderRegioesFiltradas();
    });
    document.getElementById('regiaoCarteiraClearAll').addEventListener('click', () => {
        regiaoCarteirasSelecionadas.clear();
        buildOptions(); updateLabel(); renderRegioesFiltradas();
    });

    btn.addEventListener('click', e => { e.stopPropagation(); dropdown.classList.toggle('open'); });
    document.addEventListener('click', () => dropdown.classList.remove('open'));

    renderRegioesFiltradas();
}

function renderRegioesFiltradas() {
    const filtroAtivo = regiaoCarteirasSelecionadas.size > 0;
    const REGIOES_INVALIDAS = ['REGIÃO', '#N/D', '#N/A', ''];
    const pctOrZero = (num, den) => (den > 0 ? (num / den) * 100 : 0);
    const toBR = (num) => num.toFixed(2).replace('.', ',');

    const regioesMap = {};
    for (const row of regiaoPolosData) {
        const regiao = (row[3] || '').toString().trim();
        if (REGIOES_INVALIDAS.includes(regiao.toUpperCase())) continue;
        if (!isLinhaPoloValida(row)) continue;

        // aplica filtro de carteira
        if (filtroAtivo && !regiaoCarteirasSelecionadas.has(extractCarteiraLimpa(row))) continue;

        if (!regioesMap[regiao]) {
            regioesMap[regiao] = { inscritos: 0, matriculados: 0, metaMovelInsc: 0, metaMovelMatr: 0, metaEditalInsc: 0, metaEditalMatr: 0 };
        }
        const r = regioesMap[regiao];
        r.inscritos += parseBRNumber(row[7]);
        r.matriculados += parseBRNumber(row[8]);
        r.metaMovelInsc += parseBRNumber(row[9]);
        r.metaMovelMatr += parseBRNumber(row[11]);
        r.metaEditalInsc += parseBRNumber(row[13]);
        r.metaEditalMatr += parseBRNumber(row[15]);
    }

    const regioesOrdenadas = Object.keys(regioesMap).sort((a, b) => {
        const ia = ORDEM_REGIOES.indexOf(a), ib = ORDEM_REGIOES.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1; if (ib === -1) return -1;
        return ia - ib;
    });

    let html = '';
    for (const regiao of regioesOrdenadas) {
        const r = regioesMap[regiao];

        // oculta cards zerados
        if (r.inscritos === 0 && r.matriculados === 0) continue;

        const syntheticRow = [
            null,
            r.inscritos,
            r.metaMovelInsc, toBR(pctOrZero(r.inscritos, r.metaMovelInsc)),
            r.metaEditalInsc, toBR(pctOrZero(r.inscritos, r.metaEditalInsc)),
            r.matriculados,
            r.metaMovelMatr, toBR(pctOrZero(r.matriculados, r.metaMovelMatr)),
            r.metaEditalMatr, toBR(pctOrZero(r.matriculados, r.metaEditalMatr)),
        ];
        html += buildCGCard(syntheticRow, regiao);
    }

    document.getElementById('grid-regioes').innerHTML = html || '<p style="color:var(--muted)">Nenhuma região com dados para a seleção.</p>';
}

// ==========================================
// TOTALIZADORES POR ESTADO (aba CAPTAÇÃO POLO)
// ==========================================
function renderEstadosFiltrados() {
    const filtroAtivo = estadosCarteirasSelecionadas.size > 0;
    const estadosMap = {};
    const REGIOES_INVALIDAS = ['REGIÃO', 'ESTADO', 'UF', '#N/D', '#N/A', ''];

    for (const row of estadosPolosData) {
        const estado = (row[2] || '').toString().trim().toUpperCase();
        if (REGIOES_INVALIDAS.includes(estado)) continue;
        if (filtroAtivo && !estadosCarteirasSelecionadas.has(extractCarteiraLimpa(row))) continue;

        if (!estadosMap[estado]) {
            estadosMap[estado] = {
                inscritos: 0, matriculados: 0,
                metaMovelInsc: 0, metaMovelMatr: 0,
                metaEditalInsc: 0, metaEditalMatr: 0,
            };
        }
        const e = estadosMap[estado];
        e.inscritos += parseBRNumber(row[7]);
        e.matriculados += parseBRNumber(row[8]);
        e.metaMovelInsc += parseBRNumber(row[9]);
        e.metaMovelMatr += parseBRNumber(row[11]);
        e.metaEditalInsc += parseBRNumber(row[13]);
        e.metaEditalMatr += parseBRNumber(row[15]);
    }

    const pctOrZero = (num, den) => (den > 0 ? (num / den) * 100 : 0);
    const toBR = (num) => num.toFixed(2).replace('.', ',');

    const estadosOrdenados = Object.keys(estadosMap).sort((a, b) => a.localeCompare(b));

    estadosTableData = [];
    let htmlRows = '';
    let htmlChips = '';

    for (const uf of estadosOrdenados) {
        const e = estadosMap[uf];
        if (e.inscritos === 0 && e.matriculados === 0) continue;

        const pctMovelInsc = pctOrZero(e.inscritos, e.metaMovelInsc);
        const pctMovelMatr = pctOrZero(e.matriculados, e.metaMovelMatr);

        const pctEditalInsc = pctOrZero(e.inscritos, e.metaEditalInsc);
        const pctEditalMatr = pctOrZero(e.matriculados, e.metaEditalMatr);

        estadosTableData.push({
            uf, inscritos: e.inscritos, metaMovelInsc: e.metaMovelInsc, pctMovelInsc,
            metaEditalInsc: e.metaEditalInsc, pctEditalInsc,
            matriculados: e.matriculados, metaMovelMatr: e.metaMovelMatr, pctMovelMatr,
            metaEditalMatr: e.metaEditalMatr, pctEditalMatr,
        });

        htmlRows += `
    <tr data-uf="${uf}">
    <td class="polos-nome">${uf}</td>
    <td class="num td-insc-start">${formatBRInteger(e.inscritos)}</td>
    <td class="td-insc">${formatBRInteger(e.metaMovelInsc)}</td>
    <td class="td-insc ${getPctColorClass(pctMovelInsc)}">${formatBRPctDirect(pctMovelInsc)}</td>
    <td class="td-insc">${formatBRInteger(e.metaEditalInsc)}</td>
    <td class="td-insc-end ${getPctColorClass(pctEditalInsc)}">${formatBRPctDirect(pctEditalInsc)}</td>
    <td class="num td-matr-start">${formatBRInteger(e.matriculados)}</td>
    <td class="td-matr">${formatBRInteger(e.metaMovelMatr)}</td>
    <td class="td-matr ${getPctColorClass(pctMovelMatr)}">${formatBRPctDirect(pctMovelMatr)}</td>
    <td class="td-matr">${formatBRInteger(e.metaEditalMatr)}</td>
    <td class="td-matr-end ${getPctColorClass(pctEditalMatr)}">${formatBRPctDirect(pctEditalMatr)}</td>
    </tr>`;

        htmlChips += `
          <label class="uf-chip">
            <input type="checkbox" value="${uf}" class="uf-checkbox">
            <span>${uf}</span>
          </label>`;
    }

    document.getElementById('estados-table-body').innerHTML = htmlRows || '<tr><td colspan="11" class="polos-empty">Nenhum estado com dados para a seleção.</td></tr>';
    document.getElementById('estados-checkboxes').innerHTML = htmlChips;

    document.querySelectorAll('.uf-checkbox').forEach(cb => cb.addEventListener('change', () => {
        updateUfDropdownLabel();
        filterEstados();
    }));

    updateUfDropdownLabel();
    filterEstados();
}

function processAndRenderEstados(polosData) {
    estadosPolosData = polosData;

    const carteiras = [...new Set(
        polosData.filter(row => isLinhaPoloValida(row)).map(row => extractCarteiraLimpa(row))
    )].sort((a, b) => a.localeCompare(b));

    const optionsWrapper = document.getElementById('estados-carteira-options');
    const carteiraLabel = document.getElementById('estadosCarteiraLabel');
    const dropdown = document.getElementById('estadosCarteiraDropdown');
    const btn = document.getElementById('estadosCarteiraBtn');

    function updateLabel() {
        carteiraLabel.textContent =
            estadosCarteirasSelecionadas.size === 0 || estadosCarteirasSelecionadas.size === carteiras.length
                ? 'Todas as carteiras'
                : `${estadosCarteirasSelecionadas.size} carteira(s) selecionada(s)`;
    }

    function buildOptions() {
        optionsWrapper.innerHTML = carteiras.map(c => `
            <label class="uf-chip">
                <input type="checkbox" value="${c}" ${estadosCarteirasSelecionadas.has(c) ? 'checked' : ''}>
                <span>${c}</span>
            </label>`).join('');

        optionsWrapper.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                if (cb.checked) estadosCarteirasSelecionadas.add(cb.value);
                else estadosCarteirasSelecionadas.delete(cb.value);
                updateLabel();
                renderEstadosFiltrados();
            });
        });
    }

    buildOptions();

    document.getElementById('estadosCarteiraSelectAll').addEventListener('click', () => {
        carteiras.forEach(c => estadosCarteirasSelecionadas.add(c));
        buildOptions(); updateLabel(); renderEstadosFiltrados();
    });
    document.getElementById('estadosCarteiraClearAll').addEventListener('click', () => {
        estadosCarteirasSelecionadas.clear();
        buildOptions(); updateLabel(); renderEstadosFiltrados();
    });

    btn.addEventListener('click', e => { e.stopPropagation(); dropdown.classList.toggle('open'); });
    document.addEventListener('click', () => dropdown.classList.remove('open'));

    document.getElementById('estados-search').addEventListener('input', filterEstados);
    document.getElementById('estadosExportBtn').addEventListener('click', () => {
        exportPolosCSV(filterEstados(), 'polos_por_estado');
    });

    renderEstadosFiltrados();
    initUfDropdown();
}

function filterEstados() {
    const termo = (document.getElementById('estados-search').value || '').trim().toUpperCase();
    const marcados = Array.from(document.querySelectorAll('.uf-checkbox:checked')).map(cb => cb.value);
    const visiveis = [];

    document.querySelectorAll('#estados-table-body tr[data-uf]').forEach(item => {
        const uf = item.getAttribute('data-uf');
        const passaTexto = !termo || uf.includes(termo);
        const passaCheckbox = marcados.length === 0 || marcados.includes(uf);
        const visivel = passaTexto && passaCheckbox;
        item.style.display = visivel ? '' : 'none';
        if (visivel) visiveis.push(uf);
    });

    const polosDasUfs = getPolosDosEstadosFiltrados(visiveis);
    document.getElementById('estadosExportCount').innerText = polosDasUfs.length;
    return polosDasUfs;
}

// ==========================================
// DROPDOWN DE UFs (Totalizadores por Estado)
// ==========================================
function updateUfDropdownLabel() {
    const label = document.getElementById('ufDropdownLabel');
    const marcados = document.querySelectorAll('.uf-checkbox:checked');

    if (marcados.length === 0) {
        label.textContent = 'Filtrar por UF';
    } else if (marcados.length === 1) {
        label.textContent = marcados[0].value;
    } else {
        label.textContent = `${marcados.length} UFs selecionadas`;
    }
}

function initUfDropdown() {
    const dropdown = document.getElementById('ufDropdown');
    const btn = document.getElementById('ufDropdownBtn');
    const selectAllBtn = document.getElementById('ufSelectAll');
    const clearAllBtn = document.getElementById('ufClearAll');

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target)) {
            dropdown.classList.remove('open');
        }
    });

    document.getElementById('ufDropdownPanel').addEventListener('click', (e) => e.stopPropagation());

    selectAllBtn.addEventListener('click', () => {
        document.querySelectorAll('.uf-checkbox').forEach(cb => cb.checked = true);
        updateUfDropdownLabel();
        filterEstados();
    });

    clearAllBtn.addEventListener('click', () => {
        document.querySelectorAll('.uf-checkbox').forEach(cb => cb.checked = false);
        updateUfDropdownLabel();
        filterEstados();
    });

    updateUfDropdownLabel();
}

// ==========================================
// INSIGHTS DOS POLOS (aba CAPTAÇÃO POLO)
// ==========================================
const META_EDITAL_INSC_MINIMA = 200; // recorte: só considera polos com Meta Edital Inscrição >= 100

function normalizeStr(str) {
    return (str || '').toString()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .trim().toLowerCase();
}

function formatBRPctDirect(num) {
    return num.toFixed(2).replace('.', ',') + '%';
}

function getPolosFiltrados(polosData) {
    return polosData.filter(row => parseBRNumber(row[13]) >= META_EDITAL_INSC_MINIMA);
}

function extractCarteiraLimpa(row) {
    const raw = (row[5] || '').toString();
    for (const g of [...CARTEIRAS, ...GERENCIAS]) {
        if (raw.includes(g.match)) return NOMES_CURTOS_GRUPO[g.key];
    }
    return raw.replace(/^gerente\s+/i, '').split(' - ')[0].trim();
}

function buildGerenteLabel(row) {
    return `${extractCarteiraLimpa(row)}`;
}

function buildInsightItem({ icon, title, desc, meta }) {
    return `
    <div class="insight-item">
      <span class="insight-icon">${icon}</span>
      <div class="insight-body">
        <div class="insight-title">${title}</div>
        <div class="insight-desc">${desc}</div>
        ${meta ? `<div class="insight-meta">${meta}</div>` : ''}
      </div>
    </div>`;
}

function renderInsights() {
    const filtroAtivo = insightsCarteirasSelecionadas.size > 0;
    const polosFiltrados = insightsPolosData.filter(row =>
        !filtroAtivo || insightsCarteirasSelecionadas.has(extractCarteiraLimpa(row))
    );
    const polos = getPolosFiltrados(polosFiltrados);
    const listPos = document.getElementById('insights-positivos-list');
    const listNeg = document.getElementById('insights-melhoria-list');

    if (polos.length === 0) {
        const msg = '<p class="insight-empty">Sem polos elegíveis (Meta Edital Inscrição ≥ 100) no momento.</p>';
        listPos.innerHTML = msg;
        listNeg.innerHTML = msg;
        return;
    }

    const withPct = (idx) => polos.map(row => ({ row, pct: parseBRNumber(row[idx]) }));

    // ---------- DESTAQUES POSITIVOS ----------
    const acimaMeta = polos.filter(r => parseBRNumber(r[10]) >= 100);
    const pctAcimaMeta = (acimaMeta.length / polos.length) * 100;

    const destaqueMovel = withPct(10).reduce((a, b) => (b.pct > a.pct ? b : a));
    const maiorVolume = polos.reduce((a, b) => (parseBRNumber(b[7]) > parseBRNumber(a[7]) ? b : a));
    const melhorEdital = withPct(14).reduce((a, b) => (b.pct > a.pct ? b : a));
    const liderMatricula = withPct(12).reduce((a, b) => (b.pct > a.pct ? b : a));

    const carteiraContagemPositiva = {};
    acimaMeta.forEach(r => { carteiraContagemPositiva[r[5]] = (carteiraContagemPositiva[r[5]] || 0) + 1; });
    const carteiraDestaque = Object.entries(carteiraContagemPositiva).sort((a, b) => b[1] - a[1])[0];
    const analistaCarteiraDestaque = carteiraDestaque
        ? (polos.find(r => r[5] === carteiraDestaque[0]) || [])[6] : '';

    const positivos = [
        buildInsightItem({
            icon: '✅',
            title: `${acimaMeta.length} polos atingiram 100% da Meta Móvel de Inscrição`,
            desc: `${pctAcimaMeta.toFixed(1).replace('.', ',')}% do total de polos elegíveis estão na meta`
        }),
        buildInsightItem({
            icon: '🏅',
            title: `Destaque Meta Móvel Inscrição: ${destaqueMovel.row[1]}`,
            desc: `${formatBRPctDirect(destaqueMovel.pct)} atingido — ${formatBRInteger(parseBRNumber(destaqueMovel.row[7]))} inscritos`,
            meta: buildGerenteLabel(destaqueMovel.row)
        }),
        buildInsightItem({
            icon: '📈',
            title: `Maior volume: ${maiorVolume[1]}`,
            desc: `${formatBRInteger(parseBRNumber(maiorVolume[7]))} inscritos — ${formatBRPctDirect(parseBRNumber(maiorVolume[10]))} da Meta Móvel de Inscrição`,
            meta: buildGerenteLabel(maiorVolume)
        }),
        buildInsightItem({
            icon: '📋',
            title: `Melhor % Meta Edital Inscrição: ${melhorEdital.row[1]}`,
            desc: `${formatBRPctDirect(melhorEdital.pct)} da Meta Edital atingido`,
            meta: buildGerenteLabel(melhorEdital.row)
        }),
        buildInsightItem({
            icon: '🎓',
            title: `Líder em Matrículas: ${liderMatricula.row[1]}`,
            desc: `${formatBRPctDirect(liderMatricula.pct)} da Meta Móvel Matrícula — ${formatBRInteger(parseBRNumber(liderMatricula.row[8]))} matriculados`,
            meta: buildGerenteLabel(liderMatricula.row)
        }),
        buildInsightItem({
            icon: '🗂️',
            title: carteiraDestaque ? `Carteira destaque: ${carteiraDestaque[0]}` : 'Carteira destaque: sem dados',
            desc: carteiraDestaque ? `${carteiraDestaque[1]} polos acima de 100% da Meta Móvel de Inscrição` : '',
        }),
    ].join('');

    // ---------- PONTOS DE MELHORIA ----------
    const abaixoMeta = polos.filter(r => parseBRNumber(r[10]) < 50);
    const pctAbaixoMeta = (abaixoMeta.length / polos.length) * 100;

    const situacaoCritica = withPct(10).reduce((a, b) => (b.pct < a.pct ? b : a));
    const faltamCritica = Math.max(0, Math.round(parseBRNumber(situacaoCritica.row[9]) - parseBRNumber(situacaoCritica.row[7])));

    const maiorGap = polos.reduce((a, b) => {
        const gapA = parseBRNumber(a[9]) - parseBRNumber(a[7]);
        const gapB = parseBRNumber(b[9]) - parseBRNumber(b[7]);
        return gapB > gapA ? b : a;
    });
    const gapValor = Math.max(0, Math.round(parseBRNumber(maiorGap[9]) - parseBRNumber(maiorGap[7])));

    const potencialNaoAproveitado = abaixoMeta.length > 0
        ? abaixoMeta.reduce((a, b) => (parseBRNumber(b[9]) > parseBRNumber(a[9]) ? b : a))
        : polos[0];

    const carteiraContagemNegativa = {};
    abaixoMeta.forEach(r => { carteiraContagemNegativa[r[5]] = (carteiraContagemNegativa[r[5]] || 0) + 1; });
    const carteiraCritica = Object.entries(carteiraContagemNegativa).sort((a, b) => b[1] - a[1])[0];
    const analistaCarteiraCritica = carteiraCritica
        ? (polos.find(r => r[5] === carteiraCritica[0]) || [])[6] : '';

    const outrosAbaixo = Math.max(0, abaixoMeta.length - 1);

    const melhorias = [
        buildInsightItem({
            icon: '⚠️',
            title: `${abaixoMeta.length} polos abaixo de 50% da Meta Móvel de Inscrição`,
            desc: `${pctAbaixoMeta.toFixed(1).replace('.', ',')}% dos polos elegíveis precisam de atenção prioritária`
        }),
        buildInsightItem({
            icon: '🔴',
            title: `Situação crítica (Meta Móvel Inscrição): ${situacaoCritica.row[1]}`,
            desc: `${formatBRPctDirect(situacaoCritica.pct)} atingido — faltam ${formatBRInteger(faltamCritica)} inscritos para a meta`,
            meta: buildGerenteLabel(situacaoCritica.row)
        }),
        buildInsightItem({
            icon: '📍',
            title: `Maior gap absoluto: ${maiorGap[1]}`,
            desc: `Faltam ${formatBRInteger(gapValor)} inscritos para atingir a Meta Móvel de Inscrição`,
            meta: buildGerenteLabel(maiorGap)
        }),
        buildInsightItem({
            icon: '⚡',
            title: `Potencial não aproveitado: ${potencialNaoAproveitado[1]}`,
            desc: `Meta Móvel de Inscrição de ${formatBRInteger(parseBRNumber(potencialNaoAproveitado[9]))} inscritos, mas apenas ${formatBRPctDirect(parseBRNumber(potencialNaoAproveitado[10]))} atingido`,
            meta: buildGerenteLabel(potencialNaoAproveitado)
        }),
        buildInsightItem({
            icon: '🗂️',
            title: carteiraCritica ? `Carteira com mais críticos: Gerente ${carteiraCritica[0]}` : 'Carteira crítica: sem dados',
            desc: carteiraCritica ? `${carteiraCritica[1]} polos abaixo de 50% da Meta Móvel de Inscrição nesta carteira` : '',
        }),
        buildInsightItem({
            icon: '📋',
            title: `${outrosAbaixo} outros polos abaixo de 50% da Meta Móvel de Inscrição`,
            desc: `Use a busca na tabela abaixo para localizar e filtrar por carteira`
        }),
    ].join('');

    listPos.innerHTML = positivos;
    listNeg.innerHTML = melhorias;
}

function processAndRenderInsights(polosData) {
    insightsPolosData = polosData;

    const carteiras = [...new Set(
        polosData.filter(row => isLinhaPoloValida(row)).map(row => extractCarteiraLimpa(row))
    )].sort((a, b) => a.localeCompare(b));

    const optionsWrapper = document.getElementById('insights-carteira-options');
    const carteiraLabel = document.getElementById('insightsCarteiraLabel');
    const dropdown = document.getElementById('insightsCarteiraDropdown');
    const btn = document.getElementById('insightsCarteiraBtn');

    function updateLabel() {
        carteiraLabel.textContent =
            insightsCarteirasSelecionadas.size === 0 || insightsCarteirasSelecionadas.size === carteiras.length
                ? 'Todas as carteiras'
                : `${insightsCarteirasSelecionadas.size} carteira(s) selecionada(s)`;
    }

    function buildOptions() {
        optionsWrapper.innerHTML = carteiras.map(c => `
            <label class="uf-chip">
                <input type="checkbox" value="${c}" ${insightsCarteirasSelecionadas.has(c) ? 'checked' : ''}>
                <span>${c}</span>
            </label>`).join('');

        optionsWrapper.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                if (cb.checked) insightsCarteirasSelecionadas.add(cb.value);
                else insightsCarteirasSelecionadas.delete(cb.value);
                updateLabel();
                renderInsights();
            });
        });
    }

    buildOptions();

    document.getElementById('insightsCarteiraSelectAll').addEventListener('click', () => {
        carteiras.forEach(c => insightsCarteirasSelecionadas.add(c));
        buildOptions(); updateLabel(); renderInsights();
    });
    document.getElementById('insightsCarteiraClearAll').addEventListener('click', () => {
        insightsCarteirasSelecionadas.clear();
        buildOptions(); updateLabel(); renderInsights();
    });

    btn.addEventListener('click', e => { e.stopPropagation(); dropdown.classList.toggle('open'); });
    document.addEventListener('click', () => dropdown.classList.remove('open'));

    renderInsights();
}

// ==========================================
// VISÃO DETALHADA DOS POLOS
// ==========================================
let polosDetalheData = [];
let carteiraAtiva = '';
let carteirasSelecionadas = new Set();

function buildPolosRow(row) {
    return {
        codPolo: row[0] || '',
        polo: row[1] || '',
        carteira: extractCarteiraLimpa(row),
        estado: row[2] || '',
        regiao: row[3] || '',
        parceiro: row[4] || '',
        analista: row[6] || '',
        inscritos: parseBRNumber(row[7]),
        matriculados: parseBRNumber(row[8]),
        metaMovelInsc: parseBRNumber(row[9]),
        pctMovelInsc: parseBRNumber(row[10]),
        metaMovelMatr: parseBRNumber(row[11]),
        pctMovelMatr: parseBRNumber(row[12]),
        metaEditalInsc: parseBRNumber(row[13]),
        pctEditalInsc: parseBRNumber(row[14]),
        metaEditalMatr: parseBRNumber(row[15]),
        pctEditalMatr: parseBRNumber(row[16]),
    };
}

function renderPolosTable(items) {
    const tbody = document.getElementById('polos-table-body');

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="polos-empty">Nenhum polo encontrado.</td></tr>';
        document.getElementById('polosExportCount').innerText = 0;
        return;
    }

    tbody.innerHTML = items.map(item => `
        <tr>
        <td class="polos-nome">${item.polo}</td>
        <td>${item.carteira}</td>
        <td class="num td-insc-start">${formatBRInteger(item.inscritos)}</td>
        <td class="td-insc">${formatBRInteger(item.metaMovelInsc)}</td>
        <td class="td-insc-end ${getPctColorClass(item.pctMovelInsc)}">${formatBRPctDirect(item.pctMovelInsc)}</td>
        <td class="num td-matr-start">${formatBRInteger(item.matriculados)}</td>
        <td class="td-matr">${formatBRInteger(item.metaMovelMatr)}</td>
        <td class="td-matr-end ${getPctColorClass(item.pctMovelMatr)}">${formatBRPctDirect(item.pctMovelMatr)}</td>
        </tr>`).join('');

    document.getElementById('polosExportCount').innerText = items.length;
}

function filterPolosTable() {
    const termo = (document.getElementById('polos-search').value || '').trim().toLowerCase();
    const carteiraSelecionada = carteirasSelecionadas.size > 0 ? carteirasSelecionadas : null;

    const filtrados = polosDetalheData.filter(item => {
        const passaTexto = !termo ||
            item.polo.toLowerCase().includes(termo) ||
            item.carteira.toLowerCase().includes(termo) ||
            item.analista.toLowerCase().includes(termo);
        const passaCarteira = !carteiraSelecionada || carteiraSelecionada.has(item.carteira);
        return passaTexto && passaCarteira;
    });

    renderPolosTable(filtrados);
    return filtrados;
}

function exportPolosCSV(items, nomeArquivo = 'polos_inscricoes') {
    const header = ['Polo', 'Carteira', 'Estado', 'Região', 'Parceiro', 'Analista', 'Inscritos', 'Meta Móvel Insc', '% Meta Móvel Insc', 'Matriculados', 'Meta Móvel Matr', '% Meta Móvel Matr', 'Meta Edital Insc', '% Meta Edital Insc', 'Meta Edital Matr', '% Meta Edital Matr'];
    const linhas = items.map(item => [
        item.polo, item.carteira, item.estado, item.regiao, item.parceiro, item.analista,
        item.inscritos, item.metaMovelInsc, formatBRPctDirect(item.pctMovelInsc),
        item.matriculados, item.metaMovelMatr, formatBRPctDirect(item.pctMovelMatr),
        item.metaEditalInsc, formatBRPctDirect(item.pctEditalInsc),
        item.metaEditalMatr, formatBRPctDirect(item.pctEditalMatr)
    ]);

    const csv = [header, ...linhas]
        .map(cols => cols.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
        .join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${nomeArquivo}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportEstadosCSV(items) {
    const header = ['Estado', 'Inscritos', 'Meta Móvel Insc', '% Meta Móvel Insc', 'Meta Edital Insc', '% Meta Edital Insc', 'Matriculados', 'Meta Móvel Matr', '% Meta Móvel Matr', 'Meta Edital Matr', '% Meta Edital Matr'];
    const linhas = items.map(item => [
        item.uf, item.inscritos, item.metaMovelInsc, formatBRPctDirect(item.pctMovelInsc),
        item.metaEditalInsc, formatBRPctDirect(item.pctEditalInsc),
        item.matriculados, item.metaMovelMatr, formatBRPctDirect(item.pctMovelMatr),
        item.metaEditalMatr, formatBRPctDirect(item.pctEditalMatr)
    ]);

    const csv = [header, ...linhas]
        .map(cols => cols.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
        .join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estados_inscricoes_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function isLinhaPoloValida(row) {
    const nome = (row[1] || '').toString().trim();
    if (!nome || !row[5]) return false;                          // sem nome ou carteira
    if (nome.toUpperCase() === 'POLO') return false;             // cabeçalho da planilha
    if (nome.includes('#N/D')) return false;                     // célula sem valor no Sheets
    if ((row[5] || '').toString().includes('#N/D')) return false; // carteira inválida
    return true;
}

function getPolosDosEstadosFiltrados(ufsVisiveis) {
    const carteiraFiltroAtivo = estadosCarteirasSelecionadas.size > 0;

    return estadosPolosData
        .filter(isLinhaPoloValida)
        .map(buildPolosRow)
        .filter(item => {
            const estado = (item.estado || '').toString().trim().toUpperCase();
            if (!ufsVisiveis.includes(estado)) return false;
            if (carteiraFiltroAtivo && !estadosCarteirasSelecionadas.has(item.carteira)) return false;
            return true;
        })
        .sort((a, b) => a.polo.localeCompare(b.polo));
}

function processAndRenderPolosDetalhe(polosData) {
    polosDetalheData = polosData
        .filter(isLinhaPoloValida)
        .map(buildPolosRow)
        .sort((a, b) => a.polo.localeCompare(b.polo));

    const carteiras = [...new Set(polosDetalheData.map(item => item.carteira))].sort((a, b) => a.localeCompare(b));

    const optionsWrapper = document.getElementById('polos-carteira-options');
    const carteiraLabel = document.getElementById('polosCarteiraLabel');
    const carteiraDropdown = document.getElementById('polosCarteiraDropdown');
    const carteiraBtn = document.getElementById('polosCarteiraBtn');

    function updateCarteiraLabel() {
        if (carteirasSelecionadas.size === 0 || carteirasSelecionadas.size === carteiras.length) {
            carteiraLabel.textContent = 'Todas as carteiras';
        } else {
            carteiraLabel.textContent = `${carteirasSelecionadas.size} carteira(s) selecionada(s)`;
        }
    }

    function buildCarteiraOptions() {
        optionsWrapper.innerHTML = carteiras.map(c => `
        <label class="uf-chip">
            <input type="checkbox" value="${c}" ${carteirasSelecionadas.has(c) ? 'checked' : ''}>
            <span>${c}</span>
        </label>
    `).join('');

        optionsWrapper.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                if (cb.checked) carteirasSelecionadas.add(cb.value);
                else carteirasSelecionadas.delete(cb.value);
                updateCarteiraLabel();
                filterPolosTable();
            });
        });
    }

    buildCarteiraOptions();

    document.getElementById('carteiraSelectAll').addEventListener('click', () => {
        carteiras.forEach(c => carteirasSelecionadas.add(c));
        buildCarteiraOptions();
        updateCarteiraLabel();
        filterPolosTable();
    });

    document.getElementById('carteiraClearAll').addEventListener('click', () => {
        carteirasSelecionadas.clear();
        buildCarteiraOptions();
        updateCarteiraLabel();
        filterPolosTable();
    });

    carteiraBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        carteiraDropdown.classList.toggle('open');
    });
    document.addEventListener('click', () => carteiraDropdown.classList.remove('open'));

    renderPolosTable(polosDetalheData);

    document.getElementById('polos-search').addEventListener('input', filterPolosTable);

    document.getElementById('polosClearBtn').addEventListener('click', () => {
        document.getElementById('polos-search').value = '';
        carteirasSelecionadas.clear();
        buildCarteiraOptions();
        updateCarteiraLabel();
        filterPolosTable();
    });

    document.getElementById('polosExportBtn').addEventListener('click', () => {
        exportPolosCSV(filterPolosTable());
    });
}

// ==========================================
// MAPA DE ALERTA — INSCRIÇÕES / MATRÍCULAS (por estado)
// Usa as mesmas linhas validadas da aba CAPTAÇÃO POLO (isLinhaPoloValida +
// buildPolosRow) já usadas na Visão Detalhada dos Polos, agregadas por ESTADO.
// Os contornos geográficos (BR_STATE_PATHS/BR_STATE_LABEL_POS/BR_STATE_BBOX)
// vêm de br_state_paths.js — dado estático (fronteiras não mudam), separado
// do dado da planilha (que é lido de novo a cada carregamento da página).
// ==========================================
const MAPA_ESTADO_NOMES = {
    AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará',
    DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão',
    MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará',
    PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro',
    RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima',
    SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};

const MAPA_METRIC_META = {
    insc: { label: 'Inscrições', singular: 'Inscritos', field: 'inscritos', metaField: 'metaInsc', pctField: 'pctInsc' },
    matr: { label: 'Matrículas', singular: 'Matriculados', field: 'matriculados', metaField: 'metaMatr', pctField: 'pctMatr' },
};
let mapaMetricaAtual = 'insc';
let mapaEstadoData = {};
let mapaSvgConstruido = false;

function mapaGetMetric(obj) {
    const m = MAPA_METRIC_META[mapaMetricaAtual];
    return { value: obj[m.field], meta: obj[m.metaField], pct: obj[m.pctField], singular: m.singular, label: m.label };
}

// Escala continua verde -> vermelho para os tiles de polo dentro do popup
const MAPA_TILE_STOPS = [
    { pct: 0, rgb: [232, 91, 77] },
    { pct: 50, rgb: [242, 153, 74] },
    { pct: 80, rgb: [242, 194, 0] },
    { pct: 100, rgb: [76, 175, 80] },
    { pct: 130, rgb: [27, 94, 32] },
];
function mapaHeatRGB(pct) {
    const p = Math.max(0, Math.min(pct, 130));
    for (let i = 0; i < MAPA_TILE_STOPS.length - 1; i++) {
        const a = MAPA_TILE_STOPS[i], b = MAPA_TILE_STOPS[i + 1];
        if (p >= a.pct && p <= b.pct) {
            const t = (p - a.pct) / (b.pct - a.pct);
            return a.rgb.map((v, idx) => Math.round(v + (b.rgb[idx] - v) * t));
        }
    }
    return MAPA_TILE_STOPS[MAPA_TILE_STOPS.length - 1].rgb;
}
function mapaTextColorFor(rgb) {
    const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
    return lum > 0.58 ? '#1a1810' : '#ffffff';
}

// Severidade da "nuvem" do mapa nacional — mesmas faixas do rótulo
// (Atenção/Alerta/Crítico), com piso de opacidade no topo de cada faixa
// para nao esmaecer perto de 100%.
function mapaSeverity(pct) { return Math.max(0, Math.min(1, (100 - pct) / 100)); }

const MAPA_SEV_BANDS = [
    { hi: 100, lo: 80, top: [255, 205, 20, 0.46], bot: [255, 170, 0, 0.58] },
    { hi: 80, lo: 50, top: [255, 140, 0, 0.62], bot: [255, 90, 0, 0.76] },
    { hi: 50, lo: 0, top: [235, 40, 20, 0.82], bot: [139, 0, 0, 0.96] },
];
function mapaSeverityColorFromPct(pct) {
    if (pct >= 100) return null;
    const p = Math.max(0, pct);
    const band = MAPA_SEV_BANDS.find(b => p >= b.lo && p < b.hi) || MAPA_SEV_BANDS[MAPA_SEV_BANDS.length - 1];
    const t = (band.hi - p) / (band.hi - band.lo);
    return [0, 1, 2, 3].map(i => band.top[i] + (band.bot[i] - band.top[i]) * t);
}
function mapaBandInfo(pct) {
    if (pct >= 100) return { label: 'Meta atingida', color: '#4caf50' };
    if (pct >= 80) return { label: 'Atenção', color: '#e0ac00' };
    if (pct >= 50) return { label: 'Alerta', color: '#ff6a00' };
    return { label: 'Crítico', color: '#e61414' };
}

function processAndRenderMapaEstados(polosData) {
    if (typeof BR_STATE_PATHS === 'undefined') {
        return console.warn('br_state_paths.js não carregado — Mapa de Alerta desativado.');
    }

    const porEstado = {};
    polosData.filter(isLinhaPoloValida).forEach(row => {
        const item = buildPolosRow(row);
        const uf = (item.estado || '').toString().trim().toUpperCase();
        if (!uf) return;
        (porEstado[uf] = porEstado[uf] || []).push(item);
    });

    mapaEstadoData = {};
    Object.keys(BR_STATE_PATHS).forEach(uf => {
        const itens = porEstado[uf] || [];
        if (itens.length === 0) {
            mapaEstadoData[uf] = {
                uf, nome: MAPA_ESTADO_NOMES[uf] || uf, cidades: [], hasData: false,
                inscritos: 0, metaInsc: 0, pctInsc: 0, matriculados: 0, metaMatr: 0, pctMatr: 0,
            };
            return;
        }

        const tot = itens.reduce((acc, it) => {
            acc.inscritos += it.inscritos; acc.metaInsc += it.metaMovelInsc;
            acc.matriculados += it.matriculados; acc.metaMatr += it.metaMovelMatr;
            return acc;
        }, { inscritos: 0, metaInsc: 0, matriculados: 0, metaMatr: 0 });

        const cidades = itens.map(it => ({
            polo: it.polo, carteira: it.carteira, analista: it.analista,
            inscritos: it.inscritos, metaInsc: it.metaMovelInsc, pctInsc: it.pctMovelInsc,
            matriculados: it.matriculados, metaMatr: it.metaMovelMatr, pctMatr: it.pctMovelMatr,
        })).sort((a, b) => a.polo.localeCompare(b.polo));

        mapaEstadoData[uf] = {
            uf, nome: MAPA_ESTADO_NOMES[uf] || uf, cidades, hasData: true,
            inscritos: tot.inscritos, metaInsc: tot.metaInsc,
            pctInsc: tot.metaInsc > 0 ? (tot.inscritos / tot.metaInsc) * 100 : 0,
            matriculados: tot.matriculados, metaMatr: tot.metaMatr,
            pctMatr: tot.metaMatr > 0 ? (tot.matriculados / tot.metaMatr) * 100 : 0,
        };
    });

    mapaBuildBaseSvg();
    mapaRenderBandSummary();
    mapaRenderCloud();
}

function mapaBuildBaseSvg() {
    if (mapaSvgConstruido) return;
    const brSvg = document.getElementById('mapaBrSvg');
    const labelsSvg = document.getElementById('mapaLabelsSvg');
    const statesLayer = document.getElementById('mapaStatesLayer');
    const labelsLayer = document.getElementById('mapaLabelsLayer');
    if (!brSvg || !statesLayer) return;

    const svgNS = 'http://www.w3.org/2000/svg';
    brSvg.setAttribute('viewBox', `0 0 ${BR_VIEWBOX_W} ${BR_VIEWBOX_H}`);
    labelsSvg.setAttribute('viewBox', `0 0 ${BR_VIEWBOX_W} ${BR_VIEWBOX_H}`);

    Object.keys(BR_STATE_PATHS).forEach(uf => {
        const d = BR_STATE_PATHS[uf];
        if (!d) return;

        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', d);
        path.setAttribute('class', 'uf-path');
        path.dataset.uf = uf;
        path.addEventListener('mouseenter', e => mapaShowTooltip(e, uf));
        path.addEventListener('mousemove', e => mapaPositionTooltip(e));
        path.addEventListener('mouseleave', mapaHideTooltip);
        path.addEventListener('click', () => mapaOpenModal(uf));
        statesLayer.appendChild(path);

        const pos = BR_STATE_LABEL_POS[uf];
        if (pos) {
            const text = document.createElementNS(svgNS, 'text');
            text.setAttribute('x', pos[0]);
            text.setAttribute('y', pos[1]);
            text.setAttribute('class', 'uf-label');
            text.textContent = uf;
            labelsLayer.appendChild(text);
        }
    });

    mapaSvgConstruido = true;
}

function mapaRenderBandSummary() {
    const el = document.getElementById('mapaBandSummary');
    if (!el) return;
    const estados = Object.values(mapaEstadoData).filter(d => d.hasData);
    const bands = [
        { label: 'Meta atingida (≥100%)', swatchClass: 'ok', test: d => mapaGetMetric(d).pct >= 100 },
        { label: 'Atenção (80–99%)', color: 'var(--sev-atencao)', test: d => mapaGetMetric(d).pct >= 80 && mapaGetMetric(d).pct < 100 },
        { label: 'Alerta (50–79%)', color: 'var(--sev-alerta)', test: d => mapaGetMetric(d).pct >= 50 && mapaGetMetric(d).pct < 80 },
        { label: 'Crítico (<50%)', color: 'var(--sev-critico)', test: d => mapaGetMetric(d).pct < 50 },
    ];
    el.innerHTML = bands.map(b => {
        const n = estados.filter(b.test).length;
        const swatch = b.swatchClass
            ? `<span class="band-swatch ${b.swatchClass}"></span>`
            : `<span class="band-swatch" style="background:${b.color}"></span>`;
        return `<div class="band-chip">${swatch}${b.label}: <strong>${n}</strong></div>`;
    }).join('');
}

function mapaPositionTooltip(e) {
    const tooltip = document.getElementById('mapaTooltip');
    const pad = 14;
    let x = e.clientX + pad, y = e.clientY + pad;
    const rect = tooltip.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) x = e.clientX - rect.width - pad;
    if (y + rect.height > window.innerHeight) y = e.clientY - rect.height - pad;
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
}
function mapaHideTooltip() {
    const tooltip = document.getElementById('mapaTooltip');
    if (tooltip) tooltip.classList.remove('visible');
}
function mapaShowTooltip(e, uf) {
    const d = mapaEstadoData[uf];
    const tooltip = document.getElementById('mapaTooltip');
    if (!d || !tooltip) return;

    if (!d.hasData) {
        tooltip.innerHTML = `
            <div class="tt-title">${d.nome}</div>
            <div class="tt-hint">Sem polos cadastrados para este estado.</div>
        `;
        tooltip.classList.add('visible');
        mapaPositionTooltip(e);
        return;
    }

    const m = mapaGetMetric(d);
    const band = mapaBandInfo(m.pct);
    tooltip.innerHTML = `
        <div class="tt-title">${d.nome}</div>
        <div class="tt-badge" style="background:${band.color}">${band.label}</div>
        <div class="tt-row"><span>${m.singular}</span><b>${formatBRInteger(m.value)}</b></div>
        <div class="tt-row"><span>Meta móvel</span><b>${formatBRInteger(m.meta)}</b></div>
        <div class="tt-row"><span>Atingimento</span><b>${formatBRPctDirect(m.pct)}</b></div>
        <div class="tt-hint">Clique para ver os polos por cidade</div>
    `;
    tooltip.classList.add('visible');
    mapaPositionTooltip(e);
}

function mapaRenderCloud() {
    const visible = document.getElementById('mapaCloudCanvas');
    if (!visible) return;
    const w = BR_VIEWBOX_W, h = Math.round(BR_VIEWBOX_H);
    visible.width = w; visible.height = h;
    const ctx = visible.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';

    Object.keys(mapaEstadoData).forEach(uf => {
        const d = mapaEstadoData[uf];
        if (!d.hasData) return;

        const pct = mapaGetMetric(d).pct;
        const color = mapaSeverityColorFromPct(pct);
        if (!color) return;

        const s = mapaSeverity(pct);
        const bbox = BR_STATE_BBOX[uf];
        const bw = bbox[2] - bbox[0], bh = bbox[3] - bbox[1];
        const baseRadius = Math.max(42, Math.min(130, 0.55 * Math.sqrt(bw * bh)));
        const radius = baseRadius * (0.72 + 0.4 * s);

        const [cx, cy] = BR_STATE_LABEL_POS[uf];
        const [r, g, b, a] = color;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, `rgba(${r},${g},${b},${a})`);
        grad.addColorStop(0.7, `rgba(${r},${g},${b},${a * 0.55})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
    });
}

function mapaStatPctColor(pct) {
    if (pct >= 100) return 'var(--verde-ok)';
    if (pct >= 80) return 'var(--sev-atencao)';
    if (pct >= 50) return 'var(--sev-alerta)';
    return 'var(--sev-critico)';
}

function mapaBuildCityTile(c) {
    const m = mapaGetMetric(c);
    const rgb = mapaHeatRGB(m.pct);
    const color = `rgb(${rgb.join(',')})`;
    const text = mapaTextColorFor(rgb);
    const div = document.createElement('div');
    div.className = 'heat-tile';
    div.style.background = color;
    div.style.color = text;
    div.title = `${c.polo} — ${formatBRInteger(m.value)}/${formatBRInteger(m.meta)} ${m.singular.toLowerCase()} (${formatBRPctDirect(m.pct)})`;
    div.innerHTML = `
        <span class="heat-tile-name">${c.polo}</span>
        <span class="heat-tile-pct">${formatBRPctDirect(m.pct)}</span>
        <span class="heat-tile-frac">${formatBRInteger(m.value)} / ${formatBRInteger(m.meta)}</span>
    `;
    return div;
}

function mapaOpenModal(uf) {
    const d = mapaEstadoData[uf];
    const backdrop = document.getElementById('mapaModalBackdrop');
    if (!d || !backdrop) return;

    const m = mapaGetMetric(d);
    document.getElementById('mapaModalTitle').textContent = d.nome;
    document.getElementById('mapaModalSubtitle').textContent = d.hasData
        ? `${d.cidades.length} polo(s) com dados`
        : 'Nenhum polo cadastrado';
    document.getElementById('mapaModalCitiesLabel').textContent = `Polos por cidade — ${m.label}`;

    const summaryEl = document.getElementById('mapaModalSummary');
    summaryEl.innerHTML = d.hasData ? `
        <div class="modal-stat">
            <div class="modal-stat-label">${m.label} — total do estado</div>
            <div class="modal-stat-row">
                <span class="modal-stat-value">${formatBRInteger(m.value)}</span>
                <span class="modal-stat-of">/ ${formatBRInteger(m.meta)} meta móvel</span>
                <span class="modal-stat-pct" style="color:${mapaStatPctColor(m.pct)}">${formatBRPctDirect(m.pct)}</span>
            </div>
        </div>
    ` : '';

    const grid = document.getElementById('mapaModalGrid');
    if (!d.hasData || d.cidades.length === 0) {
        grid.innerHTML = '<p class="polos-empty" style="grid-column:1/-1;">Nenhum polo encontrado para este estado.</p>';
    } else {
        grid.innerHTML = '';
        const ordenadas = [...d.cidades].sort((a, b) => mapaGetMetric(a).pct - mapaGetMetric(b).pct);
        ordenadas.forEach(c => grid.appendChild(mapaBuildCityTile(c)));
    }

    backdrop.classList.add('open');
}
function mapaCloseModal() {
    const backdrop = document.getElementById('mapaModalBackdrop');
    if (backdrop) backdrop.classList.remove('open');
}

const MAPA_HEADER_TEXT = {
    insc: {
        title: 'Mapa de Alerta de Inscrições',
        sub: 'Áreas destacadas em amarelo/laranja/vermelho indicam estados abaixo da Meta Móvel de Inscrição. Passe o mouse para ver os números; clique para abrir os polos por cidade.',
    },
    matr: {
        title: 'Mapa de Alerta de Matrículas',
        sub: 'Áreas destacadas em amarelo/laranja/vermelho indicam estados abaixo da Meta Móvel de Matrícula. Passe o mouse para ver os números; clique para abrir os polos por cidade.',
    },
};

function mapaSetMetric(metric) {
    if (metric === mapaMetricaAtual) return;
    mapaMetricaAtual = metric;

    document.querySelectorAll('.metric-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.metric === metric);
    });
    document.getElementById('mapaTitle').textContent = MAPA_HEADER_TEXT[metric].title;
    document.getElementById('mapaSubtitle').textContent = MAPA_HEADER_TEXT[metric].sub;

    mapaRenderBandSummary();
    mapaRenderCloud();
    mapaCloseModal();
}

function initMapaAlertaControls() {
    document.querySelectorAll('.metric-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => mapaSetMetric(btn.dataset.metric));
    });
    const backdrop = document.getElementById('mapaModalBackdrop');
    const closeBtn = document.getElementById('mapaModalClose');
    if (closeBtn) closeBtn.addEventListener('click', mapaCloseModal);
    if (backdrop) backdrop.addEventListener('click', e => { if (e.target === backdrop) mapaCloseModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') mapaCloseModal(); });
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================
async function initDashboardInscricoes() {
    console.log('Iniciando Dashboard de Inscrições...');
    initMapaAlertaControls();

    const consolidadoData = await fetchSheetData(GID_CAPTACAO_CONSOLIDADO);
    if (consolidadoData.length > 0) {
        processAndRenderTopKPIs(consolidadoData);
        processAndRenderCarteiras(consolidadoData);
    }

    const polosData = await fetchSheetData(GID_CAPTACAO_POLO);
    if (polosData.length > 0) {
        processAndRenderInsights(polosData);
        processAndRenderRegioes(polosData);
        processAndRenderEstados(polosData)
        processAndRenderPolosDetalhe(polosData);
        processAndRenderMapaEstados(polosData);
    }

    // Data e hora da atualização: linha "DATA E HORA ATUALIZACAO" da aba
    // CONSOLIDADO de Pagamentos (GID_CONSOLIDADO_PAGAMENTOS) — a planilha
    // inteira é atualizada de uma vez, então essa data vale para o
    // dashboard de Inscrições também. Buscamos pelo rótulo, não por
    // índice de linha, pois o parseCSV descarta linhas em branco e isso
    // deslocaria uma posição fixa.
    const dataAtualizacaoData = await fetchSheetData(GID_CONSOLIDADO_PAGAMENTOS);
    const linhaDataAtualizacao = dataAtualizacaoData.find(l =>
        l[0] && l[0].normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').trim().toUpperCase().includes('DATA E HORA')
    );
    document.getElementById('statusText').innerText = linhaDataAtualizacao && linhaDataAtualizacao[1]
        ? linhaDataAtualizacao[1].trim()
        : '--/--/---- --:--';
    document.getElementById('statusDot').className = 'status-dot ok';
}

document.addEventListener('DOMContentLoaded', initDashboardInscricoes);
