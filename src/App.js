import React, { useState } from 'react';
import './App.css';



function App() {


  let [messages, setMessages] = useState([]);
  let [loading, setLoading] = useState(false);
  let [invoicedata, setinvoicedata] = useState(null);

  let extractinfo = async (text) => {
    
    let apiKey = process.env.REACT_APP_GEMINI_API_KEY;
    
    let prompt = `Tu es un expert en extraction de données de factures et conversations commerciales.

TEXTE SOURCE:
"""
${text}
"""

EXTRACTION REQUISE:
- Identifie le client (prénom et nom)
- Trouve l'adresse de livraison  
- Liste tous les produits commandés avec quantités et couleurs
- Extrait les prix (unitaire et total)
- Trouve la date de commande si mentionnée
- Trouve la date de livraison si mentionnée

FORMAT JSON STRICT:
{
  "client": {
    "prenom": "string",
    "nom": "string"
  },
  "adresse": "string",
  "produits": [
    {
      "nom": "string",
      "quantite": number,
      "couleur": "string",
      "prix_unitaire": "string"
    }
  ],
  "prix_total": "string",
  "date_commande": "string",
  "date_livraison": "string"
}

RÈGLES:
- Si une information est manquante, utilise ""
- Pour les produits, crée un tableau même avec un seul produit
- Les prix doivent inclure le symbole €
- Sois précis avec les noms français (iPhone, Samsung, etc.)
- Extrait les adresses françaises complètes avec code postal
- Pour la livraison, cherche "livraison", "delivery", "sous X jours"

Réponds UNIQUEMENT avec le JSON, sans texte supplémentaire.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );
    
  

    if (!response.ok) {
      console.error(`HTTP error! status: ${response.status}`);
      return null;
    }
    
    let data = await response.json();
    
    if (!data.candidates || !data.candidates[0]) {
      console.error("No candidates in response");
      return null;
    }
    
    let resultText = data.candidates[0].content.parts[0].text;
    
    let jsonMatch = resultText.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const parsedData = JSON.parse(jsonMatch[0]);
      return parsedData;
    }
    
    return null;
  };




  let uploadimage = async (event) => {
    let file = event.target.files[0];
    if (!file) return;
    
    setLoading(true);
    
    const imageUrl = URL.createObjectURL(file);
    setMessages(prev => [...prev, {
      type: 'user', 
      content: imageUrl,
      isImage: true
    }]);
    
    setMessages(prev => [...prev, {
      type: 'bot',
      content: 'Traitement en cours...'
    }]);

    let Tesseract = (await import('tesseract.js')).default;
    let { data: { text } } = await Tesseract.recognize(file, 'fra');
    
    let invoicedata = await extractinfo(text);

    if (invoicedata) {
      setinvoicedata(invoicedata);
      setMessages(prev => [...prev, {
        type: 'bot', 
        content: `Facture analysée: ${invoicedata.client.prenom} ${invoicedata.client.nom} - ${invoicedata.prix_total}`
      }]);
    } else {
      setMessages(prev => [...prev, {
        type: 'bot',
        content: `Texte extrait: ${text.substring(0, 200)}...`
      }]);
    }
    
    setLoading(false);
  };




  let generatePDF = () => {
    if (!invoicedata) return;
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('FACTURE', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    
    doc.text(`Client: ${invoicedata.client.prenom} ${invoicedata.client.nom}`, 20, 40);
    doc.text(`Adresse: ${invoicedata.adresse}`, 20, 50);
    doc.text(`Date: ${invoicedata.date_commande || new Date().toLocaleDateString('fr-FR')}`, 20, 60);
    doc.text(`Livraison: ${invoicedata.date_livraison || "5 jours ouvrables"}`, 20, 70);
    
    doc.text('Produit', 20, 90);
    doc.text('Quantité', 80, 90);
    doc.text('Couleur', 110, 90);
    doc.text('Prix', 150, 90);
    doc.text('Total', 180, 90);
    
    doc.line(20, 95, 190, 95);
    
    let yPos = 105;
    let total = 0;
    
    invoicedata.produits.forEach(produit => {
      let prixUnitaire = produit.prix_unitaire || '250€';
      let prixNum = parseInt(prixUnitaire) || 250;
      let produitTotal = parseInt(produit.quantite) * prixNum;
      total += produitTotal;
      
      doc.text(produit.nom, 20, yPos);
      doc.text(produit.quantite.toString(), 80, yPos);
      doc.text(produit.couleur, 110, yPos);
      doc.text(prixUnitaire, 150, yPos);
      doc.text(produitTotal + '€', 180, yPos);
      
      yPos += 10;
    });
    
    doc.line(20, yPos + 5, 190, yPos + 5);
    doc.setFont(undefined, 'bold');
    doc.text('TOTAL:', 150, yPos + 15);
    doc.text((invoicedata.prix_total || total + '€'), 180, yPos + 15);
    
    doc.save('facture.pdf');
  };








  return (
    <div className="app">
      <div className="header">
        <h1>creer Facture</h1>
      </div>
      
      <div className="chat">
        {messages.length === 0 && (
          <div className="bot-message">
            <div className="message-bubble">
              Bonjour ! Uploader une image de facture pour commencer.
            </div>
          </div>
        )}
        
        {messages.map((msg, index) => (
          <div key={index} className={msg.type === 'user' ? 'user-message' : 'bot-message'}>
            <div className="message-bubble">
              {msg.isImage ? (
                <img src={msg.content} alt="uploaded" width="200" />
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="bot-message">
            <div className="message-bubble">
              <div className="loading">Traitement en cours...</div>
            </div>
          </div>
        )}
      </div>
  
      <div className="upload">
        <label className="upload-button">
          Uploader une image
          <input 
            type="file" 
            accept="image/*" 
            onChange={uploadimage}
          />
        </label>
      </div>
  
      {invoicedata && (
        <div className="pdf">
          <button onClick={generatePDF} className="pdf-button">
            Generer PDF Facture
          </button>
        </div>
      )}
    </div>
  );



}





export default App;