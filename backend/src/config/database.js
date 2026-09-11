// backend/src/config/database.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log(`✅ MongoDB Atlas connecté: ${conn.connection.host}`);
    console.log(`📁 Base de données: ${conn.connection.name}`);
  } catch (error) {
    console.error(`❌ Erreur MongoDB: ${error.message}`);
    console.error('Vérifiez votre URI de connexion et votre mot de passe');
    process.exit(1);
  }
};

module.exports = connectDB;