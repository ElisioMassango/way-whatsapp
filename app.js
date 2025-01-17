const express = require("express");
const venom = require("venom-bot");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const helmet = require("helmet");
const QRCode = require("qrcode"); // Para geração de QR Codes
const fs = require("fs");
const path = require("path");
const app = express();

const port = 4000;
const JWT_SECRET = "your-secret-key"; // Substitua por uma chave secreta forte

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());

// Rota para gerar um token
app.get("/generate-token", (req, res) => {
  const token = jwt.sign({ role: "user" }, JWT_SECRET, { expiresIn: "1h" });
  res.json({ token });
});

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  const token = authHeader.split(" ")[1];
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Token inválido" });
    }
    req.user = user;
    next();
  });
};

// Inicia o Venom
venom
  .create({
    session: "apizap",
  })
  .then((client) => start(client))
  .catch((err) => {
    console.error("Erro ao iniciar o Venom:", err);
  });

const start = (client) => {
  // Endpoint para envio de mensagens
  app.post("/send-message", authenticateToken, async (req, res) => {
    const { to, message } = req.body;

    if (!to || !message) {
      return res
        .status(400)
        .json({ error: "Campos 'to' e 'message' são obrigatórios" });
    }

    try {
      await client.sendText(`${to}@c.us`, message);
      res.json({ success: true, message: "Mensagem enviada com sucesso" });
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      res.status(500).json({ error: "Falha ao enviar mensagem" });
    }
  });

  // Endpoint para envio de imagens
  app.post("/send-image", authenticateToken, async (req, res) => {
    const { to, imageUrl, caption } = req.body;

    if (!to || !imageUrl) {
      return res
        .status(400)
        .json({ error: "Campos 'to' e 'imageUrl' são obrigatórios" });
    }

    // Gerar o QR Code
    const fileName = `qrcode-${Date.now()}.png`;
    const filePath = path.resolve(__dirname, fileName);

    const options = {
      errorCorrectionLevel: "H", // High error correction level
      type: "png",
      quality: 1, // Highest quality for PNG
      margin: 1, // Minimal margin
      scale: 10, // High resolution
    };

    try {
      await QRCode.toFile(filePath,imageUrl,options);

      await client.sendImage(`${to}@c.us`, filePath, fileName, caption || "");

      // Apagar o arquivo após o envio
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error("Erro ao excluir o arquivo:", err);
        }
      });

      res.json({ success: true, message: "Imagem enviada com sucesso" });

    } catch (error) {
      console.error("Erro ao enviar imagem:", error);
      res.status(500).json({ error: "Falha ao enviar imagem" });
    }
  });
};

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
