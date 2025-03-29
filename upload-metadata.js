require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');
const pinataSDK = require('@pinata/sdk');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('concurrency', {
    alias: 'c',
    type: 'number',
    default: 3,
    description: 'Number of concurrent uploads'
  })
  .option('force', {
    alias: 'f',
    type: 'boolean',
    default: false,
    description: 'Force upload all files even if already uploaded'
  })
  .help()
  .argv;

// Initialize Pinata SDK
const pinata = pinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_SECRET_API_KEY);
const gateway = process.env.PINATA_GATEWAY || "gateway.pinata.cloud";

// Path to metadata folder
const METADATA_FOLDER = path.join(__dirname, 'output', 'metadata');
const RESULTS_FILE = path.join(__dirname, 'upload-metadata-results.json');

// Function to read and parse a JSON file
async function readJsonFile(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    throw error;
  }
}

// Function to upload a single file to IPFS
async function uploadFileToIPFS(filePath) {
  try {
    const fileName = path.basename(filePath, '.json');
    const fileContent = await readJsonFile(filePath);
    
    console.log(`Uploading ${fileName}...`);
    
    // 使用@pinata/sdk的pinJSONToIPFS方法
    const options = {
      pinataMetadata: {
        name: fileName
      }
    };
    
    const result = await pinata.pinJSONToIPFS(fileContent, options);
    
    console.log(`✅ Uploaded ${fileName} to IPFS: ${result.IpfsHash}`);
    return {
      fileName,
      ipfsHash: result.IpfsHash,
      url: `ipfs://${result.IpfsHash}`,
      gateway: `https://${gateway}/ipfs/${result.IpfsHash}`
    };
  } catch (error) {
    console.error(`❌ Failed to upload ${filePath}:`, error);
    throw error;
  }
}

// Main function to upload all metadata files
async function uploadAllMetadata() {
  try {
    console.log(`🔍 Looking for metadata files in ${METADATA_FOLDER}...`);
    
    // Get list of all JSON files in the metadata folder - using glob sync for compatibility
    const metadataFiles = glob.sync('*.json', { cwd: METADATA_FOLDER });
    console.log(`Found ${metadataFiles.length} metadata files.`);
    
    // Check if results file exists and load it
    let results = {};
    if (fs.existsSync(RESULTS_FILE) && !argv.force) {
      results = await readJsonFile(RESULTS_FILE);
      console.log(`Loaded previous upload results with ${Object.keys(results).length} entries.`);
    }
    
    // Filter files that need to be uploaded
    const filesToUpload = argv.force 
      ? metadataFiles 
      : metadataFiles.filter(file => {
          const fileName = path.basename(file, '.json');
          return !results[fileName];
        });
    
    console.log(`Will upload ${filesToUpload.length} files.`);
    
    if (filesToUpload.length === 0) {
      console.log('No files to upload. Use --force to re-upload all files.');
      return;
    }
    
    // Process files in chunks based on concurrency
    const concurrency = argv.concurrency;
    let processed = 0;
    
    for (let i = 0; i < filesToUpload.length; i += concurrency) {
      const batch = filesToUpload.slice(i, i + concurrency);
      const promises = batch.map(file => {
        const filePath = path.join(METADATA_FOLDER, file);
        return uploadFileToIPFS(filePath);
      });
      
      const batchResults = await Promise.allSettled(promises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const { fileName, ipfsHash, url, gateway } = result.value;
          results[fileName] = { ipfsHash, url, gateway };
        } else {
          console.error(`❌ Failed batch upload for ${batch[index]}:`, result.reason);
        }
      });
      
      processed += batch.length;
      console.log(`Progress: ${processed}/${filesToUpload.length} (${Math.round(processed/filesToUpload.length*100)}%)`);
      
      // Save results after each batch
      await fs.writeJSON(RESULTS_FILE, results, { spaces: 2 });
    }
    
    console.log(`✅ Upload complete! Results saved to ${RESULTS_FILE}`);
    console.log(`Total files uploaded: ${Object.keys(results).length}`);
  } catch (error) {
    console.error('Error in upload process:', error);
  }
}

// Run the upload process
uploadAllMetadata().catch(console.error); 