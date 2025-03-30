// amazon-scraper.js
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

async function downloadImage(url, outputPath) {
  try {
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'arraybuffer'
    });
    
    await fs.writeFile(outputPath, response.data);
    console.log(`Image downloaded to ${outputPath}`);
    return true;
  } catch (error) {
    console.error(`Error downloading image from ${url}:`, error);
    return false;
  }
}

// Function to generate AI summary using Gemini API
async function generateGeminiSummary(productTitle, reviews) {
  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";
    
    // Prepare the review texts
    const reviewTexts = reviews.map(r => `Rating: ${r.rating}/5 - ${r.title}: ${r.text}`).join('\n\n');
    
    // Create the prompt for Gemini
    const prompt = `You are an expert electronics reviewer. Summarize these Amazon reviews of a TV, highlighting the most common pros and cons, notable features, and overall customer sentiment.\n\nHere are reviews for ${productTitle}. Please provide a concise summary:\n\n${reviewTexts}`;
    
    // Make the API request to Gemini
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 800
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Extract the generated text from the response
    if (response.data && 
        response.data.candidates && 
        response.data.candidates[0] && 
        response.data.candidates[0].content && 
        response.data.candidates[0].content.parts && 
        response.data.candidates[0].content.parts[0]) {
      return response.data.candidates[0].content.parts[0].text;
    } else {
      throw new Error("Unexpected response structure from Gemini API");
    }
  } catch (error) {
    console.error('Error generating AI summary with Gemini:', error);
    return 'Error generating AI summary. Please check your Gemini API key and try again.';
  }
}

async function scrapeAmazonProduct(url) {
  console.log(`Starting to scrape: ${url}`);
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set viewport and user agent to mimic a real browser
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Navigate to the product page
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log('Page loaded successfully');
    
    // Wait for main product details to load
    await page.waitForSelector('#productTitle', { timeout: 10000 });
    
    // Extract basic product information
    const productData = await page.evaluate(() => {
      const getTextContent = (selector) => {
        const element = document.querySelector(selector);
        return element ? element.textContent.trim() : null;
      };
      
      const productTitle = getTextContent('#productTitle');
      const rating = getTextContent('.a-icon-star-small .a-icon-alt') || 
                     getTextContent('.a-icon-star .a-icon-alt');
      const numRatings = getTextContent('#acrCustomerReviewText');
      const price = getTextContent('.a-price .a-offscreen') || 
                    getTextContent('.a-price-whole');
      const originalPrice = getTextContent('.a-text-price .a-offscreen');
      
      // Calculate discount percentage if both prices are available
      let discountPercentage = null;
      if (price && originalPrice) {
        const priceValue = parseFloat(price.replace(/[₹,]/g, ''));
        const originalPriceValue = parseFloat(originalPrice.replace(/[₹,]/g, ''));
        if (!isNaN(priceValue) && !isNaN(originalPriceValue) && originalPriceValue > 0) {
          discountPercentage = Math.round((1 - priceValue / originalPriceValue) * 100) + '%';
        }
      }
      
      // Extract bank offers
      const bankOffers = [];
      const offerElements = document.querySelectorAll('#sopp_feature_div .a-box-inner p');
      offerElements.forEach(element => {
        bankOffers.push(element.textContent.trim());
      });
      
      // Extract "About this item" section
      const aboutItems = [];
      const aboutItemElements = document.querySelectorAll('#feature-bullets .a-list-item');
      aboutItemElements.forEach(element => {
        const text = element.textContent.trim();
        if (text && !text.includes('See more')) {
          aboutItems.push(text);
        }
      });
      
      // Extract Product Information section
      const productInfo = {};
      const infoRows = document.querySelectorAll('#productDetails_techSpec_section_1 tr, #productDetails_detailBullets_sections1 tr');
      infoRows.forEach(row => {
        const label = row.querySelector('th')?.textContent.trim();
        const value = row.querySelector('td')?.textContent.trim();
        if (label && value) {
          productInfo[label] = value;
        }
      });
      
      // Additional product details from other sections
      const additionalDetails = {};
      const detailsElements = document.querySelectorAll('.a-section .a-spacing-small');
      detailsElements.forEach(element => {
        const headingElement = element.querySelector('h1, h2, h3, h4, h5');
        if (headingElement) {
          const heading = headingElement.textContent.trim();
          const details = element.textContent.replace(heading, '').trim();
          if (heading && details) {
            additionalDetails[heading] = details;
          }
        }
      });
      
      return {
        title: productTitle,
        rating,
        numRatings,
        currentPrice: price,
        originalPrice,
        discount: discountPercentage,
        bankOffers: bankOffers.length > 0 ? bankOffers : null,
        aboutThisItem: aboutItems,
        productInformation: productInfo,
        additionalDetails
      };
    });
    
    // Extract all product images
    const imageUrls = await page.evaluate(() => {
      const images = [];
      
      // Main product images
      const mainImageElements = document.querySelectorAll('#altImages .a-button-text img');
      mainImageElements.forEach(img => {
        const src = img.getAttribute('src');
        if (src && !src.includes('video')) {
          // Convert thumbnail to full-size image URL
          const fullSizeUrl = src.replace(/_S[CX]\d+_/, '_SL1500_');
          images.push(fullSizeUrl);
        }
      });
      
      // Images from "From the Manufacturer" section
      const manufacturerImages = document.querySelectorAll('#aplus img');
      manufacturerImages.forEach(img => {
        const src = img.getAttribute('src');
        if (src && !src.includes('video')) {
          images.push(src);
        }
      });
      
      return images;
    });
    
    // Extract customer reviews for AI summarization
    const reviews = await page.evaluate(() => {
      const reviewElements = document.querySelectorAll('#cm-cr-dp-review-list .a-section.review');
      const reviews = [];
      
      reviewElements.forEach(element => {
        const rating = element.querySelector('.a-icon-star')?.getAttribute('class')?.match(/a-star-(\d)/)?.[1] || null;
        const title = element.querySelector('.a-text-bold')?.textContent.trim() || null;
        const text = element.querySelector('.a-expander-content')?.textContent.trim() || null;
        
        if (text) {
          reviews.push({
            rating: rating ? parseInt(rating) : null,
            title,
            text
          });
        }
      });
      
      return reviews;
    });
    
    // Create a timestamp-based folder to store the results
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const productId = url.match(/\/([A-Z0-9]{10})(?:[/?]|$)/)?.[1] || 'unknown';
    const folderName = `amazon_tv_${productId}_${timestamp}`;
    const outputDir = path.join(__dirname, 'output', folderName);
    
    await fs.mkdir(outputDir, { recursive: true });
    console.log(`Created output directory: ${outputDir}`);
    
    // Download all images
    const imagePromises = [];
    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      const imagePath = path.join(outputDir, `image_${i + 1}.jpg`);
      imagePromises.push(downloadImage(imageUrl, imagePath));
    }
    await Promise.allSettled(imagePromises);
    
    // Generate AI review summary using Gemini if there are reviews
    let aiSummary = null;
    if (reviews.length > 0) {
      try {
        console.log(`Generating Gemini AI summary for ${reviews.length} reviews...`);
        aiSummary = await generateGeminiSummary(productData.title, reviews);
        console.log('Gemini AI summary generated successfully');
      } catch (error) {
        console.error('Error generating Gemini AI summary:', error);
        aiSummary = 'Error generating AI summary. Please check your Gemini API key and try again.';
      }
    } else {
      aiSummary = 'No reviews available for AI summarization.';
    }
    
    // Combine all data
    const completeData = {
      ...productData,
      images: imageUrls,
      reviewsCount: reviews.length,
      aiReviewSummary: aiSummary,
      scrapedAt: new Date().toISOString(),
      sourceUrl: url
    };
    
    // Save to JSON file
    await fs.writeFile(
      path.join(outputDir, 'product_data.json'),
      JSON.stringify(completeData, null, 2)
    );
    console.log('Product data saved to JSON file');
    
    // Generate HTML report
    const htmlReport = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${productData.title} - Amazon Scraper Report</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; color: #333; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #e47911; }
    h2 { color: #0066c0; margin-top: 20px; }
    .price { font-size: 1.2em; font-weight: bold; color: #B12704; }
    .rating { color: #e47911; }
    .discount { color: #B12704; font-weight: bold; }
    .image-gallery { display: flex; flex-wrap: wrap; gap: 10px; margin: 20px 0; }
    .image-gallery img { max-width: 200px; max-height: 200px; object-fit: contain; border: 1px solid #ddd; }
    .info-table { border-collapse: collapse; width: 100%; margin: 15px 0; }
    .info-table th, .info-table td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
    .info-table th { background-color: #f2f2f2; }
    .section { margin-bottom: 30px; }
    .summary { background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="section">
      <h1>${productData.title}</h1>
      <p class="rating">Rating: ${productData.rating} (${productData.numRatings})</p>
      <p class="price">Price: ${productData.currentPrice} 
        ${productData.originalPrice ? `<span style="text-decoration: line-through; color: #565959;">${productData.originalPrice}</span>` : ''}
        ${productData.discount ? `<span class="discount">(${productData.discount} off)</span>` : ''}
      </p>
    </div>
    
    ${productData.bankOffers && productData.bankOffers.length > 0 ? `
    <div class="section">
      <h2>Bank Offers</h2>
      <ul>
        ${productData.bankOffers.map(offer => `<li>${offer}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    
    <div class="section">
      <h2>About This Item</h2>
      <ul>
        ${productData.aboutThisItem.map(item => `<li>${item}</li>`).join('')}
      </ul>
    </div>
    
    <div class="section">
      <h2>Product Images</h2>
      <div class="image-gallery">
        ${imageUrls.map((url, i) => `<img src="image_${i + 1}.jpg" alt="Product image ${i + 1}" />`).join('')}
      </div>
    </div>
    
    <div class="section">
      <h2>Product Information</h2>
      <table class="info-table">
        <tr>
          <th>Attribute</th>
          <th>Value</th>
        </tr>
        ${Object.entries(productData.productInformation).map(([key, value]) => `
        <tr>
          <td>${key}</td>
          <td>${value}</td>
        </tr>
        `).join('')}
      </table>
    </div>
    
    ${aiSummary ? `
    <div class="section">
      <h2>AI-Generated Review Summary (Gemini)</h2>
      <div class="summary">
        ${aiSummary.split('\n').map(paragraph => `<p>${paragraph}</p>`).join('')}
      </div>
    </div>
    ` : ''}
    
    <div class="section">
      <p><small>Scraped from <a href="${url}" target="_blank">${url}</a> on ${new Date().toLocaleString()}</small></p>
    </div>
  </div>
</body>
</html>`;
    
    await fs.writeFile(path.join(outputDir, 'report.html'), htmlReport);
    console.log('HTML report generated successfully');
    
    return {
      success: true,
      data: completeData,
      outputDir,
      message: `Amazon product scraped successfully. Files saved to ${outputDir}`
    };
  } catch (error) {
    console.error('Error during scraping:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to scrape Amazon product'
    };
  } finally {
    await browser.close();
    console.log('Browser closed');
  }
}

module.exports = { scrapeAmazonProduct };

// Direct execution support
if (require.main === module) {
  // Get URL from command line argument
  const url = process.argv[2];
  
  if (!url) {
    console.error('Please provide an Amazon product URL as a command line argument');
    console.log('Example: node amazon-scraper.js "https://www.amazon.in/dp/B0B5TQYPKV"');
    process.exit(1);
  }
  
  scrapeAmazonProduct(url)
    .then(result => {
      if (result.success) {
        console.log(`✅ ${result.message}`);
      } else {
        console.error(`❌ ${result.message}`);
      }
    })
    .catch(err => {
      console.error('Unhandled error:', err);
    });
}