const express = require("express");
const multer = require("multer");
const { BlobServiceClient } = require("@azure/storage-blob");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer setup for file uploads
const upload = multer({ dest: "uploads/" });

// Azure Blob Storage setup
const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);

// Containers
const publicContainerName = "public-memories";
const privateContainerName = "private-memories";

async function listBlobs(containerName) {
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobs = [];
    for await (const blob of containerClient.listBlobsFlat()) {
        blobs.push(blob.name);
    }
    return blobs;
}

// Routes
app.get("/images", async (req, res) => {
    const { container } = req.query;

    if (!container || (container !== "public" && container !== "private")) {
        return res.status(400).send("Invalid container name. Use 'public' or 'private'.");
    }

    const containerName = container === "public" ? publicContainerName : privateContainerName;

    try {
        const blobs = await listBlobs(containerName);
        const blobUrls = blobs.map(blobName => {
            return `https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/${containerName}/${blobName}`;
        });
        res.json(blobUrls);
    } catch (error) {
        console.error("Error fetching blobs:", error);
        res.status(500).send("Failed to fetch images.");
    }
});

app.post("/upload", upload.single("image"), async (req, res) => {
    const file = req.file;
    const { container } = req.body;

    if (!file) {
        return res.status(400).send("No file uploaded.");
    }

    if (!container || (container !== "public" && container !== "private")) {
        return res.status(400).send("Invalid container name. Use 'public' or 'private'.");
    }

    const containerName = container === "public" ? publicContainerName : privateContainerName;

    try {
        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(file.originalname);
        const fs = require("fs");
        const fileStream = fs.createReadStream(file.path);

        await blockBlobClient.uploadStream(fileStream);
        res.send("File uploaded successfully.");
    } catch (error) {
        console.error("Error uploading file:", error);
        res.status(500).send("Failed to upload file.");
    }
});

app.listen(port, () => {
    console.log(`App running at http://localhost:${port}`);
});
