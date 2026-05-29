const STORAGE_KEY = 'nutriVES_static_v1';
const root = document.getElementById('app');

const state = {
  user: null,
  patients: [],
  consultations: []
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved === 'object') {
      state.user = saved.user || null;
      state.patients = Array.isArray(saved.patients) ? saved.patients : [];
      state.consultations = Array.isArray(saved.consultations) ? saved.consultations : [];
    }
  } catch (err) {
    state.user = null;
    state.patients = [];
    state.consultations = [];
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatDateTime(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
    full: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  };
}

function calcBMI(weight, heightCm) {
  const w = Number(weight);
  const h = Number(heightCm) / 100;
  if (!w || !h) return null;
  return Math.round((w / (h * h)) * 100) / 100;
}

function diagnosis(bmi) {
  if (bmi === null) return '---';
  if (bmi < 18.5) return 'Bajo Peso';
  if (bmi < 25) return 'Peso Normal';
  if (bmi < 30) return 'Sobrepeso';
  return 'Obesidad';
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getPatient(id) {
  return state.patients.find(patient => patient.id === Number(id));
}

function getConsultations(patientId) {
  return state.consultations
    .filter(item => item.patient_id === Number(patientId))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function createNav() {
  return `
    <nav class="navbar">
      <div class="nav-container">
        <a class="nav-brand" href="#/dashboard">Nutri VES</a>
        <div class="nav-links">
          <a class="nav-link" href="#/dashboard">Pacientes</a>
          <a class="nav-link" href="#/register">Registrar Paciente</a>
          <span class="nav-user">${escapeHTML(state.user || '')}</span>
          <a class="nav-link nav-logout" href="#/logout">Cerrar Sesión</a>
        </div>
      </div>
    </nav>
  `;
}

function renderLoginPage(errorMessage) {
  document.title = 'Nutri VES - Inicio';
  root.innerHTML = `
    <main class="container">
      <div class="login-box">
        <div class="login-header">
          <div class="logo">Nutri VES</div>
          <p class="login-subtitle">Sistema de Gestión Clínica</p>
        </div>
        <form id="loginForm" class="login-form">
          <div class="form-group">
            <label for="nutriName">Nombre del Nutriólogo</label>
            <input type="text" id="nutriName" name="nutriName" placeholder="Escribe tu nombre" required autofocus>
          </div>
          ${errorMessage ? `<p class="error-msg">${escapeHTML(errorMessage)}</p>` : ''}
          <button type="submit" class="btn btn-primary btn-full">Ingresar</button>
        </form>
      </div>
    </main>
  `;

  const form = document.getElementById('loginForm');
  form.addEventListener('submit', event => {
    event.preventDefault();
    const name = document.getElementById('nutriName').value.trim();
    if (!name) {
      renderLoginPage('Ingresa tu nombre para continuar');
      return;
    }
    state.user = name;
    saveState();
    location.hash = '#/dashboard';
  });
}

function renderDashboardPage() {
  document.title = 'Nutri VES - Dashboard';

  const patientsHTML = state.patients.length > 0
    ? `<div class="table-container">
         <table class="table">
           <thead>
             <tr>
               <th>ID</th><th>Nombre</th><th>Edad</th><th>Peso (kg)</th><th>Altura (cm)</th><th>IMC</th><th>Diagnóstico</th><th>Registrado</th><th>Acción</th>
             </tr>
           </thead>
           <tbody id="patientsBody">
             ${state.patients.map(patient => `
               <tr data-patient-id="${patient.id}">
                 <td>${patient.id}</td>
                 <td class="cell-name">${escapeHTML(patient.name)}</td>
                 <td class="cell-age">${patient.age}</td>
                 <td class="cell-weight">${patient.weight}</td>
                 <td class="cell-height">${patient.height}</td>
                 <td class="cell-bmi"><strong>${patient.bmi}</strong></td>
                 <td class="cell-diagnosis"><span class="diagnosis diagnosis-${patient.diagnosis === 'Bajo Peso' ? 'bajo' : patient.diagnosis === 'Peso Normal' ? 'normal' : patient.diagnosis === 'Sobrepeso' ? 'sobre' : 'obesidad'}">${escapeHTML(patient.diagnosis)}</span></td>
                 <td>${escapeHTML(patient.created_at.slice(0, 10))}</td>
                 <td class="cell-actions">
                   <button class="btn btn-sm btn-secondary btn-edit" data-id="${patient.id}">Editar</button>
                   <a class="btn btn-sm btn-secondary" href="#/patient/${patient.id}">Consultar</a>
                 </td>
               </tr>
             `).join('')}
           </tbody>
         </table>
       </div>`
    : `<div class="empty-state">
         <p>No hay pacientes registrados aún.</p>
         <a class="btn btn-primary" href="#/register">Registrar Primer Paciente</a>
       </div>`;

  root.innerHTML = `
    ${createNav()}
    <main class="container">
      <div class="dashboard-header">
        <h1>Pacientes Registrados</h1>
        <a class="btn btn-primary" href="#/register">+ Nuevo Paciente</a>
      </div>
      ${patientsHTML}
    </main>
    <div id="editModal" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h2>Editar Paciente</h2>
          <span id="closeModal" class="modal-close">&times;</span>
        </div>
        <form id="editForm">
          <input type="hidden" id="editId" name="id">
          <div class="form-group">
            <label for="editName">Nombre Completo</label>
            <input type="text" id="editName" name="name" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="editWeight">Peso (kg)</label>
              <input type="number" id="editWeight" name="weight" step="0.1" min="1" max="500" required>
            </div>
            <div class="form-group">
              <label for="editHeight">Altura (cm)</label>
              <input type="number" id="editHeight" name="height" step="0.1" min="50" max="250" required>
            </div>
            <div class="form-group">
              <label for="editAge">Edad</label>
              <input type="number" id="editAge" name="age" min="0" max="150" required>
            </div>
          </div>
          <div class="bmi-preview" id="editBmiPreview" style="display:none;">
            <div class="bmi-value">IMC: <span id="editBmiValue">--</span></div>
            <div class="bmi-diagnosis">Diagnóstico: <span id="editBmiDiagnosis">--</span></div>
          </div>
          <div id="editError" class="error-msg" style="display:none;"></div>
          <button type="submit" class="btn btn-primary btn-full" id="editSubmitBtn">Guardar Cambios</button>
        </form>
      </div>
    </div>
  `;

  const modal = document.getElementById('editModal');
  const closeModal = document.getElementById('closeModal');
  const editForm = document.getElementById('editForm');
  const editId = document.getElementById('editId');
  const editName = document.getElementById('editName');
  const editWeight = document.getElementById('editWeight');
  const editHeight = document.getElementById('editHeight');
  const editAge = document.getElementById('editAge');
  const editBmiPreview = document.getElementById('editBmiPreview');
  const editBmiValue = document.getElementById('editBmiValue');
  const editBmiDiagnosis = document.getElementById('editBmiDiagnosis');
  const editError = document.getElementById('editError');

  function refreshBmi() {
    const bmi = calcBMI(editWeight.value, editHeight.value);
    if (bmi !== null) {
      editBmiPreview.style.display = 'flex';
      editBmiValue.textContent = bmi;
      editBmiDiagnosis.textContent = diagnosis(bmi);
    } else {
      editBmiPreview.style.display = 'none';
    }
  }

  editWeight.addEventListener('input', refreshBmi);
  editHeight.addEventListener('input', refreshBmi);

  document.querySelectorAll('.btn-edit').forEach(button => {
    button.addEventListener('click', () => {
      const patient = getPatient(button.dataset.id);
      if (!patient) return;
      editId.value = patient.id;
      editName.value = patient.name;
      editWeight.value = patient.weight;
      editHeight.value = patient.height;
      editAge.value = patient.age;
      editError.style.display = 'none';
      modal.style.display = 'flex';
      refreshBmi();
    });
  });

  function hideModal() {
    modal.style.display = 'none';
    editError.style.display = 'none';
  }

  closeModal.addEventListener('click', hideModal);
  modal.addEventListener('click', event => {
    if (event.target === modal) hideModal();
  });

  editForm.addEventListener('submit', event => {
    event.preventDefault();
    const id = Number(editId.value);
    const name = editName.value.trim();
    const weight = Number(editWeight.value);
    const height = Number(editHeight.value);
    const age = Number(editAge.value);

    if (!name || !weight || !height || !age || weight <= 0 || height <= 0 || age <= 0) {
      editError.textContent = 'Todos los campos son obligatorios y deben ser valores positivos.';
      editError.style.display = 'block';
      return;
    }

    const patient = getPatient(id);
    if (!patient) {
      editError.textContent = 'Paciente no encontrado.';
      editError.style.display = 'block';
      return;
    }

    const bmi = calcBMI(weight, height);
    const diag = diagnosis(bmi);
    patient.name = name;
    patient.weight = weight;
    patient.height = height;
    patient.age = age;
    patient.bmi = bmi;
    patient.diagnosis = diag;
    saveState();
    hideModal();
    renderDashboardPage();
  });
}

function renderRegisterPage(errorMessage) {
  document.title = 'Nutri VES - Registrar Paciente';
  root.innerHTML = `
    ${createNav()}
    <main class="container">
      <div class="form-card">
        <h1>Registrar Paciente</h1>
        <p class="form-subtitle">Agrega un nuevo paciente y registra su IMC.</p>
        <form id="registerForm" class="form">
          <div class="form-group">
            <label for="patientName">Nombre completo</label>
            <input type="text" id="patientName" name="name" placeholder="Nombre del paciente" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="patientAge">Edad</label>
              <input type="number" id="patientAge" name="age" min="1" max="150" required>
            </div>
            <div class="form-group">
              <label for="patientWeight">Peso (kg)</label>
              <input type="number" id="patientWeight" name="weight" step="0.1" min="1" max="500" required>
            </div>
            <div class="form-group">
              <label for="patientHeight">Altura (cm)</label>
              <input type="number" id="patientHeight" name="height" step="0.1" min="50" max="250" required>
            </div>
          </div>
          <div id="registerBmiPreview" class="bmi-preview" style="display:none;">
            <div class="bmi-value">IMC: <span id="registerBmiValue">--</span></div>
            <div class="bmi-diagnosis">Diagnóstico: <span id="registerBmiDiagnosis">--</span></div>
          </div>
          ${errorMessage ? `<p class="error-msg">${escapeHTML(errorMessage)}</p>` : ''}
          <button type="submit" class="btn btn-primary btn-full">Guardar Paciente</button>
        </form>
      </div>
    </main>
  `;

  const form = document.getElementById('registerForm');
  const weightField = document.getElementById('patientWeight');
  const heightField = document.getElementById('patientHeight');
  const bmiPreview = document.getElementById('registerBmiPreview');
  const bmiValue = document.getElementById('registerBmiValue');
  const bmiDiagnosis = document.getElementById('registerBmiDiagnosis');

  function refreshBmi() {
    const bmi = calcBMI(weightField.value, heightField.value);
    if (bmi !== null) {
      bmiPreview.style.display = 'flex';
      bmiValue.textContent = bmi;
      bmiDiagnosis.textContent = diagnosis(bmi);
    } else {
      bmiPreview.style.display = 'none';
    }
  }

  weightField.addEventListener('input', refreshBmi);
  heightField.addEventListener('input', refreshBmi);

  form.addEventListener('submit', event => {
    event.preventDefault();
    const formData = new FormData(form);
    const name = formData.get('name').trim();
    const weight = Number(formData.get('weight'));
    const height = Number(formData.get('height'));
    const age = Number(formData.get('age'));

    if (!name || !weight || !height || !age || weight <= 0 || height <= 0 || age <= 0) {
      renderRegisterPage('Todos los campos son obligatorios y deben ser valores positivos.');
      return;
    }

    const bmi = calcBMI(weight, height);
    const diag = diagnosis(bmi);
    const id = state.patients.length > 0 ? Math.max(...state.patients.map(p => p.id)) + 1 : 1;
    const stamp = formatDateTime();

    state.patients.push({
      id,
      name,
      age,
      weight,
      height,
      bmi,
      diagnosis: diag,
      created_at: stamp.full,
      registered_by: state.user
    });

    saveState();
    location.hash = '#/dashboard';
  });
}

function renderPatientDetailPage(patientId, errorMessage) {
  const patient = getPatient(patientId);
  if (!patient) {
    location.hash = '#/dashboard';
    return;
  }

  const consultations = getConsultations(patientId);
  document.title = `Nutri VES - Consulta: ${patient.name}`;
  root.innerHTML = `
    ${createNav()}
    <main class="container">
      <div class="patient-header">
        <div class="patient-info">
          <h1>${escapeHTML(patient.name)}</h1>
          <div class="patient-meta">
            <span>Edad: ${patient.age} años</span>
            <span>Peso: ${patient.weight} kg</span>
            <span>Altura: ${patient.height} cm</span>
            <span>IMC: <strong>${patient.bmi}</strong></span>
            <span class="diagnosis diagnosis-${patient.diagnosis === 'Bajo Peso' ? 'bajo' : patient.diagnosis === 'Peso Normal' ? 'normal' : patient.diagnosis === 'Sobrepeso' ? 'sobre' : 'obesidad'}">${escapeHTML(patient.diagnosis)}</span>
          </div>
        </div>
        <a class="btn btn-secondary" href="#/dashboard">← Volver</a>
      </div>

      <div class="consultation-layout">
        <div class="consultation-form-card">
          <h2>Nueva Consulta</h2>
          <form id="consultationForm" class="form">
            <div class="form-group">
              <label for="evolution">Evolución del Paciente</label>
              <textarea id="evolution" name="evolution" rows="4" placeholder="Describe la evolución del paciente..." required></textarea>
            </div>
            <div class="form-group">
              <label for="dietPlan">Plan de Alimentación</label>
              <textarea id="dietPlan" name="diet_plan" rows="4" placeholder="Describe el plan de alimentación..." required></textarea>
            </div>
            ${errorMessage ? `<p class="error-msg">${escapeHTML(errorMessage)}</p>` : ''}
            <button type="submit" class="btn btn-primary btn-full">Guardar Consulta</button>
          </form>
        </div>

        <div class="history-card">
          <h2>Historial de Consultas</h2>
          <div id="consultationsList" class="consultations-list">
            ${consultations.length > 0 ? consultations.map(c => `
              <div class="consultation-entry">
                <div class="entry-header">
                  <span class="entry-date">${c.date} ${c.time}</span>
                  <span class="entry-doctor">Atendió: ${escapeHTML(c.nutriologo)}</span>
                </div>
                <div class="entry-body">
                  <div class="entry-section"><strong>Evolución:</strong><p>${escapeHTML(c.evolution)}</p></div>
                  <div class="entry-section"><strong>Plan de Alimentación:</strong><p>${escapeHTML(c.diet_plan)}</p></div>
                </div>
              </div>
            `).join('') : '<p class="empty-text">No hay consultas registradas para este paciente.</p>'}
          </div>
        </div>
      </div>
    </main>
  `;

  const form = document.getElementById('consultationForm');
  form.addEventListener('submit', event => {
    event.preventDefault();
    const evolution = document.getElementById('evolution').value.trim();
    const dietPlan = document.getElementById('dietPlan').value.trim();
    if (!evolution || !dietPlan) {
      renderPatientDetailPage(patientId, 'Debes capturar evolución y plan de alimentación.');
      return;
    }

    const id = state.consultations.length > 0 ? Math.max(...state.consultations.map(c => c.id)) + 1 : 1;
    const stamp = formatDateTime();

    state.consultations.push({
      id,
      patient_id: patient.id,
      date: stamp.date,
      time: stamp.time,
      evolution,
      diet_plan: dietPlan,
      nutriologo: state.user,
      created_at: stamp.full
    });

    saveState();
    renderPatientDetailPage(patientId);
  });
}

function renderNotFoundPage() {
  root.innerHTML = `
    ${createNav()}
    <main class="container">
      <div class="empty-state">
        <p>Ruta no encontrada. Redirigiendo al tablero...</p>
      </div>
    </main>
  `;
  setTimeout(() => { location.hash = '#/dashboard'; }, 1200);
}

function renderApp() {
  const hash = location.hash || '#/login';
  const isLogged = Boolean(state.user);

  if (hash === '#/logout') {
    state.user = null;
    saveState();
    location.hash = '#/login';
    return;
  }

  if (!isLogged && hash !== '#/login') {
    location.hash = '#/login';
    return;
  }

  if (isLogged && hash === '#/login') {
    location.hash = '#/dashboard';
    return;
  }

  if (hash === '#/login') {
    renderLoginPage();
    return;
  }

  if (hash === '#/dashboard') {
    renderDashboardPage();
    return;
  }

  if (hash === '#/register') {
    renderRegisterPage();
    return;
  }

  const patientMatch = hash.match(/^#\/patient\/(\d+)$/);
  if (patientMatch) {
    renderPatientDetailPage(patientMatch[1]);
    return;
  }

  renderNotFoundPage();
}

window.addEventListener('hashchange', renderApp);
window.addEventListener('DOMContentLoaded', () => {
  loadState();
  renderApp();
});
