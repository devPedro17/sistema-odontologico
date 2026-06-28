const API_URL = window.location.hostname === "localhost"
  ? "http://127.0.0.1:5000"
  : "https://SEU-BACKEND-ONLINE.com";

/* ================= ESTADO GLOBAL ================= */
let pacientesCache = [];
let pacienteSelecionado = null;
let denteSelecionado = null;
let faceSelecionada = null;
let procedimentosAtuais = [];
let dataAtual = new Date();
let horarioSelecionado = null;
let dataSelecionada = null;


const PROCEDIMENTOS = {
  "Restauração": "#3b82f6",
  "Extração": "#ef4444",
  "Limpeza": "#22c55e",
  "Aparelho Ortodôntico": "#8b5cf6"
};

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", async () => {
  carregarTela("home");
  await carregarPacientesLista();
  carregarDashboard();
  aplicarMascaras();
});

/* ================= API ================= */
async function api(url, opt = {}) {
  try {
    const r = await fetch(API_URL + url, opt);
    if (!r.ok) throw new Error(await r.text());
    return await r.json();
  } catch (err) {
    console.error("Erro API:", err);
    throw err;
  }
}

/* ================= NAVEGAÇÃO ================= */
function carregarTela(secao) {
  document.querySelectorAll(".conteudo-secao")
    .forEach(e => e.style.display = "none");
  const el = document.getElementById("secao-" + secao);
  if (el) el.style.display = "block";
  if (secao === "agenda") {
    renderizarAgenda();
    carregarPacientesNoSelectAgenda();
  }
  if (secao === "odontograma") {
    carregarPacientesLista();
  }
}

/* ================= DASHBOARD ================= */
async function carregarDashboard() {
  try {
    const pacientes = await api("/api/total-pacientes");
    document.getElementById("count-pacientes").innerText = pacientes.total;
    const hoje = new Date().toISOString().split("T")[0];
    const consultas = await api(`/api/consultas-hoje?data=${hoje}`);
    document.getElementById("count-consultas").innerText = consultas.total;
  } catch (e) {
    console.error("Erro dashboard:", e);
  }
}
/* ================= PACIENTES ================= */
async function carregarPacientesLista() {
  try {
    pacientesCache = await api("/api/pacientes");
  } catch (e) {
    console.error(e);
  }
}

/* ================= AGENDA ================= */
async function renderizarAgenda() {
  const grid = document.querySelector(".calendario-grid");
  const header = document.getElementById("mes-atual");
  if (!grid || !header) return;
  grid.innerHTML = "";
  const ano = dataAtual.getFullYear();
  const mes = dataAtual.getMonth();
  const meses = [
    "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
  ]
  header.innerHTML = `<button onclick="mudarMes(-1)">◀</button><strong>${meses[mes]} / ${ano}</strong><button onclick="mudarMes(1)">▶</button>`;
  let mapa = {};
  const res = await api("/api/agendamentos");
  res.forEach(a => {
    const data = a.data_hora.split(" ")[0];
    mapa[data] = (mapa[data] || 0) + 1;
  });
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  for (let i = 0; i < primeiroDia; i++) {grid.appendChild(document.createElement("div"));}
  for (let d = 1; d <= diasNoMes; d++) {
    const data = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const card = document.createElement("div");
    card.className = "dia-card";
    card.innerHTML = `<strong>${d}</strong><div>${mapa[data] || 0} agend.</div>`;
    card.onclick = () => abrirModalAgenda(data);
    grid.appendChild(card);
  }
}

function mudarMes(delta) {
  dataAtual.setMonth(dataAtual.getMonth() + delta);
  renderizarAgenda();
}

async function carregarPacientesNoSelectAgenda() {
  const select = document.getElementById("select-paciente-agendamento");
  if (!select) return;
  const pacientes = await api("/api/pacientes");
  select.innerHTML = `<option value="">Selecione um paciente</option>`;
  pacientes.forEach(p => {
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = `${p.nome} - ${p.cpf || ""}`;
    select.appendChild(option);
  });
}

/* ================= MODAL AGENDA ================= */
function abrirModalAgenda(data) {
  const modal = document.getElementById("modal-agenda-central");
  if (!modal) return;
  modal.style.display = "flex";
  dataSelecionada = data;
  horarioSelecionado = null;
  document.getElementById("data-selecionada-titulo").innerText = data;
  setTimeout(() => {
    carregarHorarios(data);
  }, 50);
}

function fecharModalAgenda() {
  const modal = document.getElementById("modal-agenda-central");
  if (modal) modal.style.display = "none";
}

async function carregarHorarios(data) {
  const container = document.getElementById("lista-horarios-modal");
  if (!container) return;
  container.innerHTML = "";
  try {
    const dentista = document.getElementById("select-dentista-agenda")?.value || "Geral";
    const ocupados = await api(`/api/agenda?data=${data}&dentista=${dentista}`);
    const horarios = [
      "08:00","09:00","10:00","11:00",
      "14:00","15:00","16:00","17:00","18:00"
    ];
    horarios.forEach(h => {
      const btn = document.createElement("button");
      btn.textContent = h;
      if (ocupados.includes(h)) {
        btn.disabled = true;
        btn.classList.add("horario-ocupado");
        btn.textContent = `${h} (ocupado)`;
      } else {
        btn.onclick = () => {
          horarioSelecionado = h;
          document.querySelectorAll("#lista-horarios-modal button")
            .forEach(b => b.classList.remove("selected"));
          btn.classList.add("selected");
        };
      }
      container.appendChild(btn);
    });

  } catch (err) {
    console.error("Erro ao carregar horários:", err);
    container.innerHTML = "<p style='color:red'>Erro ao carregar horários</p>";
  }
}

async function agendar(data, hora) {
  const p = document.getElementById("select-paciente-agendamento")?.value;
  if (!p) {
    alert("Selecione paciente");
    return;
  }
  try {
    await api("/api/agenda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paciente_id: Number(p),
        data_hora: `${data} ${hora}`
      })
    });
    fecharModalAgenda();
    renderizarAgenda();
  } catch (e) {
    alert("Erro ao agendar");
    console.error(e);
  }
}

/* ================= ODONTOGRAMA ================= */
async function abrirOdontogramaPaciente(p) {
  pacienteSelecionado = p.id;
  const ficha = await api(`/api/pacientes/${p.id}`);
  document.getElementById("odontograma-ficha").style.display = "block";
  document.getElementById("nome-paciente-ficha").innerText = ficha.nome;
  document.getElementById("cpf-ficha").innerText = ficha.cpf;
  document.getElementById("tel-ficha").innerText = ficha.contato;
  document.getElementById("alergias-ficha").innerText = ficha.alergias || "Nenhuma";
  procedimentosAtuais = await api(`/api/procedimentos/${p.id}`);
  renderizarOdontograma();
  renderizarLista();
  carregarCardAgendamento(p.id);
}

function resetOdontograma() {
  pacienteSelecionado = null;
  procedimentosAtuais = [];
  denteSelecionado = null;
  faceSelecionada = null;
  const ficha = document.getElementById("odontograma-ficha");
  if (ficha) ficha.style.display = "none";
  const nome = document.getElementById("nome-paciente-ficha");
  if (nome) nome.innerText = "";
  const cpf = document.getElementById("cpf-ficha");
  if (cpf) cpf.innerText = "";
  const tel = document.getElementById("tel-ficha");
  if (tel) tel.innerText = "";
  const alergias = document.getElementById("alergias-ficha");
  if (alergias) alergias.innerText = "";
  const lista = document.getElementById("lista-procedimentos-lancados");
  if (lista) lista.innerHTML = "";
  const arcadaSup = document.getElementById("arcada-superior");
  const arcadaInf = document.getElementById("arcada-inferior");
  if (arcadaSup) arcadaSup.innerHTML = "";
  if (arcadaInf) arcadaInf.innerHTML = "";
}

function pintar(proc) {
  const dente = document.querySelector(`[data-dente="${proc.dente}"]`);
  if (!dente) return;
  if (proc.tipo === "Aparelho Ortodôntico") {
    dente.querySelectorAll(".face").forEach(f => {
      f.style.fill = proc.cor;
    });
    return;
  }
  const face = dente.querySelector(`[data-face="${proc.face}"]`);
  if (!face) return;
  face.style.fill = proc.cor;
}

async function carregarCardAgendamento(pacienteId) {
  const card = document.getElementById("card-agendamento");
  if (!card) return;
  try {
    const agendamentos = await api(`/api/agendamentos/${pacienteId}`);
    if (!agendamentos.length) {
      card.innerHTML = "<strong>Sem agendamentos</strong>";
      return;
    }
    const ultimo = agendamentos[0];
    const [data, hora] = ultimo.data_hora.split(" ");
    card.innerHTML = `
      <h4>📅 Agendamento</h4>
      <p><strong>Data:</strong> ${data}</p>
      <p><strong>Hora:</strong> ${hora}</p>
      <p><strong>Dentista:</strong> ${ultimo.dentista}</p>`;
  } catch (e) {
    card.innerHTML = "<strong>Erro ao carregar agenda</strong>";
    console.error(e);
  }
}

function renderizarOdontograma() {
  const sup = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
  const inf = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];
  const top = document.getElementById("arcada-superior");
  const bottom = document.getElementById("arcada-inferior");
  if (!top || !bottom) return;
  top.innerHTML = "";
  bottom.innerHTML = "";
  sup.forEach(n => top.appendChild(criarDente(n)));
  inf.forEach(n => bottom.appendChild(criarDente(n)));
  setTimeout(() => {
  procedimentosAtuais.forEach(p => pintar(p));
}, 50);
}

function criarDente(numero) {
  const d = document.createElement("div");
  d.className = "dente-wrapper";
  d.dataset.dente = numero;
  d.innerHTML = `
    <div class="dente-numero">${numero}</div>
    <svg viewBox="0 0 100 120">
      <path d="M30,15 Q50,0 70,15 Q88,35 82,60 Q78,95 50,108 Q22,95 18,60 Q12,35 30,15 Z"
        fill="#fff"/>
        <rect class="face" data-face="oclusal" x="35" y="45" width="30" height="30"/>
        <rect class="face" data-face="mesial" x="18" y="45" width="16" height="30"/>
        <rect class="face" data-face="distal" x="66" y="45" width="16" height="30"/>
        <rect class="face" data-face="vestibular" x="34" y="18" width="32" height="25"/>
        <rect class="face" data-face="lingual" x="34" y="80" width="32" height="25"/>
    </svg>
  `;

  d.querySelectorAll(".face").forEach(face => {
    face.onclick = () => {
      denteSelecionado = numero;
      faceSelecionada = face.dataset.face;
      abrirModalProcedimento();
    };
  });
  return d;
}

/* ================= PROCEDIMENTOS ================= */
function abrirModalProcedimento() {
  document.getElementById("modal-odontograma").style.display = "flex";
  document.getElementById("numero-dente-selecionado").innerHTML =
    `Dente ${denteSelecionado} - Face: <strong>${faceSelecionada}</strong>`;
}

function fecharModalProcedimento() {
  document.getElementById("modal-odontograma").style.display = "none";
}

async function confirmarProcedimento() {
  const tipo = document.getElementById("select-procedimento-tipo").value;

  const novoProc = {
    paciente_id: pacienteSelecionado,
    dente: denteSelecionado,
    face: faceSelecionada,
    tipo,
    cor: PROCEDIMENTOS[tipo] || "#38bdf8"
  };
  procedimentosAtuais.push(novoProc);
  try {
    await api("/api/salvar-odontograma", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paciente_id: pacienteSelecionado,
        procedimentos: procedimentosAtuais
      })
    });
    mostrarToast("Procedimento salvo!");
  } catch (e) {
    console.error(e);
    alert("Erro ao salvar procedimento");
  }
  renderizarLista();
  renderizarOdontograma();
  fecharModalProcedimento();
}

function gerarCorAleatoria() {
  const cores = ["#3b82f6", "#ef4444", "#22c55e", "#8b5cf6", "#f59e0b"];
  return cores[Math.floor(Math.random() * cores.length)];
  cor: gerarCorAleatoria()
}

async function confirmarAgendamento() {
  const paciente = document.getElementById("select-paciente-agendamento")?.value;
  const dentista = document.getElementById("select-dentista-agenda")?.value;
  if (!paciente) return alert("Selecione paciente");
  if (!horarioSelecionado) return alert("Selecione horário");
  try {
    await api("/api/agenda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paciente_id: Number(paciente),
        dentista,
        data_hora: `${dataSelecionada} ${horarioSelecionado}`
      })
    });
    fecharModalAgenda();
    renderizarAgenda();
  } catch (e) {
    console.error(e);
    alert("Erro ao agendar");
  }
}

function renderizarListaPacientes(lista) {
  const container = document.getElementById("lista-pacientes");
  if (!container) return;
  container.innerHTML = "";
  lista.forEach(p => {
    const div = document.createElement("div");
    div.className = "paciente-item";
    div.innerHTML = `
      <strong>${p.nome}</strong><br>
      <small>${p.cpf || ""}</small>
    `;
    div.onclick = () => abrirOdontogramaPaciente(p);
    container.appendChild(div);
  });
}

function renderizarLista() {
  const ul = document.getElementById("lista-procedimentos-lancados");
  ul.innerHTML = "";
  procedimentosAtuais.forEach(p => {
    const li = document.createElement("li");
    if (p.tipo === "Aparelho Ortodôntico") {
      li.innerHTML = `🦷 ${p.tipo} (${p.face})`;
    } else {
      li.innerHTML = `🦷 Dente ${p.dente} - ${p.tipo} (${p.face})`;
    }
    li.style.borderLeft = `6px solid ${p.cor}`;
    ul.appendChild(li);
  });
}
/* ================= MÁSCARAS ================= */
function aplicarMascaras() {
  const cpf = (id) => {
    const el = document.getElementById(id);
    el?.addEventListener("input", e => {
      let v = e.target.value.replace(/\D/g, "").slice(0, 11);
      v = v.replace(/(\d{3})(\d)/, "$1.$2");
      v = v.replace(/(\d{3})(\d)/, "$1.$2");
      v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
      e.target.value = v;
    });
  };

  const phone = (id) => {
    const el = document.getElementById(id);
    el?.addEventListener("input", e => {
      let v = e.target.value.replace(/\D/g, "").slice(0, 11);
      v = v.replace(/(\d{2})(\d)/, "($1) $2");
      v = v.replace(/(\d{5})(\d)/, "$1-$2");
      e.target.value = v;
    });
  };

  const date = (id) => {
    const el = document.getElementById(id);
    el?.addEventListener("input", e => {
      let v = e.target.value.replace(/\D/g, "").slice(0, 8);
      v = v.replace(/(\d{2})(\d)/, "$1/$2");
      v = v.replace(/(\d{2})(\d)/, "$1/$2");
      e.target.value = v;
    });
  };

  cpf("cpf-paciente");
  phone("celular-paciente");
  date("nascimento-paciente");
}

/* ================= CADASTRO ================= */
async function enviarCadastro() {
  try {
    const nome = document.getElementById("nome-paciente").value;
    const cpf = document.getElementById("cpf-paciente").value;
    const nascimento = document.getElementById("nascimento-paciente").value;
    const contato = document.getElementById("celular-paciente").value;
    const alergias = document.getElementById("input-alergias-cadastro").value;
    if (!nome) return alert("Nome obrigatório");
    await api("/api/pacientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome,
        cpf,
        data_nascimento: nascimento,
        contato,
        alergias
      })
    });
    document.querySelectorAll("#secao-cadastro input")
      .forEach(i => i.value = "");
    mostrarToast("Paciente cadastrado com sucesso!");
    await carregarPacientesLista();
    carregarDashboard();
  } catch (err) {
    console.error("Erro ao salvar paciente:", err);
    alert("Erro ao salvar paciente.");
  }
}

function filtrarPacientes() {
  const termo = document.getElementById("busca-paciente")?.value?.trim().toLowerCase();
  const container = document.getElementById("lista-pacientes");
  container.innerHTML = "";
  if (!termo) return;  
  const filtrados = pacientesCache.filter(p =>
    p.nome.toLowerCase().includes(termo) ||
    (p.cpf || "").includes(termo)
  );
  filtrados.forEach(p => {
    const div = document.createElement("div");
    div.innerHTML = `<strong>${p.nome}</strong><br><small>${p.cpf || ""}</small>`;
    div.onclick = () => {
      document.getElementById("busca-paciente").value = p.nome;
      document.getElementById("lista-pacientes").innerHTML = "";
      abrirOdontogramaPaciente(p);
    };
    container.appendChild(div);
  });
}

function filtrarSelectAgenda() {
  const termo = document.getElementById("busca-modal-paciente").value.toLowerCase();
  const select = document.getElementById("select-paciente-agendamento");
  if (!select.dataset.full) {
    select.dataset.full = JSON.stringify(pacientesCache);
  }
  const pacientes = JSON.parse(select.dataset.full || "[]");
  const filtrados = pacientes.filter(p =>
    p.nome.toLowerCase().includes(termo) ||
    (p.cpf || "").includes(termo)
  );
  select.innerHTML = "";
  filtrados.forEach(p => {
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = `${p.nome} - ${p.cpf || ""}`;
    select.appendChild(option);
  });
}

async function salvarOdontogramaCompleto() {
  if (!pacienteSelecionado) return;
  try {
    await api("/api/salvar-odontograma", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paciente_id: pacienteSelecionado,
        procedimentos: procedimentosAtuais
      })
    });
    mostrarToast("Odontograma salvo com sucesso!");
  } catch (e) {
    console.error(e);
    alert("Erro ao salvar odontograma");
  }
}

/* ================= TOAST ================= */
function mostrarToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.innerText = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2000);
}