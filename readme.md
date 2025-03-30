# Amazon TV Scraper

A powerful web scraping tool that extracts detailed information about TV products from Amazon, including product specifications, images, pricing, and customer reviews. The scraper also generates an AI-powered summary of customer reviews using Google's Gemini API.

## Features

- 📋 Extracts comprehensive product information (title, price, ratings, features, etc.)
- 🖼️ Downloads all product images
- 💬 Collects customer reviews
- 🤖 Generates AI summary of reviews using Gemini API
- 📊 Creates structured JSON data output
- 📝 Generates beautiful HTML reports
- 🗂️ Organizes all data in timestamped folders

## Directory Structure

```
scraper/
│
├── amazon-scraper.js     # Main scraper file with all the functionality
├── package.json          # Project dependencies
├── .env                  # Environment variables (for API keys)
├── README.md             # Project documentation
└── output/               # Folder where scraped data is saved
    └── amazon_tv_[product-id]_[timestamp]/  # Created for each scrape
        ├── product_data.json              # JSON data
        ├── report.html                    # HTML report
        └── image_1.jpg, image_2.jpg, etc. # Downloaded images
```

## Installation

1. Clone this repository or create a new directory:
   ```bash
   mkdir scraper
   cd scraper
   ```

2. Initialize the project and install dependencies:
   ```bash
   npm init -y
   npm install puppeteer axios
   ```

3. Create the main script file by copying the provided code into `scraper.js`

4. Create an output directory:
   ```bash
   mkdir -p output
   ```

5. Create a `.env` file in the root directory with your Gemini API key:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

## Usage

Run the scraper by providing an Amazon TV product URL:

```bash
node scraper.js "https://www.amazon.in/dp/B0B5TQYPKV"
```

Or use the npm script (after adding it to package.json):

```bash
npm start "https://www.amazon.in/dp/B0B5TQYPKV"
```

## Output

After successful scraping, the program will create a new directory in the `output` folder with a timestamp and product ID. The directory will contain:

- `product_data.json`: All scraped data in JSON format
- `report.html`: A formatted HTML report with all product information
- Multiple image files downloaded from the product page

## Customization

### Visible Browser Mode

By default, the scraper runs in headless mode. If you want to see the browser in action, modify the Puppeteer launch options:

```javascript
const browser = await puppeteer.launch({
  headless: false, // Change from true to false
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
```

### Changing Selectors

If Amazon updates its website structure, you might need to update the CSS selectors used for scraping. These are located in the `page.evaluate()` functions throughout the code.

## Troubleshooting

- **CAPTCHA/Access Issues**: Amazon might block automated scraping. Try adding more delays, rotating user agents, or using proxy services.
- **Missing Gemini API Summary**: Ensure your Gemini API key is valid and properly set in the `.env` file.
- **Dependencies Issues**: Make sure to install all required dependencies with `npm install`.
- **Node Version**: This script requires Node.js version 14 or higher.

## Legal Disclaimer

This tool is provided for educational purposes only. Web scraping may be against the Terms of Service of some websites. Always check Amazon's Terms of Service before using this scraper. Use responsibly and at your own risk.

## Requirements

- Node.js (v14+)
- npm
- Internet connection
- Gemini API key (for review summarization)

## License

This project is licensed under the MIT License - see the LICENSE file for details.