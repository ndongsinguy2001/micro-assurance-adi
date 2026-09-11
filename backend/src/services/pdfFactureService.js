// backend/src/services/pdfFactureService.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * 📄 Service de génération de la facture PDF (commissions IG)
 * Prend un objet Facture complet et génère un PDF professionnel
 */

const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const formatMontant = (value) => {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value || 0);
};

/**
 * Génère la facture PDF à partir d'un objet Facture
 * @param {Object} facture - Objet Facture (déjà persisté)
 * @param {String} outputPath - Chemin complet du PDF à générer
 * @returns {Promise<{success, path, filename, reference}>}
 */
const generateFacturePDF = async (facture, outputPath) => {
  return new Promise((resolve, reject) => {
    try {
      ensureDirectoryExists(path.dirname(outputPath));

      const doc = new PDFDocument({
        margin: 50,
        size: 'A4',
        info: {
          Title: `Facture ${facture.reference}`,
          Author: 'Inclusive Guarantee',
          Subject: `Facture commission IG - ${facture.periode.trimestre}/${facture.periode.annee}`,
        },
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      const startX = 50;
      const endX = 545;
      const moisNoms = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
      ];

      // ============================================================
      // EN-TÊTE
      // ============================================================
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .fillColor('#1a56db')
        .text('Inclusive Guarantee', { align: 'center' });

      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#6b7280')
        .text('Courtier en assurance - Micro-assurance ADI', { align: 'center' })
        .text('Sénégal', { align: 'center' })
        .moveDown(1.5);

      // Titre
      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .fillColor('#1e293b')
        .text('FACTURE', { align: 'center' })
        .moveDown(0.3);

      doc
        .fontSize(11)
        .font('Helvetica')
        .fillColor('#6b7280')
        .text('Commission de courtage IG', { align: 'center' })
        .moveDown(1);

      // Référence et date
      const dateEmission = new Date(facture.dateGeneration).toLocaleDateString('fr-FR');
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#475569')
        .text(`Référence : ${facture.reference}`, { align: 'right' })
        .text(`Date : ${dateEmission}`, { align: 'right' })
        .moveDown(1);

      // Ligne
      doc
        .moveTo(startX, doc.y)
        .lineTo(endX, doc.y)
        .strokeColor('#e2e8f0')
        .stroke()
        .moveDown(1.5);

      // ============================================================
      // DESTINATAIRE
      // ============================================================
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#1e293b')
        .text('DESTINATAIRE', { underline: true })
        .moveDown(0.5);

      doc
        .fontSize(11)
        .font('Helvetica')
        .fillColor('#475569');

      if (facture.contrat?.assureurNom) {
        doc.text(`Assureur : ${facture.contrat.assureurNom}`);
      }
      doc.text(`Contrat : ${facture.contrat?.nom || 'N/A'} (${facture.contrat?.code || 'N/A'})`);
      doc.text(`SFD : ${facture.sfd?.nom || 'N/A'} (${facture.sfd?.code || 'N/A'})`);
      if (facture.sfd?.adresse) {
        doc.text(`Adresse : ${facture.sfd.adresse}`);
      }
      doc.moveDown(1.5);

      // ============================================================
      // OBJET
      // ============================================================
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#1e293b')
        .text('OBJET', { underline: true })
        .moveDown(0.5);

      const moisPeriode = (facture.periode.mois || [])
        .map((m) => moisNoms[m - 1])
        .join(', ');

      doc
        .fontSize(11)
        .font('Helvetica')
        .fillColor('#475569')
        .text(
          `Facture de commission IG pour le trimestre T${facture.periode.trimestre} ${facture.periode.annee} (${moisPeriode || 'N/A'})`
        )
        .moveDown(1.5);

      // ============================================================
      // TABLEAU DES MONTANTS
      // ============================================================
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#1e293b')
        .text('DÉTAILS FINANCIERS', { underline: true })
        .moveDown(0.8);

      let y = doc.y;

      // En-tête du tableau
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#1e293b')
        .text('Libellé', startX, y, { width: 300 })
        .text('Montant (F CFA)', startX + 300, y, { width: 195, align: 'right' });
      y += 18;

      doc
        .moveTo(startX, y)
        .lineTo(endX, y)
        .strokeColor('#cbd5e1')
        .stroke();
      y += 8;

      const lignes = [
        { label: 'Total des primes collectées', value: facture.montants.totalPrimes, bold: false },
        {
          label: `Commission IG (${(facture.montants.tauxCommission * 100).toFixed(0)}%)`,
          value: facture.montants.commissionIG,
          bold: false,
        },
        {
          label: `TVA (${(facture.montants.tauxTVA * 100).toFixed(0)}%)`,
          value: facture.montants.tva,
          bold: false,
        },
        { label: '', value: null, bold: false, separator: true },
        { label: 'TOTAL TTC', value: facture.montants.totalTTC, bold: true },
      ];

      lignes.forEach((ligne) => {
        if (ligne.separator) {
          y += 5;
          doc
            .moveTo(startX, y)
            .lineTo(endX, y)
            .strokeColor('#cbd5e1')
            .stroke();
          y += 8;
          return;
        }

        doc.font(ligne.bold ? 'Helvetica-Bold' : 'Helvetica');
        doc.fillColor(ligne.bold ? '#1e293b' : '#475569');
        doc.fontSize(ligne.bold ? 11 : 10);

        doc.text(ligne.label, startX, y, { width: 300 });
        if (ligne.value !== null) {
          doc.text(formatMontant(ligne.value), startX + 300, y, {
            width: 195,
            align: 'right',
          });
        }
        y += 20;
      });

      doc.y = y + 15;

      // Devise si tauxChange différent de 1
      if (facture.montants.totalTTCDevise && facture.periode.tauxChange !== 1) {
        doc
          .fontSize(10)
          .font('Helvetica-Oblique')
          .fillColor('#6b7280')
          .text(
            `Total TTC en devise : ${formatMontant(facture.montants.totalTTCDevise)} ` +
              `(taux de change : ${facture.periode.tauxChange})`
          )
          .moveDown(1);
      }

      // ============================================================
      // DÉTAILS REPORTINGS
      // ============================================================
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#1e293b')
        .text('REPORTINGS INCLUS', { underline: true })
        .moveDown(0.8);

      y = doc.y;

      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#1e293b');

      doc.text('Mois', startX, y, { width: 100 });
      doc.text('Adhésions', startX + 100, y, { width: 80, align: 'right' });
      doc.text('Exclusions', startX + 180, y, { width: 80, align: 'right' });
      doc.text('Prime totale', startX + 260, y, { width: 235, align: 'right' });
      y += 15;

      doc
        .moveTo(startX, y)
        .lineTo(endX, y)
        .strokeColor('#cbd5e1')
        .stroke();
      y += 6;

      doc.font('Helvetica').fontSize(9).fillColor('#475569');

      (facture.reportings || []).forEach((r) => {
        doc.text(`${moisNoms[r.mois - 1]} ${r.annee}`, startX, y, { width: 100 });
        doc.text(String(r.nombreAdhesions || 0), startX + 100, y, {
          width: 80,
          align: 'right',
        });
        doc.text(String(r.nombreExclusions || 0), startX + 180, y, {
          width: 80,
          align: 'right',
        });
        doc.text(formatMontant(r.totalPrime), startX + 260, y, {
          width: 235,
          align: 'right',
        });
        y += 14;
      });

      // Totaux
      y += 5;
      doc
        .moveTo(startX, y)
        .lineTo(endX, y)
        .strokeColor('#cbd5e1')
        .stroke();
      y += 6;

      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e293b');
      doc.text('TOTAL', startX, y, { width: 100 });
      doc.text(String(facture.details.nombreAdhesions), startX + 100, y, {
        width: 80,
        align: 'right',
      });
      doc.text(String(facture.details.nombreExclusions), startX + 180, y, {
        width: 80,
        align: 'right',
      });
      doc.text(formatMontant(facture.montants.totalPrimes), startX + 260, y, {
        width: 235,
        align: 'right',
      });

      doc.y = y + 25;

      // ============================================================
      // INFORMATIONS DE PAIEMENT
      // ============================================================
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#1e293b')
        .text('INFORMATIONS DE PAIEMENT', { underline: true })
        .moveDown(0.5);

      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#475569')
        .text('Banque : [À renseigner]')
        .text('IBAN : [À renseigner]')
        .text('BIC/SWIFT : [À renseigner]')
        .text(`Référence de paiement : ${facture.reference}`)
        .moveDown(1.5);

      // ============================================================
      // PIED DE PAGE
      // ============================================================
      doc
        .moveTo(startX, doc.y)
        .lineTo(endX, doc.y)
        .strokeColor('#e2e8f0')
        .stroke()
        .moveDown(0.8);

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
        .fillColor('#94a3b8')
        .text(
          `Document généré le ${new Date().toLocaleString('fr-FR')}`,
          { align: 'center' }
        )
        .text('© Inclusive Guarantee - Tous droits réservés', { align: 'center' });

      doc.end();

      stream.on('finish', () => {
        resolve({
          success: true,
          path: outputPath,
          filename: path.basename(outputPath),
          reference: facture.reference,
        });
      });

      stream.on('error', (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  generateFacturePDF,
  ensureDirectoryExists,
};