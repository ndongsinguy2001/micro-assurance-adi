// backend/src/services/pdfService.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * 📄 Service de génération de documents PDF
 * - Appel à cotisation (SFD → Assureur)
 * - Facture IG (IG → Assureur) [déprécié : voir pdfFactureService]
 * - Rapport de sinistres
 */

// ============================================================
// 1. APPEL À COTISATION
// ============================================================

const generateAppelCotisation = async (reporting, sfd, contrat, user, outputPath) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // --- EN-TÊTE ---
      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .fillColor('#1a56db')
        .text('Inclusive Guarantee', { align: 'center' })
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#6b7280')
        .text('Courtier en assurance - Micro-assurance ADI', { align: 'center' })
        .moveDown(2);

      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .fillColor('#1e293b')
        .text('APPEL À COTISATION', { align: 'center' })
        .moveDown(0.5);

      const ref = `AC-${sfd.code}-${reporting.mois}-${reporting.annee}`;
      const date = new Date().toLocaleDateString('fr-FR');

      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#6b7280')
        .text(`Référence : ${ref}`, { align: 'right' })
        .text(`Date : ${date}`, { align: 'right' })
        .moveDown(2);

      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#e2e8f0').moveDown(1.5);

      // --- DESTINATAIRE ---
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#1e293b')
        .text('DESTINATAIRE :', { underline: true })
        .moveDown(0.5);

      doc
        .fontSize(11)
        .font('Helvetica')
        .fillColor('#475569')
        .text(`${sfd.nom}`)
        .text(`Code SFD : ${sfd.code}`)
        .text(`Pays : ${sfd.pays || 'Sénégal'}`)
        .text(`Contact : ${sfd.contact?.nom || 'Non renseigné'}`)
        .text(`Email : ${sfd.contact?.email || 'Non renseigné'}`)
        .moveDown(1.5);

      // --- OBJET ---
      const moisNoms = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
      ];

      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#1e293b')
        .text('OBJET :', { underline: true })
        .moveDown(0.5);

      doc
        .fontSize(11)
        .font('Helvetica')
        .fillColor('#475569')
        .text(
          `Appel à cotisation pour la période du ${moisNoms[reporting.mois - 1]} ${reporting.annee}`
        )
        .moveDown(1.5);

      // --- TABLEAU ---
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#1e293b')
        .text('DÉTAILS FINANCIERS :', { underline: true })
        .moveDown(0.5);

      const startX = 50;
      let y = doc.y;

      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b');
      doc.text('Libellé', startX, y, { width: 250 });
      doc.text('Montant (F CFA)', startX + 300, y, { width: 200, align: 'right' });
      y += 20;

      doc.moveTo(startX, y).lineTo(550, y).stroke('#e2e8f0');
      y += 10;

      doc.fontSize(10).font('Helvetica').fillColor('#475569');

      const rows = [
        ['Total des primes collectées', reporting.totalPrime],
        ['Frais de gestion (8%)', reporting.totalFraisGestion],
        ['Taxes', reporting.totalTaxes],
        ['Montant total dû', reporting.totalMontantDu],
        ['', ''],
        ['Commission SFD (7%)', reporting.commissionSFD],
        ['Commission IG (15%)', reporting.commissionIG],
        ['Commission Assureur (5%)', reporting.commissionAssureur],
        ['', ''],
        [
          'Montant à reverser à l\'assureur',
          reporting.totalMontantDu - reporting.commissionSFD,
        ],
      ];

      rows.forEach((row, index) => {
        const label = row[0];
        const value = row[1];

        if (label === '') {
          y += 5;
          return;
        }

        if (index === rows.length - 1 || label.includes('total') || label.includes('Montant total')) {
          doc.font('Helvetica-Bold').fillColor('#1e293b');
        } else {
          doc.font('Helvetica').fillColor('#475569');
        }

        doc.text(label, startX, y, { width: 250 });

        if (value !== undefined && value !== null) {
          const formatted = new Intl.NumberFormat('fr-FR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(value);
          doc.text(formatted, startX + 300, y, { width: 200, align: 'right' });
        }

        y += 18;
      });

      doc.y = y + 15;

      // --- STATISTIQUES ---
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#1e293b')
        .text('STATISTIQUES :', { underline: true })
        .moveDown(0.5);

      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#475569')
        .text(`Nombre d'adhésions : ${reporting.nombreAdhesions || 0}`)
        .text(`Nombre d'exclusions : ${reporting.nombreExclusions || 0}`)
        .moveDown(1.5);

      // --- PIED ---
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#e2e8f0').moveDown(1);

      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#6b7280')
        .text('Merci de procéder au règlement dans les plus brefs délais.', {
          align: 'center',
        })
        .moveDown(0.5);

      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#94a3b8')
        .text(
          `Document généré le ${new Date().toLocaleString('fr-FR')} par ${user?.nom || 'Système'}`,
          { align: 'center' }
        )
        .text('© Inclusive Guarantee - Tous droits réservés', { align: 'center' });

      doc.end();

      stream.on('finish', () => {
        resolve({
          success: true,
          path: outputPath,
          filename: path.basename(outputPath),
          reference: ref,
        });
      });

      stream.on('error', (error) => reject(error));
    } catch (error) {
      reject(error);
    }
  });
};

// ============================================================
// 2. FACTURE IG (déprécié - utiliser pdfFactureService)
// ============================================================

const generateFactureIG = async (reporting, sfd, contrat, user, outputPath) => {
  // Délègue à pdfFactureService si un objet Facture est passé
  return generateAppelCotisation(reporting, sfd, contrat, user, outputPath);
};

// ============================================================
// 3. RAPPORT DE SINISTRES
// ============================================================

const generateRapportSinistres = async (sinistres, reporting, sfd, outputPath) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // --- EN-TÊTE ---
      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .fillColor('#1a56db')
        .text('Inclusive Guarantee', { align: 'center' })
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#6b7280')
        .text('Courtier en assurance - Micro-assurance ADI', { align: 'center' })
        .moveDown(2);

      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .fillColor('#1e293b')
        .text('RAPPORT DE SINISTRES', { align: 'center' })
        .moveDown(0.5);

      const date = new Date().toLocaleDateString('fr-FR');
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#6b7280')
        .text(`Date : ${date}`, { align: 'right' })
        .moveDown(2);

      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#e2e8f0').moveDown(1.5);

      // --- SFD ---
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#1e293b')
        .text(`SFD : ${sfd.nom} (${sfd.code})`)
        .text(
          `Période : ${reporting.mois}/${reporting.annee}`
        )
        .moveDown(1.5);

      // --- RÉSUMÉ ---
      const sinistresValides = sinistres.filter((s) => s.statut === 'VALIDE');
      const sinistresEnAttente = sinistres.filter((s) => s.statut === 'A_VERIFIER');
      const sinistresPayes = sinistres.filter((s) => s.statut === 'PAYE');

      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#1e293b')
        .text('RÉSUMÉ', { underline: true })
        .moveDown(0.5);

      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#475569')
        .text(`Total des sinistres déclarés : ${sinistres.length}`)
        .text(`En attente : ${sinistresEnAttente.length}`)
        .text(`Validés : ${sinistresValides.length}`)
        .text(`Payés : ${sinistresPayes.length}`)
        .moveDown(1.5);

      // --- LISTE ---
      if (sinistres.length > 0) {
        doc
          .fontSize(12)
          .font('Helvetica-Bold')
          .fillColor('#1e293b')
          .text('LISTE DES SINISTRES', { underline: true })
          .moveDown(0.5);

        let y = doc.y;

        const cols = {
          ref: 40,
          nom: 140,
          montant: 100,
          date: 90,
          statut: 100,
        };

        doc.fontSize(8).font('Helvetica-Bold').fillColor('#1e293b');
        doc.text('N°', 50, y, { width: cols.ref });
        doc.text('Emprunteur', 50 + cols.ref, y, { width: cols.nom });
        doc.text('Montant', 50 + cols.ref + cols.nom, y, { width: cols.montant, align: 'right' });
        doc.text('Date', 50 + cols.ref + cols.nom + cols.montant, y, { width: cols.date });
        doc.text('Statut', 50 + cols.ref + cols.nom + cols.montant + cols.date, y, {
          width: cols.statut,
        });
        y += 15;

        doc.moveTo(50, y).lineTo(550, y).stroke('#e2e8f0');
        y += 5;

        doc.fontSize(8).font('Helvetica').fillColor('#475569');

        sinistres.forEach((sinistre, index) => {
          const nom =
            sinistre.adhesionId?.nomEmprunteur || sinistre.adhesionId?.nom || 'N/A';
          const montant = sinistre.montantSinistre || 0;
          const date = sinistre.dateSinistre
            ? new Date(sinistre.dateSinistre).toLocaleDateString('fr-FR')
            : 'N/A';
          const statut =
            {
              A_VERIFIER: 'À vérifier',
              VALIDE: 'Validé',
              REFUSE: 'Refusé',
              PAYE: 'Payé',
            }[sinistre.statut] || sinistre.statut;

          doc.text(`${index + 1}`, 50, y, { width: cols.ref });
          doc.text(nom, 50 + cols.ref, y, { width: cols.nom });

          const formatted = new Intl.NumberFormat('fr-FR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(montant);
          doc.text(formatted, 50 + cols.ref + cols.nom, y, {
            width: cols.montant,
            align: 'right',
          });

          doc.text(date, 50 + cols.ref + cols.nom + cols.montant, y, { width: cols.date });
          doc.text(statut, 50 + cols.ref + cols.nom + cols.montant + cols.date, y, {
            width: cols.statut,
          });

          y += 15;

          if (y > 750) {
            doc.addPage();
            y = 50;
          }
        });
      }

      doc.moveDown(1.5);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#e2e8f0').moveDown(1);

      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#94a3b8')
        .text('© Inclusive Guarantee - Tous droits réservés', { align: 'center' });

      doc.end();

      stream.on('finish', () => {
        resolve({
          success: true,
          path: outputPath,
          filename: path.basename(outputPath),
        });
      });

      stream.on('error', (error) => reject(error));
    } catch (error) {
      reject(error);
    }
  });
};

// ============================================================
// 4. UTILITAIRE
// ============================================================

const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

module.exports = {
  generateAppelCotisation,
  generateFactureIG,
  generateRapportSinistres,
  ensureDirectoryExists,
};