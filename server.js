const express = require("express");
const multer = require("multer");
const session = require("express-session");
const { BlobServiceClient, generateBlobSASQueryParameters, StorageSharedKeyCredential } = require("@azure/storage-blob");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: "your-secret-key", // Change this to a secure key in production
    resave: false,
    saveUninitialized: true,
}));

// Multer setup for file uploads
const upload = multer({ dest: "uploads/" });

// Azure Blob Storage setup
const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient("private-memories"); // Private container name
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;

// Generate SAS token for private container access
function generateSASToken(blobName) {
    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
    const sasOptions = {
        containerName: "private-memories",
        blobName: blobName,
        permissions: "r", // Read permission
        expiresOn: new Date(new Date().valueOf() + 3600 * 1000), // 1 hour expiration
    };

    return generateBlobSASQueryParameters(sasOptions, sharedKeyCredential).toString();
}

// Login route
app.post("/login", (req, res) => {
    const { username, password } = req.body;

    // Replace with your authentication logic
    if (username === "admin" && password === "password") {
        req.session.isAuthenticated = true;
        req.session.userId = "user123"; // Replace with actual user ID from your database
        return res.send({ success: true });
    }
    return res.status(401).send({ success: false, message: "Invalid credentials" });
});

// Logout route
app.post("/logout", (req, res) => {
    req.session.destroy();
    res.send({ success: true });
});

// Upload image route
app.post("/upload", upload.single("image"), async (req, res) => {
    const file = req.file;
    const userId = req.session.userId; // Assume userId is stored in the session upon login

    if (!file || !userId) {
        return res.status(400).send("File or user ID is missing.");
    }

    try {
        const blockBlobClient = containerClient.getBlockBlobClient(`${userId}/${file.originalname}`);
        const fs = require("fs");
        const fileStream = fs.createReadStream(file.path);

        // Upload the file
        await blockBlobClient.uploadStream(fileStream, undefined, undefined, {
            blobHTTPHeaders: { blobContentType: file.mimetype },
        });

        res.send("File uploaded successfully.");
    } catch (error) {
        console.error("Error uploading file:", error);
        res.status(500).send("Failed to upload file.");
    }
});

// Get private images route
app.get("/private-images", async (req, res) => {
    if (!req.session.isAuthenticated || !req.session.userId) {
        return res.status(403).send({ message: "Unauthorized" });
    }

    const userId = req.session.userId;
    const blobs = [];

    try {
        for await (const blob of containerClient.listBlobsFlat({ prefix: `${userId}/` })) {
            const sasToken = generateSASToken(blob.name);
            const url = `https://${accountName}.blob.core.windows.net/private-memories/${blob.name}?${sasToken}`;
            blobs.push(url);
        }
        res.json(blobs);
    } catch (error) {
        console.error("Error fetching private images:", error);
        res.status(500).send({ message: "Failed to fetch images" });
    }
});

app.listen(port, () => {
    console.log(`App running at http://localhost:${port}`);
});
