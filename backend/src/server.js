// backend/src/server.js
require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const connectDB = require('./config/database');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');

// Importer les routes
const authRoutes = require('./routes/authRoutes');
const sfdRoutes = require('./routes/sfdRoutes');
const contratRoutes = require('./routes/contratRoutes');
const reportingRoutes = require('./routes/reportingRoutes');
const sinistreRoutes = require('./routes/sinistreRoutes');
const assureurRoutes = require('./routes/assureurRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const crRoutes = require('./routes/crRoutes');
const factureRoutes = require('./routes/factureRoutes');
const jobRoutes = require('./routes/jobRoutes');
const statistiqueRoutes = require('./routes/statistiqueRoutes');
const preuvePaiementRoutes = require('./routes/preuvePaiementRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// 1. CONNEXION À LA BASE DE DONNÉES
// ============================================================
connectDB();

// ============================================================
// 2. MIDDLEWARES
// ============================================================

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5000',
      'https://micro-frontend.netlify.app',
      'https://micro-assurance-frontend.vercel.app',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============================================================
// 3. ROUTES API
// ============================================================

app.use('/api/auth', authRoutes);
app.use('/api/sfd', sfdRoutes);
app.use('/api/contrats', contratRoutes);
app.use('/api/reporting', reportingRoutes);
app.use('/api/sinistres', sinistreRoutes);
app.use('/api/assureurs', assureurRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/cr', crRoutes);
app.use('/api/factures', factureRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/statistiques', statistiqueRoutes);
app.use('/api/preuves-paiement', preuvePaiementRoutes);
app.use('/api/users', userRoutes);
// ============================================================
// 4. ROUTES DE SERVICE
// ============================================================

app.get('/api/health', (req, res) => {
  const mongoState = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  res.json({
    status: 'OK',
    uptime: process.uptime(),
    message: 'API du système de gestion micro-assurance ADI',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: states[mongoState] || 'unknown',
      name: mongoose.connection.name || 'non connecté',
      host: mongoose.connection.host || 'non connecté',
    },
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Bienvenue sur l\'API de gestion micro-assurance ADI',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      sfd: '/api/sfd',
      contrats: '/api/contrats',
      reporting: '/api/reporting',
      sinistres: '/api/sinistres',
      assureurs: '/api/assureurs',
      dashboard: '/api/dashboard',
      cr: '/api/cr',
      factures: '/api/factures',
      jobs: '/api/jobs',
      statistiques: '/api/statistiques',
    },
  });
});

// ============================================================
// 5. GESTION DES ERREURS (middleware centralisé)
// ============================================================

app.use(notFoundHandler);
app.use(errorHandler);

// ============================================================
// 6. DÉMARRAGE DES WORKERS (optionnel)
// ============================================================

const { REDIS_AVAILABLE } = require('./services/queueService');

if (REDIS_AVAILABLE) {
  try {
    const {
      createImportWorker,
      createClotureWorker,
      createFactureWorker,
    } = require('./workers/importWorker');

    createImportWorker();
    createClotureWorker();
    createFactureWorker();

    console.log('👷 Workers asynchrones démarrés:');
    console.log('   - Import reporting');
    console.log('   - Génération clôture');
    console.log('   - Génération facture');
  } catch (error) {
    console.warn('⚠️ Erreur démarrage workers:', error.message);
  }
} else {
  console.log('ℹ️ Mode synchrone uniquement (Redis désactivé)');
  console.log('📌 Routes disponibles:');
  console.log('   ✅ /api/reporting/import (synchrone)');
  console.log('   ✅ Toutes les autres routes');
}

// ============================================================
// 7. DÉMARRAGE DU SERVEUR
// ============================================================

app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📊 Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log('='.repeat(50));
  console.log(`🔍 Health check:  http://localhost:${PORT}/api/health`);
  console.log(`🔐 Auth:          http://localhost:${PORT}/api/auth`);
  console.log(`📂 SFD:           http://localhost:${PORT}/api/sfd`);
  console.log(`📄 Contrats:      http://localhost:${PORT}/api/contrats`);
  console.log(`📋 Reporting:     http://localhost:${PORT}/api/reporting`);
  console.log(`🚨 Sinistres:     http://localhost:${PORT}/api/sinistres`);
  console.log(`🏢 Assureurs:     http://localhost:${PORT}/api/assureurs`);
  console.log(`📊 Dashboard:     http://localhost:${PORT}/api/dashboard`);
  console.log(`📈 CR:            http://localhost:${PORT}/api/cr`);
  console.log(`📄 Factures:      http://localhost:${PORT}/api/factures`);
  console.log(`📦 Jobs:          http://localhost:${PORT}/api/jobs`);
  console.log(`📈 Stats:         http://localhost:${PORT}/api/statistiques`);
  console.log('='.repeat(50));
});

module.exports = app;