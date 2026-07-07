// PDF Server - Enhanced PDF Download System
// Handles PDF generation and serving with Arabic path support

const express = require('express');
const fs = require('fs');
const path = require('path');
const ArabicPDFGenerator = require('./html-pdf-generator-enhanced');

const app = express();
const PORT = 3001;

// Middleware
app.use(express.json());
app.use(express.static('output'));

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Generate and serve contract PDF
app.post('/api/pdf/contract', async (req, res) => {
  try {
    console.log('Generating contract PDF...');
    
    const generator = new ArabicPDFGenerator();
    const filename = `contract-${Date.now()}.pdf`;
    const outputPath = path.join(__dirname, '../../output', filename);
    
    await generator.generateContract(req.body, outputPath);
    
    // Verify file exists
    if (!fs.existsSync(outputPath)) {
      throw new Error('PDF file was not generated');
    }
    
    // Get file stats
    const stats = fs.statSync(outputPath);
    console.log(`Contract PDF generated: ${filename}, Size: ${stats.size} bytes`);
    
    // Send file
    res.download(outputPath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Download failed' });
      }
    });
    
  } catch (error) {
    console.error('Contract generation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.stack 
    });
  }
});

// Generate and serve quote PDF
app.post('/api/pdf/quote', async (req, res) => {
  try {
    console.log('Generating quote PDF...');
    
    const generator = new ArabicPDFGenerator();
    const filename = `quote-${Date.now()}.pdf`;
    const outputPath = path.join(__dirname, '../../output', filename);
    
    await generator.generateQuote(req.body, outputPath);
    
    if (!fs.existsSync(outputPath)) {
      throw new Error('PDF file was not generated');
    }
    
    const stats = fs.statSync(outputPath);
    console.log(`Quote PDF generated: ${filename}, Size: ${stats.size} bytes`);
    
    res.download(outputPath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Download failed' });
      }
    });
    
  } catch (error) {
    console.error('Quote generation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.stack 
    });
  }
});

// Generate and serve report PDF
app.post('/api/pdf/report', async (req, res) => {
  try {
    console.log('Generating report PDF...');
    
    const generator = new ArabicPDFGenerator();
    const filename = `report-${Date.now()}.pdf`;
    const outputPath = path.join(__dirname, '../../output', filename);
    
    await generator.generateReport(req.body, outputPath);
    
    if (!fs.existsSync(outputPath)) {
      throw new Error('PDF file was not generated');
    }
    
    const stats = fs.statSync(outputPath);
    console.log(`Report PDF generated: ${filename}, Size: ${stats.size} bytes`);
    
    res.download(outputPath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Download failed' });
      }
    });
    
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.stack 
    });
  }
});

// List available PDFs
app.get('/api/pdf/list', (req, res) => {
  try {
    const outputDir = path.join(__dirname, '../../output');
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const files = fs.readdirSync(outputDir)
      .filter(file => file.endsWith('.pdf'))
      .map(file => {
        const filePath = path.join(outputDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: stats.size,
          created: stats.birthtime,
          url: `/pdf/${file}`
        };
      });
    
    res.json({ success: true, files });
  } catch (error) {
    console.error('List error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve existing PDF
app.get('/pdf/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const outputPath = path.join(__dirname, '../../output', filename);
    
    if (!fs.existsSync(outputPath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.download(outputPath, filename);
  } catch (error) {
    console.error('Serve error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    outputDir: path.join(__dirname, '../../output')
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 PDF Server running on http://localhost:${PORT}`);
  console.log(`📁 Output directory: ${path.join(__dirname, '../../output')}`);
  console.log(`✅ Ready to generate PDFs`);
});

module.exports = app;
