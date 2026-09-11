const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const generateTestExcel = async () => {
  try {
    // Créer le dossier uploads s'il n'existe pas
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log('📁 Dossier uploads créé');
    }

    const workbook = new ExcelJS.Workbook();
    
    // 1. Onglet Mensuel OK
    const sheetMensuel = workbook.addWorksheet('Mensuel OK');
    
    // En-tête
    const headers = [
      'Guichet', 'Localité du Guichet', 'Identifiant emprunteur', 'Nom emprunteur',
      'Prénom emprunteur', 'Adresse', 'Date de naissance', 'Profession', 'Sexe',
      'date de fin du prêt', 'Mois du reporting', 'Date du prêt', 'durée du prêt',
      'montant du prêt', 'Type de crédit', 'Type de prêt'
    ];
    
    sheetMensuel.addRow(headers);
    
    // Données de test
    const data = [
      ['Agence1', 'Dakar', 'EMP001', 'DIOP', 'Amadou', '123 Rue', '1990-01-01', 'Commerçant', 'M', '2025-12-31', 'JANVIER 2025', '2025-01-01', 12, 500000, 'Personnel', 'Consommation'],
      ['Agence2', 'Thiès', 'EMP002', 'SOW', 'Fatou', '456 Avenue', '1995-06-15', 'Enseignante', 'F', '2025-11-30', 'JANVIER 2025', '2025-01-01', 11, 300000, 'Personnel', 'Logement'],
      ['Agence3', 'Mbour', 'EMP003', 'NDIAYE', 'Moussa', '789 Boulevard', '1985-03-20', 'Transporteur', 'M', '2026-01-15', 'JANVIER 2025', '2025-01-15', 14, 15000000, 'Professionnel', 'Investissement'],
      ['Agence4', 'Kaolack', 'EMP004', 'BA', 'Aminata', '321 Route', '2005-08-10', 'Étudiante', 'F', '2025-08-31', 'JANVIER 2025', '2025-01-10', 8, 100000, 'Personnel', 'Études'],
    ];
    
    data.forEach(row => sheetMensuel.addRow(row));
    
    // 2. Onglet PSB
    const sheetPSB = workbook.addWorksheet('PSB');
    
    const params = [
      ['Âge minimum', 18],
      ['Âge maximum début du prêt', 64],
      ['Âge maximum fin du prêt', 65],
      ['Durée minimum prêt', 1],
      ['Montant maximum du prêt', 14000000],
      ['Taux de prime', 0.0065],
      ['Taux de prime 2', 0.0163],
      ['Taux de frais de gestion', 0.08],
      ['Taxe', 0],
      ['Date d\'effet', '2025-01-01'],
    ];
    
    params.forEach(row => sheetPSB.addRow(row));
    
    // 3. Sauvegarder
    const filePath = path.join(__dirname, '../uploads', 'test_reporting.xlsx');
    await workbook.xlsx.writeFile(filePath);
    console.log(`✅ Fichier de test généré: ${filePath}`);
    console.log(`📊 Contenu: 4 adhésions de test (2 valides, 2 exclusions)`);
    
    // Afficher le résumé
    console.log('\n📋 Résumé des données de test:');
    console.log('  ✅ DIOP Amadou (35 ans, 500k) → VALIDE');
    console.log('  ✅ SOW Fatou (29 ans, 300k) → VALIDE');
    console.log('  ❌ NDIAYE Moussa (39 ans, 15M) → EXCLUSION (montant > 14M)');
    console.log('  ❌ BA Aminata (19 ans, 100k) → EXCLUSION (âge < 18)');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
};

generateTestExcel();