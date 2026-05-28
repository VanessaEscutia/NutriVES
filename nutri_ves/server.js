const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5000;

const DATA_DIR = path.join(__dirname, 'data');
const PATIENTS_FILE = path.join(DATA_DIR, 'patients.json');
const CONSULTATIONS_FILE = path.join(DATA_DIR, 'consultations.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
[PATIENTS_FILE, CONSULTATIONS_FILE].forEach(f => {
  if (!fs.existsSync(f)) fs.writeFileSync(f, '[]', 'utf-8');
});

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch { return []; }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

function calcBMI(weight, heightCm) {
  const h = heightCm / 100;
  return Math.round((weight / (h * h)) * 100) / 100;
}

function diagnosis(bmi) {
  if (bmi < 18.5) return 'Bajo Peso';
  if (bmi < 25) return 'Peso Normal';
  if (bmi < 30) return 'Sobrepeso';
  return 'Obesidad';
}

function now() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
    full: `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  };
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000
  }
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use((req, res, next) => {
  if (req.path === '/login' || req.path === '/') return next();
  if (req.path.startsWith('/css/')) return next();
  if (!req.session.nutriologo) return res.redirect('/login');
  next();
});

app.get('/', (req, res) => {
  if (req.session.nutriologo) return res.redirect('/dashboard');
  res.redirect('/login');
});

app.route('/login')
  .get((req, res) => {
    if (req.session.nutriologo) return res.redirect('/dashboard');
    res.render('login', { error: null });
  })
  .post((req, res) => {
    const name = (req.body.name || '').trim();
    if (!name) return res.render('login', { error: 'Ingresa tu nombre para continuar' });
    req.session.regenerate(err => {
      if (err) return res.render('login', { error: 'Error al iniciar sesión' });
      req.session.nutriologo = name;
      res.redirect('/dashboard');
    });
  });

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

app.get('/dashboard', (req, res) => {
  const patients = readJSON(PATIENTS_FILE);
  res.render('dashboard', { patients, nutriologo: req.session.nutriologo });
});

app.route('/register')
  .get((req, res) => res.render('register', { error: null, nutriologo: req.session.nutriologo }))
  .post((req, res) => {
    const name = (req.body.name || '').trim();
    const weight = parseFloat(req.body.weight);
    const height = parseFloat(req.body.height);
    const age = parseInt(req.body.age);

    if (!name || !weight || !height || !age || weight <= 0 || height <= 0 || age <= 0) {
      return res.render('register', { error: 'Todos los campos son obligatorios y deben ser valores positivos.', nutriologo: req.session.nutriologo });
    }

    const bmi = calcBMI(weight, height);
    const diag = diagnosis(bmi);
    const patients = readJSON(PATIENTS_FILE);
    const id = (patients.length > 0 ? Math.max(...patients.map(p => p.id)) : 0) + 1;

    patients.push({
      id, name, weight, height, age, bmi, diagnosis: diag,
      created_at: now().full, registered_by: req.session.nutriologo
    });
    writeJSON(PATIENTS_FILE, patients);
    res.redirect('/dashboard');
  });

app.route('/patient/:id')
  .get((req, res) => {
    const patients = readJSON(PATIENTS_FILE);
    const patient = patients.find(p => p.id === parseInt(req.params.id));
    if (!patient) return res.redirect('/dashboard');

    const consultations = readJSON(CONSULTATIONS_FILE)
      .filter(c => c.patient_id === patient.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    res.render('consultation', { patient, consultations, error: null, nutriologo: req.session.nutriologo });
  })
  .post((req, res) => {
    const patients = readJSON(PATIENTS_FILE);
    const patient = patients.find(p => p.id === parseInt(req.params.id));
    if (!patient) return res.redirect('/dashboard');

    const evolution = (req.body.evolution || '').trim();
    const diet_plan = (req.body.diet_plan || '').trim();

    if (!evolution || !diet_plan) {
      const consultations = readJSON(CONSULTATIONS_FILE)
        .filter(c => c.patient_id === patient.id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      return res.render('consultation', { patient, consultations, error: 'Debes capturar evolución y plan de alimentación.', nutriologo: req.session.nutriologo });
    }

    const all = readJSON(CONSULTATIONS_FILE);
    const id = (all.length > 0 ? Math.max(...all.map(c => c.id)) : 0) + 1;
    const stamp = now();

    all.push({
      id, patient_id: patient.id,
      date: stamp.date, time: stamp.time,
      evolution, diet_plan,
      nutriologo: req.session.nutriologo,
      created_at: stamp.full
    });
    writeJSON(CONSULTATIONS_FILE, all);
    res.redirect(`/patient/${patient.id}`);
  });

app.post('/patient/:id/edit', (req, res) => {
  const patients = readJSON(PATIENTS_FILE);
  const idx = patients.findIndex(p => p.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Paciente no encontrado' });

  const name = (req.body.name || '').trim();
  const weight = parseFloat(req.body.weight);
  const height = parseFloat(req.body.height);
  const age = parseInt(req.body.age);

  if (!name || !weight || !height || !age || weight <= 0 || height <= 0 || age <= 0) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios y deben ser valores positivos.' });
  }

  const bmi = calcBMI(weight, height);
  const diag = diagnosis(bmi);

  patients[idx] = {
    ...patients[idx],
    name, weight, height, age, bmi, diagnosis: diag
  };
  writeJSON(PATIENTS_FILE, patients);
  res.json({ success: true, patient: patients[idx] });
});

app.get('/api/patient/:id/consultations', (req, res) => {
  const consultations = readJSON(CONSULTATIONS_FILE)
    .filter(c => c.patient_id === parseInt(req.params.id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  res.json(consultations);
});

app.listen(PORT, () => {
  console.log(`Nutri VES corriendo en http://localhost:${PORT}`);
});
