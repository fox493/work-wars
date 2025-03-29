module.exports = {
  layers: [
    {
      name: "Role",
      directory: "layers/Role",
      required: true,
      rarity_weights: {
        "employer": 90,
        "boss-1-star": 6,
        "boss-2-star": 2.5,
        "boss-3-star": 1,
        "boss-4-star": 0.5
      }
    },
    {
      name: "Vest-Armor",
      directory: "layers/Vest-Armor",
      required: false,
      rarity_weights: null
    },
    {
      name: "Type",
      directory: "layers/Type",
      required: true,
      rarity_weights: null
    },
    {
      name: "Tie",
      directory: "layers/Tie",
      required: false,
      rarity_weights: null
    },
    {
      name: "Smoke",
      directory: "layers/Smoke",
      required: false,
      rarity_weights: null
    },
    {
      name: "Shirt-Jacket",
      directory: "layers/Shirt-Jacket",
      required: false,
      rarity_weights: null
    },
    {
      name: "Ninja Outfit",
      directory: "layers/Ninja Outfit",
      required: false,
      rarity_weights: null
    },
    {
      name: "Mouth",
      directory: "layers/Mouth",
      required: false,
      rarity_weights: null
    },
    {
      name: "Mask",
      directory: "layers/Mask",
      required: false,
      rarity_weights: null
    },
    {
      name: "Headphones",
      directory: "layers/Headphones",
      required: false,
      rarity_weights: null
    },
    {
      name: "Headband",
      directory: "layers/Headband",
      required: false,
      rarity_weights: null
    },
    {
      name: "Hat-Helmet",
      directory: "layers/Hat-Helmet",
      required: false,
      rarity_weights: null
    },
    {
      name: "Hair",
      directory: "layers/Hair",
      required: false,
      rarity_weights: null
    },
    {
      name: "Glasses",
      directory: "layers/Glasses",
      required: false,
      rarity_weights: null
    },
    {
      name: "Facial Hair",
      directory: "layers/Facial Hair",
      required: false,
      rarity_weights: null
    },
    {
      name: "Chain",
      directory: "layers/Chain",
      required: false,
      rarity_weights: null
    },
    {
      name: "Cape",
      directory: "layers/Cape",
      required: false,
      rarity_weights: null
    }
  ],
  width: 2000,
  height: 2000,
  description: "Work Wars NFT Collection",
  baseUri: "ipfs://CID/",
  startIndex: 1,
  namePrefix: "Work Wars #",
  outputFormat: { imageFormat: "png", metadataFormat: "json" },
  collectionSize: 1000,
  rarityReportFilename: "rarity-report.xlsx"
}; 